import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ServerState, Backup, Mod, ConsoleLogLine, TelemetryData, ChatMessage, TelemetryHistoryPoint 
} from "./types";
import CommandBridge from "./components/CommandBridge";
import OperationsPanel from "./components/OperationsPanel";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
import GregAssistant from "./components/GregAssistant";
import DocumentationViewer from "./components/DocumentationViewer";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("nodes");
  
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

  // Run initial sync & set up polling intervals
  useEffect(() => {
    fetchStatus();
    fetchBackups();
    fetchMods();
    fetchLogsAndChats();
    fetchTelemetry();

    // Stats and Status Poll (Every 2 seconds)
    const statsInterval = setInterval(() => {
      fetchStatus();
      fetchTelemetry();
    }, 2000);

    // Logs and Chats Poll (Every 3 seconds)
    const logsInterval = setInterval(() => {
      fetchLogsAndChats();
    }, 3000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(logsInterval);
    };
  }, []);

  // -----------------------------------------------------------------------------
  // API ACTION TRIGGERS
  // -----------------------------------------------------------------------------

  const handleServerAction = async (action: "START" | "STOP" | "RESTART" | "UPDATE") => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/server/action", {
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
      const res = await fetch("/api/backups/trigger", { method: "POST" });
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
      await fetch("/api/backups/config", {
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
      const res = await fetch("/api/backups/restore", {
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
      await fetch(`/api/backups/${id}`, { method: "DELETE" });
      await fetchBackups();
      await fetchLogsAndChats();
    } catch (err) {
      console.error("Backup deletion failed:", err);
    }
  };

  const handleInstallMod = async (id: string) => {
    setIsLoading(true);
    try {
      await fetch("/api/mods/install", {
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
      await fetch("/api/mods/uninstall", {
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

  const handleToggleModdingProfile = async (enabled: boolean) => {
    try {
      await fetch("/api/mods/toggle-profile", {
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

  return (
    <div className="w-screen min-h-screen bg-zinc-950 font-sans flex flex-col overflow-x-hidden">
      
      {/* Sticky Command Bridge Header navigation */}
      <CommandBridge 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        serverStatus={serverStatus} 
      />

      {/* Main viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-hidden flex flex-col justify-center">
        
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
            {/* 1. OPERATIONS PANEL: SERVER NODES, BACKUPS, MODS, QUICK ACTIONS */}
            {(activeTab === "nodes" || activeTab === "backups" || activeTab === "mods" || activeTab === "quick-actions") && (
              <OperationsPanel
                activeSubTab={activeTab as "nodes" | "backups" | "mods" | "quick-actions"}
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
                onInstallMod={handleInstallMod}
                onUninstallMod={handleUninstallMod}
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
                isLoading={isLoading}
              />
            )}

            {/* 4. DOCUMENTATION INDEX VIEWER */}
            {activeTab === "docs" && (
              <DocumentationViewer 
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
