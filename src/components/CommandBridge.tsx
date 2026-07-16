import React from "react";
import { Play, RotateCw, AlertTriangle, ShieldCheck } from "lucide-react";

interface CommandBridgeProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  serverStatus: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'UPDATING' | 'CRASHED';
  onLogout?: () => void;
}

export default function CommandBridge({ activeTab, setActiveTab, serverStatus, onLogout }: CommandBridgeProps) {
  // Map status to visual indicators
  const statusColors = {
    OFFLINE: "bg-zinc-600 text-zinc-400 border-zinc-500",
    STARTING: "bg-amber-500/20 text-amber-500 border-amber-600 animate-pulse",
    ONLINE: "bg-emerald-500/20 text-emerald-400 border-emerald-600",
    UPDATING: "bg-blue-500/20 text-blue-400 border-blue-600 animate-pulse",
    CRASHED: "bg-rose-500/20 text-rose-400 border-rose-600",
  };

  return (
    <header className="relative w-full h-20 bg-zinc-950 border-b border-slate-700 flex items-center justify-between px-8 shadow-md shrink-0 z-50">
      
      {/* Left Menu: Server Operations */}
      <nav className="flex flex-1 items-center space-x-6 text-sm font-sans font-semibold text-slate-300">
        <button
          onClick={() => setActiveTab("nodes")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "nodes"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-nodes"
        >
          Satisfactory Node
        </button>
        <button
          onClick={() => setActiveTab("backups")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "backups"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-backups"
        >
          Backup System
        </button>
        <button
          onClick={() => setActiveTab("mods")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "mods"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-mods"
        >
          SML Mods (ficsit-cli)
        </button>
        <button
          onClick={() => setActiveTab("quick-actions")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "quick-actions"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-quick-actions"
        >
          Quick Actions
        </button>
      </nav>

      {/* Center: Mascot "Greg" & App Namespace */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center justify-center top-2">
        {/* Greg Octahedron Visual Representation */}
        <div 
          onClick={() => setActiveTab("assistant")}
          className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center border border-slate-700 shadow-[0_0_15px_rgba(249,115,22,0.1)] group hover:border-orange-500 hover:shadow-[0_0_20px_rgba(249,115,22,0.25)] transition-all duration-300 cursor-pointer"
          title="Connect with Mascot Greg (AI Sysadmin Assistant)"
        >
          {/* Animated Hard-Light Octahedron Core */}
          <div className="relative w-6 h-6 flex items-center justify-center">
            {serverStatus === 'CRASHED' ? (
              <span className="text-orange-500 font-mono text-xs font-bold leading-none select-none tracking-tight">
                ¯\_(ツ)_/¯
              </span>
            ) : (
              <>
                {/* Sarcastic visor dot projecting hologram */}
                <div className="absolute w-1.5 h-1.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316] animate-pulse"></div>
                <div className="w-5 h-5 border border-orange-500 rotate-45 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="absolute w-3 h-3 border border-orange-500/50 -rotate-45 group-hover:rotate-45 transition-transform duration-500"></div>
              </>
            )}
          </div>
        </div>
        
        {/* Active Namespace */}
        <span className="text-orange-500 text-[9px] font-mono mt-1 font-bold uppercase tracking-widest select-none">
          dfl-panel
        </span>
      </div>

      {/* Right Menu: Diagnostics, Chat, & Docs */}
      <nav className="flex flex-1 justify-end items-center space-x-6 text-sm font-sans font-semibold text-slate-300">
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "telemetry"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-telemetry"
        >
          Factory Stats
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "logs"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-logs"
        >
          System Logs
        </button>
        <button
          onClick={() => setActiveTab("assistant")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "assistant"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-assistant"
        >
          Greg Chat
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`pb-1 border-b-2 transition-all cursor-pointer ${
            activeTab === "docs"
              ? "text-orange-500 border-orange-500"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
          id="tab-btn-docs"
        >
          Docs Hub
        </button>

        {/* Status indicator pill */}
        <div className={`ml-4 px-3 py-1 rounded border text-[11px] font-mono font-bold tracking-tight ${statusColors[serverStatus]}`}>
          {serverStatus}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="ml-4 px-3 py-1.5 rounded border border-rose-900 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 transition-colors text-[10px] font-mono font-bold cursor-pointer"
          >
            LOGOUT
          </button>
        )}
      </nav>
      
    </header>
  );
}
