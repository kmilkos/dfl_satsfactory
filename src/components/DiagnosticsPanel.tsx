import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Cpu, MessageSquare, Send, Terminal, 
  Heart, Plug, Compass, Server, Search, RefreshCw, AlertCircle, PlayCircle,
  Layers, Box, TrendingUp, Gauge, Users
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ConsoleLogLine, TelemetryData, ChatMessage, TelemetryHistoryPoint } from "../types";

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

          {/* Telemetry Core Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CPU */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between shadow">
              <div className="text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Core CPU Load</span>
                <span className="text-xl font-mono text-slate-100 font-bold">{telemetry.cpuUsage.toFixed(1)}%</span>
              </div>
              <Cpu className="w-8 h-8 text-orange-500/20" />
            </div>

            {/* RAM */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between shadow">
              <div className="text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Memory Allocation</span>
                <span className="text-xl font-mono text-slate-100 font-bold">{telemetry.ramUsageGb.toFixed(2)} GB</span>
              </div>
              <Server className="w-8 h-8 text-orange-500/20" />
            </div>

            {/* TPS */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between shadow">
              <div className="text-left">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Ticks Per Second (TPS)</span>
                <span className="text-xl font-mono text-emerald-400 font-bold">{telemetry.tps.toFixed(2)} / 60.0</span>
              </div>
              <Activity className="w-8 h-8 text-emerald-500/20" />
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
                  const percentOfProdUsed = item.productionRate > 0 ? (item.consumptionRate / item.productionRate) * 100 : 0;
                  
                  return (
                    <div key={item.name} className="bg-zinc-950/60 border border-slate-800/80 rounded-lg p-3.5 space-y-3 relative overflow-hidden group hover:border-orange-500/30 transition-all duration-300">
                      {/* Background grid accent */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/1 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>

                      {/* Header info */}
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-mono font-bold text-slate-200 uppercase truncate" title={item.name}>
                          {item.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0 ${
                          isPositive 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : isNeutral
                              ? "bg-slate-800/20 text-slate-400 border-slate-800"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {isPositive ? "SURPLUS" : isNeutral ? "BALANCED" : "DEFICIT"}
                        </span>
                      </div>

                      {/* Net Flow rate large indicator */}
                      <div className="flex items-baseline space-x-1.5 justify-start">
                        <span className={`text-xl font-bold font-mono tracking-tight ${
                          isPositive ? "text-emerald-400" : isNeutral ? "text-slate-400" : "text-rose-400"
                        }`}>
                          {isPositive ? "+" : ""}{netRate.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold font-mono uppercase">parts/min</span>
                      </div>

                      {/* Micro bar showing consumption vs production ratio */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>BELT CONGESTION</span>
                          <span>{percentOfProdUsed.toFixed(0)}% CONSUMED</span>
                        </div>
                        <div className="w-full bg-zinc-950 border border-slate-900 h-1.5 rounded overflow-hidden relative">
                          <div 
                            className={`h-full transition-all duration-1000 ${
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

                      {/* Precise values footer */}
                      <div className="grid grid-cols-2 gap-2 text-[9px] font-mono border-t border-slate-900/60 pt-2 text-slate-500">
                        <div>
                          <span>PROD RATE</span>
                          <span className="block text-[10px] text-emerald-400 font-bold">+{item.productionRate.toFixed(1)}/m</span>
                        </div>
                        <div className="text-right">
                          <span>CONS RATE</span>
                          <span className="block text-[10px] text-rose-400 font-bold">-{item.consumptionRate.toFixed(1)}/m</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Live In-Game Chat & Connected Pioneers (Full Width IRC Client Layout) */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 flex flex-col h-[520px] shadow-lg">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center text-left">
              <div>
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-orange-500" /> Live In-Game Chat
                </span>
                <p className="text-[10px] font-mono text-slate-500">Mascot Greg watches chats for blowing fuses</p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-zinc-950 border border-slate-800 px-2 py-0.5 rounded flex items-center shrink-0">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                {telemetry.players.length} ONLINE
              </span>
            </div>

            {/* IRC Client Body */}
            <div className="flex-1 flex gap-4 min-h-0 mt-3 overflow-hidden">
              {/* Left Column: Chat log stream and message input */}
              <div className="flex-1 flex flex-col min-w-0 h-full">
                {/* Chats List Stream */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-2 text-left min-h-0">
                  {inGameChats.map((msg) => {
                    const isGreg = msg.sender === "Mascot_Greg";
                    const isServer = msg.sender === "SERVER";
                    const isUser = msg.sender === "User_Manager";

                    return (
                      <div 
                        key={msg.id}
                        className={`p-2 rounded text-xs leading-normal font-mono transition-all ${
                          isGreg 
                            ? "bg-orange-500/5 border-l-2 border-orange-500 pl-2.5" 
                            : isServer 
                              ? "bg-slate-900/60 text-slate-500 italic text-[11px]" 
                              : "bg-zinc-900 border border-slate-900"
                        }`}
                      >
                        {!isServer && (
                          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-0.5 font-bold">
                            <span className={isGreg ? "text-orange-500" : isUser ? "text-blue-400" : "text-slate-300"}>
                              {msg.sender}
                            </span>
                            <span className="text-[9px] font-light">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <p className={isServer ? "text-slate-400" : "text-slate-300 text-xs"}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input form */}
                <form onSubmit={handleSendChat} className="mt-3 flex space-x-2 border-t border-slate-800 pt-3">
                  <input
                    type="text"
                    placeholder="Send chat message to in-game crew..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-1.5 bg-zinc-900 border border-slate-800 rounded font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="p-1.5 bg-orange-500 text-zinc-950 rounded hover:bg-orange-600 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                    id="btn-send-chat"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Right Column: IRC Player/User List (Dual line details per Pioneer) */}
              <div className="w-48 bg-zinc-950/60 border border-slate-800/80 rounded p-3 flex flex-col h-full overflow-hidden shrink-0">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-800/60 flex items-center justify-between mb-2 shrink-0">
                  <span className="flex items-center">
                    <Users className="w-3.5 h-3.5 mr-1 text-orange-500 animate-pulse" /> Pioneers
                  </span>
                  <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-[9px] text-slate-500 font-bold">
                    {telemetry.players.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {telemetry.players.length === 0 ? (
                    <div className="text-[10px] font-mono text-slate-600 text-center py-6">
                      No Pioneers online.
                    </div>
                  ) : (
                    telemetry.players.map((player) => (
                      <div 
                        key={player.name} 
                        className="p-2 bg-zinc-900/60 border border-slate-900 rounded font-mono hover:border-orange-500/20 transition-all duration-200"
                      >
                        {/* Line 1: PlayerName */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[11px] font-bold text-slate-200 truncate" title={player.name}>
                            @{player.name}
                          </span>
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                        </div>
                        {/* Line 2: Health-MS */}
                        <div className="flex justify-between items-center text-[9px] text-slate-500 mt-1">
                          <span className="flex items-center gap-0.5 text-rose-400/95 font-semibold">
                            <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                            {player.health.toFixed(0)}%
                          </span>
                          <span className="text-slate-400 font-semibold bg-zinc-950 border border-slate-900 px-1 py-0.2 rounded text-[8px]">
                            {player.pingMs}ms
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>

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
    </div>
  );
}
