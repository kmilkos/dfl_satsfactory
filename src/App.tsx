import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ServerState, Backup, Mod, ConsoleLogLine, TelemetryData, ChatMessage, TelemetryHistoryPoint 
} from "./types";
import CommandBridge from "./components/CommandBridge";
import OperationsPanel from "./components/OperationsPanel";
import InGameChatPanel from "./components/InGameChatPanel";
import PublicStatusPortal from "./components/PublicStatusPortal";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
import GregAssistant from "./components/GregAssistant";
import SettingsPanel from "./components/SettingsPanel";
import MachineSeriesDiagram from "./components/MachineSeriesDiagram";
import { 
  Copy, Check, ExternalLink, Lock, Shield, Activity, Wifi, Cpu, Layers, Terminal, User, Server, Hash 
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("chat");
  
  const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  
  // Shared States
  const [serverStatus, setServerStatus] = useState<ServerState["status"]>("ONLINE");
  const [serverInfo, setServerInfo] = useState<ServerState>({
    status: "ONLINE",
    version: "1.0.0.12 (SML v3.8.0-Build2)",
    uptime: 0,
    playersOnline: 0,
    maxPlayers: 8,
    sessionName: "None (No Active Session)",
    autoBackupEnabled: true,
    backupIntervalMinutes: 15,
    moddingEnabled: true,
  });

  const [browserTitle, setBrowserTitle] = useState<string>(() => {
    return localStorage.getItem("browserTitle") || "FICSIT SECTOR ALPHA | SERVER STATUS";
  });

  useEffect(() => {
    if (browserTitle) {
      document.title = browserTitle;
      localStorage.setItem("browserTitle", browserTitle);
    } else {
      const dynamicDefault = `DFL Satisfactory Server - ${serverInfo.sessionName || "Offline"}`;
      document.title = dynamicDefault;
    }
  }, [browserTitle, serverInfo.sessionName]);

  const [backupsList, setBackupsList] = useState<Backup[]>([]);
  const [modsList, setModsList] = useState<Mod[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogLine[]>([]);
  const [inGameChats, setInGameChats] = useState<ChatMessage[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    cpuUsage: 0,
    ramUsageGb: 0,
    tps: 0,
    powerGrids: [],
    players: [],
    throughput: []
  });

  // Pre-populate with 15 starting data points so the chart is shaped beautifully on mount
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryHistoryPoint[]>(() => {
    const points: TelemetryHistoryPoint[] = [];
    const now = Date.now();
    for (let i = 14; i >= 0; i--) {
      const timeString = new Date(now - i * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      points.push({
        time: timeString,
        cpu: 0,
        ram: 0
      });
    }
    return points;
  });

  const [isLoading, setIsLoading] = useState(false);

  // -----------------------------------------------------------------------------
  // API INTEGRATION FETCHES
  // -----------------------------------------------------------------------------

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/server/status");
      const data = await res.json();
      setServerStatus(data.status);
      setServerInfo(data);
    } catch (err) {
      console.error("Failed to fetch server status:", err);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/backups");
      const data = await res.json();
      setBackupsList(data);
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    }
  };

  const fetchMods = async () => {
    try {
      const res = await fetch("/api/mods");
      const data = await res.json();
      setModsList(data);
    } catch (err) {
      console.error("Failed to fetch SML mods:", err);
    }
  };

  const fetchLogsAndChats = async () => {
    try {
      // Parallel fetch for logs and chats
      const [logsRes, chatsRes] = await Promise.all([
        fetch("/api/logs"),
        fetch("/api/chat")
      ]);
      const logsData = await logsRes.json();
      const chatsData = await chatsRes.json();
      setConsoleLogs(logsData);
      setInGameChats(chatsData);
    } catch (err) {
      console.error("Failed to fetch logs or chats:", err);
    }
  };

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/telemetry");
      const data = await res.json();
      setTelemetry(data);

      // Append to telemetryHistory
      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTelemetryHistory(prev => {
        const nextPoint: TelemetryHistoryPoint = {
          time: timeString,
          cpu: data.cpuUsage,
          ram: data.ramUsageGb,
          serviceCpu: data.service?.cpuUsagePct || 0,
          serviceRam: data.service?.memoryMb || 0
        };
        const updated = [...prev, nextPoint];
        if (updated.length > 30) {
          return updated.slice(updated.length - 30);
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to fetch telemetry metrics:", err);
    }
  };

  // -----------------------------------------------------------------------------
  // API AUTH WRAPPER AND HANDLERS
  // -----------------------------------------------------------------------------
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  const handlePortalLogin = async (password: string) => {
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("adminToken", data.token);
        setToken(data.token);
        setIsLoggedIn(true);
      } else {
        const data = await res.json();
        setLoginError(data.error || "Login failed.");
      }
    } catch (err) {
      setLoginError("Failed to connect to authentication server.");
    }
  };



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("adminToken", data.token);
        setToken(data.token);
        setIsLoggedIn(true);
        setPasswordInput("");
      } else {
        const data = await res.json();
        setLoginError(data.error || "Login failed.");
      }
    } catch (err) {
      setLoginError("Failed to connect to authentication server.");
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }
    localStorage.removeItem("adminToken");
    setToken(null);
    setIsLoggedIn(false);
  };

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          const res = await fetch("/api/auth/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
          });
          const data = await res.json();
          if (data.valid) {
            setIsLoggedIn(true);
          } else {
            localStorage.removeItem("adminToken");
            setToken(null);
            setIsLoggedIn(false);
          }
        } catch (err) {
          console.error("Token validation failed:", err);
        }
      }
    };
    validateToken();
  }, [token]);

  // Set up polling intervals for public data
  useEffect(() => {
    fetchStatus();
    fetchMods();
    fetchTelemetry();

    // Poll status and telemetry every 3 seconds
    const statsInterval = setInterval(() => {
      fetchStatus();
      fetchTelemetry();
    }, 3000);

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  // Set up polling intervals for admin data
  useEffect(() => {
    if (!isLoggedIn) return;

    fetchBackups();
    fetchLogsAndChats();

    const adminInterval = setInterval(() => {
      fetchBackups();
      fetchLogsAndChats();
    }, 3000);

    return () => {
      clearInterval(adminInterval);
    };
  }, [isLoggedIn]);

  // -----------------------------------------------------------------------------
  // API ACTION TRIGGERS (ADMIN ONLY ROUTES)
  // -----------------------------------------------------------------------------

  const handleServerAction = async (action: "START" | "STOP" | "RESTART" | "UPDATE") => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth("/api/server/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      setServerStatus(data.status);
      await fetchStatus();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Server action failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth("/api/backups/trigger", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to trigger save backup.");
        return;
      }
      await fetchBackups();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Backup trigger failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBackupConfig = async (enabled: boolean, intervalMinutes: number) => {
    try {
      await fetchWithAuth("/api/backups/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalMinutes })
      });
      await fetchStatus();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Saving backup configuration failed:", err);
    }
  };

  const handleRestoreBackup = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      setServerStatus(data.status);
      await fetchStatus();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Restore failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    try {
      await fetchWithAuth(`/api/backups/${id}`, { method: "DELETE" });
      await fetchBackups();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Backup deletion failed:", err);
    }
  };

  const handlePurgeBackups = async () => {
    setIsLoading(true);
    try {
      await fetchWithAuth("/api/backups/purge", { method: "POST" });
      await fetchBackups();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Backup purge failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallMod = async (id: string) => {
    setIsLoading(true);
    try {
      await fetchWithAuth("/api/mods/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      await fetchMods();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Mod installation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUninstallMod = async (id: string) => {
    setIsLoading(true);
    try {
      await fetchWithAuth("/api/mods/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      await fetchMods();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Mod removal failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMod = async (id: string, enabled: boolean) => {
    setIsLoading(true);
    try {
      await fetchWithAuth("/api/mods/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled })
      });
      await fetchMods();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Toggling mod status failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleModdingProfile = async (enabled: boolean) => {
    try {
      await fetchWithAuth("/api/mods/toggle-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      await fetchStatus();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Toggling SML profile failed:", err);
    }
  };

  const handleSendChatMessage = async (text: string) => {
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: "User_Manager", text })
      });
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Chat sending failed:", err);
    }
  };

  if (!isLoggedIn) {
    return (
      <PublicStatusPortal
        serverStatus={serverStatus}
        serverInfo={serverInfo}
        telemetry={telemetry}
        onLogin={handlePortalLogin}
        loginError={loginError}
        isLoading={isLoading}
        browserTitle={browserTitle}
      />
    );
  }

  return (
    <div className="w-screen min-h-screen bg-zinc-950 font-sans flex flex-col overflow-x-hidden text-slate-100">
      
      {/* Sticky Command Bridge Header navigation */}
      <CommandBridge 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        serverStatus={serverStatus} 
        onLogout={handleLogout}
      />

      {/* Main viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-y-auto md:overflow-hidden flex flex-col justify-center">
        
        {/* Animated layout stage wrapper */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 bg-zinc-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
            id={`stage-${activeTab}`}
          >
            {/* 0. LIVE IN-GAME CHAT PANEL */}
            {activeTab === "chat" && (
              <InGameChatPanel
                inGameChats={inGameChats}
                onSendChatMessage={handleSendChatMessage}
                telemetry={telemetry}
                isLoading={isLoading}
                gregName={serverInfo.gregName || "Mascot_Greg"}
              />
            )}

            {/* 1. OPERATIONS PANEL: SERVER NODES, BACKUPS, MODS */}
            {(activeTab === "nodes" || activeTab === "backups" || activeTab === "mods") && (
              <OperationsPanel
                activeSubTab={activeTab as "nodes" | "backups" | "mods"}
                serverStatus={serverStatus}
                serverInfo={serverInfo}
                backupsList={backupsList}
                modsList={modsList}
                telemetry={telemetry}
                onServerAction={handleServerAction}
                onTriggerBackup={handleTriggerBackup}
                onSaveBackupConfig={handleSaveBackupConfig}
                onRestoreBackup={handleRestoreBackup}
                onDeleteBackup={handleDeleteBackup}
                onPurgeBackups={handlePurgeBackups}
                onInstallMod={handleInstallMod}
                onUninstallMod={handleUninstallMod}
                onToggleMod={handleToggleMod}
                onToggleModdingProfile={handleToggleModdingProfile}
                onRefreshStatus={fetchStatus}
                telemetryHistory={telemetryHistory}
                isLoading={isLoading}
              />
            )}

            {/* 2. DIAGNOSTICS PANEL: TELEMETRY & SYSTEM LOGS */}
            {(activeTab === "telemetry" || activeTab === "logs") && (
              <DiagnosticsPanel
                activeSubTab={activeTab as "telemetry" | "logs"}
                consoleLogs={consoleLogs}
                telemetry={telemetry}
                telemetryHistory={telemetryHistory}
                inGameChats={inGameChats}
                onSendChatMessage={handleSendChatMessage}
                isLoading={isLoading}
              />
            )}

            {/* 3. MASCOT CHAT ASSISTANT: GREG */}
            {activeTab === "assistant" && (
              <GregAssistant 
                serverStatus={serverStatus}
                hasGeminiKey={serverInfo.hasGeminiKey || false}
                geminiModel={serverInfo.geminiModel || "gemini-3.5-flash"}
                onRefreshStatus={fetchStatus}
                isLoading={isLoading}
                gregName={serverInfo.gregName || "Mascot_Greg"}
              />
            )}


            {/* 5. MACHINE SERIES DIAGRAM (PRODUCTION FLOW) */}
            {activeTab === "flow-diagram" && (
              <MachineSeriesDiagram 
                telemetry={telemetry}
                isLoading={isLoading}
              />
            )}

            {/* 6. SYSTEM SETTINGS PANEL */}
            {activeTab === "settings" && (
              <SettingsPanel
                serverInfo={serverInfo}
                serverStatus={serverStatus}
                onRefreshStatus={fetchStatus}
                onSaveBackupConfig={handleSaveBackupConfig}
                browserTitle={browserTitle}
                setBrowserTitle={setBrowserTitle}
                isLoading={isLoading}
              />
            )}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Industrial brand footer info block */}
      <footer className="w-full h-10 border-t border-slate-900 bg-zinc-950 flex items-center justify-between px-6 shrink-0 text-[10px] font-mono text-slate-500">
        <div>
          BRAND DEPLOYMENT: <span className="text-slate-400 font-bold uppercase">DaemonForge Labs</span>
        </div>
        <div>
          "Orchestrating digital worlds" | Node v24.x LTS (Active)
        </div>
      </footer>

    </div>
  );
}
