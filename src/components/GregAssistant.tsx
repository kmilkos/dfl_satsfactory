import React, { useState, useEffect, useRef } from "react";
import { Terminal, Send, Info, AlertOctagon, HelpCircle, Key, CheckCircle2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface GregAssistantProps {
  serverStatus: string;
  hasGeminiKey: boolean;
  onRefreshStatus?: () => Promise<void>;
  isLoading: boolean;
}

export default function GregAssistant({ 
  serverStatus, 
  hasGeminiKey, 
  onRefreshStatus, 
  isLoading: serverLoading 
}: GregAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "DaemonForge system-intelligence core active. I'm Greg. SML profile verified, automated backups running every 15 minutes, and Grid 2 is sitting on 95% capacity... so please, don't ask me to start another particle accelerator today. What are we breaking now? ¯\\_(ツ)_/¯"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState("");
  const assistantEndRef = useRef<HTMLDivElement>(null);

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim() && !hasGeminiKey) return;
    setIsSavingKey(true);
    setKeySaveMessage("");
    try {
      const res = await fetch("/api/greg/config-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput })
      });
      const data = await res.json();
      if (data.success) {
        setKeySaveMessage("API Key updated successfully!");
        setApiKeyInput("");
        if (onRefreshStatus) await onRefreshStatus();
      } else {
        setKeySaveMessage("Failed to save API key.");
      }
    } catch (err: any) {
      setKeySaveMessage("Error: " + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  // Quick suggestions
  const suggestions = [
    { label: "Check Modding Profiles", text: "Explain how ficsit-cli handles profile conflicts and mod packages on a headless server." },
    { label: "Diagnose Fuses & Power", text: "Why is Ficsit Remote Monitoring reporting blowing fuses on Grid 2?" },
    { label: "Automate Backups", text: "How do I configure automated backups to prevent desynchronization file corruptions?" },
    { label: "Mod SML Crash", text: "Troubleshoot a headless server SML loader crash. Visor displays ¯\\_(ツ)_/¯." }
  ];

  // Auto-scroll on messages
  useEffect(() => {
    if (assistantEndRef.current) {
      assistantEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/greg/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages })
      });

      const data = await response.json();
      if (data.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "¯\\_(ツ)_/¯ My cognitive threads are throwing a null reference. Probably due to a loose fiber-optic bridge." }]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev, 
        { 
          role: "assistant", 
          content: `My neural subroutines timed out: ${err.message}. ¯\\_(ツ)_/¯ Check that process.env.GEMINI_API_KEY is active in the Secrets panel.` 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="flex-1 overflow-hidden p-6 flex flex-col h-full text-slate-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 shrink-0">
        <div className="text-left">
          <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">Mascot Core: Greg</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Sarcastic, veteran IT sysadmin AI running background daemons</p>
        </div>
        <div className="text-xs font-mono text-slate-400 mt-2 md:mt-0 flex items-center bg-zinc-900 border border-slate-800 px-3 py-1.5 rounded">
          <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
          Personality: <span className="text-orange-500 ml-1 font-bold">SARCASMTIC (TIRED SYSADMIN)</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        
        {/* Left Suggestions Side panel */}
        <div className="lg:col-span-1 space-y-4 text-left hidden lg:block">
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 space-y-3 shadow-lg">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Terminal className="w-4 h-4 mr-1.5 text-orange-500" /> System Queries
            </span>
            <p className="text-[10px] font-mono text-slate-500 leading-normal">
              Click any diagnostic macro query below to prompt Greg with active server configurations and telemetry:
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSendMessage(s.text)}
                  disabled={loading}
                  className="w-full text-left p-2 bg-zinc-900 hover:bg-orange-500/10 border border-slate-800 hover:border-orange-500/50 rounded transition-all text-[11px] font-mono leading-tight cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4 space-y-2">
            <span className="text-xs font-mono font-bold text-orange-500 flex items-center">
              <Info className="w-4 h-4 mr-1.5" /> GREG STATS
            </span>
            <ul className="text-[10px] font-mono text-slate-400 space-y-1.5">
              <li>• Octahedron hard-light: <span className="text-orange-400 font-bold">Orange</span></li>
              <li>• System temperature: <span className="text-slate-200">Optimal (42°C)</span></li>
              <li>• Patience: <span className="text-rose-400 font-bold">Extremely Low</span></li>
              <li>• Visor Status: <span className="text-slate-200">¯\_(ツ)_/¯ enabled</span></li>
            </ul>
          </div>

          {/* Gemini API Key Configuration Card */}
          <div className="bg-zinc-900 border border-slate-800 rounded-lg p-4 space-y-3 shadow-lg">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Key className="w-4 h-4 mr-1.5 text-orange-500" /> API Configuration
            </span>
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Mascot AI status:</span>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold ${
                hasGeminiKey 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse"
              }`}>
                {hasGeminiKey ? "ACTIVE" : "OFFLINE STUBS"}
              </span>
            </div>

            <p className="text-[10px] font-mono text-slate-500 leading-normal">
              {hasGeminiKey 
                ? "Mascot engine fully initialized via Google Gemini API." 
                : "Mascot is operating in offline sandbox mode. Enter a Gemini API Key to enable cognitive reasoning."}
            </p>

            <form onSubmit={handleSaveApiKey} className="space-y-2 pt-1.5">
              <input
                type="password"
                placeholder={hasGeminiKey ? "••••••••••••••••" : "Enter GEMINI_API_KEY..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                disabled={isSavingKey}
                className="w-full px-2.5 py-1.5 bg-zinc-955 border border-slate-800 rounded font-mono text-[10px] text-slate-100 placeholder-slate-700 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={isSavingKey || (!apiKeyInput.trim() && !hasGeminiKey)}
                className={`w-full py-1.5 rounded font-mono font-bold text-[10px] transition-colors cursor-pointer ${
                  !apiKeyInput.trim() && !hasGeminiKey
                    ? "bg-slate-850 text-slate-500 border border-slate-800"
                    : "bg-orange-500 text-zinc-950 hover:bg-orange-600"
                }`}
              >
                {isSavingKey ? "SAVING..." : hasGeminiKey && !apiKeyInput.trim() ? "CLEAR KEY" : "SAVE KEY"}
              </button>
            </form>
            
            {keySaveMessage && (
              <p className="text-[9px] font-mono text-center text-slate-400 animate-pulse">
                {keySaveMessage}
              </p>
            )}
          </div>
        </div>

        {/* Chat Stream Main Block */}
        <div className="lg:col-span-3 bg-zinc-900 border border-slate-800 rounded-lg p-4 flex flex-col h-[520px] shadow-lg">
          
          {/* Chat Stream messages box */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
            {messages.map((m, idx) => {
              const isAssistant = m.role === "assistant";
              return (
                <div 
                  key={idx} 
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div 
                    className={`max-w-[85%] rounded p-3.5 border text-xs leading-relaxed font-mono ${
                      isAssistant 
                        ? "bg-zinc-900 border-slate-800 text-slate-100" 
                        : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wider">
                      <span>{isAssistant ? "Mascot_Greg (DaemonForge)" : "You (Manager)"}</span>
                      {isAssistant && (
                        <span className="text-orange-500/70 font-semibold">[SYSADMIN]</span>
                      )}
                    </div>
                    <p className="whitespace-pre-line">{m.content}</p>
                  </div>
                </div>
              );
            })}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-900 border border-slate-800 rounded p-3.5 text-xs font-mono text-slate-400 animate-pulse flex items-center">
                  <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5 animate-ping"></span>
                  Greg is analyzing server telemetry...
                </div>
              </div>
            )}
            
            <div ref={assistantEndRef}></div>
          </div>

          {/* Chat Submit bar */}
          <form onSubmit={handleSubmit} className="mt-3 flex space-x-2 border-t border-slate-800 pt-3 shrink-0">
            <input
              type="text"
              placeholder="Query Greg's technical engine... (e.g., Explain SML configs)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-zinc-900 border border-slate-800 rounded font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-orange-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-zinc-950 font-mono font-bold text-xs rounded hover:bg-orange-600 transition-colors cursor-pointer shrink-0"
              id="btn-greg-submit"
            >
              SEND
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
