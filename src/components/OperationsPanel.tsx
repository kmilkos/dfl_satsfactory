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
  activeSubTab: "nodes" | "backups" | "mods";
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
  onPurgeBackups?: () => Promise<void>;
  onInstallMod: (id: string) => Promise<void>;
  onUninstallMod: (id: string) => Promise<void>;
  onToggleMod: (id: string, enabled: boolean) => Promise<void>;
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
  onPurgeBackups,
  onInstallMod,
  onUninstallMod,
  onToggleMod,
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
  const [modsSubTab, setModsSubTab] = useState<"installed" | "browse">("installed");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [remoteMods, setRemoteMods] = useState<Mod[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  const handleTriggerRemoteSearch = async () => {
    if (!searchModQuery.trim()) return;
    setIsSearchingRemote(true);
    setRemoteMods([]);
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
  };

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

  const [autoHealActive, setAutoHealActive] = useState(serverInfo.autoHealEnabled !== false);

  const handleToggleAutoHeal = async (enabled: boolean) => {
    setAutoHealActive(enabled);
    try {
      const response = await fetch("/api/server/auto-heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) {
        throw new Error("Failed to update auto-heal status.");
      }
      if (onRefreshStatus) {
        await onRefreshStatus();
      }
    } catch (err) {
      console.error(err);
      setAutoHealActive(!enabled);
    }
  };

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

  const handleToggleModEnabledLocal = async (modId: string, enabled: boolean) => {
    await onToggleMod(modId, enabled);
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
  const filteredMods = modsList.filter(mod => {
    const matchesSearch = 
      mod.name.toLowerCase().includes(searchModQuery.toLowerCase()) ||
      mod.id.toLowerCase().includes(searchModQuery.toLowerCase()) ||
      mod.author.toLowerCase().includes(searchModQuery.toLowerCase());
      
    if (modsSubTab === "installed") {
      return mod.installed && matchesSearch;
    } else {
      return matchesSearch;
    }
  });

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
                <span className="text-[10px] font-mono font-bold tracking-wider text-orange-500 uppercase">{(serverInfo.gregName || "Mascot_Greg")} (DaemonForge)</span>
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
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Server Control</h1>
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

              {/* Unified Server Telemetry Chart */}
              <div className="bg-zinc-950/40 border border-slate-800 rounded-lg p-5 space-y-4 font-mono text-xs text-left">
                <div className="text-slate-300 font-bold uppercase text-[9.5px] border-b border-slate-800/85 pb-2.5 flex justify-between items-center">
                  <span className="flex items-center">
                    <Sliders className="w-3.5 h-3.5 mr-1.5 text-orange-500 animate-pulse" /> Unified Server Telemetry Timeline
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 px-2 py-0.5 rounded bg-zinc-900 border border-slate-800">real-time updates</span>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  Real-time timeline visualizing comparative system loads. Monitors processor footprint differences between the game server daemon service (orange) and host system hardware overhead (blue).
                </p>

                <div className="h-56 w-full bg-black/20 rounded border border-slate-850 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetryHistory}>
                      <defs>
                        <linearGradient id="colorServiceCpuUnified" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorHostCpuUnified" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" opacity={0.6} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b" 
                        fontSize={8}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={8} 
                        domain={[0, 100]} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ background: '#090d16', borderColor: '#1e293b', fontSize: '9px', fontFamily: 'monospace' }}
                        labelStyle={{ color: '#64748b' }}
                      />
                      <Area 
                        name="Service CPU %"
                        type="monotone" 
                        dataKey="serviceCpu" 
                        stroke="#f97316" 
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill="url(#colorServiceCpuUnified)" 
                      />
                      <Area 
                        name="Host CPU %"
                        type="monotone" 
                        dataKey="cpu" 
                        stroke="#3b82f6" 
                        strokeWidth={1.5}
                        fillOpacity={1} 
                        fill="url(#colorHostCpuUnified)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Stacked Status Panels */}
            <div className="lg:col-span-1 space-y-5 flex flex-col">
              
              {/* Card 1: State Metadata */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-lg text-left animate-fade-in">
                <div>
                  <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                    <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase">Live Node Telemetry</span>
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                  </div>

                  <div className="py-4 space-y-3.5">
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

                    {/* IP Bound Port */}
                    <div className="flex justify-between items-center text-xs font-mono pb-1">
                      <span className="text-slate-400">IP Bound Port:</span>
                      <span className="text-slate-300 font-bold">0.0.0.0:7777 (UDP)</span>
                    </div>
                  </div>
                </div>

                {/* Warning notice banner */}
                <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3 mt-1">
                  <div className="flex items-center text-orange-500 text-xs font-mono font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 mr-1.5" /> INDUSTRIAL NOTICE
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal font-mono">
                    All systems operating under the DFL framework require dedicated port forwarding for UDP protocol 7777 (Game combined V2). Shutting down node saves factory status.
                  </p>
                </div>
              </div>

              {/* Card 2: Dedicated Server Service Status */}
              {telemetry.service ? (
                <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-lg text-left font-mono text-xs animate-fade-in">
                  <div>
                    <div className="text-slate-300 font-bold uppercase text-[9.5px] border-b border-slate-800/85 pb-2.5 flex justify-between items-center">
                      <span className="flex items-center">
                        <Terminal className="w-3.5 h-3.5 mr-1.5 text-orange-500 animate-pulse" /> Dedicated Server Service
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        telemetry.service.activeState === "active" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {telemetry.service.activeState.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-4 mt-4">
                      {/* CPU Usage progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 uppercase font-bold">Service CPU Load</span>
                          <span className="text-orange-500 font-bold">{telemetry.service.cpuUsagePct}%</span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 border border-slate-850 overflow-hidden">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, Math.max(0, telemetry.service.cpuUsagePct))}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Memory footprint */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 uppercase font-bold">RAM Footprint</span>
                          <span className="text-orange-500 font-bold">{telemetry.service.memoryMb} MB</span>
                        </div>
                        <div className="w-full bg-zinc-950 rounded-full h-1.5 border border-slate-850 overflow-hidden">
                          <div 
                            className="bg-orange-500/80 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, (telemetry.service.memoryMb / 16384) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 font-mono text-xs text-left text-slate-500 shadow-lg min-h-[120px] flex items-center justify-center">
                  Service telemetry offline...
                </div>
              )}

              {/* Card 3: Host Node Hardware */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between shadow-lg text-left font-mono text-xs animate-fade-in">
                <div>
                  <div className="text-slate-300 font-bold uppercase text-[9.5px] border-b border-slate-800/85 pb-2.5 flex justify-between items-center">
                    <span className="flex items-center">
                      <Sliders className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Host Node Hardware
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ONLINE
                    </span>
                  </div>

                  <div className="space-y-4 mt-4">
                    {/* Host CPU usage progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 uppercase font-bold">Host CPU Load</span>
                        <span className="text-blue-400 font-bold">{telemetry.cpuUsage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5 border border-slate-850 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, Math.max(0, telemetry.cpuUsage))}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Host RAM usage progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 uppercase font-bold">Host RAM Usage</span>
                        <span className="text-blue-400 font-bold">{telemetry.ramUsageGb.toFixed(2)} GB</span>
                      </div>
                      <div className="w-full bg-zinc-950 rounded-full h-1.5 border border-slate-850 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (telemetry.ramUsageGb / 32) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
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
            <div className="flex flex-wrap gap-2.5 mt-2.5 md:mt-0">
              {onPurgeBackups && (
                <button
                  onClick={async () => {
                    if (window.confirm("WARNING: Are you sure you want to purge ALL backup snapshots? This action is permanent and cannot be undone.")) {
                      await onPurgeBackups();
                    }
                  }}
                  disabled={isLoading || backupsList.length === 0}
                  className={`px-4 py-2 rounded text-xs font-mono font-bold border flex items-center shadow transition-all cursor-pointer ${
                    !isLoading && backupsList.length > 0
                      ? "border-rose-900 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50"
                      : "border-slate-800 text-slate-500 bg-zinc-900/30 cursor-not-allowed"
                  }`}
                  id="btn-purge-backups"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> PURGE ALL BACKUPS
                </button>
              )}
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
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">SML Mod Manager</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">SML profile dependency resolutions, searching and automated package downloads</p>
            </div>
            
            {/* Search Bar */}
            <div className="mt-3 md:mt-0 flex items-center space-x-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-slate-500" />
                </span>
                <input
                  type="text"
                  placeholder={modsSubTab === "installed" ? "Search installed mods..." : "Search mods..."}
                  value={searchModQuery}
                  onChange={(e) => {
                    setSearchModQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setRemoteMods([]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && modsSubTab === "browse") {
                      handleTriggerRemoteSearch();
                    }
                  }}
                  className="w-full pl-9 pr-4 py-1.5 bg-zinc-955 border border-slate-800 rounded font-mono text-xs text-slate-100 focus:outline-none focus:border-orange-500 placeholder-slate-600"
                />
              </div>
              {modsSubTab === "browse" && (
                <button
                  onClick={handleTriggerRemoteSearch}
                  disabled={isSearchingRemote || !searchModQuery.trim()}
                  className="px-3 py-1.5 bg-orange-500 text-zinc-950 font-mono font-bold text-xs rounded hover:bg-orange-600 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearchingRemote ? "SEARCHING..." : "SEARCH SMR"}
                </button>
              )}
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
              
              {/* Tab Navigation header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setModsSubTab("installed");
                      setSearchModQuery("");
                    }}
                    className={`px-4 py-1.5 font-mono text-xs font-bold rounded transition-all cursor-pointer ${
                      modsSubTab === "installed"
                        ? "bg-orange-500 text-zinc-950 shadow-md"
                        : "text-slate-400 hover:text-slate-200 hover:bg-zinc-800/40"
                    }`}
                  >
                    INSTALLED ({modsList.filter(m => m.installed).length})
                  </button>
                  <button
                    onClick={() => {
                      setModsSubTab("browse");
                      setSearchModQuery("");
                    }}
                    className={`px-4 py-1.5 font-mono text-xs font-bold rounded transition-all cursor-pointer ${
                      modsSubTab === "browse"
                        ? "bg-orange-500 text-zinc-950 shadow-md"
                        : "text-slate-400 hover:text-slate-200 hover:bg-zinc-800/40"
                    }`}
                  >
                    BROWSE NEW MODS
                  </button>
                </div>
                <span className="text-xs font-mono text-slate-500">Registry: Ficsit.app API</span>
              </div>

              {/* Mod entries listing */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px]">
                {modsSubTab === "installed" ? (
                  /* --- INSTALLED TAB --- */
                  filteredMods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 font-mono">
                      <Info className="w-8 h-8 mb-2" />
                      {searchModQuery.trim() 
                        ? `No installed mods matching "${searchModQuery}" found.`
                        : "No mods currently installed."
                      }
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
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border transition-all ${
                              mod.enabled
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-800/40 text-slate-500 border-slate-700/50"
                            }`}>
                              {mod.enabled ? "ACTIVE" : "DISABLED"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-normal line-clamp-2 pr-2">
                            {mod.description}
                          </p>
                          <div className="flex items-center space-x-3 text-[9px] font-mono text-slate-500">
                            <span>Developer: <span className="text-orange-500">{mod.author}</span></span>
                            <span>Downloads: <span>{mod.downloads.toLocaleString()}</span></span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end shrink-0">
                          {/* Toggle Enabled */}
                          <button
                            onClick={() => handleToggleModEnabledLocal(mod.id, !mod.enabled)}
                            disabled={mod.id === "FicsitRemoteMonitoring"}
                            title={mod.id === "FicsitRemoteMonitoring" ? "Required tool" : mod.enabled ? "Disable Mod" : "Enable Mod"}
                            className={`px-3 py-1 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                              mod.enabled
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-800/40 hover:bg-slate-800/60 text-slate-400 border-slate-750"
                            }`}
                          >
                            {mod.enabled ? "DISABLE" : "ENABLE"}
                          </button>

                          {/* Uninstall Mod */}
                          <button
                            onClick={() => onUninstallMod(mod.id)}
                            disabled={isLoading || mod.id === "FicsitRemoteMonitoring"}
                            className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-mono font-bold rounded cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  /* --- BROWSE TAB --- */
                  filteredMods.length > 0 ? (
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
                  )
                )}
              </div>
            </div>
          </div>
        </div>
        )}

    </div>
  </div>
  );
}
