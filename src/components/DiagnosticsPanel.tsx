import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Cpu, MessageSquare, Send, Terminal, 
  Heart, Plug, Compass, Server, Search, RefreshCw, AlertCircle, PlayCircle
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

          {/* Telemetry Historical Graph */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                  <Activity className="w-4 h-4 mr-1.5 text-orange-500 animate-pulse" /> Telemetry Resource History
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5">30-frame rolling metrics of server daemon activity</span>
              </div>
              <div className="flex space-x-4 text-xs font-mono mt-2 sm:mt-0">
                <div className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded bg-orange-500/20 border border-orange-500 mr-1.5"></span>
                  <span className="text-slate-400">CPU Usage</span>
                </div>
                <div className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded bg-sky-500/20 border border-sky-500 mr-1.5"></span>
                  <span className="text-slate-400">RAM Allocation</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={telemetryHistory}
                  margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#475569" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#f97316" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#0ea5e9" 
                    fontSize={10} 
                    fontFamily="JetBrains Mono, monospace"
                    tickLine={false}
                    domain={[0, 16]}
                    tickFormatter={(v) => `${v}GB`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="cpu" 
                    name="CPU Usage"
                    stroke="#f97316" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCpu)" 
                    isAnimationActive={false}
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="ram" 
                    name="RAM Allocation"
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRam)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Power Grids & Players */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Power Grid breakdown */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                    <Plug className="w-4 h-4 mr-1.5 text-orange-500" /> Isolated Power Grids
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Source: GET /getPower</span>
                </div>

                <div className="space-y-4">
                  {telemetry.powerGrids.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 font-mono text-xs">Grid telemetry offline. Start node to power switchboards.</div>
                  ) : (
                    telemetry.powerGrids.map((grid) => {
                      const consumptionPercent = Math.min(100, (grid.consumedMw / grid.capacityMw) * 100);
                      const batteryPercent = (grid.batteryChargeMj / grid.batteryCapacityMj) * 100;
                      return (
                        <div key={grid.gridId} className="space-y-2 border-b border-slate-900 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-orange-500 font-bold uppercase">Grid Network #{grid.gridId}</span>
                            <span className="text-slate-400">
                              Load: <span className="text-slate-200 font-bold">{grid.consumedMw} MW</span> / <span className="text-orange-500 font-bold">{grid.capacityMw} MW</span>
                            </span>
                          </div>

                          {/* Power meter progress bar */}
                          <div className="w-full bg-zinc-900 border border-slate-800 h-3 rounded overflow-hidden relative">
                            <div 
                              className={`h-full transition-all duration-1000 ${
                                consumptionPercent > 90 
                                  ? "bg-rose-500" 
                                  : consumptionPercent > 75 
                                    ? "bg-amber-500" 
                                    : "bg-orange-500"
                              }`}
                              style={{ width: `${consumptionPercent}%` }}
                            ></div>
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold text-slate-200 uppercase select-none">
                              Consumption: {consumptionPercent.toFixed(1)}%
                            </span>
                          </div>

                          {/* Battery charge stats if RefinedPower/Battery exists */}
                          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                            <span>FICSIT Accumulators Charge: {grid.batteryChargeMj} / {grid.batteryCapacityMj} MJ</span>
                            <span>{batteryPercent.toFixed(0)}% Charged</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Connected Players Grid */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-lg text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                    <Compass className="w-4 h-4 mr-1.5 text-orange-500" /> Active Players Coordinates
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Source: GET /getPlayer</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {telemetry.players.length === 0 ? (
                    <div className="sm:col-span-2 text-center py-6 text-slate-600 font-mono text-xs">Lobby empty. Node awaiting client connections.</div>
                  ) : (
                    telemetry.players.map((player) => (
                      <div key={player.name} className="p-3 bg-zinc-900/40 border border-slate-900 rounded font-mono text-xs space-y-1.5">
                        <div className="flex justify-between items-center border-b border-slate-800/60 pb-1">
                          <span className="text-slate-200 font-bold uppercase">{player.name}</span>
                          <span className="text-slate-500 text-[10px]">Ping: <span className="text-emerald-400 font-bold">{player.pingMs}ms</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[10px]">Health:</span>
                          <span className="text-rose-500 font-bold flex items-center">
                            <Heart className="w-3.5 h-3.5 mr-1 fill-rose-500" /> {player.health.toFixed(0)}%
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 text-[9px] uppercase tracking-wide">In-Game Coordinates:</span>
                          <div className="text-[10px] text-slate-400 leading-normal font-bold">
                            X: {player.location.x} | Y: {player.location.y} | Z: {player.location.z}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Production Rates throughput */}
              <div className="bg-zinc-900 border border-slate-800 rounded-lg p-5 space-y-3 shadow-lg text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-sm font-mono font-bold text-slate-300 uppercase flex items-center">
                    <Activity className="w-4 h-4 mr-1.5 text-orange-500" /> Factory Throughput Production
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Source: GET /getProduction</span>
                </div>

                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {telemetry.throughput.length === 0 ? (
                    <div className="text-center py-6 text-slate-600 font-mono text-xs">Production rates zeroed. Factory is asleep.</div>
                  ) : (
                    telemetry.throughput.map((item) => (
                      <div key={item.name} className="flex justify-between items-center font-mono text-xs p-1.5 border-b border-slate-900/40 last:border-b-0 hover:bg-zinc-900/40 rounded transition-all">
                        <span className="text-slate-300 font-semibold">{item.name}</span>
                        <div className="space-x-4 flex items-center">
                          <span className="text-[10px] text-slate-500">
                            Prod: <span className="text-emerald-400 font-bold">+{item.productionRate.toFixed(1)}/m</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Cons: <span className="text-rose-400 font-bold">-{item.consumptionRate.toFixed(1)}/m</span>
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.currentRate > 0 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : item.currentRate === 0 
                                ? "bg-slate-800 text-slate-500" 
                                : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {item.currentRate >= 0 ? `+${item.currentRate.toFixed(1)}` : item.currentRate.toFixed(1)}/m
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Right Col: In-Game Chat Box */}
            <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 flex flex-col h-[520px] shadow-lg">
              <div className="border-b border-slate-800 pb-3 mb-3 text-left">
                <span className="text-sm font-mono font-bold tracking-wider text-slate-300 uppercase flex items-center">
                  <MessageSquare className="w-4 h-4 mr-1.5 text-orange-500" /> Live In-Game Chat Log
                </span>
                <p className="text-[10px] font-mono text-slate-500">Mascot Greg watches chats for blowing fuses</p>
              </div>

              {/* Chats List Stream */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-3 pr-1 text-left">
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
