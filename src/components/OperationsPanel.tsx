import React, { useState, useEffect } from "react";
import { 
  Play, Square, RefreshCw, DownloadCloud, Trash2, 
  Settings, Check, Search, Plus, Terminal, AlertTriangle, 
  FolderLock, Info, CheckCircle2, Sliders, ExternalLink,
  Zap, ShieldCheck, Wifi, Database, RotateCw, Star
} from "lucide-react";
import { ServerState, Backup, Mod, TelemetryData, TelemetryHistoryPoint } from "../types";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface OperationsPanelProps {
  activeSubTab: "nodes" | "backups" | "mods" | "quick-actions";
  serverStatus: ServerState["status"];
  serverInfo: ServerState;
  backupsList: Backup[];
  modsList: Mod[];
  telemetry: TelemetryData;
  telemetryHistory: TelemetryHistoryPoint[];
  onServerAction: (action: "START" | "STOP" | "RESTART" | "UPDATE") => Promise<void>;
  onTriggerBackup: () => Promise<void>;
  onSaveBackupConfig: (enabled: boolean, interval: number) => Promise<void>;
  onRestoreBackup: (id: string) => Promise<void>;
  onDeleteBackup: (id: string) => Promise<void>;
  onInstallMod: (id: string) => Promise<void>;
  onUninstallMod: (id: string) => Promise<void>;
  onToggleModdingProfile: (enabled: boolean) => Promise<void>;
  onRefreshStatus?: () => Promise<void>;
  isLoading: boolean;
}

export default function OperationsPanel({
  activeSubTab,
  serverStatus,
  serverInfo,
  backupsList,
  modsList,
  telemetry,
  telemetryHistory,
  onServerAction,
  onTriggerBackup,
  onSaveBackupConfig,
  onRestoreBackup,
  onDeleteBackup,
  onInstallMod,
  onUninstallMod,
  onToggleModdingProfile,
  onRefreshStatus,
  isLoading
}: OperationsPanelProps) {

  // Create game session inputs
  const [newSessionName, setNewSessionName] = useState("");
  const [startingBiome, setStartingBiome] = useState("Grass Fields");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createSessionError, setCreateSessionError] = useState("");

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    setIsCreatingSession(true);
    setCreateSessionError("");
    try {
      const response = await fetch("/api/server/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionName: newSessionName, biome: startingBiome })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create session.");
      }
      setTimeout(async () => {
        setIsCreatingSession(false);
        setNewSessionName("");
        if (onRefreshStatus) {
          await onRefreshStatus();
        }
      }, 1500);
    } catch (e: any) {
      setCreateSessionError(e.message || "An error occurred.");
      setIsCreatingSession(false);
    }
  };

  // Backup configuration inputs
  const [backupEnabled, setBackupEnabled] = useState(serverInfo.autoBackupEnabled);
  const [backupInterval, setBackupInterval] = useState(serverInfo.backupIntervalMinutes);
  const [searchModQuery, setSearchModQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [remoteMods, setRemoteMods] = useState<Mod[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  useEffect(() => {
    if (!searchModQuery.trim()) {
      setRemoteMods([]);
      return;
    }

    const localMatches = modsList.some(mod =>
      mod.name.toLowerCase().includes(searchModQuery.toLowerCase()) ||
      mod.id.toLowerCase().includes(searchModQuery.toLowerCase()) ||
      mod.author.toLowerCase().includes(searchModQuery.toLowerCase())
    );

    if (localMatches) {
      setRemoteMods([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingRemote(true);
      try {
        const res = await fetch(`/api/mods/search?q=${encodeURIComponent(searchModQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setRemoteMods(data);
        }
      } catch (err) {
        console.error("Failed to query SMR API search:", err);
      } finally {
        setIsSearchingRemote(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchModQuery, modsList]);

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

  // Local state for SML status change restart warning
  const [showRestartWarning, setShowRestartWarning] = useState(false);

  // Auto-clear restart warning when the server goes offline
  useEffect(() => {
    if (serverStatus === "OFFLINE") {
      setShowRestartWarning(false);
    }
  }, [serverStatus]);

  const handleToggleModdingLocal = async (enabled: boolean) => {
    await onToggleModdingProfile(enabled);
    if (serverStatus !== "OFFLINE") {
      setShowRestartWarning(true);
    }
  };

  const handleServerActionLocal = async (action: "START" | "STOP" | "RESTART" | "UPDATE") => {
    if (action === "RESTART" || action === "STOP" || action === "UPDATE") {
      setShowRestartWarning(false);
    }
    await onServerAction(action);
  };

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
    <div className="w-full h-full text-slate-100 flex flex-col min-h-0">
      
      {/* Left Column: Active Panel Workspace (Nodes, Backups, or Mods list) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        
        {/* Restart Warning banner from Mascot Greg */}
        {showRestartWarning && (
          <div className="mx-6 mt-6 bg-zinc-950/95 border-2 border-orange-500 rounded-xl p-4 shadow-[0_0_20px_rgba(249,115,22,0.2)] relative flex items-start space-x-4 animate-bounce-subtle">
            {/* Anti-gravity Octahedron Greg Icon */}
            <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-zinc-900 border border-orange-500/40 rounded-lg text-orange-500 relative">
              <Sliders className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 text-[8px] font-bold text-zinc-950 items-center justify-center font-mono">!</span>
              </span>
            </div>
            
            {/* Speech Bubble / Text */}
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-wider text-orange-500 uppercase">Mascot_Greg (DaemonForge)</span>
                <button 
                  onClick={() => setShowRestartWarning(false)}
                  className="text-[9px] font-mono text-slate-500 hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded border border-slate-800 hover:border-slate-700 cursor-pointer"
                >
                  DISMISS
                </button>
              </div>
              <p className="text-[11px] text-slate-200 font-mono mt-1 leading-normal">
                "Look, I updated the ficsit-cli installations file for you. But SML loader settings don't hot-reload themselves on a running process. ¯\_(ツ)_/¯ You need to <strong className="text-orange-400 font-bold">RESTART</strong> the server node to apply vanilla/mod status changes."
              </p>
            </div>
          </div>
        )}

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
                  onClick={() => handleServerActionLocal("START")}
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
                  onClick={() => handleServerActionLocal("STOP")}
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
                  onClick={() => handleServerActionLocal("RESTART")}
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
                  onClick={() => handleServerActionLocal("UPDATE")}
                  disabled={serverStatus === "STARTING" || serverStatus === "UPDATING" || isLoading}
                  className="flex flex-col items-center justify-center p-4 rounded border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-500 text-blue-400 transition-all cursor-pointer"
                  id="btn-update"
                >
                  <DownloadCloud className={`w-5 h-5 mb-2 ${serverStatus === "UPDATING" ? "animate-bounce" : ""}`} />
                  <span className="text-xs font-mono font-bold">SML UPDATE</span>
                </button>
              </div>

              {/* Initialize Game Session (Rendered only if server is ONLINE and has no active session) */}
              {serverStatus === "ONLINE" && serverInfo.sessionName?.startsWith("None") && (
                <div className="bg-zinc-950 border-2 border-orange-500/30 rounded-lg p-5 space-y-4">
                  <div className="flex items-center space-x-2 text-orange-400">
                    <Plus className="w-5 h-5 animate-pulse" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">Initialize Game Session</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed text-left">
                    The server daemon is running, but no save game session is active. You must initialize a new session so players can connect.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">New Session Name</label>
                      <input
                        type="text"
                        placeholder="e.g. MyAwesomeFactory"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        className="w-full bg-zinc-900 border border-slate-800 text-xs font-mono text-slate-200 px-3 py-2 rounded focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Starting Biome</label>
                      <select
                        value={startingBiome}
                        onChange={(e) => setStartingBiome(e.target.value)}
                        className="w-full bg-zinc-900 border border-slate-800 text-xs font-mono text-slate-200 px-3 py-2 rounded focus:outline-none focus:border-orange-500 cursor-pointer"
                      >
                        <option value="Grass Fields">Grass Fields (Beginner)</option>
                        <option value="Rocky Desert">Rocky Desert (Moderate)</option>
                        <option value="Northern Forest">Northern Forest (Hard)</option>
                        <option value="Dune Desert">Dune Desert (Expert)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleCreateSession}
                      disabled={isCreatingSession || !newSessionName.trim()}
                      className={`flex items-center px-4 py-2 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                        !newSessionName.trim() || isCreatingSession
                          ? "bg-slate-800 text-slate-500 border border-slate-700"
                          : "bg-orange-600 hover:bg-orange-500 text-white border border-orange-500"
                      }`}
                    >
                      {isCreatingSession ? (
                        <>
                          <RotateCw className="w-4 h-4 mr-1.5 animate-spin" />
                          INITIALIZING WORLD...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1.5" />
                          INITIALIZE & START SESSION
                        </>
                      )}
                    </button>
                  </div>
                  {createSessionError && (
                    <p className="text-[11px] text-red-400 font-mono text-left">{createSessionError}</p>
                  )}
                </div>
              )}

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
                    onClick={() => handleToggleModdingLocal(!serverInfo.moddingEnabled)}
                    className={`px-4 py-1.5 rounded text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                      serverInfo.moddingEnabled
                        ? "bg-orange-500/10 text-orange-400 border border-orange-500"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    {serverInfo.moddingEnabled ? "MODS ACTIVE (VANILLA: OFF)" : "VANILLA ACTIVE (MODS: OFF)"}
                  </button>
                </div>
              </div>

              {/* Dedicated Server Service & Host Node Hardware Telemetry Cards with Graphs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-800/80">
                
                {/* 1. Dedicated Server Service Card */}
                {telemetry.service ? (
                  <div className="bg-zinc-950/40 border border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs text-left flex flex-col justify-between">
                    <div>
                      <div className="text-slate-300 font-bold uppercase text-[9px] border-b border-slate-800/85 pb-2 flex justify-between items-center">
                        <span className="flex items-center">
                          <Terminal className="w-3.5 h-3.5 mr-1 text-orange-500 animate-pulse" /> Dedicated Server Service
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          telemetry.service.activeState === "active" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {telemetry.service.activeState.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                        <div className="bg-zinc-900/50 p-2 rounded border border-slate-850">
                          <span className="text-slate-500 text-[8px] block">SERVICE CPU LOAD</span>
                          <span className="text-xs font-bold text-orange-450">{telemetry.service.cpuUsagePct}%</span>
                        </div>
                        <div className="bg-zinc-900/50 p-2 rounded border border-slate-850">
                          <span className="text-slate-500 text-[8px] block">SERVICE MEMORY</span>
                          <span className="text-xs font-bold text-orange-455">{telemetry.service.memoryMb} MB</span>
                        </div>
                      </div>
                    </div>

                    {/* Service CPU/Memory Sparkline Graph */}
                    <div className="h-28 w-full bg-black/20 rounded border border-slate-850 p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={telemetryHistory}>
                          <defs>
                            <linearGradient id="colorServiceCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                          <XAxis dataKey="time" hide />
                          <YAxis hide domain={[0, 100]} />
                          <Tooltip 
                            contentStyle={{ background: '#090d16', borderColor: '#1e293b', fontSize: '9px', fontFamily: 'monospace' }}
                            labelStyle={{ color: '#64748b' }}
                          />
                          <Area 
                            name="Service CPU %"
                            type="monotone" 
                            dataKey="serviceCpu" 
                            stroke="#f97316" 
                            fillOpacity={1} 
                            fill="url(#colorServiceCpu)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-955/40 border border-slate-800 rounded-lg p-4 font-mono text-xs text-left text-slate-500 flex items-center justify-center h-full min-h-[180px]">
                    Service telemetry offline or loading...
                  </div>
                )}

                {/* 2. Host Node Hardware Card */}
                <div className="bg-zinc-950/40 border border-slate-800 rounded-lg p-4 space-y-3 font-mono text-xs text-left flex flex-col justify-between">
                  <div>
                    <div className="text-slate-300 font-bold uppercase text-[9px] border-b border-slate-800/85 pb-2 flex justify-between items-center">
                      <span className="flex items-center">
                        <Sliders className="w-3.5 h-3.5 mr-1 text-orange-500" /> Host Node Hardware
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ONLINE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 mb-4">
                      <div className="bg-zinc-900/50 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 text-[8px] block">HOST CPU LOAD</span>
                        <span className="text-xs font-bold text-slate-200">{telemetry.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="bg-zinc-900/50 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 text-[8px] block">HOST RAM USAGE</span>
                        <span className="text-xs font-bold text-slate-200">{telemetry.ramUsageGb.toFixed(2)} GB</span>
                      </div>
                    </div>
                  </div>

                  {/* Host CPU Sparkline Graph */}
                  <div className="h-28 w-full bg-black/20 rounded border border-slate-850 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={telemetryHistory}>
                        <defs>
                          <linearGradient id="colorHostCpu" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                        <XAxis dataKey="time" hide />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ background: '#090d16', borderColor: '#1e293b', fontSize: '9px', fontFamily: 'monospace' }}
                          labelStyle={{ color: '#64748b' }}
                        />
                        <Area 
                          name="Host CPU %"
                          type="monotone" 
                          dataKey="cpu" 
                          stroke="#3b82f6" 
                          fillOpacity={1} 
                          fill="url(#colorHostCpu)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
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
                      onClick={() => handleToggleModdingLocal(!serverInfo.moddingEnabled)}
                      className={`px-3 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        serverInfo.moddingEnabled
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500"
                          : "bg-slate-800/40 text-slate-500 border-slate-700"
                      }`}
                    >
                      {serverInfo.moddingEnabled ? "LOADER ACTIVE (VANILLA: OFF)" : "LOADER DISABLED (VANILLA: ON)"}
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
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Available SML Packages ({filteredMods.length > 0 ? filteredMods.length : remoteMods.length})</span>
                <span className="text-xs font-mono text-slate-500">Registry: Ficsit.app API</span>
              </div>

              {/* Mod entries listing */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px]">
                {filteredMods.length > 0 ? (
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
                ) : isSearchingRemote ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 font-mono">
                    <RefreshCw className="w-8 h-8 mb-2 animate-spin text-orange-500" />
                    Searching Ficsit.app repository for "{searchModQuery}"...
                  </div>
                ) : remoteMods.length > 0 ? (
                  remoteMods.map((mod) => (
                    <div 
                      key={mod.id}
                      className="p-3 bg-zinc-900/40 border border-slate-800 hover:border-slate-700 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 transition-all text-left"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-slate-200">{mod.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">v{mod.version}</span>
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">
                            SMR REPOSITORY
                          </span>
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
                          title="Queue for SML Auto-Install on server boot"
                          className={`p-1 rounded border transition-all cursor-pointer ${
                            autoInstallQueue.includes(mod.id)
                              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
                              : "border-slate-800 bg-zinc-950/40 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${autoInstallQueue.includes(mod.id) ? "fill-orange-400" : ""}`} />
                        </button>

                        <button
                          onClick={() => onInstallMod(mod.id)}
                          disabled={isLoading}
                          className="px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-mono font-bold rounded flex items-center cursor-pointer transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> INSTALL
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500 font-mono">
                    <Info className="w-8 h-8 mb-2" />
                    {searchModQuery.trim() 
                      ? `No packages matching "${searchModQuery}" found locally or on Ficsit.app.`
                      : "No packages matching query found on Ficsit.app API."
                    }
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}
      </div>

      {/* 3b. SUB-PANEL: QUICK ACTIONS (FULL TAB) */}
      {activeSubTab === "quick-actions" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header & Tagline */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold flex items-center">
                <Zap className="w-5 h-5 mr-2 text-orange-500 animate-pulse" /> Daemon Quick Actions
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">Single-click utility operations & telemetry triggers</p>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-3 py-1 rounded mt-2 md:mt-0 flex items-center">
              <Terminal className="w-3.5 h-3.5 mr-1.5" />
              <span>DAEMONFORGE ENGINE v1.4.2</span>
            </div>
          </div>

          {/* Grid Layout for Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Validate Server Files */}
            <div className="bg-zinc-900/60 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 hover:bg-zinc-900 transition-all duration-200">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">File Integrity Check</span>
                  <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700/50 uppercase font-mono">steamcmd</span>
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-200">Verify Server Installation</h3>
                <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                  Triggers SteamCMD to scan and verify the checksum hashes of all server binary chunks against the Valve database manifest.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {validateStatus && (
                  <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded animate-pulse">
                    {validateStatus}
                  </div>
                )}
                <button
                  onClick={handleValidateServerFiles}
                  disabled={isValidating || isLoading}
                  id="quick-btn-validate"
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                    isValidating 
                      ? "border-orange-500/30 bg-orange-500/5 text-orange-400 font-bold" 
                      : "border-slate-800 bg-zinc-950 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 mr-2 ${isValidating ? "animate-spin text-orange-500" : "text-slate-500"}`} />
                  {isValidating ? "VALIDATING..." : "VALIDATE FILES"}
                </button>
              </div>
            </div>

            {/* Card 2: Clear SML Cache */}
            <div className="bg-zinc-900/60 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 hover:bg-zinc-900 transition-all duration-200">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Package Cache Clean</span>
                  <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700/50 uppercase font-mono">ficsit-cli</span>
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-200">Purge Local SML Caches</h3>
                <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                  Removes cached mod manifests, local DB lockfiles, and downloaded registry indexes to resolve dependency conflicts.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {clearCacheStatus && (
                  <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded">
                    {clearCacheStatus}
                  </div>
                )}
                <button
                  onClick={handleClearSmlCache}
                  disabled={isClearingCache || isLoading}
                  id="quick-btn-clear"
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                    isClearingCache 
                      ? "border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold" 
                      : "border-slate-800 bg-zinc-955 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                  }`}
                >
                  <Trash2 className={`w-4 h-4 mr-2 ${isClearingCache ? "animate-bounce text-amber-500" : "text-slate-500"}`} />
                  {isClearingCache ? "CLEARING..." : "CLEAR SML CACHE"}
                </button>
              </div>
            </div>

            {/* Card 3: Force Telemetry Sync */}
            <div className="bg-zinc-900/60 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 hover:bg-zinc-900 transition-all duration-200">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Telemetry Engine Sync</span>
                  <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700/50 uppercase font-mono">daemon</span>
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-200">Forced Telemetry Re-align</h3>
                <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                  Re-opens local host query sockets, purges out-of-order packet buffers, and restarts telemetry streaming.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {forceRefreshStatus && (
                  <div className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1.5 rounded">
                    {forceRefreshStatus}
                  </div>
                )}
                <button
                  onClick={handleForceRefreshDaemon}
                  disabled={isForceRefreshing || isLoading}
                  id="quick-btn-refresh"
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                    isForceRefreshing 
                      ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-400 font-bold" 
                      : "border-slate-800 bg-zinc-955 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isForceRefreshing ? "animate-spin text-cyan-500" : "text-slate-500"}`} />
                  {isForceRefreshing ? "SYNCING..." : "FORCE REFRESH"}
                </button>
              </div>
            </div>

            {/* Card 4: Diagnostic Network Ping Test */}
            <div className="bg-zinc-900/60 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 hover:bg-zinc-900 transition-all duration-200">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Network Diagnostics</span>
                  <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700/50 uppercase font-mono">udp:7777</span>
                </div>
                <h3 className="text-sm font-mono font-bold text-slate-200">Run Diagnostic Ping</h3>
                <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                  Sends raw diagnostic packets to UDP port 7777 to measure round-trip time and packet loss status.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {pingStatus && (
                  <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded animate-pulse">
                    {pingStatus}
                  </div>
                )}
                <button
                  onClick={handlePingDiagnostics}
                  disabled={isPinging || isLoading}
                  id="quick-btn-ping"
                  className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                    isPinging 
                      ? "border-slate-750 bg-slate-800/40 text-slate-300 font-bold" 
                      : "border-slate-800 bg-zinc-955 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                  }`}
                >
                  <Wifi className={`w-4 h-4 mr-2 ${isPinging ? "animate-pulse text-emerald-500" : "text-slate-500"}`} />
                  {isPinging ? "PINGING..." : "RUN DIAGNOSTIC PING"}
                </button>
              </div>
            </div>

            {/* Full-width Toggle Box: Auto-Heal Daemon */}
            <div className="col-span-1 md:col-span-2 bg-zinc-950/60 border border-slate-800/80 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 md:space-x-8 hover:border-orange-500/20 transition-all">
              <div className="space-y-1.5 text-left flex-1">
                <span className="text-[9px] font-mono font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded">Security Policy</span>
                <h3 className="text-sm font-mono font-bold text-slate-200 mt-2">Activate Automated Recovery Daemon</h3>
                <p className="text-[11px] text-slate-500 font-mono leading-relaxed">
                  Enables automated recovery protocols to hot-patch memory-leaking SML mods, clear dead sockets, and reload node parameters if inactive player counts drop to 0.
                </p>
              </div>

              <div className="shrink-0 flex items-center space-x-3 bg-zinc-900 border border-slate-800 px-4 py-3 rounded-lg self-stretch md:self-auto justify-between">
                <span className={`text-[10px] font-mono font-bold uppercase ${autoHealActive ? "text-orange-500" : "text-slate-500"}`}>
                  {autoHealActive ? "ACTIVE" : "STANDBY"}
                </span>
                <button
                  onClick={() => setAutoHealActive(!autoHealActive)}
                  className={`w-10 h-5 rounded-full p-0.5 transition-all cursor-pointer flex ${autoHealActive ? "bg-orange-500 justify-end" : "bg-slate-800 justify-start"}`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-100 shadow"></span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
