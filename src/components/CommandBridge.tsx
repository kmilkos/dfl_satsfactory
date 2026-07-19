import React, { useState } from "react";
import { Play, RotateCw, AlertTriangle, ShieldCheck, Menu, X, LogOut } from "lucide-react";

interface CommandBridgeProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  serverStatus: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'UPDATING' | 'CRASHED';
  onLogout?: () => void;
}

export default function CommandBridge({ activeTab, setActiveTab, serverStatus, onLogout }: CommandBridgeProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Map status to visual indicators
  const statusColors = {
    OFFLINE: "bg-zinc-600 text-zinc-400 border-zinc-500",
    STARTING: "bg-amber-500/20 text-amber-500 border-amber-600 animate-pulse",
    ONLINE: "bg-emerald-500/20 text-emerald-400 border-emerald-600",
    UPDATING: "bg-blue-500/20 text-blue-400 border-blue-600 animate-pulse",
    CRASHED: "bg-rose-500/20 text-rose-400 border-rose-600",
  };

  const navItems = [
    { id: "chat", label: "Live Chat" },
    { id: "nodes", label: "Server Control" },
    { id: "backups", label: "Backup System" },
    { id: "mods", label: "Mod Manager" },
    { id: "telemetry", label: "Factory Stats" },
    { id: "flow-diagram", label: "Machine Flows" },
    { id: "logs", label: "System Logs" },
    { id: "assistant", label: "Greg Chat" },
    { id: "settings", label: "Settings" }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="relative w-full h-16 md:h-20 bg-zinc-950 border-b border-slate-700 flex items-center justify-between px-4 md:px-8 shadow-md shrink-0 z-50">
      
      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden p-2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
        title="Toggle Menu"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6 text-orange-500" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Left Menu: Server Operations (Desktop Only) */}
      <nav className="hidden md:flex flex-1 items-center space-x-6 text-sm font-sans font-semibold text-slate-300">
        {navItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`pb-1 border-b-2 transition-all cursor-pointer ${
              activeTab === item.id
                ? "text-orange-500 border-orange-500"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id={`tab-btn-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Center: Mascot "Greg" & App Namespace */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center md:flex-col justify-center gap-2 md:gap-0 top-1/2 md:top-2 -translate-y-1/2 md:translate-y-0">
        {/* Greg Octahedron Visual Representation */}
        <div 
          onClick={() => handleTabClick("assistant")}
          className="w-9 h-9 md:w-12 md:h-12 bg-zinc-900 rounded-lg flex items-center justify-center border border-slate-700 shadow-[0_0_15px_rgba(249,115,22,0.1)] group hover:border-orange-500 hover:shadow-[0_0_20px_rgba(249,115,22,0.25)] transition-all duration-300 cursor-pointer"
          title="Connect with Mascot Greg (AI Sysadmin Assistant)"
        >
          {/* Animated Hard-Light Octahedron Core */}
          <div className="relative w-5 h-5 md:w-6 md:h-6 flex items-center justify-center">
            {serverStatus === 'CRASHED' ? (
              <span className="text-orange-500 font-mono text-[9px] md:text-xs font-bold leading-none select-none tracking-tight">
                ¯\_(ツ)_/¯
              </span>
            ) : (
              <>
                <div className="absolute w-1 md:w-1.5 h-1 md:h-1.5 bg-orange-500 rounded-full shadow-[0_0_10px_#f97316] animate-pulse"></div>
                <div className="w-4 h-4 md:w-5 md:h-5 border border-orange-500 rotate-45 group-hover:scale-110 transition-transform duration-300"></div>
                <div className="absolute w-2.5 h-2.5 md:w-3 md:h-3 border border-orange-500/50 -rotate-45 group-hover:rotate-45 transition-transform duration-500"></div>
              </>
            )}
          </div>
        </div>
        
        {/* Active Namespace */}
        <span className="text-orange-500 text-[8px] md:text-[9px] font-mono font-bold uppercase tracking-widest select-none hidden sm:block md:mt-1">
          dfl-panel
        </span>
      </div>

      {/* Right Menu: Diagnostics, Chat, & Docs (Desktop Only) */}
      <nav className="hidden md:flex flex-1 justify-end items-center space-x-6 text-sm font-sans font-semibold text-slate-300">
        {navItems.slice(5).map((item) => (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`pb-1 border-b-2 transition-all cursor-pointer ${
              activeTab === item.id
                ? "text-orange-500 border-orange-500"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            id={`tab-btn-${item.id}`}
          >
            {item.label}
          </button>
        ))}

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

      {/* Mobile Right Container (Status Pill & Logout icon) */}
      <div className="flex md:hidden items-center space-x-2">
        <div className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold tracking-tight ${statusColors[serverStatus]}`}>
          {serverStatus}
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded border border-rose-900 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 cursor-pointer transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mobile Navigation Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-zinc-950/95 backdrop-blur-md z-45 md:hidden flex flex-col p-6 overflow-y-auto border-t border-slate-800">
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold text-left mb-2">Command Bridge Links</span>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`py-3.5 px-4 font-mono text-xs uppercase text-left rounded border transition-all cursor-pointer flex items-center justify-between ${
                  activeTab === item.id
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 font-bold"
                    : "border-transparent text-slate-400 hover:bg-zinc-900 hover:text-slate-200"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[9px] text-slate-600 font-normal">0x{item.id.substring(0, 3)}</span>
              </button>
            ))}
          </div>

          <div className="pt-8 mt-auto">
            <button
              onClick={onLogout}
              className="w-full py-3 rounded border border-rose-900 bg-rose-950/30 text-rose-400 hover:bg-rose-950/60 font-mono font-bold text-xs uppercase transition-colors tracking-wider cursor-pointer"
            >
              Terminate Session (Logout)
            </button>
          </div>
        </div>
      )}
      
    </header>
  );
}
