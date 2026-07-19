import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Users, Heart, Cpu } from "lucide-react";
import { ChatMessage, TelemetryData } from "../types";

interface InGameChatPanelProps {
  inGameChats: ChatMessage[];
  onSendChatMessage: (text: string) => Promise<void>;
  telemetry: TelemetryData;
  isLoading?: boolean;
}

export default function InGameChatPanel({
  inGameChats,
  onSendChatMessage,
  telemetry,
  isLoading = false
}: InGameChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chats to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [inGameChats]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    try {
      await onSendChatMessage(chatInput.trim());
      setChatInput("");
    } catch (err) {
      console.error("Failed to send in-game chat:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto md:overflow-hidden p-4 md:p-6 flex flex-col h-full text-slate-200">
      
      {/* Header & Tagline */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 shrink-0">
        <div className="text-left">
          <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">In-Game Communication Bridge</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Real-time IRC link coupling dashboard to Satisfactory pioneer feed</p>
        </div>
        <div className="text-xs font-mono text-slate-400 mt-2 md:mt-0 flex items-center bg-zinc-900 border border-slate-800 px-3 py-1.5 rounded">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
          Pioneers Online: <span className="text-orange-500 ml-1 font-bold">{telemetry.players.length}</span>
        </div>
      </div>

      {/* IRC Client Body */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 mt-6 overflow-visible md:overflow-hidden">
        
        {/* Left Column: Chat log stream and message input */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[400px] md:min-h-0 bg-zinc-900 border border-slate-800 rounded-lg p-4 md:p-5 shadow-lg">
          {/* Section Header */}
          <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center text-left shrink-0">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center">
              <MessageSquare className="w-3.5 h-3.5 mr-1.5 text-orange-500" /> Channel Feed: #save-session
            </span>
            <span className="text-[9px] font-mono text-slate-500 bg-zinc-950 border border-slate-850 px-2 py-0.5 rounded">
              live coupling
            </span>
          </div>

          {/* Chats List Stream */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-1 pr-2 text-left min-h-0 custom-scrollbar font-mono text-[11px] bg-zinc-950 border border-slate-850 p-4 rounded-md">
            {inGameChats.length === 0 ? (
              <div className="text-center text-slate-600 font-mono text-xs py-12">
                No telemetry chats recorded in this session.
              </div>
            ) : (
              inGameChats.map((msg) => {
                const isGreg = msg.sender === "Mascot_Greg";
                const isServer = msg.sender === "SERVER";
                const isUser = msg.sender === "User_Manager";
                
                const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                if (isServer) {
                  return (
                    <div key={msg.id} className="text-slate-500 leading-relaxed">
                      <span className="text-slate-600 mr-2">[{timeString}]</span>
                      <span className="text-pink-500 font-bold mr-1.5">-!-</span>
                      <span className="text-slate-400">{msg.text}</span>
                    </div>
                  );
                }

                let senderLabel = msg.sender;
                let senderClass = "text-slate-300";
                if (isGreg) {
                  senderLabel = `@${msg.sender}`;
                  senderClass = "text-orange-500 font-bold";
                } else if (isUser) {
                  senderLabel = `@${msg.sender}`;
                  senderClass = "text-blue-400 font-bold";
                } else {
                  senderClass = "text-amber-500";
                }

                return (
                  <div key={msg.id} className="leading-relaxed hover:bg-white/[0.02] px-1 rounded transition-colors">
                    <span className="text-slate-600 mr-2">[{timeString}]</span>
                    <span className={`${senderClass} mr-2`}>&lt;{senderLabel}&gt;</span>
                    <span className="text-slate-200">{msg.text}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input form */}
          <form onSubmit={handleSendChat} className="mt-4 flex space-x-2 border-t border-slate-800/80 pt-4 shrink-0">
            <input
              type="text"
              placeholder="Send chat message to in-game pioneer crew..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-zinc-950 border border-slate-800 rounded font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={isLoading || !chatInput.trim()}
              className="px-4 py-2 bg-orange-500 text-zinc-955 rounded hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 transition-colors cursor-pointer flex items-center justify-center shrink-0 font-mono font-bold text-xs uppercase"
              id="btn-send-chat"
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Send
            </button>
          </form>
        </div>

        {/* Right Column: IRC Player/User List (Dual line details per Pioneer) */}
        <div className="w-full md:w-60 bg-zinc-900 border border-slate-800 rounded-lg p-4 md:p-5 flex flex-col h-auto md:h-full overflow-hidden shrink-0 shadow-lg text-left">
          <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider pb-3 border-b border-slate-800 flex items-center justify-between mb-4 shrink-0">
            <span className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-orange-500 animate-pulse" /> Active Pioneers
            </span>
            <span className="bg-zinc-955 border border-slate-850 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold font-mono">
              {telemetry.players.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {telemetry.players.length === 0 ? (
              <div className="text-[11px] font-mono text-slate-500 text-center py-12 leading-relaxed">
                No active pioneers online inside server save matrix.
              </div>
            ) : (
              telemetry.players.map((player) => {
                const isGreg = player.name === "Mascot_Greg";
                return (
                  <div 
                    key={player.name} 
                    className={`p-3 bg-zinc-950/60 border rounded font-mono transition-all duration-300 group ${
                      isGreg 
                        ? "border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.05)] hover:border-orange-500" 
                        : "border-slate-850 hover:border-orange-500/30"
                    }`}
                  >
                    {/* Line 1: PlayerName */}
                    <div className="flex items-center justify-between gap-1.5">
                      <span 
                        className={`text-xs font-bold truncate transition-colors ${
                          isGreg ? "text-orange-400 group-hover:text-orange-500" : "text-slate-200 group-hover:text-orange-500"
                        }`}
                        title={player.name}
                      >
                        {isGreg ? "Mascot_Greg (AI)" : `@${player.name}`}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isGreg 
                          ? "bg-orange-500 shadow-[0_0_8px_#f97316]" 
                          : "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                      }`}></span>
                    </div>
                    {/* Line 2: Health-MS */}
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2.5">
                      {isGreg ? (
                        <span className="flex items-center gap-1 text-orange-400 font-bold bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10">
                          <Cpu className="w-3 h-3 text-orange-500" />
                          SYSADMIN
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-400/90 font-bold bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          {player.health.toFixed(0)}%
                        </span>
                      )}
                      <span className="text-slate-400 font-bold bg-zinc-900 border border-slate-850 px-2 py-0.5 rounded text-[9px]">
                        {isGreg ? "QUANTUM" : `${player.pingMs}ms`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
