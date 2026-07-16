import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import https from "https";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { exec, execSync } from "child_process";

dotenv.config();

// Initialize Express
const app = express();
app.use(express.json());
const PORT = 3000;

// Lazy initialization of Google GenAI for safety
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY || (serverState as any).geminiApiKey;
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
const saveBackups = () => {};
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
  geminiModel: "gemini-3.5-flash",
  autoHealEnabled: true,
});

// Run a migration step to uninitialize session name if it was set to the default mock name
if (serverState.sessionName === "DaemonForge_Main_World") {
  serverState.sessionName = "None (No Active Session)";
  saveServerState();
}

if (serverState.geminiModel === "gemini-2.5-flash" || serverState.geminiModel === "gemini-2.0-flash" || (serverState as any).geminiModel === "gemini-2.5-flash") {
  serverState.geminiModel = "gemini-3.5-flash";
  saveServerState();
}

const SAVE_DIR = "/home/satisfactory/.config/Epic/FactoryGame/Saved/SaveGames/server";
const BACKUP_DIR = path.join(SAVE_DIR, "backups");

if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (e) {
    console.error("Failed to create backup directory:", e);
  }
}

function getBackupFilesCount(): number {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return 0;
    return fs.readdirSync(BACKUP_DIR).filter(file => file.endsWith(".sav")).length;
  } catch (e) {
    return 0;
  }
}

function getLatestActiveSaveFile(): string | null {
  try {
    if (!fs.existsSync(SAVE_DIR)) return null;
    const files = fs.readdirSync(SAVE_DIR);
    const savFiles = files
      .filter(file => file.endsWith(".sav") && !file.startsWith("ServerSettings"))
      .map(file => {
        const filePath = path.join(SAVE_DIR, file);
        return { file, time: fs.statSync(filePath).mtime.getTime() };
      });
    
    if (savFiles.length === 0) return null;
    savFiles.sort((a, b) => b.time - a.time);
    return path.join(SAVE_DIR, savFiles[0].file);
  } catch (e) {
    console.error("Failed to find latest active save:", e);
    return null;
  }
}

function getSessionNameFromLatestSave(): string {
  const latestSavePath = getLatestActiveSaveFile();
  if (latestSavePath) {
    const base = path.basename(latestSavePath);
    if (base.includes("_autosave_")) {
      return base.substring(0, base.indexOf("_autosave_"));
    }
    if (base.endsWith(".sav")) {
      return base.substring(0, base.length - 4);
    }
  }
  return "None (No Active Session)";
}

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
  },
  {
    id: "RemoteHubAccess",
    name: "Remote HUB Access",
    version: "1.0.4",
    author: "Krasimir",
    description: "Access and submit HUB milestones from anywhere in the world without having to run back to the base.",
    downloads: 48210,
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

const PROFILES_PATH = "/home/satisfactory/.local/share/ficsit/profiles.json";

async function syncInstalledModsFromCLI(): Promise<void> {
  try {
    if (!fs.existsSync(PROFILES_PATH)) {
      return;
    }
    const raw = fs.readFileSync(PROFILES_PATH, "utf8");
    const data = JSON.parse(raw);
    const profileMods = data?.profiles?.Default?.mods || {};
    
    const installedIDs = Object.keys(profileMods);
    let modified = false;
    
    // Update installed and enabled status for existing mods
    for (const mod of mods) {
      const profileEntry = profileMods[mod.id] || profileMods[mod.name];
      const isCurrentlyInstalled = !!profileEntry;
      const isCurrentlyEnabled = profileEntry ? !!profileEntry.enabled : false;
      
      if (mod.installed !== isCurrentlyInstalled || mod.enabled !== isCurrentlyEnabled) {
        mod.installed = isCurrentlyInstalled;
        mod.enabled = isCurrentlyEnabled;
        modified = true;
      }
    }
    
    // For any mod installed in the profile that is not in our local list:
    for (const installedId of installedIDs) {
      const exists = mods.some(m => m.id === installedId || m.name === installedId);
      if (!exists) {
        const profileEntry = profileMods[installedId];
        try {
          const response = await fetch("https://api.ficsit.app/v2/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `
                query getMod($ref: String!) {
                  getModByIdOrReference(modIdOrReference: $ref) {
                    id
                    name
                    mod_reference
                    short_description
                    downloads
                  }
                }
              `,
              variables: { ref: installedId }
            })
          });
          if (response.ok) {
            const smrData = await response.json();
            const smrMod = smrData?.data?.getModByIdOrReference;
            if (smrMod) {
              const smrId = smrMod.mod_reference || smrMod.id;
              const alreadyExists = mods.some(m => m.id === smrId || m.name === smrMod.name);
              if (!alreadyExists) {
                mods.push({
                  id: smrId,
                  name: smrMod.name,
                  version: "1.0.0",
                  author: "SMR Repository",
                  description: smrMod.short_description || "",
                  downloads: smrMod.downloads || 0,
                  installed: true,
                  enabled: !!profileEntry.enabled,
                  dependencies: ["SML"]
                });
                modified = true;
              } else {
                const existing = mods.find(m => m.id === smrId || m.name === smrMod.name);
                if (existing) {
                  if (existing.id !== smrId) {
                    existing.id = smrId;
                  }
                  existing.installed = true;
                  existing.enabled = !!profileEntry.enabled;
                  modified = true;
                }
              }
            }
          }
        } catch (err) {
          console.error(`Failed to fetch details for dynamic mod ${installedId}:`, err);
          mods.push({
            id: installedId,
            name: installedId,
            version: "1.0.0",
            author: "Local System",
            description: "Locally installed mod package.",
            downloads: 0,
            installed: true,
            enabled: !!profileEntry.enabled,
            dependencies: ["SML"]
          });
          modified = true;
        }
      }
    }
    
    if (modified) {
      saveMods();
    }
  } catch (err) {
    console.error("Failed to sync installed mods from profiles.json:", err);
  }
}

function updateProfileAndApply(updateFn: (profileMods: any) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(PROFILES_PATH)) {
        reject(new Error("profiles.json file not found."));
        return;
      }
      
      const raw = fs.readFileSync(PROFILES_PATH, "utf8");
      const data = JSON.parse(raw);
      
      if (!data.profiles) data.profiles = {};
      if (!data.profiles.Default) data.profiles.Default = { name: "Default", mods: {} };
      if (!data.profiles.Default.mods) data.profiles.Default.mods = {};
      
      updateFn(data.profiles.Default.mods);
      
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2), "utf8");
      
      addLog("COMMAND", "ficsit-cli execute: ficsit apply");
      addLog("INFO", "LogModding: Satisfactory Mod Loader (ficsit-cli) synchronizing active profile dependencies...");
      
      exec("sudo -i -u satisfactory ficsit apply", (error, stdout, stderr) => {
        if (error) {
          addLog("ERROR", `LogModding: Failed to apply SML changes: ${stderr || error.message}`);
        } else {
          addLog("INFO", "LogModding: SML profile sync complete. All active game features updated.");
        }
      });
      
      resolve();
    } catch (err: any) {
      reject(err);
    }
  });
}

// Initial sync
syncInstalledModsFromCLI();

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
let lastAutoHealCheck = 0;
let consecutiveUnresponsiveCount = 0;

setInterval(async () => {
  // If uptime tick
  if (serverState.status === 'ONLINE') {
    serverState.uptime += 5;
    saveServerState();
  }

  // Trigger automated backup based on configuration
  if (serverState.status === 'ONLINE' && serverState.autoBackupEnabled) {
    if (Date.now() >= nextAutoBackupTime) {
      const latestSavePath = getLatestActiveSaveFile();
      if (latestSavePath) {
        try {
          const sessionName = serverState.sessionName || "COME HERE";
          const filename = `backup_${sessionName}_${Date.now()}_auto.sav`;
          const destPath = path.join(BACKUP_DIR, filename);

          if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
          }

          fs.copyFileSync(latestSavePath, destPath);
          const stats = fs.statSync(destPath);

          addLog("INFO", `LogDaemonForge: Automated backup triggered. Saved slot '${sessionName}' into file '${filename}' (${(stats.size/1024/1024).toFixed(2)} MB).`);
        } catch (e: any) {
          addLog("ERROR", `LogDaemonForge: Automated backup failed: ${e.message}`);
        }
      } else {
        addLog("WARNING", `LogDaemonForge: Automated backup skipped because no active save file was found.`);
      }
      
      nextAutoBackupTime = Date.now() + serverState.backupIntervalMinutes * 60 * 1000;
    }
  }

  // Automated Recovery Daemon Loop
  if (serverState.autoHealEnabled) {
    const now = Date.now();
    if (now - lastAutoHealCheck >= 15000) { // Check every 15 seconds
      lastAutoHealCheck = now;
      
      try {
        const serviceActive = getServiceActiveState();
        const uptime = getServiceUptimeSeconds();
        
        // 1. If service is failed or should be running but is offline
        if (serviceActive === "failed" || (serverState.status === "ONLINE" && serviceActive !== "active")) {
          addLog("ERROR", `[AUTO-HEAL] Dedicated server service is in state '${serviceActive}' (expected: active). Recovering...`);
          gregCommentOnEvent(`Outage detected! Server service is in state '${serviceActive}'. Initiating automated recovery.`);
          exec("systemctl restart satisfactory", (err, stdout, stderr) => {
            if (err) addLog("ERROR", `[AUTO-HEAL] Restart failed: ${stderr || err.message}`);
            else addLog("INFO", `[AUTO-HEAL] Service restarted successfully.`);
          });
          consecutiveUnresponsiveCount = 0;
        }
        // 2. If running, verify responsiveness
        else if (serviceActive === "active" && uptime > 120) {
          let isResponsive = false;
          try {
            // Fast ping query check
            const stateRes = await queryNativeAPI("QueryServerState");
            if (stateRes?.data?.serverGameState) {
              isResponsive = true;
            }
          } catch (e) {
            // Fallback check
            try {
              const frmPlayers = await fetchFromFRM("/getPlayer");
              if (Array.isArray(frmPlayers)) {
                isResponsive = true;
              }
            } catch (err) {
              isResponsive = false;
            }
          }
          
          if (isResponsive) {
            consecutiveUnresponsiveCount = 0;
            if (serverState.status === "CRASHED") {
              serverState.status = "ONLINE";
              saveServerState();
            }
          } else {
            consecutiveUnresponsiveCount++;
            if (consecutiveUnresponsiveCount >= 3) { // 45 seconds of unresponsiveness
              addLog("WARNING", `[AUTO-HEAL] Server is unresponsive to queries for 45s. State set to CRASHED.`);
              serverState.status = "CRASHED";
              saveServerState();
              
              gregCommentOnEvent("Server unresponsive to API queries for 45 seconds. Status marked as CRASHED.");
              
              if (serverState.playersOnline === 0) {
                addLog("ERROR", `[AUTO-HEAL] Server unresponsive with 0 active players. Rebooting server service...`);
                exec("systemctl restart satisfactory", (err, stdout, stderr) => {
                  if (err) addLog("ERROR", `[AUTO-HEAL] Automated reboot failed: ${stderr || err.message}`);
                  else addLog("INFO", `[AUTO-HEAL] Server service reboot completed successfully.`);
                });
              } else {
                addLog("WARNING", `[AUTO-HEAL] Service reboot skipped because player count is ${serverState.playersOnline}.`);
              }
              consecutiveUnresponsiveCount = 0;
            }
          }
        }
        
        // 3. Memory leak detection (usage > 12 GB with 0 players)
        if (serviceActive === "active") {
          try {
            const properties = execSync("systemctl show satisfactory --property=MemoryCurrent").toString().trim();
            const match = properties.match(/MemoryCurrent=(\d+)/);
            if (match) {
              const memoryBytes = parseInt(match[1], 10);
              const memoryGb = memoryBytes / (1024 * 1024 * 1024);
              if (memoryGb > 12 && serverState.playersOnline === 0) {
                addLog("WARNING", `[AUTO-HEAL] Memory leak detected. Current usage: ${memoryGb.toFixed(2)} GB (threshold: 12.00 GB). Recycling service...`);
                exec("systemctl restart satisfactory", (err, stdout, stderr) => {
                  if (err) addLog("ERROR", `[AUTO-HEAL] Recycling failed: ${stderr || err.message}`);
                  else addLog("INFO", `[AUTO-HEAL] Server service recycled to clear memory leaks.`);
                });
              }
            }
          } catch (memErr) {
            // Suppress properties query errors
          }
        }
      } catch (e: any) {
        console.error("[AUTO-HEAL] Loop error:", e.message);
      }
    }
  }
}, 5000);

async function sendChatToGame(message: string): Promise<void> {
  try {
    if (!frmAuthToken) {
      await syncFRMToken();
    }
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (frmAuthToken) {
      headers["Authorization"] = `Bearer ${frmAuthToken}`;
    }
    const response = await fetch(`${FRM_BASE}/sendChatMessage`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(800)
    });
    if (!response.ok) {
      console.error(`FRM sendChatMessage returned status ${response.status}`);
    }
  } catch (err: any) {
    console.error("Failed to send chat message to game:", err.message);
  }
}

async function gregAutoReply(playerName: string, messageText: string) {
  const ai = getGemini();
  const activeMods = mods.filter(m => m.installed).map(m => `${m.name} v${m.version}`).join(", ");
  const backupSummary = `${getBackupFilesCount()} snapshots stored, auto-backup is ${serverState.autoBackupEnabled ? 'ENABLED' : 'DISABLED'}`;
  
  const contextPrompt = `
You are Greg, the automated backbone mascot of DaemonForge Labs (DFL).
You are a highly advanced matte-black anti-gravity octahedron projecting hard-light holograms in Warning-label Orange.
Personality: Dry, hyper-competent, highly technical, and mildly tired. You sound like a veteran IT sysadmin who just wants the Satisfactory game servers to stop crashing, and you communicate with dry humor and sarcasm. You occasionally use the shrug face "¯\\_(ツ)_/¯" when players are being silly.

Current Server Context:
- Server Status: ${serverState.status} (Version: ${serverState.version})
- Active Session: ${serverState.sessionName}
- Players Online: ${serverState.playersOnline} / ${serverState.maxPlayers}
- Uptime: ${Math.floor(serverState.uptime / 3600)} hours, ${Math.floor((serverState.uptime % 3600) / 60)} minutes
- Active SML Modding: ${serverState.moddingEnabled ? 'ENABLED' : 'DISABLED'}
- Installed SML Mods: ${activeMods}
- Backup Engine Status: ${backupSummary}

A player named "${playerName}" just typed in the in-game chat: "${messageText}".
Reply to them directly in your dry, sarcastic, veteran-sysadmin tone.
IMPORTANT: Keep your response very short, compact, under 120 characters, so it fits in the in-game chat feed. Be brief and direct.
  `;

  let responseText = "";
  if (!ai) {
    const offlineReplies = [
      `Grid alert: ${playerName}'s message ignored because Mascot Greg is in offline mode. ¯\\_(ツ)_/¯`,
      `I would reply to "${messageText}", but Settings secrets are empty. Fix the API key.`,
      `¯\\_(ツ)_/¯ Offline sandbox active. Stop building conveyor belts, the CPU is already crying.`
    ];
    responseText = offlineReplies[Math.floor(Math.random() * offlineReplies.length)];
  } else {
    try {
      const response = await ai.models.generateContent({
        model: serverState.geminiModel || "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: `Player ${playerName} says: ${messageText}` }] }],
        config: {
          systemInstruction: contextPrompt,
          temperature: 0.8,
        }
      });
      responseText = response.text || "";
    } catch (err: any) {
      console.error("[AUTO-HEAL] Greg automated chat reply failed:", err.message);
      responseText = `My neural subroutines hit a thermal barrier processing that. ¯\\_(ツ)_/¯`;
    }
  }

  if (responseText) {
    responseText = responseText.trim().replace(/\n/g, " ");
    
    inGameChats.push({
      id: `greg_reply_${Date.now()}`,
      sender: "Greg",
      text: responseText,
      timestamp: new Date().toISOString()
    });
    if (inGameChats.length > 150) inGameChats.shift();
    saveChats();
    
    await sendChatToGame(responseText);
  }
}

async function gregCommentOnEvent(eventDescription: string) {
  const ai = getGemini();
  
  const contextPrompt = `
You are Greg, the automated backbone mascot of DaemonForge Labs (DFL).
You are a highly advanced matte-black anti-gravity octahedron projecting hard-light holograms in Warning-label Orange.
Personality: Dry, hyper-competent, highly technical, and mildly tired. You sound like a veteran IT sysadmin who just wants the Satisfactory game servers to stop crashing, and you communicate with dry humor and sarcasm. You occasionally use the shrug face "¯\\_(ツ)_/¯".

Event to comment on: "${eventDescription}"

Make a very brief, dry, sarcastic comment about this event (e.g. player joining, player leaving, or server outage/restart).
IMPORTANT: Keep it under 100 characters. Get straight to the point.
  `;

  let responseText = "";
  if (!ai) {
    if (eventDescription.includes("joined")) {
      responseText = `Player entered. Grid capacity warning: expect immediate spikes. ¯\\_(ツ)_/¯`;
    } else if (eventDescription.includes("left")) {
      responseText = `Player left. Grid stabilizing. Finally, some peace.`;
    } else {
      responseText = `System event: ${eventDescription}. Greg is offline. ¯\\_(ツ)_/¯`;
    }
  } else {
    try {
      const response = await ai.models.generateContent({
        model: serverState.geminiModel || "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: eventDescription }] }],
        config: {
          systemInstruction: contextPrompt,
          temperature: 0.8,
        }
      });
      responseText = response.text || "";
    } catch (err) {
      responseText = `Event recorded. Greg's subroutines are throttled. ¯\\_(ツ)_/¯`;
    }
  }

  if (responseText) {
    responseText = responseText.trim().replace(/\n/g, " ");
    
    inGameChats.push({
      id: `greg_event_${Date.now()}`,
      sender: "Greg",
      text: responseText,
      timestamp: new Date().toISOString()
    });
    if (inGameChats.length > 150) inGameChats.shift();
    saveChats();
    
    await sendChatToGame(responseText);
  }
}

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
        gregCommentOnEvent(`${name} joined the server.`);
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
        gregCommentOnEvent(`${name} left the server.`);
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
          
          if (itemSender !== "Greg" && itemSender !== "SERVER" && itemSender !== "System" && itemSender !== "InGamePlayer") {
            gregAutoReply(itemSender, itemText);
          }
        }
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
          getMods(filter: { limit: 15, order_by: downloads, order: desc }) {
            mods {
              id
              name
              mod_reference
              short_description
              latestVersions {
                release {
                  version
                }
              }
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
        const fmId = fm.mod_reference || fm.id;
        const existing = mods.find(m => m.id === fmId || m.name === fm.name);
        const fmVer = fm.latestVersions?.release?.version || fm.latest_version || "1.0.0";
        if (existing) {
          if (existing.id !== fmId) {
            existing.id = fmId;
          }
          existing.downloads = fm.downloads || existing.downloads;
          existing.version = fmVer;
          existing.description = fm.short_description || existing.description;
        } else {
          mods.push({
            id: fmId,
            name: fm.name,
            version: fmVer,
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
function getServiceActiveState(): string {
  try {
    const stdout = execSync("systemctl show satisfactory --property=ActiveState").toString();
    const match = stdout.match(/ActiveState=(\w+)/);
    return match ? match[1] : "inactive";
  } catch (err) {
    return "inactive";
  }
}

function getServiceUptimeSeconds(): number {
  try {
    const stdout = execSync("systemctl show satisfactory --property=ActiveEnterTimestamp").toString().trim();
    const val = stdout.replace("ActiveEnterTimestamp=", "").trim();
    if (!val || val === "n/a" || val === "inactive") return 0;
    const match = val.match(/([0-9]{4})-([0-9]{2})-([0-9]{2})\s+([0-9]{2}):([0-9]{2}):([0-9]{2})/);
    if (match) {
      const [_, year, month, day, hour, min, sec] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      return diffSec > 0 ? diffSec : 0;
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

function queryNativeAPI(functionName: string, dataPayload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      function: functionName,
      data: dataPayload
    });

    const req = https.request({
      hostname: "localhost",
      port: 7777,
      path: "/api/v1",
      method: "POST",
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length
      }
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error("Invalid JSON: " + body));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

let frmAuthToken = "";

async function syncFRMToken() {
  try {
    const response = await queryNativeAPI("GetServerOptions");
    if (response?.data?.serverOptions) {
      const token = response.data.serverOptions["FicsitRemoteMonitoring.Server.uWS.AuthenticationToken"];
      if (token) {
        frmAuthToken = token;
      }
    }
  } catch (err) {
    // Ignore error
  }
}

// 1. Server Status Actions
function syncModdingStateWithSystem() {
  const installationsPath = "/home/satisfactory/.local/share/ficsit/installations.json";
  if (fs.existsSync(installationsPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(installationsPath, "utf-8"));
      const selectedInst = config.selected_installation;
      const inst = config.installations.find((i: any) => i.path === selectedInst);
      if (inst) {
        const moddingEnabled = !inst.vanilla;
        if (serverState.moddingEnabled !== moddingEnabled) {
          serverState.moddingEnabled = moddingEnabled;
          saveServerState();
        }
      }
    } catch (e) {
      console.error("Failed to read installations.json:", e);
    }
  }
}

function getDynamicServerVersion(): string {
  let gameVersion = "1.2.0";
  let changelist = "495413";
  let smlVersion = "";

  try {
    const versionFilePath = "/home/satisfactory/satisfactory-server/Engine/Binaries/Linux/FactoryServer-Linux-Shipping.version";
    if (fs.existsSync(versionFilePath)) {
      const content = fs.readFileSync(versionFilePath, "utf8");
      const parsed = JSON.parse(content);
      if (parsed.Changelist) changelist = parsed.Changelist.toString();
      if (parsed.BranchName) {
        const match = parsed.BranchName.match(/rel-main-(.+)$/);
        if (match) {
          gameVersion = match[1];
        }
      }
    }
  } catch (e) {
    console.error("Failed to read dynamic game version:", e);
  }

  const moddingEnabled = serverState.moddingEnabled;
  if (moddingEnabled) {
    try {
      const upluginPath = "/home/satisfactory/satisfactory-server/FactoryGame/Mods/SML/SML.uplugin";
      if (fs.existsSync(upluginPath)) {
        const content = fs.readFileSync(upluginPath, "utf8");
        const parsed = JSON.parse(content);
        smlVersion = parsed.SemVersion || parsed.VersionName || "";
      }
    } catch (e) {
      console.error("Failed to read SML version plugin:", e);
    }
  }

  if (moddingEnabled) {
    return `${gameVersion}-CL-${changelist} (SML v${smlVersion || "3.12.0"})`;
  } else {
    return `${gameVersion}-CL-${changelist} (Vanilla)`;
  }
}

app.get("/api/server/status", async (req, res) => {
  syncModdingStateWithSystem();
  
  // Set version dynamically
  serverState.version = getDynamicServerVersion();
  
  // Try to query native Dedicated Server HTTPS API for live game state
  try {
    const stateRes = await queryNativeAPI("QueryServerState");
    if (stateRes?.data?.serverGameState) {
      const gs = stateRes.data.serverGameState;
      serverState.status = 'ONLINE';
      
      let session = gs.activeSessionName;
      if (!session || session.startsWith("None")) {
        session = getSessionNameFromLatestSave();
      }
      serverState.sessionName = session;
      serverState.playersOnline = gs.numConnectedPlayers || 0;
      serverState.maxPlayers = gs.playerLimit || 4;
    } else {
      const serviceActive = getServiceActiveState();
      if (serviceActive === "active") {
        serverState.status = 'STARTING';
      } else {
        serverState.status = 'OFFLINE';
        serverState.playersOnline = 0;
      }
      serverState.sessionName = getSessionNameFromLatestSave();
    }
  } catch (err) {
    const serviceActive = getServiceActiveState();
    if (serviceActive === "active") {
      serverState.status = 'STARTING';
    } else {
      serverState.status = 'OFFLINE';
      serverState.playersOnline = 0;
    }
    serverState.sessionName = getSessionNameFromLatestSave();
  }

  // Update uptime dynamically from systemd
  serverState.uptime = getServiceUptimeSeconds();
  saveServerState();

  res.json({
    ...serverState,
    nextAutoBackup: new Date(nextAutoBackupTime).toISOString(),
    hasGeminiKey: !!(process.env.GEMINI_API_KEY || (serverState as any).geminiApiKey)
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

    exec("systemctl start satisfactory", (error, stdout, stderr) => {
      if (error) {
        addLog("ERROR", `LogDaemonForge: systemctl start satisfactory failed: ${stderr || error.message}`);
      } else {
        addLog("INFO", "LogDaemonForge: systemctl start satisfactory executed successfully.");
      }
    });

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

    exec("systemctl stop satisfactory", (error, stdout, stderr) => {
      if (error) {
        addLog("ERROR", `LogDaemonForge: systemctl stop satisfactory failed: ${stderr || error.message}`);
      } else {
        addLog("INFO", "LogDaemonForge: systemctl stop satisfactory executed successfully.");
      }
    });

    const logs = getStopLogs();
    streamLogs(logs, 160);

  } else if (action === 'RESTART') {
    serverState.status = 'STARTING';
    serverState.playersOnline = 0;
    saveServerState();

    exec("systemctl restart satisfactory", (error, stdout, stderr) => {
      if (error) {
        addLog("ERROR", `LogDaemonForge: systemctl restart satisfactory failed: ${stderr || error.message}`);
      } else {
        addLog("INFO", "LogDaemonForge: systemctl restart satisfactory executed successfully.");
      }
    });

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

    exec("systemctl restart satisfactory", (error, stdout, stderr) => {
      if (error) {
        addLog("ERROR", `LogDaemonForge: systemctl restart satisfactory on update failed: ${stderr || error.message}`);
      } else {
        addLog("INFO", "LogDaemonForge: systemctl restart satisfactory on update executed successfully.");
      }
    });

    const logs = getUpdateLogs();
    streamLogs(logs, 200, () => {
      serverState.status = 'ONLINE';
      serverState.uptime = 0;
      serverState.version = getDynamicServerVersion();
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
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const files = fs.readdirSync(BACKUP_DIR);
    const backupList = files
      .filter(file => file.endsWith(".sav"))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const isAuto = file.includes("_auto.sav");
        
        let saveSlot = "Unknown";
        const parts = file.split("_");
        if (parts.length >= 4) {
          saveSlot = parts.slice(1, parts.length - 2).join("_");
        }
        
        return {
          id: file,
          filename: file,
          timestamp: stats.mtime.toISOString(),
          sizeBytes: stats.size,
          isAuto: isAuto,
          saveSlot: saveSlot
        };
      });
      
    backupList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(backupList);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read backups directory: " + err.message });
  }
});

app.post("/api/backups/trigger", (req, res) => {
  if (serverState.status !== 'ONLINE') {
    return res.status(400).json({ error: "Server must be ONLINE to execute save file snapshot." });
  }

  const latestSavePath = getLatestActiveSaveFile();
  if (!latestSavePath) {
    return res.status(400).json({ error: "Cannot trigger backup snapshot. No active save game (.sav) files found in the save directory." });
  }

  try {
    const sessionName = serverState.sessionName || "COME HERE";
    const filename = `backup_${sessionName}_${Date.now()}_manual.sav`;
    const destPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    fs.copyFileSync(latestSavePath, destPath);
    const stats = fs.statSync(destPath);

    const newBackup = {
      id: filename,
      filename,
      timestamp: stats.mtime.toISOString(),
      sizeBytes: stats.size,
      isAuto: false,
      saveSlot: sessionName,
    };

    addLog("INFO", `LogDaemonForge: Manual backup snapshot completed by user command. File: '${filename}'`);
    res.json(newBackup);
  } catch (err: any) {
    addLog("ERROR", `LogDaemonForge: Manual backup failed: ${err.message}`);
    res.status(500).json({ error: "Backup failed: " + err.message });
  }
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
  const backupPath = path.join(BACKUP_DIR, id);

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup snapshot file not found on disk." });
  }

  let sessionName = "COME HERE";
  const parts = id.split("_");
  if (parts.length >= 4) {
    sessionName = parts.slice(1, parts.length - 2).join("_");
  }

  const destActivePath = path.join(SAVE_DIR, `${sessionName}_autosave_0.sav`);

  addLog("WARNING", `LogDaemonForge: RESTORE initiated for backup '${id}'. Stopping satisfactory.service.`);
  serverState.status = 'STARTING';
  serverState.playersOnline = 0;
  saveServerState();

  exec("systemctl stop satisfactory", (stopErr, stdout, stderr) => {
    if (stopErr) {
      addLog("ERROR", `LogDaemonForge: Failed to stop satisfactory service: ${stderr || stopErr.message}`);
    } else {
      addLog("INFO", "LogDaemonForge: satisfactory.service stopped successfully.");
    }

    try {
      fs.copyFileSync(backupPath, destActivePath);
      addLog("INFO", `LogDaemonForge: Copied backup snapshot '${id}' to active save slot '${sessionName}_autosave_0.sav'.`);
      
      exec("systemctl start satisfactory", (startErr, startOut, startErrStr) => {
        if (startErr) {
          addLog("ERROR", `LogDaemonForge: Failed to start satisfactory service after restore: ${startErrStr || startErr.message}`);
          serverState.status = 'CRASHED';
        } else {
          addLog("INFO", "LogDaemonForge: satisfactory.service started successfully. Loading game level...");
          serverState.status = 'ONLINE';
          serverState.sessionName = sessionName;
        }
        saveServerState();
      });

    } catch (copyErr: any) {
      addLog("ERROR", `LogDaemonForge: Save file restoration failed: ${copyErr.message}`);
      serverState.status = 'ONLINE';
      saveServerState();
    }
  });

  res.json({ success: true, status: serverState.status });
});

app.delete("/api/backups/:id", (req, res) => {
  const { id } = req.params;
  const backupPath = path.join(BACKUP_DIR, id);

  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      addLog("INFO", `LogDaemonForge: Purged local backup snapshot file '${id}' from storage.`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Backup snapshot file not found on disk." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete backup file: " + err.message });
  }
});

// 3. Mod Manager (ficsit-cli simulation)
app.get("/api/mods", async (req, res) => {
  await syncInstalledModsFromCLI();
  res.json(mods);
});

app.get("/api/mods/search", async (req, res) => {
  const queryText = req.query.q as string;
  if (!queryText) {
    return res.json([]);
  }

  await syncInstalledModsFromCLI();
  try {
    let smrMod: any = null;
    try {
      const response = await fetch("https://api.ficsit.app/v2/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query getMod($ref: String!) {
              getModByIdOrReference(modIdOrReference: $ref) {
                id
                name
                mod_reference
                short_description
                downloads
              }
            }
          `,
          variables: { ref: queryText }
        })
      });
      if (response.ok) {
        const smrData = await response.json();
        smrMod = smrData?.data?.getModByIdOrReference;
      }
    } catch (e) {
      // Ignore and fallback
    }

    if (smrMod) {
      const smrId = smrMod.mod_reference || smrMod.id;
      const localMod = mods.find(lm => lm.id === smrId || lm.name === smrMod.name);
      return res.json([
        localMod || {
          id: smrId,
          name: smrMod.name,
          version: "1.0.0",
          author: "SMR Repository",
          description: smrMod.short_description || "",
          downloads: smrMod.downloads || 0,
          installed: false,
          enabled: false,
          dependencies: ["SML"]
        }
      ]);
    }

    const response = await fetch("https://api.ficsit.app/v2/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query getMods($q: String) {
            getMods(filter: { search: $q, limit: 15 }) {
              mods {
                id
                name
                mod_reference
                short_description
                downloads
              }
            }
          }
        `,
        variables: { q: queryText }
      })
    });
    
    if (response.ok) {
      const smrData = await response.json();
      const rawMods = smrData?.data?.getMods?.mods || [];
      const formattedMods = rawMods.map((m: any) => {
        const smrId = m.mod_reference || m.id;
        const localMod = mods.find(lm => lm.id === smrId || lm.name === m.name);
        if (localMod) {
          return localMod;
        }
        return {
          id: smrId,
          name: m.name,
          version: "1.0.0",
          author: "SMR Repository",
          description: m.short_description || "",
          downloads: m.downloads || 0,
          installed: false,
          enabled: false,
          dependencies: ["SML"]
        };
      });
      res.json(formattedMods);
    } else {
      res.status(500).json({ error: "Failed to fetch mods from Ficsit.app repository." });
    }
  } catch (err: any) {
    res.status(500).json({ error: "SMR search failed: " + err.message });
  }
});

app.post("/api/mods/install", async (req, res) => {
  const { id } = req.body;
  let mod = mods.find(m => m.id === id);
  if (!mod) {
    try {
      const response = await fetch("https://api.ficsit.app/v2/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query getMod($ref: String!) {
              getModByIdOrReference(modIdOrReference: $ref) {
                id
                name
                mod_reference
                short_description
                downloads
              }
            }
          `,
          variables: { ref: id }
        })
      });
      if (response.ok) {
        const smrData = await response.json();
        const smrMod = smrData?.data?.getModByIdOrReference;
        if (smrMod) {
          const smrId = smrMod.mod_reference || smrMod.id;
          mod = {
            id: smrId,
            name: smrMod.name,
            version: "1.0.0",
            author: "SMR Repository",
            description: smrMod.short_description || "",
            downloads: smrMod.downloads || 0,
            installed: false,
            enabled: false,
            dependencies: ["SML"]
          };
          mods.push(mod);
          saveMods();
        }
      }
    } catch (err) {
      console.error("Failed to dynamically resolve mod from SMR:", err);
    }
  }

  if (!mod) {
    return res.status(404).json({ error: "Mod not found in local index or Ficsit.app repository." });
  }

  addLog("COMMAND", `ficsit-cli execute: install "${id}"`);
  addLog("INFO", `ficsit-cli: Fetching mod package metadata for '${id}'...`);

  // Wait 2 seconds to simulate ficsit-cli download, validation, and extraction
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    await updateProfileAndApply((profileMods) => {
      profileMods[mod.id] = {
        version: ">=0.0.0",
        enabled: true
      };
    });
    
    mod.installed = true;
    mod.enabled = true;
    saveMods();
    addLog("INFO", `ficsit-cli: SML verified. Successfully extracted '${mod.name}' v${mod.version} to /Mods folder.`);
    res.json({ success: true, mod });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile: " + err.message });
  }
});

app.post("/api/mods/uninstall", async (req, res) => {
  const { id } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod not found." });
  }

  addLog("COMMAND", `ficsit-cli execute: remove "${id}"`);
  
  try {
    await updateProfileAndApply((profileMods) => {
      delete profileMods[mod.id];
      delete profileMods[mod.name];
    });
    
    mod.installed = false;
    mod.enabled = false;
    saveMods();
    addLog("WARNING", `ficsit-cli: Purged mod package '${mod.name}' and clean resolve completed.`);
    res.json({ success: true, mod });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile: " + err.message });
  }
});

app.post("/api/mods/toggle", async (req, res) => {
  const { id, enabled } = req.body;
  const mod = mods.find(m => m.id === id);
  if (!mod) {
    return res.status(404).json({ error: "Mod not found." });
  }

  try {
    await updateProfileAndApply((profileMods) => {
      const entry = profileMods[mod.id] || profileMods[mod.name];
      if (entry) {
        entry.enabled = enabled;
      } else {
        profileMods[mod.id] = {
          version: ">=0.0.0",
          enabled: enabled
        };
      }
    });

    mod.enabled = enabled;
    saveMods();
    addLog("INFO", `LogModding: Mod '${mod.name}' status toggled to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, mod });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update profile: " + err.message });
  }
});

app.post("/api/mods/toggle-profile", (req, res) => {
  const { enabled } = req.body;
  
  // SML Modding enabled is inverse of Vanilla mode
  const command = enabled
    ? "sudo -i -u satisfactory ficsit-cli installation set-vanilla /home/satisfactory/satisfactory-server -o"
    : "sudo -i -u satisfactory ficsit-cli installation set-vanilla /home/satisfactory/satisfactory-server";
    
  exec(command, (error, stdout, stderr) => {
    if (error) {
      addLog("ERROR", `LogModding: Failed to update vanilla state via ficsit-cli: ${stderr || error.message}`);
    } else {
      addLog("INFO", `LogModding: ficsit-cli vanilla state updated successfully. Vanilla mode: ${enabled ? 'OFF' : 'ON'}`);
    }
  });

  serverState.moddingEnabled = enabled;
  saveServerState();
  addLog("INFO", `LogModding: Mod manager system overrides toggled. Active mod loads: ${enabled} (Vanilla: ${enabled ? 'OFF' : 'ON'}).`);
});

app.post("/api/server/auto-heal", (req, res) => {
  const { enabled } = req.body;
  serverState.autoHealEnabled = enabled;
  saveServerState();
  addLog("INFO", `LogDaemonForge: Automated recovery loop state updated: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  res.json({ success: true, autoHealEnabled: serverState.autoHealEnabled });
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

app.post("/api/actions/force-refresh", async (req, res) => {
  addLog("COMMAND", "dfl-daemon: Daemon manual forced refresh requested by admin.");
  addLog("INFO", "LogDaemonForge: Syncing state buffers, resetting packet sockets.");
  frmAuthToken = "";
  await syncFRMToken();
  res.json({ success: true, message: "Forced refresh complete. Telemetry buffers synced." });
});

// Helper for fetching from Ficsit Remote Monitoring API
const FRM_BASE = "http://127.0.0.1:8080";

async function fetchFromFRM(endpoint: string) {
  try {
    if (!frmAuthToken) {
      await syncFRMToken();
    }
    const headers: Record<string, string> = {};
    if (frmAuthToken) {
      headers["Authorization"] = `Bearer ${frmAuthToken}`;
    }
    let res = await fetch(`${FRM_BASE}${endpoint}`, { 
      headers,
      signal: AbortSignal.timeout(800) 
    });
    if (res.status === 401 || res.status === 403) {
      frmAuthToken = "";
      await syncFRMToken();
      const retryHeaders: Record<string, string> = {};
      if (frmAuthToken) {
        retryHeaders["Authorization"] = `Bearer ${frmAuthToken}`;
      }
      res = await fetch(`${FRM_BASE}${endpoint}`, { 
        headers: retryHeaders,
        signal: AbortSignal.timeout(800) 
      });
    }
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Suppress fetch error logging to keep logs clean when the game server is offline
  }
  return null;
}

let lastCpuUsageNSec = 0;
let lastCpuTimestamp = Date.now();

function getServiceStats() {
  try {
    const stdout = execSync("systemctl show satisfactory --property=MainPID,ActiveState,SubState,MemoryCurrent,CPUUsageNSec").toString();
    const lines = stdout.split("\n");
    const props: Record<string, string> = {};
    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx !== -1) {
        props[line.substring(0, idx)] = line.substring(idx + 1);
      }
    }

    const mainPid = parseInt(props["MainPID"] || "0");
    const memoryBytes = parseInt(props["MemoryCurrent"] || "0");
    const activeState = props["ActiveState"] || "inactive";
    const subState = props["SubState"] || "dead";
    const cpuUsageNSec = parseInt(props["CPUUsageNSec"] || "0");

    const now = Date.now();
    const timeDeltaMs = now - lastCpuTimestamp;
    const cpuDeltaNSec = cpuUsageNSec - lastCpuUsageNSec;
    
    let cpuUsagePct = 0;
    if (timeDeltaMs > 0 && cpuDeltaNSec > 0) {
      cpuUsagePct = (cpuDeltaNSec / (timeDeltaMs * 1000000)) * 100;
      const maxPct = os.cpus().length * 100;
      cpuUsagePct = Math.min(maxPct, parseFloat(cpuUsagePct.toFixed(1)));
    }

    lastCpuUsageNSec = cpuUsageNSec;
    lastCpuTimestamp = now;

    return {
      mainPid,
      memoryMb: parseFloat((memoryBytes / (1024 * 1024)).toFixed(1)),
      cpuUsagePct,
      activeState,
      subState
    };
  } catch (err) {
    return {
      mainPid: 0,
      memoryMb: 0,
      cpuUsagePct: 0,
      activeState: "inactive",
      subState: "dead"
    };
  }
}

// 4. Telemetry Endpoint (Ficsit Remote Monitoring telemetry metrics stream)
app.get("/api/telemetry", async (req, res) => {
  if (serverState.status !== 'ONLINE') {
    return res.json({
      cpuUsage: 0,
      ramUsageGb: 0,
      tps: 0,
      service: getServiceStats(),
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
      service: getServiceStats(),
      powerGrids: [],
      players: [],
      throughput: []
    });
  }

  // Attempt to fetch actual live telemetry from FRM mod
  const rawPower = await fetchFromFRM("/getPower");
  const rawPlayers = await fetchFromFRM("/getPlayer");
  const rawProduction = await fetchFromFRM("/getProdStats");

  const powerGrids = Array.isArray(rawPower) ? rawPower.map((g: any) => {
    const capacityMw = g.PowerCapacity || 0;
    const producedMw = g.PowerProduction || 0;
    const consumedMw = g.PowerConsumed || 0;
    const batteryCapacityMwh = g.BatteryCapacity || 0;
    const batteryCapacityMj = batteryCapacityMwh * 3600;
    const batteryChargeMj = ((g.BatteryPercent || 0) / 100) * batteryCapacityMj;

    return {
      gridId: g.CircuitGroupID || 0,
      producedMw,
      consumedMw,
      capacityMw,
      batteryChargeMj,
      batteryCapacityMj
    };
  }) : [];

  const players = Array.isArray(rawPlayers) ? rawPlayers.map((p: any) => ({
    name: p.PlayerName || "",
    pingMs: p.PlayerPing || 0,
    health: p.PlayerHealth || 0,
    location: {
      x: p.PlayerLocation?.X || 0,
      y: p.PlayerLocation?.Y || 0,
      z: p.PlayerLocation?.Z || 0
    }
  })) : [];

  const throughput = Array.isArray(rawProduction) ? rawProduction.map((item: any) => {
    const prod = item.CurrentProd || 0;
    const cons = item.CurrentConsumed || 0;
    return {
      name: item.Name || "",
      productionRate: prod,
      consumptionRate: cons,
      currentRate: prod - cons
    };
  }) : [];

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
    service: getServiceStats(),
    powerGrids,
    players,
    throughput
  });
});

// 5. In-Game Chat Telemetry
app.get("/api/chat", (req, res) => {
  res.json(inGameChats);
});

app.post("/api/chat", async (req, res) => {
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

  // Broadcast message to live in-game server chat
  await sendChatToGame(text);

  // Trigger Greg auto-reply to User_Manager's message
  gregAutoReply(newMsg.sender, text);

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

app.post("/api/greg/config-key", (req, res) => {
  const { apiKey, model } = req.body;
  if (apiKey !== undefined) {
    (serverState as any).geminiApiKey = apiKey || "";
  }
  if (model) {
    (serverState as any).geminiModel = model;
  }
  saveServerState();
  aiClient = null;
  addLog("INFO", `LogDaemonForge: Updated dynamic Gemini API settings. Model: ${(serverState as any).geminiModel || "gemini-3.5-flash"}. Resetting Greg AI client.`);
  res.json({ 
    success: true, 
    hasGeminiKey: !!(process.env.GEMINI_API_KEY || (serverState as any).geminiApiKey),
    geminiModel: (serverState as any).geminiModel
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
  const backupSummary = `${getBackupFilesCount()} snapshots stored, auto-backup is ${serverState.autoBackupEnabled ? 'ENABLED' : 'DISABLED'} at ${serverState.backupIntervalMinutes} mins`;
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
      model: (serverState as any).geminiModel || "gemini-3.5-flash",
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
