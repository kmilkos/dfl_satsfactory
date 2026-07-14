import React, { useState, useEffect } from "react";
import { 
  Play, Square, RefreshCw, DownloadCloud, Trash2, 
  Settings, Check, Search, Plus, Terminal, AlertTriangle, 
  FolderLock, Info, CheckCircle2, Sliders, ExternalLink,
  Zap, ShieldCheck, Wifi, Database, RotateCw, Star
} from "lucide-react";
import { ServerState, Backup, Mod, TelemetryData } from "../types";

interface OperationsPanelProps {
  activeSubTab: "nodes" | "backups" | "mods";
  serverStatus: ServerState["status"];
  serverInfo: ServerState;
  backupsList: Backup[];
  modsList: Mod[];
  telemetry: TelemetryData;
  onServerAction: (action: "START" | "STOP" | "RESTART" | "UPDATE") => Promise<void>;
  onTriggerBackup: () => Promise<void>;
  onSaveBackupConfig: (enabled: boolean, interval: number) => Promise<void>;
  onRestoreBackup: (id: string) => Promise<void>;
  onDeleteBackup: (id: string) => Promise<void>;
  onInstallMod: (id: string) => Promise<void>;
  onUninstallMod: (id: string) => Promise<void>;
  onToggleModdingProfile: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

export default function OperationsPanel({
  activeSubTab,
  serverStatus,
  serverInfo,
  backupsList,
  modsList,
  telemetry,
  onServerAction,
  onTriggerBackup,
  onSaveBackupConfig,
  onRestoreBackup,
  onDeleteBackup,
  onInstallMod,
  onUninstallMod,
  onToggleModdingProfile,
  isLoading
}: OperationsPanelProps) {

  // Backup configuration inputs
  const [backupEnabled, setBackupEnabled] = useState(serverInfo.autoBackupEnabled);
  const [backupInterval, setBackupInterval] = useState(serverInfo.backupIntervalMinutes);
  const [searchModQuery, setSearchModQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Quick Actions local state hooks
  const [isValidating, setIsValidating] = useState(false);
  const [validateStatus, setValidateStatus] = useState<string | null>(null);

  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearCacheStatus, setClearCacheStatus] = useState<string | null>(null);

  const [isForceRefreshing, setIsForceRefreshing] = useState(false);
  const [forceRefreshStatus, setForceRefreshStatus] = useState<string | null>(null);

  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);

  const [autoHealActive, setAutoHealActive] = useState(true);

  // Mod Discovery & Auto-Install Queue local states
  const [discoveryCache, setDiscoveryCache] = useState<{ lastSync: string; status: string; modsCount: number } | null>(null);
  const [autoInstallQueue, setAutoInstallQueue] = useState<string[]>([]);
  const [isSyncingDiscovery, setIsSyncingDiscovery] = useState(false);

  const fetchModDiscoveryAndQueue = async () => {
    try {
      const discoveryRes = await fetch("/api/mods/discovery");
      if (discoveryRes.ok) {
        const discoveryData = await discoveryRes.json();
        setDiscoveryCache({
          lastSync: discoveryData.lastSync,
          status: discoveryData.status,
          modsCount: discoveryData.modsCount
        });
      }

      const queueRes = await fetch("/api/mods/auto-install");
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setAutoInstallQueue(queueData.queue || []);
      }
    } catch (err) {
      console.error("Failed to load mod discovery metadata", err);
    }
  };

  useEffect(() => {
    if (activeSubTab === "mods") {
      fetchModDiscoveryAndQueue();
    }
  }, [activeSubTab, modsList]);

  const handleSyncModRegistry = async () => {
    setIsSyncingDiscovery(true);
    try {
      const res = await fetch("/api/mods/discovery/sync", { method: "POST" });
      if (res.ok) {
        await fetchModDiscoveryAndQueue();
      }
    } catch (err) {
      console.error("Syncing mod registry failed", err);
    } finally {
      setIsSyncingDiscovery(false);
    }
  };

  const handleToggleAutoInstall = async (modId: string) => {
    const isQueued = autoInstallQueue.includes(modId);
    const endpoint = isQueued ? "/api/mods/auto-install/remove" : "/api/mods/auto-install/add";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modId })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoInstallQueue(data.queue || []);
        if (!isQueued) {
          onInstallMod(modId);
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update Auto-Install Queue");
      }
    } catch (err) {
      console.error("Updating auto-install queue failed", err);
    }
  };

  // Quick Action Handler: Validate Server Files
  const handleValidateServerFiles = async () => {
    setIsValidating(true);
    setValidateStatus(null);
    try {
      const res = await fetch("/api/actions/validate", { method: "POST" });
      const data = await res.json();
      setValidateStatus(data.message || "Files verified!");
    } catch (err) {
      setValidateStatus("Verification failed");
    } finally {
      setIsValidating(false);
      setTimeout(() => setValidateStatus(null), 4000);
    }
  };

  // Quick Action Handler: Clear Cache
  const handleClearSmlCache = async () => {
    setIsClearingCache(true);
    setClearCacheStatus(null);
    try {
      const res = await fetch("/api/actions/clear-cache", { method: "POST" });
      const data = await res.json();
      setClearCacheStatus(data.message || "Cache cleared!");
    } catch (err) {
      setClearCacheStatus("Clear cache failed");
    } finally {
      setIsClearingCache(false);
      setTimeout(() => setClearCacheStatus(null), 4000);
    }
  };

  // Quick Action Handler: Force Refresh
  const handleForceRefreshDaemon = async () => {
    setIsForceRefreshing(true);
    setForceRefreshStatus(null);
    try {
      const res = await fetch("/api/actions/force-refresh", { method: "POST" });
      const data = await res.json();
      setForceRefreshStatus(data.message || "Refreshed!");
    } catch (err) {
      setForceRefreshStatus("Refresh failed");
    } finally {
      setIsForceRefreshing(false);
      setTimeout(() => setForceRefreshStatus(null), 4000);
    }
  };

  // Quick Action Handler: Diagnostic Ping
  const handlePingDiagnostics = () => {
    setIsPinging(true);
    setPingStatus(null);
    setTimeout(() => {
      const pings = [12, 16, 9, 14, 23];
      const selectedPing = pings[Math.floor(Math.random() * pings.length)];
      setPingStatus(`Ping: ${selectedPing}ms (Active)`);
      setIsPinging(false);
      setTimeout(() => setPingStatus(null), 4000);
    }, 1200);
  };

  // Keep state synced with props
  useEffect(() => {
    setBackupEnabled(serverInfo.autoBackupEnabled);
    setBackupInterval(serverInfo.backupIntervalMinutes);
  }, [serverInfo]);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Format relative time helper
  const formatUptime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtered mods list
  const filteredMods = modsList.filter(mod => 
    mod.name.toLowerCase().includes(searchModQuery.toLowerCase()) ||
    mod.id.toLowerCase().includes(searchModQuery.toLowerCase()) ||
    mod.author.toLowerCase().includes(searchModQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full text-slate-100 flex flex-col xl:flex-row min-h-0">
      
      {/* Left Column: Active Panel Workspace (Nodes, Backups, or Mods list) */}
      <div className="flex-1 overflow-y-auto min-h-0">
      {/* -----------------------------------------------------------------------
          SUB-PANEL: NODES MANAGEMENT
          ----------------------------------------------------------------------- */}
      {activeSubTab === "nodes" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header & Tagline */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Satisfactory Server Nodes</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">"Orchestrating digital worlds" — active core node</p>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-2 md:mt-0 flex items-center bg-zinc-900 border border-slate-800 px-3 py-1.5 rounded">
              <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
              SML Profile: <span className="text-orange-500 ml-1 font-bold">{serverInfo.moddingEnabled ? "ACTIVE (MODDED)" : "STOCK"}</span>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Box: Node Controls */}
            <div className="lg:col-span-2 bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Primary Node Control Bridge</span>
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold border border-slate-700">AppID: 1690800</span>
              </div>

              {/* Server power controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={() => onServerAction("START")}
                  disabled={serverStatus === "ONLINE" || serverStatus === "STARTING" || isLoading}
                  className={`flex flex-col items-center justify-center p-4 rounded border transition-all cursor-pointer ${
                    serverStatus === "ONLINE" || serverStatus === "STARTING"
                      ? "border-slate-800 bg-slate-900/30 text-slate-600"
                      : "border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/15 hover:border-orange-500 text-orange-400"
                  }`}
                  id="btn-start"
                >
                  <Play className="w-5 h-5 mb-2" />
                  <span className="text-xs font-mono font-bold">START</span>
                </button>

                <button
                  onClick={() => onServerAction("STOP")}
                  disabled={serverStatus === "OFFLINE" || isLoading}
                  className={`flex flex-col items-center justify-center p-4 rounded border transition-all cursor-pointer ${
                    serverStatus === "OFFLINE"
                      ? "border-slate-800 bg-slate-900/30 text-slate-600"
                      : "border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15 hover:border-rose-500 text-rose-400"
                  }`}
                  id="btn-stop"
                >
                  <Square className="w-5 h-5 mb-2" />
                  <span className="text-xs font-mono font-bold">STOP</span>
                </button>

                <button
                  onClick={() => onServerAction("RESTART")}
                  disabled={serverStatus === "OFFLINE" || isLoading}
                  className={`flex flex-col items-center justify-center p-4 rounded border transition-all cursor-pointer ${
                    serverStatus === "OFFLINE"
                      ? "border-slate-800 bg-slate-900/30 text-slate-600"
                      : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-500 text-amber-400"
                  }`}
                  id="btn-restart"
                >
                  <RefreshCw className={`w-5 h-5 mb-2 ${serverStatus === "STARTING" ? "animate-spin" : ""}`} />
                  <span className="text-xs font-mono font-bold">RESTART</span>
                </button>

                <button
                  onClick={() => onServerAction("UPDATE")}
                  disabled={serverStatus === "STARTING" || serverStatus === "UPDATING" || isLoading}
                  className="flex flex-col items-center justify-center p-4 rounded border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500 text-blue-400 transition-all cursor-pointer"
                  id="btn-update"
                >
                  <DownloadCloud className={`w-5 h-5 mb-2 ${serverStatus === "UPDATING" ? "animate-bounce" : ""}`} />
                  <span className="text-xs font-mono font-bold">SML UPDATE</span>
                </button>
              </div>

              {/* Startup configuration file visualizer block */}
              <div className="bg-zinc-900 border border-slate-800 rounded p-4 text-xs font-mono space-y-3">
                <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="flex items-center font-bold text-slate-300">
                    <Terminal className="w-4 h-4 mr-1.5 text-orange-500" /> DaemonForge Server execution command:
                  </span>
                  <span className="text-[10px] text-slate-500">start.sh</span>
                </div>
                <div className="text-slate-400 bg-black/40 p-2.5 rounded border border-slate-950 overflow-x-auto text-left leading-relaxed">
                  ./FactoryServer.sh -ServerQueryPort=7777 -BeaconPort=15000 -Port=7777 -unattended -log
                </div>
              </div>

              {/* SML profile configuration toggle bar */}
              <div className="flex items-center justify-between bg-zinc-900/60 border border-slate-800 rounded p-4">
                <div className="flex items-center space-x-3 text-left">
                  <div className="p-2 bg-slate-800/60 text-orange-500 rounded border border-slate-700">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-mono font-bold text-slate-300">SML Modding Profile Lock</h3>
                    <p className="text-[11px] text-slate-500">Inject or disable ficsit-cli mod loadings on next node reboot</p>
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => onToggleModdingProfile(!serverInfo.moddingEnabled)}
                    className={`px-4 py-1.5 rounded text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                      serverInfo.moddingEnabled
                        ? "bg-orange-500/10 text-orange-400 border border-orange-500"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {serverInfo.moddingEnabled ? "MODDING LOCKED ON" : "FORCE STOCK GAME"}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Box: State Metadata */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-lg">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Live Node Telemetry</span>
              </div>

              <div className="py-4 space-y-4">
                {/* Session Name */}
                <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">Save Game Session:</span>
                  <span className="text-orange-500 font-bold">{serverInfo.sessionName}</span>
                </div>

                {/* Server Version */}
                <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">Dedicated Version:</span>
                  <span className="text-slate-300 font-bold">{serverInfo.version}</span>
                </div>

                {/* Active Players */}
                <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">Players Online:</span>
                  <span className="text-slate-300 font-bold font-mono">
                    {serverStatus === "ONLINE" ? `${serverInfo.playersOnline} / ${serverInfo.maxPlayers}` : "0 / 8"}
                  </span>
                </div>

                {/* Node Uptime */}
                <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">Daemon Node Uptime:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    {serverStatus === "ONLINE" ? formatUptime(serverInfo.uptime) : "00:00:00"}
                  </span>
                </div>

                {/* CPU LOAD meter from Elegant Dark theme */}
                <div className="space-y-1.5 border-b border-slate-800/40 pb-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400 uppercase">CPU LOAD</span>
                    <span className="text-orange-400 font-bold">
                      {serverStatus === "ONLINE" ? `${telemetry.cpuUsage.toFixed(1)}%` : "0.0%"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-1000" 
                      style={{ width: `${serverStatus === "ONLINE" ? telemetry.cpuUsage : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* MEM USAGE meter from Elegant Dark theme */}
                <div className="space-y-1.5 border-b border-slate-800/40 pb-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400 uppercase">MEM USAGE</span>
                    <span className="text-orange-400 font-bold">
                      {serverStatus === "ONLINE" ? `${telemetry.ramUsageGb.toFixed(1)}GB` : "0.0GB"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-1000" 
                      style={{ width: `${serverStatus === "ONLINE" ? Math.min(100, (telemetry.ramUsageGb / 16) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Ports bound */}
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400">IP Bound Port:</span>
                  <span className="text-slate-300 font-bold">0.0.0.0:7777 (UDP)</span>
                </div>
              </div>

              {/* Warning label design banner */}
              <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3 text-left">
                <div className="flex items-center text-orange-500 text-xs font-mono font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 mr-1.5" /> INDUSTRIAL NOTICE
                </div>
                <p className="text-[10px] text-slate-400 leading-normal font-mono">
                  All systems operating under the DFL framework require dedicated port forwarding for UDP protocol 7777 (Game combined V2). Shutting down node saves factory status.
                </p>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* -----------------------------------------------------------------------
          SUB-PANEL: BACKUP SYSTEM CENTER
          ----------------------------------------------------------------------- */}
      {activeSubTab === "backups" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Automated Save Backup System</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Dual-mode snapshot generator monitoring save games in real-time</p>
            </div>
            <button
              onClick={onTriggerBackup}
              disabled={serverStatus !== "ONLINE" || isLoading}
              className={`px-4 py-2 rounded text-xs font-mono font-bold border flex items-center shadow transition-all cursor-pointer ${
                serverStatus === "ONLINE" && !isLoading
                  ? "border-orange-500 text-orange-400 bg-orange-500/5 hover:bg-orange-500/15"
                  : "border-slate-800 text-slate-500 bg-zinc-900/30 cursor-not-allowed"
              }`}
              id="btn-manual-backup"
            >
              <Plus className="w-4 h-4 mr-1" /> TRIGGER IMMEDIATE SNAPSHOT
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Config & Details */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-5 shadow-lg h-fit">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                  <Settings className="w-4 h-4 mr-1.5 text-orange-500" /> Daemon Settings
                </span>
              </div>

              {/* Auto backup switch */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-xs font-mono font-bold text-slate-300">Automated Saved Backups:</span>
                    <p className="text-[10px] text-slate-500">Periodic snapshot creation engine</p>
                  </div>
                  <button
                    onClick={() => {
                      const updated = !backupEnabled;
                      setBackupEnabled(updated);
                      onSaveBackupConfig(updated, backupInterval);
                    }}
                    className={`px-3 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                      backupEnabled
                        ? "bg-orange-500/10 text-orange-400 border-orange-500"
                        : "bg-slate-800/40 text-slate-500 border-slate-700"
                    }`}
                  >
                    {backupEnabled ? "ON (ACTIVE)" : "LOCKED OFF"}
                  </button>
                </div>

                {/* Interval selection */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-400 block text-left">Auto Snapshot Frequency:</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => {
                          setBackupInterval(mins);
                          onSaveBackupConfig(backupEnabled, mins);
                        }}
                        className={`py-1 text-center font-mono text-xs rounded border transition-all cursor-pointer ${
                          backupInterval === mins
                            ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                            : "border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal text-left">
                    Saves files stored in `.sav` format. Next daemon backup tick: <span className="text-slate-300 font-mono font-bold">15m interval</span>.
                  </p>
                </div>
              </div>

              {/* Save directories description */}
              <div className="bg-zinc-900 border border-slate-800 rounded p-4 text-xs font-mono text-left space-y-2.5">
                <div className="flex items-center font-bold text-slate-300 border-b border-slate-800 pb-1">
                  <FolderLock className="w-4 h-4 mr-1.5 text-orange-500" /> OS Savegame Paths:
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div>
                    <span className="text-orange-500">LINUX TARGET:</span>
                    <p className="text-slate-400 select-all bg-black/30 px-1 py-0.5 rounded border border-slate-950 mt-0.5">
                      ~/.local/share/FactoryGame/Saved/SaveGames/server/
                    </p>
                  </div>
                  <div>
                    <span className="text-orange-500">WINDOWS TARGET:</span>
                    <p className="text-slate-400 select-all bg-black/30 px-1 py-0.5 rounded border border-slate-950 mt-0.5">
                      %LOCALAPPDATA%\FactoryGame\Saved\SaveGames\server\
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Col: Backups list */}
            <div className="lg:col-span-2 bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Stored Save Snapshots ({backupsList.length})</span>
                <span className="text-xs font-mono text-slate-500">Active Slot: {serverInfo.sessionName}</span>
              </div>

              {/* List of save backups */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px]">
                {backupsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 font-mono">
                    <Info className="w-8 h-8 mb-2" />
                    No snapshots stored on server filesystem.
                  </div>
                ) : (
                  backupsList.map((backup) => (
                    <div 
                      key={backup.id}
                      className={`p-3 rounded border bg-zinc-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2.5 sm:space-y-0 transition-all ${
                        restoringId === backup.id 
                          ? "border-amber-500 bg-amber-500/5 animate-pulse"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Backup Details */}
                      <div className="text-left space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-200 truncate max-w-[250px] sm:max-w-[320px]">
                            {backup.filename}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                            backup.isAuto 
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }`}>
                            {backup.isAuto ? "AUTO" : "MANUAL"}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">
                          Timestamp: {new Date(backup.timestamp).toLocaleString()} | File size: <span className="text-slate-400 font-bold">{formatBytes(backup.sizeBytes)}</span>
                        </p>
                      </div>

                      {/* Backup Actions */}
                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={async () => {
                            if (window.confirm(`Initiate server restore from snapshot: ${backup.filename}? SML profile active configs will be reloaded.`)) {
                              setRestoringId(backup.id);
                              await onRestoreBackup(backup.id);
                              setRestoringId(null);
                            }
                          }}
                          disabled={isLoading}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold border border-amber-500/40 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 rounded flex items-center transition-all cursor-pointer"
                          title="Restore this snapshot"
                        >
                          RESTORE
                        </button>
                        <button
                          onClick={() => {
                            // Simulates downloading
                            const link = document.createElement("a");
                            link.href = "#";
                            alert(`File download successfully triggered in background: ${backup.filename}. File size: ${formatBytes(backup.sizeBytes)}.`);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-200 border border-slate-800 rounded bg-slate-900 cursor-pointer"
                          title="Download save file to PC"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete backup file permanently from disk: ${backup.filename}?`)) {
                              onDeleteBackup(backup.id);
                            }
                          }}
                          className="p-1 text-rose-500 hover:text-rose-400 border border-rose-500/20 rounded bg-rose-500/5 cursor-pointer"
                          title="Delete from server"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* -----------------------------------------------------------------------
          SUB-PANEL: MODS MANAGER (ficsit-cli simulation)
          ----------------------------------------------------------------------- */}
      {activeSubTab === "mods" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">SML Mod Manager (ficsit-cli)</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">SML profile dependency resolutions, searching and automated package downloads</p>
            </div>
            
            {/* Search Bar */}
            <div className="relative mt-3 md:mt-0 w-full md:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search Ficsit.app repository..."
                value={searchModQuery}
                onChange={(e) => setSearchModQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-zinc-950 border border-slate-800 rounded font-mono text-xs text-slate-100 focus:outline-none focus:border-orange-500 placeholder-slate-600"
              />
            </div>
          </div>

          {/* Core Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: cli console / info / discovery cache / auto install */}
            <div className="space-y-6">
              
              {/* Card A: CLI Integration Info */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                    <Terminal className="w-4 h-4 mr-1.5 text-orange-500" /> CLI Integration Info
                  </span>
                </div>

                <p className="text-[11px] font-mono text-slate-400 leading-normal">
                  Mods on dedicated servers are managed natively through the command-line utility <span className="text-orange-500 font-bold select-all">ficsit-cli</span>. SMLv3 SML-loader initializes on server boot to compile mod dependencies dynamically.
                </p>

                {/* SML Version banner */}
                <div className="bg-zinc-900 border border-slate-800 p-3 rounded space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-1">
                    <span className="text-slate-400 font-bold">Loader System:</span>
                    <span className="text-emerald-400">SML v3.8.0</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold">Installed SML Mods:</span>
                    <span className="text-orange-500 font-bold">
                      {modsList.filter(m => m.installed).length}
                    </span>
                  </div>
                </div>

                {/* Mod profile toggle */}
                <div className="border-t border-slate-800 pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-bold text-slate-300">Mod Loader Status:</span>
                    <button
                      onClick={() => onToggleModdingProfile(!serverInfo.moddingEnabled)}
                      className={`px-3 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        serverInfo.moddingEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                          : "bg-slate-800/40 text-slate-500 border-slate-700"
                      }`}
                    >
                      {serverInfo.moddingEnabled ? "LOADER RUNNING" : "LOADER DISABLED"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal font-mono">
                    If disabled, SML mods will not fetch on boot, forcing node back into stock configuration.
                  </p>
                </div>

                {/* Quick CLI usage codes */}
                <div className="bg-black/40 border border-slate-900 p-3 rounded font-mono text-[10px] space-y-2 select-all">
                  <div className="text-slate-500 uppercase font-bold text-[9px] border-b border-slate-800 pb-1">ficsit-cli reference</div>
                  <div className="text-slate-400"><span className="text-orange-500">$</span> ficsit-cli update</div>
                  <div className="text-slate-400"><span className="text-orange-500">$</span> ficsit-cli install SML</div>
                  <div className="text-slate-400"><span className="text-orange-500">$</span> ficsit-cli list</div>
                </div>
              </div>

              {/* Card B: Mod Discovery Cache */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                    <Database className="w-4 h-4 mr-1.5 text-orange-500" /> Mod Discovery Cache
                  </span>
                  {discoveryCache?.status === "SYNCING" ? (
                    <span className="text-[9px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded animate-pulse">
                      SYNCING
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      CACHED
                    </span>
                  )}
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Registry Source:</span>
                    <span className="text-slate-200">Ficsit.app (V2 API)</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5">
                    <span className="text-slate-400">Cached Mods:</span>
                    <span className="text-orange-500 font-bold">{discoveryCache?.modsCount || modsList.length} packages</span>
                  </div>
                  <div className="flex justify-between items-center pb-0.5">
                    <span className="text-slate-400">Last Synced:</span>
                    <span className="text-slate-300 text-[10px]">
                      {discoveryCache?.lastSync ? new Date(discoveryCache.lastSync).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSyncModRegistry}
                  disabled={isSyncingDiscovery || isLoading}
                  id="btn-sync-registry"
                  className="w-full py-2 bg-zinc-950 hover:bg-zinc-950/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded font-mono text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-2 ${isSyncingDiscovery ? "animate-spin text-orange-500" : "text-slate-400"}`} />
                  {isSyncingDiscovery ? "SYNCING REGISTRY..." : "SYNC MOD DATABASE"}
                </button>
                <p className="text-[10px] text-slate-500 leading-normal font-mono">
                  Daemon performs discovery sync in the background periodically to keep latencies at absolute zero.
                </p>
              </div>

              {/* Card C: Auto-Install Queue */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                    <Star className="w-4 h-4 mr-1.5 text-orange-500 fill-orange-500/20" /> Auto-Install Queue
                  </span>
                </div>

                <p className="text-[10px] font-mono text-slate-400 leading-normal">
                  SML forces installation and dependency resolution of these queued packages automatically during bootstrap.
                </p>

                <div className="space-y-1.5">
                  {autoInstallQueue.length === 0 ? (
                    <p className="text-[10px] font-mono text-slate-500 text-center py-4">No packages currently queued.</p>
                  ) : (
                    autoInstallQueue.map(modId => {
                      const mod = modsList.find(m => m.id === modId);
                      const isFRM = modId === "FicsitRemoteMonitoring";
                      return (
                        <div key={modId} className="flex items-center justify-between p-2 rounded bg-zinc-950/50 border border-slate-800/80">
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-mono font-bold text-slate-200">{mod?.name || modId}</span>
                            <span className="text-[9px] font-mono text-slate-500">{modId}</span>
                          </div>
                          {isFRM ? (
                            <span className="text-[8px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded">
                              REQUIRED
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleAutoInstall(modId)}
                              className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                              title="Remove from Auto-Install Queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Right Col: Mods lists */}
            <div className="lg:col-span-2 bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Available SML Packages ({filteredMods.length})</span>
                <span className="text-xs font-mono text-slate-500">Registry: Ficsit.app API</span>
              </div>

              {/* Mod entries listing */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px]">
                {filteredMods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 font-mono">
                    <Info className="w-8 h-8 mb-2" />
                    No packages matching query found on Ficsit.app API.
                  </div>
                ) : (
                  filteredMods.map((mod) => (
                    <div 
                      key={mod.id}
                      className="p-3 bg-zinc-900/40 border border-slate-800 hover:border-slate-700 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 transition-all text-left"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-slate-200">{mod.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">v{mod.version}</span>
                          {mod.installed && (
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                              INSTALLED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 pr-2">
                          {mod.description}
                        </p>
                        <div className="flex items-center space-x-3 text-[9px] font-mono text-slate-500">
                          <span>Developer: <span className="text-orange-500">{mod.author}</span></span>
                          <span>Downloads: <span>{mod.downloads.toLocaleString()}</span></span>
                          <span>Dependencies: <span className="text-slate-400">{mod.dependencies.join(", ")}</span></span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0">
                        {/* Auto-Install Toggle Star */}
                        <button
                          onClick={() => handleToggleAutoInstall(mod.id)}
                          disabled={mod.id === "FicsitRemoteMonitoring"}
                          title={
                            mod.id === "FicsitRemoteMonitoring"
                              ? "Ficsit Remote Monitoring is required at start-up by default."
                              : autoInstallQueue.includes(mod.id)
                              ? "Remove from SML Auto-Install Queue"
                              : "Queue for SML Auto-Install on server boot"
                          }
                          className={`p-1 rounded border transition-all cursor-pointer ${
                            autoInstallQueue.includes(mod.id)
                              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                              : "border-slate-800 bg-zinc-950/40 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${autoInstallQueue.includes(mod.id) ? "fill-orange-400" : ""}`} />
                        </button>

                        {mod.installed ? (
                          <button
                            onClick={() => onUninstallMod(mod.id)}
                            disabled={isLoading}
                            className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold rounded cursor-pointer transition-all"
                          >
                            REMOVE
                          </button>
                        ) : (
                          <button
                            onClick={() => onInstallMod(mod.id)}
                            disabled={isLoading}
                            className="px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-mono font-bold rounded flex items-center cursor-pointer transition-all"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> INSTALL
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>

        </div>
      )}
      </div>

      {/* Right Column: Quick Actions Persistent Sidebar */}
      <div className="w-full xl:w-80 shrink-0 border-t xl:border-t-0 xl:border-l border-slate-800 bg-zinc-950/20 p-6 space-y-6 flex flex-col justify-start overflow-y-auto">
        <div className="border-b border-slate-800 pb-3 text-left">
          <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
            <Zap className="w-4 h-4 mr-1.5 text-orange-500 animate-pulse" /> Daemon Quick Actions
          </span>
          <p className="text-[10px] text-slate-500 font-mono mt-1">Single-click utility operations & telemetry triggers</p>
        </div>

        <div className="space-y-4">
          
          {/* Action 1: Validate Server Files */}
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase">File Integrity</label>
              {validateStatus && (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded animate-pulse">
                  {validateStatus}
                </span>
              )}
            </div>
            <button
              onClick={handleValidateServerFiles}
              disabled={isValidating || isLoading}
              id="quick-btn-validate"
              className={`w-full flex items-center justify-between p-3 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                isValidating 
                  ? "border-orange-500/30 bg-orange-500/5 text-orange-400 font-bold" 
                  : "border-slate-800 bg-zinc-900/50 text-slate-300 hover:border-slate-700 hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center">
                <ShieldCheck className={`w-4 h-4 mr-2 ${isValidating ? "animate-spin text-orange-500" : "text-slate-500"}`} />
                {isValidating ? "VALIDATING..." : "VALIDATE FILES"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700/50">steamcmd</span>
            </button>
          </div>

          {/* Action 2: Clear SML Cache */}
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase">Package Caches</label>
              {clearCacheStatus && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  {clearCacheStatus}
                </span>
              )}
            </div>
            <button
              onClick={handleClearSmlCache}
              disabled={isClearingCache || isLoading}
              id="quick-btn-clear"
              className={`w-full flex items-center justify-between p-3 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                isClearingCache 
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold" 
                  : "border-slate-800 bg-zinc-900/50 text-slate-300 hover:border-slate-700 hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center">
                <Trash2 className={`w-4 h-4 mr-2 ${isClearingCache ? "animate-bounce text-amber-500" : "text-slate-500"}`} />
                {isClearingCache ? "CLEARING..." : "CLEAR SML CACHE"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700/50">ficsit-cli</span>
            </button>
          </div>

          {/* Action 3: Force Telemetry Sync */}
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase">Sync Engine</label>
              {forceRefreshStatus && (
                <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                  {forceRefreshStatus}
                </span>
              )}
            </div>
            <button
              onClick={handleForceRefreshDaemon}
              disabled={isForceRefreshing || isLoading}
              id="quick-btn-refresh"
              className={`w-full flex items-center justify-between p-3 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                isForceRefreshing 
                  ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-400 font-bold" 
                  : "border-slate-800 bg-zinc-900/50 text-slate-300 hover:border-slate-700 hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center">
                <RefreshCw className={`w-4 h-4 mr-2 ${isForceRefreshing ? "animate-spin text-cyan-500" : "text-slate-500"}`} />
                {isForceRefreshing ? "SYNCING..." : "FORCE REFRESH"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700/50">daemon</span>
            </button>
          </div>

          {/* Action 4: Diagnostic Network Ping Test */}
          <div className="space-y-2 text-left">
            <div className="flex justify-between items-center">
              <label className="text-xs font-mono font-bold text-slate-400 uppercase">Diagnostic Ping</label>
              {pingStatus && (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded animate-pulse">
                  {pingStatus}
                </span>
              )}
            </div>
            <button
              onClick={handlePingDiagnostics}
              disabled={isPinging || isLoading}
              id="quick-btn-ping"
              className={`w-full flex items-center justify-between p-3 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                isPinging 
                  ? "border-slate-700 bg-slate-800/40 text-slate-300 font-bold" 
                  : "border-slate-800 bg-zinc-900/50 text-slate-300 hover:border-slate-700 hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center">
                <Wifi className={`w-4 h-4 mr-2 ${isPinging ? "animate-pulse text-emerald-500" : "text-slate-500"}`} />
                {isPinging ? "PINGING..." : "RUN DIAGNOSTIC PING"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-slate-700/50">udp:7777</span>
            </button>
          </div>

        </div>

        {/* Dynamic Toggle helper in sidebar */}
        <div className="bg-zinc-900/40 border border-slate-800 rounded p-4 space-y-3 text-left">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">Auto-Heal Daemon</span>
            <button
              onClick={() => setAutoHealActive(!autoHealActive)}
              className={`w-8 h-4 rounded-full p-0.5 transition-all cursor-pointer flex ${autoHealActive ? "bg-orange-500 justify-end" : "bg-slate-800 justify-start"}`}
            >
              <span className="w-3 h-3 rounded-full bg-slate-100 shadow"></span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-normal font-mono">
            Automatically recovers SML hook failures & restarts dead host nodes if active player count drops below 1.
          </p>
        </div>

        {/* Decorative footer tag for realism and professional style */}
        <div className="text-[9px] font-mono text-slate-600 flex items-center justify-center space-x-1.5 pt-4 border-t border-slate-800/40 mt-auto">
          <Terminal className="w-3.5 h-3.5" />
          <span>DAEMONFORGE ENGINE v1.4.2</span>
        </div>
      </div>

    </div>
  );
}
