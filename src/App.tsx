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
import { 
  Copy, Check, ExternalLink, Lock, Shield, Activity, Wifi, Cpu, Layers, Terminal, User, Server, Hash 
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("nodes");
  
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
    const handleCopy = () => {
      const address = "satisfactory.milkos.gr:7777";
      
      const performFallbackCopy = (text: string) => {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand("copy");
          document.body.removeChild(textarea);
          if (successful) {
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2000);
          } else {
            console.error("Fallback clipboard copy failed");
          }
        } catch (err) {
          console.error("Fallback clipboard copy threw error:", err);
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address)
          .then(() => {
            setCopiedText(true);
            setTimeout(() => setCopiedText(false), 2000);
          })
          .catch(() => {
            performFallbackCopy(address);
          });
      } else {
        performFallbackCopy(address);
      }
    };

    const statusColors = {
      OFFLINE: "bg-zinc-600 text-zinc-400 border-zinc-500",
      STARTING: "bg-amber-500/20 text-amber-500 border-amber-600 animate-pulse",
      ONLINE: "bg-emerald-500/20 text-emerald-400 border-emerald-600",
      UPDATING: "bg-blue-500/20 text-blue-400 border-blue-600 animate-pulse",
      CRASHED: "bg-rose-500/20 text-rose-400 border-rose-600",
    };

    const activeMods = modsList.filter(m => m.installed);

    return (
      <div className="w-screen min-h-screen bg-zinc-950 font-sans flex flex-col justify-between overflow-x-hidden text-slate-100 selection:bg-orange-500/30 selection:text-orange-400">
        
        {/* Header */}
        <header className="relative w-full h-20 bg-zinc-950 border-b border-slate-900 flex items-center justify-between px-8 shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-zinc-900 border border-slate-800 rounded flex items-center justify-center shadow-lg">
              <Server className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-mono font-bold tracking-wider text-slate-200">DAEMONFORGE</h1>
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Public Server Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider">Status:</span>
            <div className={`px-3 py-1 rounded border text-[11px] font-mono font-bold tracking-tight ${statusColors[serverStatus]}`}>
              {serverStatus}
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left side: Telemetry & Installed Mods list */}
            <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
              
              {/* Telemetry card */}
              <div className="bg-zinc-900/40 border border-slate-800/80 rounded-xl p-6 shadow-xl flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/60 mb-4">
                    <Activity className="w-4 h-4 text-orange-500 animate-pulse" />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Live Telemetry</h2>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-zinc-950/60 border border-slate-900 rounded-lg p-3 text-left">
                      <p className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Active Session</p>
                      <p className="text-xs font-bold text-slate-200 truncate mt-1" title={serverInfo.sessionName}>
                        {serverInfo.sessionName || "None"}
                      </p>
                    </div>

                    <div className="bg-zinc-950/60 border border-slate-900 rounded-lg p-3 text-left">
                      <p className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Pioneers Online</p>
                      <p className="text-xs font-bold text-slate-200 mt-1 flex items-center">
                        <User className="w-3.5 h-3.5 text-emerald-500 mr-1 shrink-0" />
                        {serverInfo.playersOnline} / {serverInfo.maxPlayers}
                      </p>
                    </div>

                    <div className="bg-zinc-950/60 border border-slate-900 rounded-lg p-3 text-left">
                      <p className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Server Build</p>
                      <p className="text-xs font-bold text-slate-200 mt-1 truncate" title={serverInfo.version}>
                        {serverInfo.version ? serverInfo.version.split(" ")[0] : "v1.0.0"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Telemetry metrics */}
                <div className="space-y-4">
                  <div className="bg-zinc-950/60 border border-slate-900 rounded-lg p-4 text-left">
                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-2 font-bold uppercase tracking-wider">
                      <span>Server Resources</span>
                      <span className="text-slate-400">
                        CPU: {telemetry.cpuUsage.toFixed(1)}% | RAM: {telemetry.ramUsageGb.toFixed(2)} GB
                      </span>
                    </div>
                    <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden flex">
                      <div 
                        className="bg-orange-500 transition-all duration-500" 
                        style={{ width: `${Math.min(telemetry.cpuUsage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Active Pioneers online */}
                  <div className="bg-zinc-950/60 border border-slate-900 rounded-lg p-4 text-left">
                    <p className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider mb-2">Connected Pioneers</p>
                    {telemetry.players.length === 0 ? (
                      <p className="text-xs text-slate-600 font-mono italic">No Pioneers active in-game currently.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {telemetry.players.map(p => (
                          <span key={p.name} className="px-2 py-1 bg-zinc-900 border border-slate-800 text-slate-300 text-[10px] font-mono rounded flex items-center">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                            @{p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* SML Mods Card */}
              <div className="bg-zinc-900/40 border border-slate-800/80 rounded-xl p-6 shadow-xl text-left">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-4">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Installed SML Mods</h2>
                  </div>
                  <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded text-[9px] font-mono font-bold">
                    {activeMods.length} PACKAGES
                  </span>
                </div>

                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {activeMods.length === 0 ? (
                    <p className="text-xs text-slate-600 font-mono italic">No SML mods active. Running Vanilla configuration.</p>
                  ) : (
                    activeMods.map(m => (
                      <div key={m.id} className="p-2.5 bg-zinc-950/60 border border-slate-900 rounded-lg flex items-center justify-between gap-4">
                        <div className="min-w-0 text-left">
                          <h3 className="text-xs font-bold text-slate-200 truncate">{m.name}</h3>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{m.description || "No description."}</p>
                        </div>
                        <span className="bg-zinc-900 px-2 py-1 rounded text-[9px] font-mono text-slate-400 border border-slate-800 shrink-0">
                          v{m.version}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right side: Copy connection info & Login Form */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              
              {/* Connection Card */}
              <div className="bg-zinc-900/40 border border-slate-800/80 rounded-xl p-6 shadow-xl text-left">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/60 mb-4">
                  <ExternalLink className="w-4 h-4 text-orange-500" />
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Connection Details</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Server IP Address</label>
                    <div className="mt-1 flex space-x-2">
                      <div className="flex-1 bg-zinc-950 border border-slate-900 px-3 py-2 rounded font-mono text-xs text-slate-300 select-all truncate">
                        satisfactory.milkos.gr
                      </div>
                      <button 
                        onClick={handleCopy}
                        className="px-3 bg-zinc-900 border border-slate-800 text-slate-300 rounded hover:bg-zinc-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer text-xs font-mono font-bold animate-transition"
                      >
                        {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Query Port</label>
                      <div className="mt-1 bg-zinc-950 border border-slate-900 px-3 py-2 rounded font-mono text-xs text-slate-300">
                        7777 UDP
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">SML Modding Status</label>
                      <div className="mt-1 bg-zinc-950 border border-slate-900 px-3 py-2 rounded font-mono text-xs text-slate-300 flex items-center">
                        <span className={`w-1.5 h-1.5 rounded-full mr-2 ${serverInfo.moddingEnabled ? "bg-orange-500 shadow-[0_0_8px_#f97316]" : "bg-zinc-500"}`}></span>
                        {serverInfo.moddingEnabled ? "MODDED (SML)" : "VANILLA"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Card */}
              <div className="bg-zinc-900/40 border border-slate-800/80 rounded-xl p-6 shadow-xl text-left flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 pb-3 border-b border-slate-800/60 mb-4">
                    <Lock className="w-4 h-4 text-orange-500" />
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Admin Console Access</h2>
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono leading-relaxed mb-6">
                    Enter the administration console password configured in your server state parameters to access settings, system controls, backups, and live commands.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 bg-rose-955 border border-rose-900/40 text-rose-400 text-xs font-mono rounded-lg">
                      Error: {loginError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Admin Password</label>
                    <input 
                      type="password"
                      placeholder="Enter administrator password..."
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-slate-900 rounded font-mono text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2 bg-orange-500 text-zinc-950 hover:bg-orange-600 transition-colors font-mono font-bold text-xs rounded shadow-lg cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>AUTHENTICATE BRIDGE</span>
                  </button>
                </form>
              </div>

            </div>

          </div>
        </main>

        {/* Footer */}
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
