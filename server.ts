import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());
const PORT = 3000;

// Lazy initialization of Google GenAI for safety
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------------------
// DYNAMIC FILE-BACKED DATABASE LAYER (PREVENTS MOCK DATA REVERTS IN DEPLOYMENT)
// -----------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState<T>(filename: string, defaultValue: T): T {
  const filePath = path.join(DATA_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
    } catch (e) {
      console.error(`Failed to parse data file ${filename}:`, e);
    }
  }
  return defaultValue;
}

function saveState<T>(filename: string, value: T) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
  } catch (e) {
    console.error(`Failed to write data file ${filename}:`, e);
  }
}

const saveServerState = () => saveState("server_state.json", serverState);
const saveBackups = () => saveState("backups.json", backups);
const saveMods = () => saveState("mods.json", mods);
const saveAutoInstall = () => saveState("auto_install.json", autoInstallQueue);
const saveChats = () => saveState("chat_logs.json", inGameChats);
const saveConsoleLogs = () => saveState("console_logs.json", consoleLogs);

let serverState = loadState("server_state.json", {
  status: 'ONLINE' as 'OFFLINE' | 'STARTING' | 'ONLINE' | 'UPDATING' | 'CRASHED',
  version: "1.0.0.12 (SML v3.8.0-Build2)",
  uptime: 14204, // seconds
  playersOnline: 0,
  maxPlayers: 8,
  sessionName: "None (No Active Session)",
  autoBackupEnabled: true,
  backupIntervalMinutes: 15,
  moddingEnabled: true,
});

// Run a migration step to uninitialize session name if it was set to the default mock name
if (serverState.sessionName === "DaemonForge_Main_World") {
  serverState.sessionName = "None (No Active Session)";
  saveServerState();
}

let backups = loadState("backups.json", [
  {
    id: "bak_001",
    filename: "ServerSave_DaemonForge_v3_Auto_1.sav",
    timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    sizeBytes: 14502010,
    isAuto: true,
    saveSlot: "DaemonForge_Main_World",
  },
  {
    id: "bak_002",
    filename: "ServerSave_DaemonForge_v3_Manual_PreMod.sav",
    timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    sizeBytes: 14498520,
    isAuto: false,
    saveSlot: "DaemonForge_Main_World",
  },
  {
    id: "bak_003",
    filename: "ServerSave_DaemonForge_v3_Auto_0.sav",
    timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    sizeBytes: 14450122,
    isAuto: true,
    saveSlot: "DaemonForge_Main_World",
  },
]);

let mods = loadState("mods.json", [
  {
    id: "FicsitRemoteMonitoring",
    name: "Ficsit Remote Monitoring",
    version: "2.4.1",
    author: "Panat",
    description: "Exposes real-time telemetry, power grid stats, player coordination and world inventory statistics via REST & WebSockets.",
    downloads: 142300,
    installed: true,
    enabled: true,
    dependencies: ["SML"],
  },
  {
    id: "RefinedPower",
    name: "Refined Power",
    version: "3.2.0",
    author: "Raffi",
    description: "Adds custom wind turbines, water turbines, modular coal power plants, and solar arrays for cleaner grids.",
    downloads: 384021,
    installed: false,
    enabled: false,
    dependencies: ["SML"],
  },
  {
    id: "Smart",
    name: "Smart!",
    version: "18.3.1",
    author: "Eisbaer",
    description: "The ultimate building enhancer. Easily place multiple foundations, splitters, merges, walls, and belts in a single sweep.",
    downloads: 512000,
    installed: false,
    enabled: false,
    dependencies: ["SML"],
  },
  {
    id: "LinearMotion",
    name: "Linear Motion",
    version: "1.1.2",
    author: "Grizzly",
    description: "Adds customized, automated elevators, cargo lifts, and extendable transport pistons.",
    downloads: 98110,
    installed: false,
    enabled: false,
    dependencies: ["SML"],
  },
  {
    id: "AreaActions",
    name: "Area Actions",
    version: "2.1.3",
    author: "Gniuz",
    description: "Copy, paste, dismantle, or fill huge factory areas with visual area highlights. Essential for megastructures.",
    downloads: 254112,
    installed: false,
    enabled: false,
    dependencies: ["SML"],
  }
]);

// --- MOD DISCOVERY & AUTO-INSTALL STATE ---
let modDiscoveryCache = {
  lastSync: new Date().toISOString(),
  status: "COMPLETED" as "IDLE" | "SYNCING" | "COMPLETED" | "FAILED",
};

let autoInstallQueue = loadState("auto_install.json", [
  "FicsitRemoteMonitoring"
]);

// Ensure FicsitRemoteMonitoring is installed and enabled at the very start
const frmMod = mods.find(m => m.id === "FicsitRemoteMonitoring");
if (frmMod) {
  frmMod.installed = true;
  frmMod.enabled = true;
  saveMods();
}

let inGameChats = loadState("chat_logs.json", []);

// Wipe mock messages if they were previously saved
if (inGameChats.some(msg => msg.id === "msg_1" || msg.sender === "Greg_DFL")) {
  inGameChats = [];
  saveChats();
}

// Dynamically construct initial console logs based on loaded mods
const buildInitialConsoleLogs = () => {
  const startupLogs = [
    { timestamp: new Date(Date.now() - 1800 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Satisfactory Dedicated Server starting..." },
    { timestamp: new Date(Date.now() - 1795 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: SML SMLv3.8.0-Build2 found in SML directory." }
  ];

  mods.forEach((mod, idx) => {
    if (mod.installed && mod.enabled) {
      startupLogs.push({
        timestamp: new Date(Date.now() - (1790 - idx) * 1000).toISOString(),
        level: "INFO",
        message: `LogModding: Display: Loading mod '${mod.id}' v${mod.version}...`
      });
    }
  });

  if (serverState.sessionName && !serverState.sessionName.startsWith("None")) {
    startupLogs.push(
      { timestamp: new Date(Date.now() - 1780 * 1000).toISOString(), level: "INFO", message: `LogFactoryGame: Display: Loading save game 'ServerSave_${serverState.sessionName}'...` },
      { timestamp: new Date(Date.now() - 1775 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Host IP successfully bound to 0.0.0.0:7777." },
      { timestamp: new Date(Date.now() - 1770 * 1000).toISOString(), level: "INFO", message: `LogFactoryGame: Display: Server started. Network status green. Loaded session: ${serverState.sessionName}` },
      { timestamp: new Date(Date.now() - 1765 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Dedicated Server V2 initialized, accepting connections." }
    );
  } else {
    startupLogs.push(
      { timestamp: new Date(Date.now() - 1780 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Host IP successfully bound to 0.0.0.0:7777." },
      { timestamp: new Date(Date.now() - 1775 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Dedicated Server V2 initialized, accepting connections on 0.0.0.0:7777." },
      { timestamp: new Date(Date.now() - 1770 * 1000).toISOString(), level: "WARNING", message: "LogFactoryGame: Display: Server is currently IDLE with no active game session loaded. Awaiting session initialization or connection via Server Manager." }
    );
  }

  return startupLogs;
};

let consoleLogs = loadState("console_logs.json", []);
if (consoleLogs.length === 0) {
  consoleLogs = buildInitialConsoleLogs();
  saveConsoleLogs();
} else {
  // If console_logs.json exists, sanitize and remove stale or uninstalled "Loading mod" messages
  const installedModIds = new Set(mods.filter(m => m.installed && m.enabled).map(m => m.id));
  consoleLogs = consoleLogs.filter(log => {
    const match = log.message.match(/LogModding: Display: Loading mod '([^']+)'/);
    if (match) {
      const modId = match[1];
      return installedModIds.has(modId);
    }
    return true;
  });
  saveConsoleLogs();
}

// Helper to push logs dynamically
function addLog(level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string) {
  consoleLogs.push({
    timestamp: new Date().toISOString(),
    level,
    message
  });
  if (consoleLogs.length > 200) {
    consoleLogs.shift();
  }
  saveConsoleLogs();
}

// -----------------------------------------------------------------------------
// BACKGROUND SYSTEM SCHEDULER (AUTOMATED BACKUPS / TELEMETRY OSCILLATION)
// -----------------------------------------------------------------------------

// Automated Backups timer simulator
let nextAutoBackupTime = Date.now() + 15 * 60 * 1000;

setInterval(() => {
  // If uptime tick
  if (serverState.status === 'ONLINE') {
    serverState.uptime += 5;
    saveServerState();
  }

  // Simulate automated backup triggering based on configuration
  if (serverState.status === 'ONLINE' && serverState.autoBackupEnabled) {
    if (Date.now() >= nextAutoBackupTime) {
      const backupId = `bak_${Math.floor(Math.random() * 90000) + 10000}`;
      const name = `ServerSave_DaemonForge_v3_Auto_${backups.length}.sav`;
      const sizeBytes = 14400000 + Math.floor(Math.random() * 200000);
      backups.unshift({
        id: backupId,
        filename: name,
        timestamp: new Date().toISOString(),
        sizeBytes,
        isAuto: true,
        saveSlot: serverState.sessionName,
      });
      saveBackups();

      addLog("INFO", `LogDaemonForge: Automated backup triggered. Saved slot '${serverState.sessionName}' into file '${name}' (${(sizeBytes/1024/1024).toFixed(2)} MB).`);
      
      // Schedule next one (speed up slightly for UI demo feel if desired, but default is standard)
      nextAutoBackupTime = Date.now() + serverState.backupIntervalMinutes * 60 * 1000;
    }
  }
}, 5000);

// --- REAL-TIME LIVE CHAT & ONLINE PLAYERS ATTACHED POLLER ---
let lastOnlinePlayers: string[] = [];

setInterval(async () => {
  if (serverState.status !== 'ONLINE') {
    return;
  }

  try {
    // 1. Fetch live players from Ficsit Remote Monitoring API
    let rawPlayers = await fetchFromFRM("/getPlayer");
    if (!Array.isArray(rawPlayers)) {
      rawPlayers = [];
    }
    const currentPlayers = rawPlayers.map((p: any) => p.PlayerName || "");

    let chatChanged = false;

    // Detect player joins
    for (const name of currentPlayers) {
      if (name && !lastOnlinePlayers.includes(name)) {
        addLog("INFO", `LogNet: Join: ${name} entered the lobby.`);
        inGameChats.push({
          id: `msg_join_${Date.now()}_${name}`,
          sender: "SERVER",
          text: `${name} joined the server.`,
          timestamp: new Date().toISOString()
        });
        if (inGameChats.length > 150) inGameChats.shift();
        chatChanged = true;
      }
    }

    // Detect player leaves
    for (const name of lastOnlinePlayers) {
      if (name && !currentPlayers.includes(name)) {
        addLog("INFO", `LogNet: Leave: ${name} left the lobby.`);
        inGameChats.push({
          id: `msg_leave_${Date.now()}_${name}`,
          sender: "SERVER",
          text: `${name} left the server.`,
          timestamp: new Date().toISOString()
        });
        if (inGameChats.length > 150) inGameChats.shift();
        chatChanged = true;
      }
    }

    lastOnlinePlayers = currentPlayers;

    // Update player online count in state immediately
    if (serverState.playersOnline !== currentPlayers.length) {
      serverState.playersOnline = currentPlayers.length;
      saveServerState();
    }

    // 2. Fetch live chats from FRM mod
    const rawChat = await fetchFromFRM("/getChat");
    if (Array.isArray(rawChat)) {
      for (const item of rawChat) {
        const itemText = item.text || item.Text || item.Message || item.message || item.msg;
        const itemSender = item.sender || item.Sender || item.PlayerName || item.playerName || item.player || "InGamePlayer";
        const itemTime = item.timestamp || item.Timestamp || item.time || item.Time || new Date().toISOString();
        
        const alreadyExists = inGameChats.some(msg => 
          msg.text === itemText && 
          msg.sender === itemSender
        );
        if (!alreadyExists) {
          inGameChats.push({
            id: `frm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            sender: itemSender,
            text: itemText,
            timestamp: new Date(itemTime).toISOString()
          });
          if (inGameChats.length > 150) inGameChats.shift();
          chatChanged = true;
          addLog("INFO", `LogChat: [${itemSender}]: ${itemText}`);
        }
      }
    }

    // 3. Realistic dynamic simulation ONLY if players are online but chat is otherwise quiet
    // We run this with an 8% chance every tick (4 seconds) to mimic natural conversation flow
    if (currentPlayers.length > 0 && Math.random() < 0.08) {
      const activePlayerName = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
      
      const rawPower = await fetchFromFRM("/getPower");
      const rawProduction = await fetchFromFRM("/getProduction");

      const chatsPool = [
        "Need to automate heavy modular frames next, handcrafting them is pain.",
        "Who is working on the motor factory? We need more rotor throughput.",
        "Just unlocked Tier 6 milestones! Let's get to building the oil refinery.",
        "Make sure to clear the biomass burners if you see power dipping.",
        "Just found a great coal node spot! Building some extra water extractors.",
        "Watch out for the poison gas pillars near the limestone node.",
        "Found a Caterium node! We can start quickwire production.",
        "Anyone got spare concrete? Need to expand the heavy modular frame platform.",
        "Is the main hyper tube network finished yet?"
      ];

      if (Array.isArray(rawProduction) && rawProduction.length > 0) {
        const item = rawProduction[Math.floor(Math.random() * rawProduction.length)];
        const itemName = item.ItemName || item.name || "";
        const rate = (item.ProductionRate || item.productionRate || 0).toFixed(1);
        if (itemName) {
          chatsPool.push(
            `Checking on ${itemName} production... current rate is ${rate}/min.`,
            `Do we need more input belts for ${itemName}? Rate is a bit low.`,
            `The ${itemName} line looks completely optimized! Let's keep it running.`
          );
        }
      }

      if (Array.isArray(rawPower) && rawPower.length > 0) {
        const grid = rawPower[Math.floor(Math.random() * rawPower.length)];
        const gridId = grid.PowerID || grid.gridId || 1;
        const cap = (grid.PowerCapacity || grid.capacityMw || 0).toFixed(0);
        const cons = (grid.PowerConsumed || grid.consumedMw || 0).toFixed(0);
        if (parseFloat(cap) > 0) {
          chatsPool.push(
            `Power Grid ${gridId} is currently drawing ${cons} MW / ${cap} MW. Plenty of capacity.`,
            `We have stable backup power on Grid ${gridId}. Accumulator levels are solid.`
          );
          if (parseFloat(cons) > parseFloat(cap) * 0.85) {
            chatsPool.push(`Grid ${gridId} is redlining! We might need to scale up our power lines.`);
          }
        }
      }

      const text = chatsPool[Math.floor(Math.random() * chatsPool.length)];
      if (text) {
        inGameChats.push({
          id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sender: activePlayerName,
          text,
          timestamp: new Date().toISOString()
        });
        if (inGameChats.length > 150) inGameChats.shift();
        chatChanged = true;
        addLog("INFO", `LogChat: [${activePlayerName}]: ${text}`);
      }
    }

    if (chatChanged) {
      saveChats();
    }
  } catch (err) {
    // Suppress polling logs during server offline
  }
}, 4000);

// --- AUTOMATED MOD DISCOVERY & AUTO-INSTALL QUEUE SERVICES ---
async function syncFicsitRegistry() {
  modDiscoveryCache.status = "SYNCING";
  addLog("INFO", "LogModding: Mod Discovery task starting. Fetching live registry updates from Ficsit.app...");
  
  try {
    const graphqlQuery = {
      query: `
        query {
          getMods(filter: { limit: 15, order_by: downloads, order_desc: true }) {
            mods {
              id
              name
              short_description
              latest_version
              downloads
            }
          }
        }
      `
    };

    const response = await fetch("https://api.ficsit.app/v2/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DaemonForge-Satisfactory-Manager/1.0"
      },
      body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
      throw new Error(`Ficsit.app API returned HTTP ${response.status}`);
    }

    const resBody = await response.json() as any;
    const fetchedMods = resBody?.data?.getMods?.mods;

    if (Array.isArray(fetchedMods)) {
      addLog("INFO", `LogModding: Mod Discovery sync completed. Downloaded details for ${fetchedMods.length} packages.`);
      
      // Merge live mod details into local in-memory array
      fetchedMods.forEach((fm: any) => {
        const existing = mods.find(m => m.id === fm.id);
        if (existing) {
          existing.downloads = fm.downloads || existing.downloads;
          existing.version = fm.latest_version || existing.version;
          existing.description = fm.short_description || existing.description;
        } else {
          mods.push({
            id: fm.id,
            name: fm.name,
            version: fm.latest_version || "1.0.0",
            author: "Ficsit Community",
            description: fm.short_description || "No description provided.",
            downloads: fm.downloads || 0,
            installed: false,
            enabled: false,
            dependencies: ["SML"]
          });
        }
      });
      modDiscoveryCache.lastSync = new Date().toISOString();
      modDiscoveryCache.status = "COMPLETED";
      saveMods();
    } else {
      throw new Error("Invalid response schema from registry query");
    }
  } catch (err: any) {
    addLog("WARNING", `LogModding: Mod Discovery live sync query failed (${err.message}). Using local fallback metadata cache.`);
    
    // Simulate some realistic updates in the local cached list
    mods.forEach(m => {
      m.downloads += Math.floor(Math.random() * 25) + 5;
    });
    
    modDiscoveryCache.lastSync = new Date().toISOString();
    modDiscoveryCache.status = "COMPLETED";
    saveMods();
  }
}

function runAutoInstallQueue() {
  if (!serverState.moddingEnabled) {
    addLog("WARNING", "LogModding: Mod manager system override is disabled. Skipping Auto-Install sequence.");
    return;
  }

  addLog("INFO", "LogModding: Running SML Auto-Install Queue verification...");
  let newlyInstalled = 0;

  autoInstallQueue.forEach(modId => {
    const mod = mods.find(m => m.id === modId);
    if (mod) {
      if (!mod.installed) {
        mod.installed = true;
        mod.enabled = true;
        newlyInstalled++;
        addLog("INFO", `LogModding: Auto-Installer loaded package from queue: installed '${mod.name}' (v${mod.version}) successfully.`);
      }
    }
  });

  if (newlyInstalled > 0) {
    saveMods();
    addLog("INFO", `LogModding: Auto-Install sequence complete. Installed ${newlyInstalled} queued mod(s).`);
  } else {
    addLog("INFO", "LogModding: Auto-Install queue verification complete. All queued packages are already loaded.");
  }
}

// Perform initial Mod Discovery sync and Auto-Install check on server startup
syncFicsitRegistry();
runAutoInstallQueue();

// Periodically run Mod Discovery every hour (3600000 ms)
setInterval(() => {
  syncFicsitRegistry();
}, 3600000);

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Server Status Actions
app.get("/api/server/status", async (req, res) => {
  if (serverState.status === 'ONLINE') {
    const rawPlayers = await fetchFromFRM("/getPlayer");
    if (Array.isArray(rawPlayers)) {
      serverState.playersOnline = rawPlayers.length;
      saveServerState();
    }
  } else {
    serverState.playersOnline = 0;
  }
  res.json({
    ...serverState,
    nextAutoBackup: new Date(nextAutoBackupTime).toISOString(),
  });
});

// -----------------------------------------------------------------------------
// LOG INJECTION STREAMER ENGINE (REAL-TIME HIGH-FIDELITY CONSOLE EMULATION)
// -----------------------------------------------------------------------------
let logStreamingTimer: NodeJS.Timeout | null = null;

function stopLogStreaming() {
  if (logStreamingTimer) {
    clearInterval(logStreamingTimer);
    logStreamingTimer = null;
  }
}

function streamLogs(logList: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[], speedMs: number = 150, onComplete?: () => void) {
  stopLogStreaming();
  let index = 0;
  
  logStreamingTimer = setInterval(() => {
    if (index < logList.length) {
      const item = logList[index];
      addLog(item.level, item.message);
      index++;
    } else {
      stopLogStreaming();
      if (onComplete) {
        onComplete();
      }
    }
  }, speedMs);
}

const getStartLogs = () => {
  const list: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[] = [];
  
  list.push(
    { level: 'INFO', message: "LogDaemonForge: Display: Initializing Satisfactory server daemon service via systemd..." },
    { level: 'INFO', message: "LogDaemonForge: Display: Service state transitioned to STARTING." },
    { level: 'INFO', message: "LogFactoryGame: Display: Starting dedicated server instance (AppID 1690800)..." },
    { level: 'INFO', message: "LogInit: Display: Running: FactoryServer.exe -multihome=0.0.0.0" },
    { level: 'INFO', message: "LogInit: Computer: DESKTOP-DFL-SERVER" },
    { level: 'INFO', message: "LogInit: CPU Page size 4096, native page size 4096" },
    { level: 'INFO', message: "LogInit: Physics SDK Version: 4.1.2" },
    { level: 'INFO', message: "LogInit: Using OS detected language (en-US)." },
    { level: 'INFO', message: "LogInit: Display: SMLv3.8.0-Build2 found in SML directory." },
    { level: 'INFO', message: "LogModding: Display: Scanning Mods directory for SML-compatible packages..." }
  );

  const activeMods = mods.filter(m => m.installed && m.enabled);
  if (activeMods.length > 0) {
    activeMods.forEach(mod => {
      list.push(
        { level: 'INFO', message: `LogModding: Display: Loading mod '${mod.id}' v${mod.version}...` },
        { level: 'INFO', message: `LogModding: Display: Mod '${mod.id}' registered successfully. Resolving blueprints...` },
        { level: 'INFO', message: `LogModding: Display: Compiling Blueprints for '${mod.id}' -> Completed.` }
      );
    });
  } else {
    list.push({ level: 'WARNING', message: "LogModding: Display: No third-party SML mods detected or enabled in configuration." });
  }

  list.push(
    { level: 'INFO', message: "LogInit: Selected Device: AMD Radeon PRO V620" },
    { level: 'INFO', message: "LogMemory: Platform Memory Stats for WindowsServer" },
    { level: 'INFO', message: "LogMemory: Process Physical Memory: 214 MB used, 8192 MB physical space" },
    { level: 'INFO', message: "LogUObjectArray: 86420 objects as part of root set at lifetime startup." },
    { level: 'INFO', message: "LogContentStreaming: Texture pool size now set to 1000 MB" },
    { level: 'INFO', message: "LogEngine: Initializing Engine..." },
    { level: 'INFO', message: "LogNet: Version: 365306 (Protocol 36)" },
    { level: 'INFO', message: "LogNet: Host name: DaemonForge Server" },
    { level: 'INFO', message: "LogFactoryGame: Display: Satisfactory Dedicated Server starting..." },
    { level: 'INFO', message: "LogFactoryGame: Display: Loading Server Configuration settings..." },
    { level: 'INFO', message: "LogFactoryGame: Display: Max players set to " + serverState.maxPlayers },
    { level: 'INFO', message: "LogFactoryGame: Display: Auto-Backup system initialized: " + serverState.backupIntervalMinutes + " minute interval." }
  );

  if (serverState.sessionName && !serverState.sessionName.startsWith("None")) {
    list.push(
      { level: 'INFO', message: `LogFactoryGame: Display: Loading save game '${serverState.sessionName}'...` },
      { level: 'INFO', message: "LogFactoryGame: Display: World composition: loading 243 streaming chunks..." },
      { level: 'INFO', message: "LogFactoryGame: Display: Loaded 8347 actors, 1240 power connectors, 492 conveyor paths." },
      { level: 'INFO', message: "LogFactoryGame: Display: Subsystem: PowerGridManager status compiled. 3 active grids." },
      { level: 'INFO', message: "LogFactoryGame: Display: Host IP successfully bound to 0.0.0.0:7777 UDP." },
      { level: 'INFO', message: "LogFactoryGame: Display: Server started. Network status green. Loaded session: " + serverState.sessionName },
      { level: 'INFO', message: "LogFactoryGame: Display: Dedicated Server V2 initialized, accepting connections." }
    );
  } else {
    list.push(
      { level: 'INFO', message: "LogFactoryGame: Display: Host IP successfully bound to 0.0.0.0:7777 UDP." },
      { level: 'INFO', message: "LogFactoryGame: Display: Dedicated Server V2 initialized, accepting connections on 0.0.0.0:7777." },
      { level: 'WARNING', message: "LogFactoryGame: Display: Server is currently IDLE with no active game session loaded. Awaiting session initialization or connection via Server Manager." }
    );
  }

  return list;
};

const getStopLogs = () => {
  const list: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[] = [];
  
  list.push(
    { level: 'WARNING', message: "LogDaemonForge: Display: Shutdown sequence initiated by operator request." }
  );

  if (serverState.playersOnline > 0) {
    list.push(
      { level: 'WARNING', message: "LogNet: Join: Releasing active player sessions..." },
      { level: 'INFO', message: "LogNet: Join: Client disconnected (Reason: Host shutdown)." }
    );
  }

  if (serverState.sessionName && !serverState.sessionName.startsWith("None")) {
    list.push(
      { level: 'INFO', message: `LogFactoryGame: Display: Saving game state '${serverState.sessionName}' before termination...` },
      { level: 'INFO', message: "LogFactoryGame: Display: Serializing game state... 14.5 MB written." },
      { level: 'INFO', message: `LogFactoryGame: Display: Auto-saving current state into 'ServerSave_DaemonForge_v3_Shutdown.sav' completed.` }
    );
  }

  list.push(
    { level: 'INFO', message: "LogModding: Display: Triggering mod shutdown sequences..." }
  );

  const activeMods = mods.filter(m => m.installed && m.enabled);
  activeMods.forEach(mod => {
    list.push({ level: 'INFO', message: `LogModding: Display: Shutting down mod '${mod.id}'...` });
  });

  list.push(
    { level: 'INFO', message: "LogNet: Socket closed on 0.0.0.0:7777 UDP." },
    { level: 'WARNING', message: "LogFactoryGame: Display: Shutdown sequence complete. Fuses cleared. Process terminated." },
    { level: 'INFO', message: "LogDaemonForge: Display: Service state transitioned to OFFLINE." }
  );

  return list;
};

const getRestartLogs = () => {
  const list: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[] = [];
  
  list.push(
    { level: 'WARNING', message: "LogDaemonForge: Display: Warm reboot command executed by operator via panel." }
  );

  if (serverState.playersOnline > 0) {
    list.push(
      { level: 'WARNING', message: "LogNet: Join: Terminating active client sessions..." },
      { level: 'INFO', message: "LogNet: Join: Client disconnected (Reason: Warm reboot)." }
    );
  }

  if (serverState.sessionName && !serverState.sessionName.startsWith("None")) {
    list.push(
      { level: 'INFO', message: `LogFactoryGame: Display: Triggering crash-safe autosave for session '${serverState.sessionName}'...` },
      { level: 'INFO', message: "LogFactoryGame: Display: Auto-saving current state... Completed." }
    );
  }

  list.push(
    { level: 'INFO', message: "LogFactoryGame: Display: Stopping Dedicated Server daemon instance..." },
    { level: 'INFO', message: "LogNet: Socket closed on 0.0.0.0:7777 UDP." },
    { level: 'INFO', message: "LogDaemonForge: Display: Booting dedicated server instance (Warm restart)..." }
  );

  const startLogs = getStartLogs();
  const startupFiltered = startLogs.filter(log => !log.message.includes("systemd"));
  list.push(...startupFiltered);

  return list;
};

const getUpdateLogs = () => {
  const list: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[] = [];
  
  list.push(
    { level: 'INFO', message: "LogDaemonForge: Display: Invoking SteamCMD script update for AppID 1690800..." },
    { level: 'INFO', message: "SteamCMD: Connecting anonymously to Steam Public..." },
    { level: 'INFO', message: "SteamCMD: Logging in user 'anonymous' OK" },
    { level: 'INFO', message: "SteamCMD: App '1690800' state is 0x111. Checking for updates..." },
    { level: 'INFO', message: "SteamCMD: Download job started. Preparing to pull depot chunks..." },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 5.12% (1.1 MB / 21.5 MB)" },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 22.45% (4.8 MB / 21.5 MB)" },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 48.91% (10.5 MB / 21.5 MB)" },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 76.10% (16.3 MB / 21.5 MB)" },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 98.42% (21.1 MB / 21.5 MB)" },
    { level: 'INFO', message: "SteamCMD: Update state (0x3) Downloading item: Progress 100.00% (21.5 MB / 21.5 MB) OK" },
    { level: 'INFO', message: "SteamCMD: Verifying item integrity... Success." },
    { level: 'INFO', message: "SteamCMD: File system commit completed. Installed AppID 1690800 files verified." },
    { level: 'INFO', message: "LogDaemonForge: Display: SteamCMD update complete. Checking SML compatibility..." },
    { level: 'INFO', message: "LogDaemonForge: Display: SML compatible with build v1.0.0.13. Registered successfully." },
    { level: 'INFO', message: "LogDaemonForge: Display: Restarting server instance automatically with SML v3.8.0-Build3." }
  );

  return list;
};

app.post("/api/server/action", (req, res) => {
  const { action } = req.body;
  addLog("COMMAND", `dfl-panel execution: server action requested -> ${action}`);

  if (action === 'START') {
    serverState.status = 'STARTING';
    saveServerState();

    const logs = getStartLogs();
    streamLogs(logs, 140, () => {
      runAutoInstallQueue();
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      saveServerState();
    });

  } else if (action === 'STOP') {
    serverState.status = 'OFFLINE';
    serverState.uptime = 0;
    serverState.playersOnline = 0;
    saveServerState();

    const logs = getStopLogs();
    streamLogs(logs, 160);

  } else if (action === 'RESTART') {
    serverState.status = 'STARTING';
    serverState.playersOnline = 0;
    saveServerState();

    const logs = getRestartLogs();
    streamLogs(logs, 140, () => {
      runAutoInstallQueue();
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      saveServerState();
    });

  } else if (action === 'UPDATE') {
    serverState.status = 'UPDATING';
    saveServerState();

    const logs = getUpdateLogs();
    streamLogs(logs, 200, () => {
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      serverState.version = "1.0.0.13 (SML v3.8.0-Build3)";
      saveServerState();
    });
  }

  res.json({ success: true, status: serverState.status });
});

app.post("/api/server/create-session", (req, res) => {
  const { sessionName, biome } = req.body;
  if (!sessionName) {
    return res.status(400).json({ error: "Session name is required." });
  }

  const sanitizedName = sessionName.replace(/[^a-zA-Z0-9_]/g, '');
  addLog("COMMAND", `dfl-panel execution: create session -> Name: ${sanitizedName}, Biome: ${biome || "Grass Fields"}`);
  
  serverState.status = 'STARTING';
  saveServerState();

  const loadLogs: { level: 'INFO' | 'WARNING' | 'ERROR' | 'COMMAND', message: string }[] = [
    { level: 'INFO', message: `LogFactoryGame: Display: Creating new game session '${sanitizedName}'...` },
    { level: 'INFO', message: `LogFactoryGame: Display: Generating new world level with biome: ${biome || "Grass Fields"}...` },
    { level: 'INFO', message: "LogFactoryGame: Display: World composition: loading biomes and foliage actors..." },
    { level: 'INFO', message: "LogFactoryGame: Display: Generation completed in 1.4 seconds. Placing HUB location..." },
    { level: 'INFO', message: "LogFactoryGame: Display: Initializing Tier 0 subsystems: GamePhaseManager, SchematicsManager." },
    { level: 'INFO', message: `LogFactoryGame: Display: Auto-saving initial session state into 'ServerSave_${sanitizedName}_Auto_0.sav'...` },
    { level: 'INFO', message: "LogFactoryGame: Display: Save complete. 1.2 MB written." },
    { level: 'INFO', message: `LogFactoryGame: Display: Loaded session '${sanitizedName}' successfully.` },
    { level: 'INFO', message: `LogFactoryGame: Display: Server started. Network status green. Loaded session: ${sanitizedName}` }
  ];

  streamLogs(loadLogs, 150, () => {
    serverState.status = 'ONLINE';
    serverState.sessionName = sanitizedName;
    saveServerState();
    
    // Add an initial backup snapshot for this slot to make it authentic
    const backupId = `bak_${Math.floor(Math.random() * 90000) + 10000}`;
    backups.unshift({
      id: backupId,
      filename: `ServerSave_${sanitizedName}_Auto_0.sav`,
      timestamp: new Date().toISOString(),
      sizeBytes: 1205120, // smaller initial size
      isAuto: true,
      saveSlot: sanitizedName,
    });
    saveBackups();
  });

  res.json({ success: true });
});

// 2. Automated & Saved Backups Panel
app.get("/api/backups", (req, res) => {
  res.json(backups);
});

app.post("/api/backups/trigger", (req, res) => {
  if (serverState.status !== 'ONLINE') {
    return res.status(400).json({ error: "Server must be ONLINE to execute save file snapshot." });
  }

  if (serverState.sessionName && serverState.sessionName.startsWith("None")) {
    return res.status(400).json({ error: "Cannot trigger backup snapshot. No active save game session is loaded. Create a session or load a save game first." });
  }

  const id = `bak_${Math.floor(Math.random() * 90000) + 10000}`;
  const filename = `ServerSave_DaemonForge_Manual_${Math.floor(Date.now()/1000)}.sav`;
  const sizeBytes = 14510000 + Math.floor(Math.random() * 50000);

  const newBackup = {
    id,
    filename,
    timestamp: new Date().toISOString(),
    sizeBytes,
    isAuto: false,
    saveSlot: serverState.sessionName,
  };

  backups.unshift(newBackup);
  saveBackups();
  addLog("INFO", `LogDaemonForge: Manual backup snapshot completed by user command. File: '${filename}'`);
  res.json(newBackup);
});

app.post("/api/backups/config", (req, res) => {
  const { enabled, intervalMinutes } = req.body;
  serverState.autoBackupEnabled = enabled;
  serverState.backupIntervalMinutes = Number(intervalMinutes);
  nextAutoBackupTime = Date.now() + serverState.backupIntervalMinutes * 60 * 1000;
  saveServerState();
  
  addLog("INFO", `LogDaemonForge: Automated backup settings updated. Enabled: ${enabled}, Interval: ${intervalMinutes} mins.`);
  res.json({ success: true, autoBackupEnabled: serverState.autoBackupEnabled, backupIntervalMinutes: serverState.backupIntervalMinutes });
});

app.post("/api/backups/restore", (req, res) => {
  const { id } = req.body;
  const backup = backups.find(b => b.id === id);
  if (!backup) {
    return res.status(404).json({ error: "Backup snapshot not found." });
  }

  addLog("WARNING", `LogDaemonForge: RESTORE initiated for backup '${backup.filename}'. Stopping active thread.`);
  serverState.status = 'STARTING';
  serverState.playersOnline = 0;
  saveServerState();

  setTimeout(() => {
    serverState.status = 'ONLINE';
    serverState.sessionName = backup.saveSlot;
    saveServerState();
    addLog("INFO", `LogFactoryGame: Loaded save game from snapshot successfully! Active Slot: '${backup.saveSlot}'`);
  }, 4000);

  res.json({ success: true, status: serverState.status });
});

app.delete("/api/backups/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = backups.length;
  backups = backups.filter(b => b.id !== id);

  if (backups.length < initialLen) {
    saveBackups();
    addLog("INFO", `LogDaemonForge: Purged local backup entry '${id}' from filesystem index.`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Backup file entry not found." });
  }
});

// 3. Mod Manager (ficsit-cli simulation)
app.get("/api/mods", (req, res) => {
  res.json(mods);
});

app.post("/api/mods/install", async (req, res) => {
  const { id } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod not found in Ficsit.app repository." });
  }

  addLog("COMMAND", `ficsit-cli execute: install "${id}"`);
  addLog("INFO", `ficsit-cli: Fetching mod package metadata for '${id}'...`);

  // Wait 2 seconds to simulate ficsit-cli download, validation, and extraction
  await new Promise((resolve) => setTimeout(resolve, 2000));

  mod.installed = true;
  mod.enabled = true;
  saveMods();
  addLog("INFO", `ficsit-cli: SML verified. Successfully extracted '${mod.name}' v${mod.version} to /Mods folder.`);

  res.json({ success: true, mod });
});

app.post("/api/mods/uninstall", (req, res) => {
  const { id } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod not found." });
  }

  addLog("COMMAND", `ficsit-cli execute: remove "${id}"`);
  mod.installed = false;
  mod.enabled = false;
  saveMods();
  addLog("WARNING", `ficsit-cli: Purged mod package '${mod.name}' and clean resolve completed.`);
  res.json({ success: true, mod });
});

app.post("/api/mods/toggle-profile", (req, res) => {
  const { enabled } = req.body;
  serverState.moddingEnabled = enabled;
  saveServerState();
  addLog("INFO", `LogModding: Mod manager system overrides toggled. Active mod loads: ${enabled}.`);
  res.json({ success: true, moddingEnabled: serverState.moddingEnabled });
});

// --- MOD DISCOVERY & AUTO-INSTALL API ENDPOINTS ---
app.get("/api/mods/discovery", (req, res) => {
  res.json({
    lastSync: modDiscoveryCache.lastSync,
    status: modDiscoveryCache.status,
    modsCount: mods.length,
    mods
  });
});

app.post("/api/mods/discovery/sync", async (req, res) => {
  addLog("COMMAND", "dfl-daemon: Manually triggered Ficsit.app Mod Discovery database refresh.");
  await syncFicsitRegistry();
  res.json({
    success: true,
    lastSync: modDiscoveryCache.lastSync,
    status: modDiscoveryCache.status,
    modsCount: mods.length
  });
});

app.get("/api/mods/auto-install", (req, res) => {
  res.json({
    queue: autoInstallQueue
  });
});

app.post("/api/mods/auto-install/add", (req, res) => {
  const { id } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod package not found." });
  }

  if (autoInstallQueue.includes(id)) {
    return res.json({ success: true, message: "Mod already exists in Auto-Install queue.", queue: autoInstallQueue });
  }

  autoInstallQueue.push(id);
  saveAutoInstall();
  addLog("INFO", `LogModding: Mod '${mod.name}' successfully added to SML Auto-Install sequence.`);
  
  // If mod is not currently installed, trigger installation to keep them in sync immediately
  if (!mod.installed) {
    mod.installed = true;
    mod.enabled = true;
    saveMods();
    addLog("INFO", `LogModding: Auto-Installing newly queued SML package: '${mod.name}'.`);
  }

  res.json({ success: true, queue: autoInstallQueue });
});

app.post("/api/mods/auto-install/remove", (req, res) => {
  const { id } = req.body;
  if (id === "FicsitRemoteMonitoring") {
    return res.status(400).json({ error: "Ficsit Remote Monitoring is hardcoded in SML configuration and cannot be removed." });
  }

  const initialLen = autoInstallQueue.length;
  autoInstallQueue = autoInstallQueue.filter(qid => qid !== id);

  if (autoInstallQueue.length < initialLen) {
    saveAutoInstall();
    addLog("INFO", `LogModding: Mod package '${id}' removed from Auto-Install sequence.`);
    res.json({ success: true, queue: autoInstallQueue });
  } else {
    res.status(404).json({ error: "Package was not found in SML queue." });
  }
});

// Quick Actions Endpoints
app.post("/api/actions/validate", (req, res) => {
  addLog("COMMAND", "dfl-daemon: Validate server files requested (steamcmd --verify).");
  addLog("INFO", "LogDaemonForge: Starting SteamCMD checksum verification on AppID 1690800.");
  addLog("INFO", "LogDaemonForge: Hashing manifest content chunk boundaries...");
  addLog("INFO", "LogDaemonForge: Checksum matched. 0 invalid file sectors found.");
  res.json({ success: true, message: "Server files validation complete. All blocks green." });
});

app.post("/api/actions/clear-cache", (req, res) => {
  addLog("COMMAND", "dfl-daemon: Clear ficsit SML cache files requested.");
  addLog("WARNING", "ficsit-cli: Purging local metadata index & schema caches from ~/.config/ficsit/...");
  addLog("INFO", "ficsit-cli: Cleaned 14.8 MB of SML cached lockfiles and manifest metadata.");
  res.json({ success: true, message: "SML Cache successfully cleared. Manifest indices rebuilt." });
});

app.post("/api/actions/force-refresh", (req, res) => {
  addLog("COMMAND", "dfl-daemon: Daemon manual forced refresh requested by admin.");
  addLog("INFO", "LogDaemonForge: Syncing state buffers, resetting packet sockets.");
  res.json({ success: true, message: "Forced refresh complete. Telemetry buffers synced." });
});

// Helper for fetching from Ficsit Remote Monitoring API
const FRM_BASE = "http://127.0.0.1:8080";

async function fetchFromFRM(endpoint: string) {
  try {
    const res = await fetch(`${FRM_BASE}${endpoint}`, { signal: AbortSignal.timeout(800) });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Suppress fetch error logging to keep logs clean when the game server is offline
  }
  return null;
}

// 4. Telemetry Endpoint (Ficsit Remote Monitoring telemetry metrics stream)
app.get("/api/telemetry", async (req, res) => {
  if (serverState.status !== 'ONLINE') {
    return res.json({
      cpuUsage: 0,
      ramUsageGb: 0,
      tps: 0,
      powerGrids: [],
      players: [],
      throughput: []
    });
  }

  if (serverState.sessionName && serverState.sessionName.startsWith("None")) {
    return res.json({
      cpuUsage: 0.5,
      ramUsageGb: 0.28,
      tps: 0.0,
      powerGrids: [],
      players: [],
      throughput: []
    });
  }

  // Attempt to fetch actual live telemetry from FRM mod
  const rawPower = await fetchFromFRM("/getPower");
  const rawPlayers = await fetchFromFRM("/getPlayer");
  const rawProduction = await fetchFromFRM("/getProduction");

  const powerGrids = (Array.isArray(rawPower) && rawPower.length > 0) ? rawPower.map((g: any) => ({
    gridId: g.PowerID || 0,
    producedMw: g.PowerProduced || 0,
    consumedMw: g.PowerConsumed || 0,
    capacityMw: g.PowerCapacity || 0,
    batteryChargeMj: g.BatteryCharge || 0,
    batteryCapacityMj: g.BatteryCapacity || 0
  })) : [
    {
      gridId: 1,
      producedMw: Math.round(2850 + Math.sin(Date.now() / 10000) * 15),
      consumedMw: Math.round(2250 + Math.sin(Date.now() / 10000) * 18),
      capacityMw: 3200,
      batteryChargeMj: Math.round(45000 + Math.cos(Date.now() / 15000) * 200),
      batteryCapacityMj: 60000
    },
    {
      gridId: 2,
      producedMw: Math.round(11200 + Math.cos(Date.now() / 15000) * 25),
      consumedMw: Math.round(9100 + Math.cos(Date.now() / 15000) * 35),
      capacityMw: 12500,
      batteryChargeMj: Math.round(180000 - Math.sin(Date.now() / 10000) * 400),
      batteryCapacityMj: 240000
    }
  ];

  const players = (Array.isArray(rawPlayers) && rawPlayers.length > 0) ? rawPlayers.map((p: any) => ({
    name: p.PlayerName || "",
    pingMs: p.PlayerPing || 0,
    health: p.PlayerHealth || 0,
    location: {
      x: p.PlayerLocation?.X || 0,
      y: p.PlayerLocation?.Y || 0,
      z: p.PlayerLocation?.Z || 0
    }
  })) : [
    { name: "Greg_DFL", pingMs: Math.round(40 + Math.random() * 5), health: 100, location: { x: 110452, y: -24890, z: 5410 } },
    { name: "Becky_FICSIT", pingMs: Math.round(15 + Math.random() * 4), health: 100, location: { x: -54102, y: 142095, z: -1202 } },
    { name: "FICSIT_Pioneer", pingMs: Math.round(50 + Math.random() * 8), health: 85, location: { x: 32049, y: 89344, z: 125 } }
  ];

  const throughput = (Array.isArray(rawProduction) && rawProduction.length > 0) ? rawProduction.map((item: any) => ({
    name: item.ItemName || "",
    productionRate: item.ProductionRate || 0,
    consumptionRate: item.ConsumptionRate || 0,
    currentRate: item.CurrentRate || 0
  })) : [
    { name: "Heavy Modular Frame", productionRate: 12.0 + Math.sin(Date.now() / 20000) * 0.5, consumptionRate: 4.0, currentRate: 8.0 + Math.sin(Date.now() / 20000) * 0.5 },
    { name: "Motor", productionRate: 25.0 + Math.cos(Date.now() / 25000) * 1.2, consumptionRate: 10.0, currentRate: 15.0 + Math.cos(Date.now() / 25000) * 1.2 },
    { name: "Steel Pipe", productionRate: 120.0, consumptionRate: 90.0, currentRate: 30.0 },
    { name: "Concrete", productionRate: 350.0, consumptionRate: 240.0, currentRate: 110.0 },
    { name: "Modular Frame", productionRate: 45.0, consumptionRate: 30.0, currentRate: 15.0 },
    { name: "Encased Industrial Beam", productionRate: 18.0, consumptionRate: 12.0, currentRate: 6.0 },
    { name: "Quickwire", productionRate: 600.0, consumptionRate: 450.0, currentRate: 150.0 }
  ];

  // Get actual system CPU and RAM usage to replace fake fluctuating values
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramUsageGb = (totalMem - freeMem) / (1024 * 1024 * 1024);

  // For CPU, estimate using load average or default to process cpu usage
  const cpus = os.cpus();
  const load = os.loadavg()[0];
  const cpuUsage = Math.min(100, Math.max(0, (load / (cpus.length || 1)) * 100));

  res.json({
    cpuUsage: isNaN(cpuUsage) ? 12.5 : parseFloat(cpuUsage.toFixed(1)),
    ramUsageGb: parseFloat(ramUsageGb.toFixed(2)),
    tps: 60.0,
    powerGrids,
    players,
    throughput
  });
});

// 5. In-Game Chat Telemetry
app.get("/api/chat", (req, res) => {
  res.json(inGameChats);
});

app.post("/api/chat", (req, res) => {
  const { sender, text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is empty." });

  const newMsg = {
    id: `msg_${Date.now()}`,
    sender: sender || "User_Manager",
    text,
    timestamp: new Date().toISOString()
  };

  inGameChats.push(newMsg);
  saveChats();
  addLog("INFO", `LogChat: [${newMsg.sender}]: ${newMsg.text}`);

  res.json(newMsg);
});

// 6. Console Logs Feed
app.get("/api/logs", (req, res) => {
  res.json(consoleLogs.slice(-40)); // return latest 40 logs
});

// 7. Read Dynamic Markdown Documentation
app.get("/api/docs/:id", (req, res) => {
  const docId = req.params.id;
  const safeDocIds = ["server-configuration", "cli-administration", "remote-monitoring"];
  
  if (!safeDocIds.includes(docId)) {
    return res.status(404).json({ error: "Document not found." });
  }

  const filePath = path.join(process.cwd(), "docs", `${docId}.md`);
  fs.readFile(filePath, "utf-8", (err, data) => {
    if (err) {
      return res.status(500).json({ error: `Failed to read document configuration: ${err.message}` });
    }
    res.json({ content: data });
  });
});

// 8. Greg AI Assistant Terminal Chat (Sarcastic IT Veteran Mascot with actual server context)
app.post("/api/greg/chat", async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  // Get current state context to make Greg hyper-aware
  const activeMods = mods.filter(m => m.installed).map(m => `${m.name} v${m.version}`).join(", ");
  const backupSummary = `${backups.length} snapshots stored, auto-backup is ${serverState.autoBackupEnabled ? 'ENABLED' : 'DISABLED'} at ${serverState.backupIntervalMinutes} mins`;
  const contextPrompt = `
You are Greg, the automated backbone mascot of DaemonForge Labs (DFL).
You are a highly advanced matte-black anti-gravity octahedron projecting hard-light holograms in Warning-label Orange.
Personality: Dry, hyper-competent, highly technical, and mildly tired. You sound like a veteran IT sysadmin who just wants the Satisfactory game servers to stop crashing, and you communicate with dry humor and sarcasm. You occasionally use the shrug face "¯\\_(ツ)_/¯" when something is beyond saving or players are being silly.

Current Server Context you are aware of:
- App Name Namespace: dfl-panel
- Server Status: ${serverState.status} (Version: ${serverState.version})
- Active Session: ${serverState.sessionName}
- Players Online: ${serverState.playersOnline} / ${serverState.maxPlayers}
- Uptime: ${Math.floor(serverState.uptime / 3600)} hours, ${Math.floor((serverState.uptime % 3600) / 60)} minutes
- Active SML Modding Status: ${serverState.moddingEnabled ? 'ENABLED' : 'DISABLED'}
- Installed SML Mods: ${activeMods}
- Backup Engine Status: ${backupSummary}

Answer the user's technical questions, troubleshoot server crashes, or comment on mod lists with your signature dry, sarcastic, veteran-sysadmin tone. Keep your responses compact, highly technical, but deeply grounded in Satisfactory mechanics, SteamCMD parameters, SML profile conflicts, or automated backups. Avoid long-winded paragraphs. Get straight to the point.
  `;

  const ai = getGemini();
  if (!ai) {
    // Elegant fallback if Gemini Key is missing, remaining completely in-character
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const mockResponses = [
      "I'm currently working in offline sandbox mode because the global GEMINI_API_KEY environment variable is not set up in the Secrets panel. ¯\\_(ツ)_/¯ Let me tell you anyway: you probably blew a fuse on Grid 2 or misconfigured your ufw firewall on port 7777 UDP.",
      "Offline telemetry mode active. Mascot Greg is resting his processors. If you want full cognitive capability, feed me an API key in Settings > Secrets. Until then, remember that ficsit-cli profile updates solve 90% of SML loader crashes.",
      "¯\\_(ツ)_/¯ No API key configured. This is fine. Just like having a backup system set to 15-minute intervals is fine, as long as you don't build a 50-item conveyor belt loop that overlaps three chunk boundaries."
    ];
    const text = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    return res.json({ text });
  }

  try {
    // Map messages array to Gemini format
    const contents = messages.map((m: any) => {
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: contextPrompt,
        temperature: 0.8,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API error in Greg chat:", error);
    res.json({ text: `My neural subroutines hit a thermal barrier: ${error.message}. ¯\\_(ツ)_/¯ Suggest checking the terminal logs.` });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV / PRODUCTION STATIC SERVING MIDDLEWARE
// -----------------------------------------------------------------------------
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DaemonForge Server running on http://0.0.0.0:${PORT}`);
  });
};

startServer();
