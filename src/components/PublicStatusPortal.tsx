import React, { useState } from "react";
import { ServerState, TelemetryData } from "../types";

interface PublicStatusPortalProps {
  serverStatus: 'OFFLINE' | 'STARTING' | 'ONLINE' | 'UPDATING' | 'CRASHED';
  serverInfo: ServerState;
  telemetry: TelemetryData;
  onLogin: (password: string) => Promise<void>;
  loginError: string | null;
  isLoading?: boolean;
  browserTitle: string;
}

export default function PublicStatusPortal({
  serverStatus,
  serverInfo,
  telemetry,
  onLogin,
  loginError,
  isLoading = false,
  browserTitle
}: PublicStatusPortalProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);

  const totalPowerProduced = telemetry.powerGrids?.reduce((acc, grid) => acc + (grid.producedMw || 0), 0) || 0;
  const totalPowerCapacity = telemetry.powerGrids?.reduce((acc, grid) => acc + (grid.capacityMw || 0), 0) || 0;
  const powerDisplay = `${Math.round(totalPowerProduced)}/${Math.round(totalPowerCapacity)} MW`;

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0m";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  const uptimeDisplay = formatUptime(serverInfo.uptime);

  const statusColor = serverStatus === "ONLINE"
    ? "text-tertiary"
    : serverStatus === "STARTING" || serverStatus === "UPDATING"
      ? "text-amber-500"
      : "text-rose-500";

  const statusText = serverStatus === "ONLINE"
    ? "NOMINAL"
    : serverStatus;

  const objectsDisplay = (telemetry.worldObjects ?? 0).toLocaleString();

  const cleanTitle = (browserTitle || "FICSIT SECTOR ALPHA")
    .replace(/\s*\|\s*SERVER\s*STATUS/i, "")
    .replace(/\s*\|\s*STATUS/i, "")
    .trim();

  const handleCopy = (text: string, setCopiedState: (v: boolean) => void) => {
    const performFallbackCopy = (val: string) => {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = val;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (successful) {
          setCopiedState(true);
          setTimeout(() => setCopiedState(false), 2000);
        }
      } catch (err) {
        console.error("Fallback clipboard copy failed:", err);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedState(true);
          setTimeout(() => setCopiedState(false), 2000);
        })
        .catch(() => {
          performFallbackCopy(text);
        });
    } else {
      performFallbackCopy(text);
    }
  };

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim() || isLoading) return;
    try {
      await onLogin(passwordInput);
    } catch (err) {
      console.error("Login verification failed:", err);
    }
  };

  return (
    <div className="public-body font-body-md text-on-surface selection:bg-primary selection:text-on-primary min-h-screen relative w-full overflow-x-hidden flex flex-col justify-between">
      <div className="scanline"></div>

      {/* Header */}
      <header className="bg-surface-container-low/80 backdrop-blur-md border-b-2 border-outline-variant sticky top-0 z-40 shrink-0">
        <div className="flex flex-col md:flex-row md:justify-between items-center w-full px-margin py-3 md:py-0 md:h-16 max-w-container-max mx-auto gap-3 md:gap-0">
          <div className="flex justify-between w-full md:w-auto items-center">
            <span className="font-display-lg text-lg md:text-xl text-primary-container tracking-tighter uppercase glitch-hover cursor-pointer">
              {cleanTitle}
            </span>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="md:hidden font-label-caps text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-none outline-none text-[10px] font-bold"
            >
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              LOGIN
            </button>
          </div>

          {/* Header Telemetry Stats (Middle) */}
          <div className="flex items-center justify-around w-full md:w-auto gap-4 md:gap-6 font-mono text-[9px] md:text-[10px] border-t border-b border-outline-variant/30 py-1.5 md:py-0 md:border-none flex-wrap">
            {/* Factory Machines */}
            <div className="flex items-center gap-1.5 md:border-r md:border-outline-variant/60 md:pr-6">
              <span className="material-symbols-outlined text-primary text-xs md:text-sm">settings</span>
              <div className="flex flex-col text-left">
                <span className="text-[6px] md:text-[7px] text-on-surface-variant uppercase font-bold tracking-wider leading-none">MACHINES</span>
                <span className="text-on-surface font-bold leading-tight">{objectsDisplay}</span>
              </div>
            </div>

            {/* Power Production */}
            <div className="flex items-center gap-1.5 md:border-r md:border-outline-variant/60 md:pr-6">
              <span className="material-symbols-outlined text-secondary text-xs md:text-sm">bolt</span>
              <div className="flex flex-col text-left">
                <span className="text-[6px] md:text-[7px] text-on-surface-variant uppercase font-bold tracking-wider leading-none">POWER</span>
                <span className="text-secondary font-bold leading-tight">{powerDisplay}</span>
              </div>
            </div>

            {/* Relay Uptime */}
            <div className={`flex items-center gap-1.5 ${telemetry.spaceElevator?.currentPhase?.length ? "md:border-r md:border-outline-variant/60 md:pr-6" : ""}`}>
              <span className={`material-symbols-outlined ${statusColor} text-xs md:text-sm`}>
                {serverStatus === "ONLINE" ? "verified" : "warning"}
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[6px] md:text-[7px] text-on-surface-variant uppercase font-bold tracking-wider leading-none">UPTIME</span>
                <span className={`${statusColor} font-bold leading-tight`}>{uptimeDisplay}</span>
              </div>
            </div>

            {/* Space Elevator Phase Items */}
            {telemetry.spaceElevator?.currentPhase?.map((phase, idx) => {
              const delivered = phase.totalCost - phase.remainingCost;
              const done = phase.remainingCost === 0;
              const isLast = idx === (telemetry.spaceElevator!.currentPhase.length - 1);
              return (
                <div key={idx} className={`flex items-center gap-1.5 ${!isLast ? "md:border-r md:border-outline-variant/60 md:pr-6" : ""}`}>
                  <span className={`material-symbols-outlined text-xs md:text-sm ${done ? "text-emerald-400" : "text-amber-400"}`}>
                    rocket_launch
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-[6px] md:text-[7px] text-on-surface-variant uppercase font-bold tracking-wider leading-none truncate max-w-[70px] md:max-w-none">
                      {phase.name}
                    </span>
                    <span className={`font-bold leading-tight ${done ? "text-emerald-400" : "text-amber-400"}`}>
                      {delivered.toLocaleString()}/{phase.totalCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setShowLoginModal(true)}
              className="font-label-caps text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none outline-none text-xs"
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              ADMIN LOGIN
            </button>
          </div>
        </div>
      </header>

      {/* Main content body */}
      <main className="flex-1 w-full">
        
        {/* Hero Section */}
        <section className="relative w-full h-[60vh] min-h-[450px] overflow-hidden border-b-4 border-outline-variant">
          <img 
            alt={`${cleanTitle} Factory`} 
            className="w-full h-full object-cover opacity-85" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2JdppK7N16HGt7GPVSGcJ6SWtizXTujt5GJ5pyq7yAJ1KREkIXOz0dIwmFiyACQDq89QBs0hhN-VVpyIHe5yLMIsJdNkhrRLc_ISjVtcYUS3406b8W8mCJHBcmJVcEFc7BhVFQcwX_YXRJ8loTLdQ_0eECYvWT6cuMUhGL8bnrDqAXyUvIn5q88_MI8988lQZBdTOUkGlJWAkKLsGd5D7D161YJpn5THPuBTBc4OTAdDI75sfPO14OA"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-margin z-10">
            <div className="mb-4 flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full led-pulse ${
                serverStatus === 'ONLINE' ? 'bg-tertiary' : 'bg-rose-500 shadow-[0_0_10px_#f43f5e]'
              }`}></span>
              <span className="font-label-caps text-tertiary text-xs tracking-widest uppercase">
                SERVER_STATUS: {serverStatus}
              </span>
            </div>
            
             <h1 className="font-display-lg text-4xl md:text-6xl lg:text-7xl text-white uppercase tracking-tighter drop-shadow-2xl mb-6 font-bold">
              {cleanTitle}
            </h1>
            
            {/* Smaller Connection Info Card */}
            <div className="mb-8 bg-surface-container-low/75 border border-outline-variant px-4 py-2 flex items-center justify-between gap-4 max-w-xs w-full shadow-[4px_4px_0px_#000000] text-left backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="material-symbols-outlined text-primary text-base">wifi</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-caps text-on-surface-variant text-[8px] uppercase tracking-wider font-bold">UPLINK ADDRESS</span>
                  <span className="font-data-mono text-xs text-primary font-bold truncate">
                    satisfactory.milkos.gr:7777
                  </span>
                </div>
              </div>
              <button 
                onClick={() => handleCopy("satisfactory.milkos.gr:7777", setCopiedAddr)}
                className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors active:scale-90 cursor-pointer text-base bg-transparent border-none outline-none flex-shrink-0" 
                title="Copy full connection address"
              >
                {copiedAddr ? "check" : "content_copy"}
              </button>
            </div>

            <button 
              onClick={() => setShowLoginModal(true)}
              className="terminal-button bg-primary-container hover:bg-primary px-8 py-3.5 font-headline-lg text-on-primary-container uppercase flex items-center gap-3 border-2 border-on-primary-container cursor-pointer text-sm font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-base">terminal</span>
              LOGIN TO ADMIN
            </button>
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-2 hazard-strip"></div>
        </section>

        <div className="max-w-container-max mx-auto px-margin py-16 space-y-16">
          {/* Section cleared - Uplink Coordinates and World Metrics moved to top overlay */}
        </div>
      </main>

      {/* Technical Footer */}
      <footer className="mt-24 pt-12 bg-surface-container-lowest border-t-2 border-outline-variant shrink-0">
        <div className="max-w-container-max mx-auto px-margin">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-cover bg-center border-2 border-outline-variant p-1" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDjUjGoIJ1SsyIzOBd_Z5yqOKj6qVagk_vHPRvs_5Ql2zHodDc9txRiFqQdCguM0iC821N419cMq6aLG6ehrmtFm9sNEhqROU1RlbV2X4dtsRq6H5Z9Edf2PESlqgc7DQvpqXYjhBeO7TWihs5Ke1dVn_V3TNg4kSNecxVHaPKqgyAyruFC1sBKtFjXWjMHA_oUL76qe8sCph21pikEE3lrWITyAB7WiGaCY_jbQApxAMNBdxSQmbKerg')" }}></div>
              <div className="flex flex-col text-left">
                <span className="font-display-lg text-xl text-on-surface font-bold">FICSIT INC.</span>
                <span className="font-data-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Construct. Automate. Explore. Exploit.</span>
              </div>
            </div>
            <div className="flex gap-12 text-left">
              <div className="flex flex-col">
                <span className="font-label-caps text-on-surface-variant text-[9px] font-bold">RELIABILITY_RATING</span>
                <span className="font-data-mono text-primary font-bold">99.98%</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-caps text-on-surface-variant text-[9px] font-bold">SERVER_LOC</span>
                <span className="font-data-mono font-bold">EU-CENTRAL-1</span>
              </div>
            </div>
          </div>
          <div className="h-1 hazard-strip opacity-30 mb-6"></div>
          <p className="font-data-mono text-[9px] text-center text-on-surface-variant/40 pb-12 uppercase max-w-2xl mx-auto leading-relaxed">
            ALL DATA TRANSMITTED VIA THE FICSIT MESH NETWORK IS THE EXCLUSIVE PROPERTY OF FICSIT INC. ANY UNAUTHORIZED INTERCEPTION OR MODIFICATION OF TELEMETRY DATA IS SUBJECT TO IMMEDIATE PIONEER CONTRACT TERMINATION AND SUBSEQUENT RECYCLING.
          </p>
        </div>
      </footer>

      {/* Admin Login Modal overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border-2 border-outline-variant p-6 w-full max-w-md shadow-2xl relative text-left">
            <button 
              onClick={() => {
                setShowLoginModal(false);
                setPasswordInput("");
              }}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-white cursor-pointer font-bold text-sm bg-transparent border-none"
            >
              [X]
            </button>

            <h3 className="font-display-lg text-lg text-primary uppercase font-bold tracking-wider mb-2">
              Secure Link Access
            </h3>
            <p className="text-xs text-slate-400 font-mono leading-relaxed mb-6">
              Enter secure admin decryption key configured in your node environment parameters to authenticate session bridge.
            </p>

            <form onSubmit={handleSubmitLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 text-rose-400 text-xs font-mono rounded">
                  ERROR: {loginError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-wider">Admin Password</label>
                <input 
                  type="password"
                  placeholder="Enter administrator password..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-zinc-950 border border-slate-800 rounded font-mono text-xs text-slate-200 placeholder-slate-800 focus:outline-none focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setPasswordInput("");
                  }}
                  className="flex-1 py-2 bg-zinc-800 text-slate-300 hover:bg-zinc-700 transition-colors font-mono font-bold text-xs rounded border border-slate-700 cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="submit"
                  disabled={isLoading || !passwordInput.trim()}
                  className="flex-1 py-2 bg-primary-container text-on-primary-container hover:bg-primary transition-colors font-mono font-bold text-xs rounded border border-on-primary-container cursor-pointer flex items-center justify-center gap-1"
                >
                  {isLoading ? "AUTHENTICATING..." : "AUTHENTICATE"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
