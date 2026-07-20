import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Cpu, MessageSquare, Send, Terminal, 
  Heart, Plug, Compass, Server, Search, RefreshCw, AlertCircle, PlayCircle,
  Layers, Box, TrendingUp, Gauge, Users, Sliders, Rocket
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ConsoleLogLine, TelemetryData, ChatMessage, TelemetryHistoryPoint, ItemThroughput } from "../types";

// Custom elegant dark tooltip for the telemetry charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950/95 border border-slate-800 p-2.5 rounded-md shadow-xl text-left font-mono text-[10px]">
        <p className="text-slate-400 mb-1 border-b border-slate-800/60 pb-1 font-bold">Time: {label}</p>
        {payload.map((entry: any, index: number) => {
          const isCpu = entry.name === "CPU Usage";
          return (
            <p key={index} style={{ color: entry.color }} className="flex justify-between items-center space-x-4 py-0.5">
              <span className="uppercase">{isCpu ? "CPU LOAD:" : "RAM ALLOC:"}</span>
              <span className="font-bold">{entry.value.toFixed(1)}{isCpu ? "%" : " GB"}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

interface DiagnosticsPanelProps {
  activeSubTab: "telemetry" | "logs";
  consoleLogs: ConsoleLogLine[];
  telemetry: TelemetryData;
  telemetryHistory: TelemetryHistoryPoint[];
  inGameChats: ChatMessage[];
  onSendChatMessage: (text: string) => Promise<void>;
  isLoading: boolean;
}

export default function DiagnosticsPanel({
  activeSubTab,
  consoleLogs,
  telemetry,
  telemetryHistory,
  inGameChats,
  onSendChatMessage,
  isLoading
}: DiagnosticsPanelProps) {

  // Chat & Log container refs for local scrolling without shifting parent page scroll
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs states
  const [logSearch, setLogSearch] = useState("");
  const [logFilterLevel, setLogFilterLevel] = useState<"ALL" | "INFO" | "WARNING" | "ERROR" | "COMMAND">("ALL");

  // In-game manager chat message input
  const [chatInput, setChatInput] = useState("");

  // Selected production item for details modal
  const [selectedProduction, setSelectedProduction] = useState<ItemThroughput | null>(null);

  // Scroll chat container to bottom on changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [inGameChats]);

  // Scroll logs container to bottom on changes/subtab active
  useEffect(() => {
    if (activeSubTab === "logs" && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [consoleLogs, activeSubTab]);

  // Format log levels helper
  const logStyles = {
    INFO: "text-slate-400",
    WARNING: "text-amber-400 bg-amber-400/5 px-1 py-0.5 rounded",
    ERROR: "text-rose-500 bg-rose-500/5 px-1 py-0.5 rounded font-bold",
    COMMAND: "text-blue-400 font-mono",
  };

  // Filtered console logs
  const filteredLogs = consoleLogs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(logSearch.toLowerCase());
    const matchesLevel = logFilterLevel === "ALL" || log.level === logFilterLevel;
    return matchesSearch && matchesLevel;
  });

  // Handle send chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await onSendChatMessage(chatInput);
    setChatInput("");
  };

  return (
    <div className="w-full h-full text-slate-100 flex flex-col">
      {/* -----------------------------------------------------------------------
          SUB-PANEL: FACTORY STATS & CHAT
          ----------------------------------------------------------------------- */}
      {activeSubTab === "telemetry" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Factory Stats Telemetry</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Live JSON REST API feeds proxying in-game operations on port 8080</p>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-2 md:mt-0 bg-zinc-900 border border-slate-800 px-3 py-1.5 rounded flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping"></span>
              API Connection: <span className="text-emerald-400 ml-1 font-bold">ESTABLISHED</span>
            </div>
          </div>



          {/* FICSIT POWER GRID CONTROL MATRIX (Prominent Full-Width Panel) */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                  <Plug className="w-4 h-4 mr-1.5 text-orange-500 animate-pulse" /> Ficsit Power Grid Control Matrix
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5">Real-time status of high-voltage industrial circuits and accumulator reserves</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-2 py-1 rounded mt-2 sm:mt-0 self-start sm:self-center">Source: GET /getPower</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {telemetry.powerGrids.length === 0 ? (
                <div className="md:col-span-2 text-center py-8 text-slate-600 font-mono text-xs">
                  Power grid telemetry offline. Start the Factory server to establish active switchboard connections.
                </div>
              ) : (
                telemetry.powerGrids.map((grid) => {
                  const consumptionPercent = Math.min(100, (grid.consumedMw / (grid.capacityMw || 1)) * 100);
                  const batteryPercent = grid.batteryCapacityMj > 0 ? (grid.batteryChargeMj / grid.batteryCapacityMj) * 100 : 0;
                  const isCritical = consumptionPercent > 90;
                  const isHighLoad = consumptionPercent > 75 && consumptionPercent <= 90;

                  return (
                    <div key={grid.gridId} className="bg-zinc-950/60 border border-slate-800/80 rounded-lg p-4 space-y-4 relative overflow-hidden group hover:border-orange-500/30 transition-all duration-300">
                      {/* Background accent glow */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/2 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                      {/* Header Row */}
                      <div className="flex justify-between items-center border-b border-slate-900/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${isCritical ? "bg-rose-500 animate-ping" : isHighLoad ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`}></div>
                          <span className="text-sm font-mono font-bold text-slate-200">CIRCUIT #{grid.gridId}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                          isCritical 
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                            : isHighLoad 
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {isCritical ? "CRITICAL OVERLOAD" : isHighLoad ? "HEAVY LOAD" : "STABLE COUPLING"}
                        </span>
                      </div>

                      {/* Major Metrics readout */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">Power Consumption</span>
                          <div className="flex items-baseline space-x-1 font-mono">
                            <span className="text-lg font-bold text-slate-100">{grid.consumedMw.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 font-bold">MW</span>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-slate-500 uppercase block">Total Grid Capacity</span>
                          <div className="flex items-baseline space-x-1 font-mono">
                            <span className="text-lg font-bold text-orange-500">{grid.capacityMw.toLocaleString()}</span>
                            <span className="text-[10px] text-orange-500/70 font-bold">MW</span>
                          </div>
                        </div>
                      </div>

                      {/* Big styled consumption progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span>GRID METRIC LIMIT</span>
                          <span>{consumptionPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-zinc-950 border border-slate-900 h-3.5 rounded overflow-hidden relative">
                          <div 
                            className={`h-full transition-all duration-1000 relative shadow-inner ${
                              isCritical 
                                ? "bg-gradient-to-r from-rose-600 to-rose-400" 
                                : isHighLoad 
                                  ? "bg-gradient-to-r from-amber-600 to-amber-400" 
                                  : "bg-gradient-to-r from-orange-600 to-orange-400"
                            }`}
                            style={{ width: `${consumptionPercent}%` }}
                          >
                            {/* Light stripe reflection effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                          </div>
                        </div>
                      </div>

                      {/* Battery sub-panel */}
                      {grid.batteryCapacityMj > 0 ? (
                        <div className="pt-2 border-t border-slate-900/60 space-y-1.5">
                          <div className="flex justify-between items-center font-mono text-[10px] text-slate-400">
                            <span className="flex items-center">
                              <Activity className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                              ACCUMULATOR RESERVES
                            </span>
                            <span className="text-emerald-400 font-bold">{batteryPercent.toFixed(0)}% CHARGED</span>
                          </div>
                          
                          <div className="w-full bg-zinc-950 border border-slate-900 h-2 rounded overflow-hidden relative">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000"
                              style={{ width: `${batteryPercent}%` }}
                            ></div>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 flex justify-between">
                            <span>BATTERY LEVEL: {grid.batteryChargeMj.toLocaleString()} MJ</span>
                            <span>TOTAL RESERVES: {grid.batteryCapacityMj.toLocaleString()} MJ</span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1.5 border-t border-slate-900/40 text-[9px] font-mono text-slate-600">
                          No FICSIT Power Accumulators detected on this grid.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* FICSIT ASSEMBLY LINE & OUTPUT MATRIX (Prominent Full-Width Panel) */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-orange-500 animate-pulse" /> Ficsit Assembly Line & Output Matrix
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5">Real-time throughput analysis of automated manufacture lines and material balances</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-2 py-1 rounded mt-2 sm:mt-0 self-start sm:self-center">Source: GET /getProduction</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {telemetry.throughput.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-600 font-mono text-xs">
                  Assembly telemetry offline. Start the Factory server to establish active conveyor belt feeds.
                </div>
              ) : (
                telemetry.throughput.map((item) => {
                  const netRate = item.currentRate;
                  const isPositive = netRate > 0;
                  const isNeutral = netRate === 0;
                  
                  return (
                    <div 
                      key={item.name} 
                      onClick={() => setSelectedProduction(item)}
                      className="bg-zinc-950/60 border border-slate-800/85 rounded-lg p-3 relative overflow-hidden group hover:border-orange-500/50 hover:bg-zinc-950/90 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                    >
                      {/* Background accent */}
                      <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/1 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none"></div>

                      {/* Header: Name & Badge */}
                      <div className="flex justify-between items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold text-slate-200 uppercase truncate" title={item.name}>
                          {item.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border shrink-0 ${
                          isPositive 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : isNeutral
                              ? "bg-slate-800/20 text-slate-400 border-slate-800"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {isPositive ? "SURPLUS" : isNeutral ? "BALANCED" : "DEFICIT"}
                        </span>
                      </div>

                      {/* Rate block */}
                      <div className="flex items-baseline space-x-1 justify-start mt-2">
                        <span className={`text-base font-bold font-mono tracking-tight ${
                          isPositive ? "text-emerald-400" : isNeutral ? "text-slate-400" : "text-rose-400"
                        }`}>
                          {isPositive ? "+" : ""}{netRate.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold font-mono lowercase">parts.min.</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* SPACE ELEVATOR UPLINK STATUS */}
          {telemetry.spaceElevator && (
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                    <Rocket className="w-4 h-4 mr-1.5 text-orange-500" /> Space Elevator Phase Tracker
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 mt-0.5">Live delivery progress for current FICSIT Tier milestone — items shipped to HQ</span>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  {telemetry.spaceElevator.upgradeReady && (
                    <span className="px-2 py-1 rounded text-[9px] font-mono font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse">
                      ✓ UPGRADE READY
                    </span>
                  )}
                  {telemetry.spaceElevator.fullyUpgraded && (
                    <span className="px-2 py-1 rounded text-[9px] font-mono font-bold border bg-orange-500/10 text-orange-400 border-orange-500/30">
                      ★ FULLY UPGRADED
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-2 py-1 rounded self-start sm:self-center">Source: GET /getSpaceElevator</span>
                </div>
              </div>

              {telemetry.spaceElevator.currentPhase.length === 0 ? (
                <div className="text-center py-8 text-slate-600 font-mono text-xs">
                  No active phase items detected. Space Elevator may not be placed yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {telemetry.spaceElevator.currentPhase.map((phase, idx) => {
                    const delivered = phase.totalCost - phase.remainingCost;
                    const pct = phase.totalCost > 0 ? Math.min(100, (delivered / phase.totalCost) * 100) : 0;
                    const done = phase.remainingCost === 0;
                    return (
                      <div
                        key={idx}
                        className={`bg-zinc-950/60 border rounded-lg p-4 space-y-3 relative overflow-hidden transition-all duration-300 ${
                          done
                            ? "border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.06)]"
                            : "border-slate-800 hover:border-orange-500/30"
                        }`}
                      >
                        {/* Item name + badge */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-200 uppercase leading-tight">{phase.name}</span>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border ${
                            done
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {done ? "COMPLETE" : "IN PROGRESS"}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono text-slate-500">
                            <span>DELIVERED</span>
                            <span className={done ? "text-emerald-400 font-bold" : "text-orange-400 font-bold"}>{pct.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                done ? "bg-emerald-500" : "bg-orange-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Counts */}
                        <div className="flex justify-between text-[10px] font-mono">
                          <div className="flex flex-col">
                            <span className="text-slate-500">SHIPPED</span>
                            <span className="text-slate-100 font-bold">{delivered.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-slate-500">REMAINING</span>
                            <span className={`font-bold ${ done ? "text-emerald-400" : "text-rose-400" }`}>
                              {phase.remainingCost.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-slate-500">TOTAL</span>
                            <span className="text-slate-100 font-bold">{phase.totalCost.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}



        </div>
      )}

      {/* -----------------------------------------------------------------------
          SUB-PANEL: SYSTEM CONSOLE LOGS
          ----------------------------------------------------------------------- */}
      {activeSubTab === "logs" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Terminal System Logs</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Console stdout capture mapping SteamCMD, SML, and DFL startup sequences</p>
            </div>

            {/* Filter Logs */}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-3 md:mt-0 w-full md:w-auto">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-3.5 w-3.5 text-slate-500" />
                </span>
                <input
                  type="text"
                  placeholder="Filter outputs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-9 pr-4 py-1 bg-zinc-900 border border-slate-800 rounded font-mono text-xs text-slate-100 focus:outline-none focus:border-orange-500 placeholder-slate-600 w-full sm:w-48"
                />
              </div>

              <div className="flex border border-slate-800 rounded overflow-hidden">
                {(["ALL", "INFO", "WARNING", "ERROR", "COMMAND"] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLogFilterLevel(level)}
                    className={`px-2 py-1 font-mono text-[9px] font-bold border-r border-slate-800 last:border-r-0 transition-all cursor-pointer ${
                      logFilterLevel === level
                        ? "bg-orange-500 text-zinc-950"
                        : "bg-zinc-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terminal Console Log Output block */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 font-mono text-left shadow-lg flex flex-col h-[460px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 text-[10px] text-slate-500 uppercase">
              <span>stdout console streams (Buffer: 40 lines)</span>
              <span className="flex items-center">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin text-orange-500" /> STDOUT FEEDING LIVE
              </span>
            </div>

            <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-1.5 pr-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-600 text-xs">No matching stdout log streams found.</div>
              ) : (
                filteredLogs.map((log, idx) => (
                  <div key={idx} className="text-xs leading-normal select-text break-words">
                    <span className="text-slate-500 text-[10px] mr-2">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className={`text-[10px] font-bold mr-1.5 font-mono ${
                      log.level === "ERROR" 
                        ? "text-rose-500" 
                        : log.level === "WARNING" 
                          ? "text-amber-400" 
                          : log.level === "COMMAND" 
                            ? "text-blue-400" 
                            : "text-slate-500"
                    }`}>
                      [{log.level}]
                    </span>
                    <span className={`${logStyles[log.level]}`}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal Popup for Production Details */}
      {selectedProduction && (
        <div 
          className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setSelectedProduction(null)}
        >
          <div 
            className="bg-zinc-900 border border-slate-800 rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Title */}
            <div className="flex justify-between items-start gap-4 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Material Item</span>
                <h3 className="text-sm font-mono font-bold text-slate-200 uppercase truncate">
                  {selectedProduction.name}
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${
                selectedProduction.currentRate > 0 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                  : selectedProduction.currentRate === 0
                    ? "bg-slate-800/20 text-slate-400 border-slate-800"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}>
                {selectedProduction.currentRate > 0 ? "SURPLUS" : selectedProduction.currentRate === 0 ? "BALANCED" : "DEFICIT"}
              </span>
            </div>

            {/* Main Stats Details */}
            <div className="space-y-3.5 py-1">
              <div className="flex justify-between items-center bg-zinc-950/40 p-2.5 rounded border border-slate-900/60">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Net Flow Rate</span>
                <span className={`text-base font-bold font-mono ${
                  selectedProduction.currentRate > 0 ? "text-emerald-400" : selectedProduction.currentRate === 0 ? "text-slate-400" : "text-rose-400"
                }`}>
                  {selectedProduction.currentRate > 0 ? "+" : ""}{selectedProduction.currentRate.toFixed(2)} <span className="text-[10px] text-slate-500">parts.min.</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/40 p-2 border border-slate-900/60 rounded">
                  <span className="text-[9px] font-mono text-slate-500 block uppercase">Production</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">+{selectedProduction.productionRate.toFixed(2)}/m</span>
                </div>
                <div className="bg-zinc-950/40 p-2 border border-slate-900/60 rounded">
                  <span className="text-[9px] font-mono text-slate-500 block uppercase">Consumption</span>
                  <span className="text-xs font-mono font-bold text-rose-400">-{selectedProduction.consumptionRate.toFixed(2)}/m</span>
                </div>
              </div>

              {/* Belt Congestion Meter */}
              {(() => {
                const percentOfProdUsed = selectedProduction.productionRate > 0 
                  ? (selectedProduction.consumptionRate / selectedProduction.productionRate) * 100 
                  : 0;
                return (
                  <div className="space-y-1.5 bg-zinc-950/40 p-2.5 border border-slate-900/60 rounded">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>CONVEYOR BELT CONGESTION</span>
                      <span className="font-bold text-slate-300">{percentOfProdUsed.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 border border-slate-900 h-2 rounded overflow-hidden relative">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          percentOfProdUsed > 90 
                            ? "bg-rose-500" 
                            : percentOfProdUsed > 60 
                              ? "bg-amber-500" 
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, percentOfProdUsed)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer / Close Button */}
            <div className="flex justify-end pt-3 border-t border-slate-850">
              <button
                onClick={() => setSelectedProduction(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded uppercase tracking-wider transition-colors cursor-pointer"
              >
                Close Detail Matrix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
