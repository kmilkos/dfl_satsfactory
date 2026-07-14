import express from "express";
import path from "path";
import fs from "fs";
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
  playersOnline: 2,
  maxPlayers: 8,
  sessionName: "DaemonForge_Main_World",
  autoBackupEnabled: true,
  backupIntervalMinutes: 15,
  moddingEnabled: true,
});

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
    installed: true,
    enabled: true,
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
    installed: true,
    enabled: true,
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

let inGameChats = loadState("chat_logs.json", [
  { id: "msg_1", sender: "SERVER", text: "Greg_DFL joined the server.", timestamp: new Date(Date.now() - 600 * 1000).toISOString() },
  { id: "msg_2", sender: "Greg_DFL", text: "Connecting the heavy steel modular frame factory now.", timestamp: new Date(Date.now() - 420 * 1000).toISOString() },
  { id: "msg_3", sender: "SERVER", text: "Mascot_Greg connected from DFL-HQ.", timestamp: new Date(Date.now() - 300 * 1000).toISOString() },
  { id: "msg_4", sender: "Mascot_Greg", text: "I see 4 blown fuses in Grid 2. What did I say about overloading the biogenerators?", timestamp: new Date(Date.now() - 250 * 1000).toISOString() },
  { id: "msg_5", sender: "Greg_DFL", text: "Oops... sorry Mascot Greg, will boot up the Coal lines.", timestamp: new Date(Date.now() - 100 * 1000).toISOString() },
]);

let consoleLogs = loadState("console_logs.json", [
  { timestamp: new Date(Date.now() - 1800 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Satisfactory Dedicated Server starting..." },
  { timestamp: new Date(Date.now() - 1795 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: SML SMLv3.8.0-Build2 found in SML directory." },
  { timestamp: new Date(Date.now() - 1790 * 1000).toISOString(), level: "INFO", message: "LogModding: Display: Loading mod 'FicsitRemoteMonitoring' v2.4.1..." },
  { timestamp: new Date(Date.now() - 1789 * 1000).toISOString(), level: "INFO", message: "LogModding: Display: Loading mod 'RefinedPower' v3.2.0..." },
  { timestamp: new Date(Date.now() - 1788 * 1000).toISOString(), level: "INFO", message: "LogModding: Display: Loading mod 'AreaActions' v2.1.3..." },
  { timestamp: new Date(Date.now() - 1780 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Loading save game 'ServerSave_DaemonForge_v3'..." },
  { timestamp: new Date(Date.now() - 1775 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Host IP successfully bound to 0.0.0.0:7777." },
  { timestamp: new Date(Date.now() - 1770 * 1000).toISOString(), level: "INFO", message: "LogFactoryGame: Display: Dedicated Server V2 initialized, accepting connections." },
  { timestamp: new Date(Date.now() - 600 * 1000).toISOString(), level: "INFO", message: "LogNet: Join: Greg_DFL entered the lobby (SteamID: 76561198000000000)." },
  { timestamp: new Date(Date.now() - 300 * 1000).toISOString(), level: "INFO", message: "LogNet: Join: Mascot_Greg entered the lobby (SteamID: 76561198011223344)." },
  { timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), level: "INFO", message: "LogDaemonForge: Display: Automated backup system created 'ServerSave_DaemonForge_v3_Auto_1.sav' successfully." }
]);

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

// Periodically run Mod Discovery every 60 seconds
setInterval(() => {
  syncFicsitRegistry();
}, 60000);

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Server Status Actions
app.get("/api/server/status", (req, res) => {
  res.json({
    ...serverState,
    nextAutoBackup: new Date(nextAutoBackupTime).toISOString(),
  });
});

app.post("/api/server/action", (req, res) => {
  const { action } = req.body;
  addLog("COMMAND", `dfl-panel execution: server action requested -> ${action}`);

  if (action === 'START') {
    serverState.status = 'STARTING';
    saveServerState();
    addLog("INFO", "LogFactoryGame: Display: Starting dedicated server instance...");
    setTimeout(() => {
      runAutoInstallQueue();
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      saveServerState();
      addLog("INFO", "LogFactoryGame: Display: Server started. Network status green. Loaded session: " + serverState.sessionName);
    }, 4000);
  } else if (action === 'STOP') {
    serverState.status = 'OFFLINE';
    serverState.uptime = 0;
    serverState.playersOnline = 0;
    saveServerState();
    addLog("WARNING", "LogFactoryGame: Display: Shutdown sequence initiated. Fuses cleared.");
  } else if (action === 'RESTART') {
    serverState.status = 'STARTING';
    serverState.playersOnline = 0;
    saveServerState();
    addLog("WARNING", "LogFactoryGame: Display: Reboot command executed by DFL daemon.");
    setTimeout(() => {
      runAutoInstallQueue();
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      saveServerState();
      addLog("INFO", "LogFactoryGame: Display: Warm reboot complete. Session restored.");
    }, 3000);
  } else if (action === 'UPDATE') {
    serverState.status = 'UPDATING';
    saveServerState();
    addLog("INFO", "LogDaemonForge: Display: Running SteamCMD update for AppID 1690800...");
    setTimeout(() => {
      serverState.status = 'ONLINE';
      serverState.version = "1.0.0.13 (SML v3.8.0-Build3)";
      saveServerState();
      addLog("INFO", "LogDaemonForge: SteamCMD update completed. Installed Version: v1.0.0.13.");
    }, 6000);
  }

  res.json({ success: true, status: serverState.status });
});

// 2. Automated & Saved Backups Panel
app.get("/api/backups", (req, res) => {
  res.json(backups);
});

app.post("/api/backups/trigger", (req, res) => {
  if (serverState.status !== 'ONLINE') {
    return res.status(400).json({ error: "Server must be ONLINE to execute save file snapshot." });
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

app.post("/api/mods/install", (req, res) => {
  const { id } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod not found in Ficsit.app repository." });
  }

  addLog("COMMAND", `ficsit-cli execute: install "${id}"`);
  addLog("INFO", `ficsit-cli: Fetching mod package metadata for '${id}'...`);

  setTimeout(() => {
    mod.installed = true;
    mod.enabled = true;
    saveMods();
    addLog("INFO", `ficsit-cli: SML verified. Successfully extracted '${mod.name}' v${mod.version} to /Mods folder.`);
  }, 2000);

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

// 4. Telemetry Endpoint (Ficsit Remote Monitoring telemetry metrics stream)
app.get("/api/telemetry", (req, res) => {
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

  // Generate slightly fluctuating telemetry for dynamic visuals
  const timeSec = Date.now() / 1000;
  const players: any[] = [];
  
  if (serverState.uptime > 0) {
    players.push({
      name: "Greg_DFL",
      pingMs: 24 + Math.floor(Math.sin(timeSec / 10) * 5),
      health: 100,
      location: { x: 142050 + Math.floor(Math.sin(timeSec) * 200), y: -210332 + Math.floor(Math.cos(timeSec) * 200), z: 5420 }
    });
    players.push({
      name: "Mascot_Greg",
      pingMs: 42 + Math.floor(Math.cos(timeSec / 7) * 12),
      health: 80,
      location: { x: 139500, y: -208110, z: 5310 }
    });
  }

  const powerGrids = [
    {
      gridId: 1,
      producedMw: 4200 + Math.floor(Math.sin(timeSec / 20) * 150),
      consumedMw: 3120 + Math.floor(Math.cos(timeSec / 15) * 250),
      capacityMw: 5000,
      batteryChargeMj: 12000,
      batteryCapacityMj: 12000,
    },
    {
      gridId: 2,
      producedMw: 1800,
      consumedMw: 1750 + Math.floor(Math.sin(timeSec / 5) * 45),
      capacityMw: 1800,
      batteryChargeMj: 4120 + Math.floor(Math.cos(timeSec / 30) * 100),
      batteryCapacityMj: 10000,
    }
  ];

  const throughput = [
    { name: "Supercomputer", productionRate: 1.8, consumptionRate: 0.0, currentRate: 1.8 },
    { name: "Reinforced Iron Plate", productionRate: 15.0, consumptionRate: 12.5, currentRate: 2.5 },
    { name: "Modular Frame", productionRate: 6.0, consumptionRate: 4.0, currentRate: 2.0 },
    { name: "Screws", productionRate: 240.0, consumptionRate: 240.0, currentRate: 0.0 },
    { name: "Quickwire", productionRate: 360.0, consumptionRate: 320.0, currentRate: 40.0 },
  ];

  res.json({
    cpuUsage: 14.5 + Math.abs(Math.sin(timeSec / 10)) * 12.0,
    ramUsageGb: 11.2 + Math.abs(Math.sin(timeSec / 40)) * 1.5,
    tps: 59.90 + Math.random() * 0.09,
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

  // Greg mascot reactive chatter simulation!
  if (sender !== "Mascot_Greg") {
    setTimeout(() => {
      let responseText = "";
      const query = text.toLowerCase();
      if (query.includes("mod") || query.includes("sml")) {
        responseText = "ficsit-cli handles package locks correctly. Don't touch SML unless you want modular power to compile into sand.";
      } else if (query.includes("fuse") || query.includes("power") || query.includes("grid")) {
        responseText = "Grid 2 capacity is redlined. Standard automated load-shifter hasn't booted because someone skipped wiring the switchboards.";
      } else if (query.includes("backup") || query.includes("save")) {
        responseText = "Yes, automated snapshot is running. 15-minute interval offsets risk of save corruption, unlike manual save spamming.";
      } else {
        const gregSnarks = [
          "My processors are running 60 ticks per second. Please restrict discussions to active thermal loads.",
          "I've logged that. System analytics indicate a 42% decrease in grid stability when players jump on conveyor belts.",
          "¯\\_(ツ)_/¯. Booting the heavy iron frame logistics right now.",
          "Another day of keeping SML profiles from collapsing into standard stack overflows. Carry on."
        ];
        responseText = gregSnarks[Math.floor(Math.random() * gregSnarks.length)];
      }

      const gregMsg = {
        id: `msg_${Date.now() + 1}`,
        sender: "Mascot_Greg",
        text: responseText,
        timestamp: new Date().toISOString()
      };
      inGameChats.push(gregMsg);
      saveChats();
      addLog("INFO", `LogChat: [Mascot_Greg]: ${gregMsg.text}`);
    }, 1500);
  }

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
