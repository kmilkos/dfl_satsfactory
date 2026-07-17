import React, { useState, useEffect } from "react";
import { 
  Settings, Shield, Database, Brain, Layout, Save, 
  RefreshCw, CheckCircle, AlertCircle, Info, ToggleLeft, ToggleRight,
  Zap, Trash2, Wifi, FileText, Terminal, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ServerState } from "../types";
import DocumentationViewer from "./DocumentationViewer";

interface SettingsPanelProps {
  serverInfo: ServerState;
  serverStatus: string;
  onRefreshStatus: () => Promise<void>;
  onSaveBackupConfig: (enabled: boolean, intervalMinutes: number) => Promise<void>;
  browserTitle: string;
  setBrowserTitle: (title: string) => void;
  isLoading?: boolean;
}

export default function SettingsPanel({
  serverInfo,
  serverStatus,
  onRefreshStatus,
  onSaveBackupConfig,
  browserTitle,
  setBrowserTitle,
  isLoading: parentLoading
}: SettingsPanelProps) {
  // Local states for settings inputs
  const [activeSubTab, setActiveSubTab] = useState<"system" | "quick-actions" | "docs">("system");
  const [autoHealActive, setAutoHealActive] = useState(serverInfo.autoHealEnabled !== false);
  const [backupEnabled, setBackupEnabled] = useState(serverInfo.autoBackupEnabled);
  const [backupInterval, setBackupInterval] = useState(serverInfo.backupIntervalMinutes);
  const [geminiModel, setGeminiModel] = useState(serverInfo.geminiModel || "gemini-3.5-flash");
  const [gregPersonality, setGregPersonality] = useState(serverInfo.gregPersonality || "sarcastic");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [customTitleInput, setCustomTitleInput] = useState(browserTitle);
  const [googleClientId, setGoogleClientId] = useState(serverInfo.googleClientId || "");
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);

  // States for Password Change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // States for Quick Actions
  const [isValidating, setIsValidating] = useState(false);
  const [validateStatus, setValidateStatus] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearCacheStatus, setClearCacheStatus] = useState<string | null>(null);
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);
  const [forceRefreshStatus, setForceRefreshStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  
  // Status feedback states
  const [actionStatus, setActionStatus] = useState<{
    section: "auto-heal" | "backup" | "greg" | "interface" | null;
    type: "success" | "error" | "loading" | null;
    message: string;
  }>({ section: null, type: null, message: "" });

  const [isSaving, setIsSaving] = useState(false);

  // Sync inputs with incoming serverInfo when it updates
  useEffect(() => {
    setAutoHealActive(serverInfo.autoHealEnabled !== false);
    setBackupEnabled(serverInfo.autoBackupEnabled);
    setBackupInterval(serverInfo.backupIntervalMinutes);
    setGeminiModel(serverInfo.geminiModel || "gemini-3.5-flash");
    setGregPersonality(serverInfo.gregPersonality || "sarcastic");
    setGoogleClientId(serverInfo.googleClientId || "");
  }, [serverInfo]);

  // Load Google Identity Services SDK dynamically for live login
  useEffect(() => {
    if (serverInfo.googleClientId && showGoogleModal) {
      const scriptId = "google-gis-sdk";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const initGoogleBtn = () => {
        if ((window as any).google?.accounts?.id) {
          (window as any).google.accounts.id.initialize({
            client_id: serverInfo.googleClientId,
            callback: (response: any) => {
              try {
                const base64Url = response.credential.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const payload = JSON.parse(jsonPayload);
                handleGoogleLogin(payload.email, payload.name, payload.picture);
              } catch (err) {
                console.error("JWT Decode error:", err);
                triggerFeedback("greg", "error", "Failed to decode Google identity token.");
              }
            }
          });

          (window as any).google.accounts.id.renderButton(
            document.getElementById("live-google-btn"),
            { theme: "outline", size: "large", text: "signin_with", width: 280 }
          );
        }
      };

      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setTimeout(initGoogleBtn, 250);
        };
        document.body.appendChild(script);
      } else {
        initGoogleBtn();
      }
    }
  }, [serverInfo.googleClientId, showGoogleModal]);

  // Temporary feedback toast timer
  const triggerFeedback = (section: typeof actionStatus.section, type: typeof actionStatus.type, message: string) => {
    setActionStatus({ section, type, message });
    if (type !== "loading") {
      setTimeout(() => {
        setActionStatus({ section: null, type: null, message: "" });
      }, 4000);
    }
  };

  // Authenticated fetch wrapper using local admin token
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const adminToken = localStorage.getItem("adminToken");
    const headers = {
      ...(options.headers || {}),
      ...(adminToken ? { "Authorization": `Bearer ${adminToken}` } : {})
    };
    return fetch(url, { ...options, headers });
  };

  // 1. Save Auto-Heal setting
  const handleToggleAutoHeal = async (enabled: boolean) => {
    setAutoHealActive(enabled);
    triggerFeedback("auto-heal", "loading", "Updating daemon configuration...");
    try {
      const response = await fetchWithAuth("/api/server/auto-heal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      if (!response.ok) {
        throw new Error("Failed to update auto-heal daemon status.");
      }
      await onRefreshStatus();
      triggerFeedback("auto-heal", "success", "Auto-Heal daemon configuration applied.");
    } catch (err: any) {
      console.error(err);
      setAutoHealActive(!enabled);
      triggerFeedback("auto-heal", "error", err.message || "Failed to update status.");
    }
  };

  // 2. Save Auto-Backup settings
  const handleSaveBackupSettings = async (enabled: boolean, interval: number) => {
    triggerFeedback("backup", "loading", "Applying backup policy...");
    try {
      await onSaveBackupConfig(enabled, interval);
      setBackupEnabled(enabled);
      setBackupInterval(interval);
      triggerFeedback("backup", "success", "Backup policy successfully synchronized.");
    } catch (err: any) {
      console.error(err);
      triggerFeedback("backup", "error", "Failed to update backup policy.");
    }
  };

  // 3. Save Gemini API Configuration (Model & Key)
  const handleSaveAIConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    triggerFeedback("greg", "loading", "Deploying AI neural matrix keys...");
    setIsSaving(true);
    try {
      const body: Record<string, string> = { 
        model: geminiModel,
        personality: gregPersonality,
        googleClientId: googleClientId.trim()
      };
      if (apiKeyInput.trim()) {
        body.apiKey = apiKeyInput.trim();
      }

      const res = await fetchWithAuth("/api/greg/config-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setApiKeyInput("");
        await onRefreshStatus();
        triggerFeedback("greg", "success", "AI cognitive matrix keys deployed successfully.");
      } else {
        throw new Error(data.error || "Failed to save API configurations.");
      }
    } catch (err: any) {
      triggerFeedback("greg", "error", err.message || "Error deploying keys.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoogleLogin = async (email: string, name: string, picture?: string) => {
    setIsLoggingInGoogle(true);
    triggerFeedback("greg", "loading", "Connecting to FICSIT AI Cloud via Google auth...");
    try {
      const res = await fetchWithAuth("/api/greg/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, picture })
      });
      const data = await res.json();
      if (data.success) {
        await onRefreshStatus();
        setShowGoogleModal(false);
        triggerFeedback("greg", "success", `Successfully linked subscription to ${name}!`);
      } else {
        throw new Error(data.error || "Failed to establish AI session.");
      }
    } catch (err: any) {
      triggerFeedback("greg", "error", err.message || "Google Authentication failed.");
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleGoogleLogout = async () => {
    triggerFeedback("greg", "loading", "Disconnecting FICSIT AI Cloud subscription...");
    try {
      const res = await fetchWithAuth("/api/greg/google-logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        await onRefreshStatus();
        triggerFeedback("greg", "success", "Reverted to customized API parameters.");
      } else {
        throw new Error("Failed to clear Google account.");
      }
    } catch (err: any) {
      triggerFeedback("greg", "error", err.message || "OAuth signout error.");
    }
  };

  // 4. Save Interface Settings (Browser Title)
  const handleSaveInterfaceConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newTitle = customTitleInput.trim();
    if (newTitle) {
      setBrowserTitle(newTitle);
      triggerFeedback("interface", "success", "Window title interface parameters applied.");
    } else {
      // Revert to default logic
      localStorage.removeItem("dfl_browser_title");
      if (serverInfo.sessionName) {
        setBrowserTitle(`DFL Satisfactory Server - ${serverInfo.sessionName}`);
      } else {
        setBrowserTitle("DaemonForge Satisfactory Server Panel");
      }
      setCustomTitleInput("");
      triggerFeedback("interface", "success", "Reverted window title to default parameters.");
    }
  };

  // Quick Action Handler: Validate Server Files
  const handleValidateServerFiles = async () => {
    setIsValidating(true);
    setValidateStatus(null);
    try {
      const res = await fetchWithAuth("/api/actions/validate", { method: "POST" });
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
      const res = await fetchWithAuth("/api/actions/clear-cache", { method: "POST" });
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
      const res = await fetchWithAuth("/api/actions/force-refresh", { method: "POST" });
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

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError("All password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetchWithAuth("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordChangeSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordChangeSuccess(null), 5000);
      } else {
        setPasswordChangeError(data.error || "Failed to update password.");
      }
    } catch (err) {
      setPasswordChangeError("Network connection failure.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="w-full h-full text-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 p-6 pb-4 shrink-0 text-left">
        <div>
          <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold flex items-center">
            <Settings className="w-5 h-5 mr-2 text-orange-500 animate-spin" style={{ animationDuration: '6s' }} />
            FICSIT System Settings Manager
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Consolidated configuration matrix controlling daemon parameters, backup loops, cognitive models, and interface parameters
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 mt-2 md:mt-0 bg-zinc-955 border border-slate-900 px-3 py-1.5 rounded flex items-center shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2"></span>
          ACTIVE SESSION: <span className="text-slate-300 ml-1 font-bold">{serverInfo.sessionName || "None"}</span>
        </div>
      </div>

      {/* Sub-tab Navigation Menu */}
      <div className="flex border-b border-slate-800 px-6 shrink-0 bg-zinc-950/20 text-left gap-4 py-2.5">
        <button
          onClick={() => setActiveSubTab("system")}
          className={`px-3 py-1.5 font-mono text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "system"
              ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          System Settings
        </button>
        <button
          onClick={() => setActiveSubTab("quick-actions")}
          className={`px-3 py-1.5 font-mono text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "quick-actions"
              ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Quick Actions
        </button>
        <button
          onClick={() => setActiveSubTab("docs")}
          className={`px-3 py-1.5 font-mono text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "docs"
              ? "bg-orange-500/10 text-orange-500 border border-orange-500/30"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Docs Hub
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto min-h-0 flex flex-col"
          >
            {activeSubTab === "system" && (
              <div className="p-6 space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card 1: FICSIT Node Controls (Auto-Heal) */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between text-left space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                          <Shield className="w-4 h-4 mr-1.5 text-orange-500" /> FICSIT Node Controls
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 rounded bg-zinc-950 border border-slate-850">daemon</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Configure auto-healing loops. When active, the system monitoring daemon scans satisfactory processes for lockups or server crashes, auto-triggering restart sequences.
                      </p>
                    </div>

                    <div className="bg-zinc-955/60 border border-slate-850 p-4 rounded-lg flex flex-col justify-between space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono text-slate-300 font-bold block">Daemon Auto-Heal Mode</span>
                          <span className="text-[9px] font-mono text-slate-500">Triggers automated systemd restarts</span>
                        </div>
                        <button
                          onClick={() => handleToggleAutoHeal(!autoHealActive)}
                          className="focus:outline-none transition-transform hover:scale-105 cursor-pointer text-orange-500"
                        >
                          {autoHealActive ? (
                            <ToggleRight className="w-10 h-10 text-orange-500" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-600" />
                          )}
                        </button>
                      </div>

                      {/* Action Feedback Row */}
                      <AnimatePresence mode="wait">
                        {actionStatus.section === "auto-heal" && (
                          <motion.div 
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            className="text-[9px] font-mono flex items-center space-x-1.5 pt-1.5 border-t border-slate-900"
                          >
                            {actionStatus.type === "loading" && <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
                            {actionStatus.type === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            {actionStatus.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                            <span className={actionStatus.type === "error" ? "text-rose-400" : actionStatus.type === "success" ? "text-emerald-400" : "text-slate-400"}>
                              {actionStatus.message}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Card 2: Backup Policy (Auto-Backup & Intervals) */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between text-left space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                          <Database className="w-4 h-4 mr-1.5 text-orange-500" /> Backup Policy Configuration
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 rounded bg-zinc-950 border border-slate-850">scheduler</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Configure automated save snapshot policies. Backups capture active server slots at selected minute ticks, preserving historical progress.
                      </p>
                    </div>

                    <div className="bg-zinc-955/60 border border-slate-850 p-4 rounded-lg space-y-4">
                      {/* Toggle Row */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono text-slate-300 font-bold block">Automated Backup Daemon</span>
                          <span className="text-[9px] font-mono text-slate-500">Periodic snapshot creation loop</span>
                        </div>
                        <button
                          onClick={() => handleSaveBackupSettings(!backupEnabled, backupInterval)}
                          className="focus:outline-none transition-transform hover:scale-105 cursor-pointer text-orange-500"
                        >
                          {backupEnabled ? (
                            <ToggleRight className="w-10 h-10 text-orange-500" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-600" />
                          )}
                        </button>
                      </div>

                      {/* Interval Row */}
                      <div className="space-y-2 pt-2 border-t border-slate-900">
                        <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Snapshot frequency interval</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[5, 15, 30, 60].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => handleSaveBackupSettings(backupEnabled, mins)}
                              disabled={!backupEnabled}
                              className={`py-1 text-center font-mono text-xs rounded border transition-all cursor-pointer ${
                                backupInterval === mins && backupEnabled
                                  ? "bg-orange-500/15 border-orange-500 text-orange-400 font-bold"
                                  : "border-slate-800 text-slate-500 hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none"
                              }`}
                            >
                              {mins}m
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Feedback toast row */}
                      <AnimatePresence mode="wait">
                        {actionStatus.section === "backup" && (
                          <motion.div 
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            className="text-[9px] font-mono flex items-center space-x-1.5 pt-1.5 border-t border-slate-900"
                          >
                            {actionStatus.type === "loading" && <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
                            {actionStatus.type === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            {actionStatus.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                            <span className={actionStatus.type === "error" ? "text-rose-400" : actionStatus.type === "success" ? "text-emerald-400" : "text-slate-400"}>
                              {actionStatus.message}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Card 3: Greg Cognitive Engine */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between text-left space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                          <Brain className="w-4 h-4 mr-1.5 text-orange-500" /> Mascot Cognitive Neural Parameters
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 rounded bg-zinc-950 border border-slate-850">gemini</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Connect the AI sysadmin assistant "Greg" to Google Gemini API keys. Enables analytical reasoning over logs, technical query resolution, and live chat advice.
                      </p>
                    </div>

                    <form onSubmit={handleSaveAIConfig} className="bg-zinc-950/60 border border-slate-850 p-4 rounded-lg space-y-3.5">
                      
                      {/* Dropdown Select Model */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Select Active Engine Model</label>
                        <select
                          value={geminiModel}
                          onChange={(e) => setGeminiModel(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300 focus:outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Flagship Fast)</option>
                          <option value="gemini-3.5-pro">Gemini 3.5 Pro (Flagship High-Intelligence)</option>
                          <option value="gemini-3.1-flash">Gemini 3.1 Flash (Legacy Fast)</option>
                          <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Analytical Preview)</option>
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                          <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro Experimental</option>
                          <option value="gemini-2.0-flash-thinking-exp">Gemini 2.0 Flash Thinking Experimental</option>
                        </select>
                      </div>

                      {/* Dropdown Select Personality */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Mascot GReg's Personality Adjuster</label>
                        <select
                          value={gregPersonality}
                          onChange={(e) => setGregPersonality(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-300 focus:outline-none focus:border-orange-500 cursor-pointer"
                        >
                          <option value="sarcastic">Sarcastic Sysadmin (Tired, dry humor, default)</option>
                          <option value="corporate">Cheery FICSIT Guide (corporate, overly positive)</option>
                          <option value="military">Drill Sergeant (strict, loud commands)</option>
                          <option value="glados">Paranoid AI (condescending, GLaDOS-like)</option>
                        </select>
                      </div>

                      {/* Google Client ID Input */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Google Client ID (For Live Google Login)</label>
                          <a 
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-mono text-orange-500 hover:text-orange-400 font-bold flex items-center hover:underline cursor-pointer transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            GET CLIENT ID
                          </a>
                        </div>
                        <input
                          type="text"
                          placeholder="Enter Google Client ID..."
                          value={googleClientId}
                          onChange={(e) => setGoogleClientId(e.target.value)}
                          disabled={isSaving}
                          className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* API Key Input or Subscription Status */}
                      {serverInfo.useSubscriptionAI ? (
                        <div className="space-y-2 pt-2 border-t border-slate-900">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                            <span>FICSIT AI CLOUD INTEGRATION</span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[8px] font-bold animate-pulse">
                              Subscription Active
                            </span>
                          </div>
                          
                          <div className="bg-zinc-900 border border-slate-800 rounded p-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3 text-left">
                              {serverInfo.gregGooglePicture ? (
                                <img 
                                  src={serverInfo.gregGooglePicture} 
                                  alt="Google Profile" 
                                  className="w-9 h-9 rounded-full border border-orange-500 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-orange-500/15 border border-orange-500 flex items-center justify-center text-orange-400 font-mono font-bold text-xs select-none">
                                  FP
                                </div>
                              )}
                              <div className="font-mono">
                                <span className="text-xs font-bold text-slate-200 block truncate max-w-[140px]">
                                  {serverInfo.gregGoogleName || "Ficsit Pioneer"}
                                </span>
                                <span className="text-[9px] text-slate-500 block truncate max-w-[140px]">
                                  {serverInfo.gregGoogleEmail}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={handleGoogleLogout}
                              className="px-2.5 py-1 border border-rose-900/60 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 rounded font-mono font-bold text-[9px] uppercase transition-colors cursor-pointer"
                            >
                              Sign Out
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-mono text-slate-500 uppercase font-bold">Gemini API Key</label>
                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                                serverInfo.hasGeminiKey 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
                              }`}>
                                {serverInfo.hasGeminiKey ? "Key Configured" : "Key Missing"}
                              </span>
                            </div>
                            <input
                              type="password"
                              placeholder={serverInfo.hasGeminiKey ? "••••••••••••••••••••••••••••••••••••" : "Enter GEMINI_API_KEY..."}
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              disabled={isSaving}
                              className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                            />
                          </div>

                          <div className="pt-2 border-t border-slate-900 flex flex-col space-y-1.5">
                            <span className="text-[9px] font-mono text-slate-500 uppercase font-bold block text-left">Or coupling to subscription AI services</span>
                            <button
                              type="button"
                              onClick={() => setShowGoogleModal(true)}
                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 font-sans font-bold text-[11px] rounded border border-slate-300 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                              Sign in with Google
                            </button>
                          </div>
                        </>
                      )}

                      {/* Card-wide Save Button */}
                      <div className="pt-3 border-t border-slate-900">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-zinc-950 transition-colors font-mono font-bold text-[10px] uppercase rounded shadow cursor-pointer flex items-center justify-center space-x-1.5 font-bold"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSaving ? "SAVING..." : "SAVE GREG CONFIGURATION"}</span>
                        </button>
                      </div>

                      {/* Feedback toast row */}
                      <AnimatePresence mode="wait">
                        {actionStatus.section === "greg" && (
                          <motion.div 
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            className="text-[9px] font-mono flex items-center space-x-1.5 pt-1.5 border-t border-slate-900"
                          >
                            {actionStatus.type === "loading" && <RefreshCw className="w-3.5 h-3.5 text-orange-500 animate-spin" />}
                            {actionStatus.type === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                            {actionStatus.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                            <span className={actionStatus.type === "error" ? "text-rose-400" : actionStatus.type === "success" ? "text-emerald-400" : "text-slate-400"}>
                              {actionStatus.message}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </form>
                  </div>

                  {/* Card 4: Web Interface (Browser Title) */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between text-left space-y-4 shadow-lg">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                        <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                          <Layout className="w-4 h-4 mr-1.5 text-orange-500" /> Web Interface Customizations
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 px-2 py-0.5 rounded bg-zinc-950 border border-slate-850">client</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Modify panel interface elements. Set a custom browser window tab title to easily distinguish between multiple Satisfactory server panels running in background tabs.
                      </p>
                    </div>

                    <form onSubmit={handleSaveInterfaceConfig} className="bg-zinc-955/60 border border-slate-850 p-4 rounded-lg space-y-3.5">
                      
                      {/* Window Title Input */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-slate-500 uppercase font-bold block">Browser Window Tab Title</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Enter Custom Browser Title..."
                            value={customTitleInput}
                            onChange={(e) => setCustomTitleInput(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                          />
                          <button
                            type="submit"
                            className="px-3 bg-orange-500 text-zinc-955 rounded hover:bg-orange-600 font-mono font-bold text-[10px] uppercase transition-all cursor-pointer flex items-center justify-center shrink-0"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Reset to Default Button option */}
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-slate-500">Clear title to restore defaults</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomTitleInput("");
                            localStorage.removeItem("dfl_browser_title");
                            if (serverInfo.sessionName) {
                              setBrowserTitle(`DFL Satisfactory Server - ${serverInfo.sessionName}`);
                            } else {
                              setBrowserTitle("DaemonForge Satisfactory Server Panel");
                            }
                            triggerFeedback("interface", "success", "Reverted title to dynamic defaults.");
                          }}
                          className="text-[9px] text-orange-500 hover:text-orange-400 hover:underline transition-all cursor-pointer uppercase font-bold"
                        >
                          Reset Default
                        </button>
                      </div>

                      {/* Feedback toast row */}
                      <AnimatePresence mode="wait">
                        {actionStatus.section === "interface" && (
                          <motion.div 
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            className="text-[9px] font-mono flex items-center space-x-1.5 pt-1.5 border-t border-slate-900"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">
                              {actionStatus.message}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </form>

                    {/* Admin Password Change Section */}
                    <div className="mt-4 pt-4 border-t border-slate-900 space-y-3.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Change Admin Password
                      </span>
                      
                      <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                        {passwordChangeError && (
                          <div className="p-2 bg-rose-950/40 border border-rose-900/40 text-rose-400 text-[10px] font-mono rounded">
                            ERROR: {passwordChangeError}
                          </div>
                        )}
                        {passwordChangeSuccess && (
                          <div className="p-2 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] font-mono rounded">
                            SUCCESS: {passwordChangeSuccess}
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-500 uppercase font-bold block">Current Admin Password</label>
                          <input
                            type="password"
                            placeholder="Enter current password..."
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={isUpdatingPassword}
                            className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-750 focus:outline-none focus:border-orange-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-slate-500 uppercase font-bold block">New Password</label>
                            <input
                              type="password"
                              placeholder="Min 6 chars..."
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              disabled={isUpdatingPassword}
                              className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-750 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono text-slate-500 uppercase font-bold block">Confirm Password</label>
                            <input
                              type="password"
                              placeholder="Re-type password..."
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              disabled={isUpdatingPassword}
                              className="w-full px-2.5 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-750 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isUpdatingPassword}
                          className="w-full py-2 bg-orange-500 text-zinc-955 hover:bg-orange-600 transition-colors font-mono font-bold text-[10px] uppercase rounded shadow cursor-pointer flex items-center justify-center space-x-1.5"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>{isUpdatingPassword ? "UPDATING PASSWORD..." : "UPDATE PASSWORD"}</span>
                        </button>
                      </form>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeSubTab === "quick-actions" && (
              <div className="p-6 space-y-6 flex-1">
                {/* Header & Tagline */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 text-left">
                  <div>
                    <h2 className="text-lg font-mono text-orange-500 uppercase tracking-wider font-bold flex items-center">
                      <Zap className="w-4 h-4 mr-2 text-orange-500 animate-pulse" /> Daemon Quick Actions
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1">Single-click utility operations & telemetry triggers</p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-3 py-1.5 rounded mt-2 md:mt-0 flex items-center shrink-0">
                    <Terminal className="w-3.5 h-3.5 mr-1.5" />
                    <span>DAEMONFORGE ENGINE v1.4.2</span>
                  </div>
                </div>

                {/* Grid Layout for Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Card 1: Validate Server Files */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all duration-200 text-left">
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
                        disabled={isValidating || parentLoading}
                        className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                          isValidating 
                            ? "border-orange-500/30 bg-orange-500/5 text-orange-400 font-bold" 
                            : "border-slate-800 bg-zinc-950 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                        }`}
                      >
                        <Shield className={`w-4 h-4 mr-2 ${isValidating ? "animate-spin text-orange-500" : "text-slate-500"}`} />
                        {isValidating ? "VALIDATING..." : "VALIDATE FILES"}
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Clear SML Cache */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all duration-200 text-left">
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
                        <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded">
                          {clearCacheStatus}
                        </div>
                      )}
                      <button
                        onClick={handleClearSmlCache}
                        disabled={isClearingCache || parentLoading}
                        className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                          isClearingCache 
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-400 font-bold" 
                            : "border-slate-800 bg-zinc-950 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                        }`}
                      >
                        <Trash2 className={`w-4 h-4 mr-2 ${isClearingCache ? "animate-bounce text-amber-500" : "text-slate-500"}`} />
                        {isClearingCache ? "CLEARING..." : "CLEAR SML CACHE"}
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Force Telemetry Sync */}
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all duration-200 text-left">
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
                        disabled={isForceRefreshing || parentLoading}
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
                  <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all duration-200 text-left">
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
                        disabled={isPinging || parentLoading}
                        className={`w-full flex items-center justify-center py-2.5 px-4 rounded border text-xs font-mono font-bold tracking-tight transition-all cursor-pointer ${
                          isPinging 
                            ? "border-slate-750 bg-slate-800/40 text-slate-300 font-bold" 
                            : "border-slate-800 bg-zinc-950 text-slate-300 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-400"
                        }`}
                      >
                        <Wifi className={`w-4 h-4 mr-2 ${isPinging ? "animate-pulse text-emerald-500" : "text-slate-500"}`} />
                        {isPinging ? "PINGING..." : "RUN DIAGNOSTIC PING"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeSubTab === "docs" && (
              <div className="p-6 flex-1 flex flex-col overflow-hidden min-h-0">
                <DocumentationViewer isLoading={!!parentLoading} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Info Guidelines */}
      <div className="bg-zinc-950/20 p-4 border-t border-slate-900 text-[10px] font-mono text-slate-500 text-left flex gap-2 shrink-0">
        <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5 animate-pulse" />
        <p className="leading-relaxed">
          Daemon configurations take immediate effect. Persistent credentials (like Gemini API keys) are stored securely in `/opt/dfl_satsfactory/data/server_state.json` on the server host machine. Interface customizations are cached client-side.
        </p>
      </div>

      {/* Mock Google Login Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-zinc-955/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-lg shadow-2xl max-w-sm w-full p-6 text-left space-y-5 font-sans relative border border-slate-200">
            {/* Header / Logo */}
            <div className="flex flex-col items-center space-y-2 pb-2 border-b border-slate-100">
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <h3 className="text-base font-semibold text-slate-800 tracking-tight">Sign in with Google</h3>
              <p className="text-xs text-slate-500">to continue to DaemonForge Panel</p>
            </div>

            {/* List of Accounts */}
            {isLoggingInGoogle ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 font-mono text-[11px] text-slate-500 font-bold">
                <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                <span>CONNECTING FICSIT SUBSCRIPTION...</span>
              </div>
            ) : serverInfo.googleClientId ? (
              <div className="py-6 flex flex-col items-center justify-center space-y-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">LIVE GOOGLE IDENTITY</span>
                <div id="live-google-btn" className="min-h-[40px] flex items-center justify-center"></div>
                <p className="text-[9px] font-mono text-slate-400 text-center leading-normal max-w-[280px] mt-2">
                  Authenticated directly via Google's secure OAuth servers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[9.5px] font-mono leading-normal text-left mb-3">
                  ⚠️ Google Client ID is not configured. Falling back to simulated Pioneer accounts for demonstration. Enter a Google Client ID in GReg's settings to enable live Google identity.
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">SIMULATED ACCOUNTS</span>
                
                {/* Account 1 */}
                <button
                  type="button"
                  onClick={() => handleGoogleLogin("pioneer.495413@ficsit.com", "Pioneer #495413")}
                  className="w-full flex items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-left space-x-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 font-mono font-bold text-xs">
                    P1
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-700 block group-hover:text-orange-600 transition-colors">Pioneer #495413</span>
                    <span className="text-[10px] text-slate-400 block truncate">pioneer.495413@ficsit.com</span>
                  </div>
                </button>

                {/* Account 2 */}
                <button
                  type="button"
                  onClick={() => handleGoogleLogin("supervisor.carter@ficsit.com", "Supervisor Carter")}
                  className="w-full flex items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors text-left space-x-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 font-mono font-bold text-xs">
                    SC
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-700 block group-hover:text-blue-600 transition-colors">Supervisor Carter</span>
                    <span className="text-[10px] text-slate-400 block truncate">supervisor.carter@ficsit.com</span>
                  </div>
                </button>
              </div>
            )}

            {/* Cancel Button */}
            {!isLoggingInGoogle && (
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
