import React, { useState, useEffect } from "react";
import { FileText, HelpCircle, Loader, Terminal, ArrowRight, AlertTriangle } from "lucide-react";

interface DocumentationViewerProps {
  isLoading: boolean;
}

export default function DocumentationViewer({ isLoading: serverLoading }: DocumentationViewerProps) {
  const [activeDocId, setActiveDocId] = useState<string>("server-configuration");
  const [docContent, setDocContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const docs = [
    { id: "server-configuration", title: "Dedicated Server Setup", desc: "SteamCMD scripts, configurations, and network ports." },
    { id: "cli-administration", title: "SML Modding (ficsit-cli)", desc: "Headless mod profiles, SML installation, and updates." },
    { id: "remote-monitoring", title: "Remote Control & Telemetry", desc: "Ficsit Remote Monitoring REST/WebSocket configurations." },
    { id: "cloudflare-setup", title: "Cloudflare & Tunnels", desc: "Setting up DNS proxy bypasses and cloudflared tunnels." },
    { id: "antigravity-cli-setup", title: "Antigravity CLI & Storage", desc: "Installation instructions and host network folder bind mounting." }
  ];

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/docs/${activeDocId}`);
        if (!response.ok) throw new Error("Could not load dynamic document.");
        const data = await response.json();
        setDocContent(data.content);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [activeDocId]);

  // A lightweight and robust markdown parser to convert markdown structure into stylish tailored JSX
  const parseMarkdown = (markdownText: string) => {
    const lines = markdownText.split("\n");
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let parsedElements: React.ReactNode[] = [];
    let keyIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks wrapping
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          // close block
          inCodeBlock = false;
          parsedElements.push(
            <div key={`code-${keyIdx++}`} className="relative bg-black/60 border border-slate-900 rounded p-4 font-mono text-xs text-left text-slate-300 leading-relaxed overflow-x-auto select-all mb-4 mt-2">
              <span className="absolute top-1 right-2 text-[9px] font-mono text-slate-600 uppercase font-bold select-none">stdout code</span>
              {codeBlockContent.join("\n")}
            </div>
          );
          codeBlockContent = [];
        } else {
          // start block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Headers parsing
      if (line.startsWith("# ")) {
        parsedElements.push(
          <h1 key={`h1-${keyIdx++}`} className="text-xl font-mono text-orange-500 font-bold border-b border-slate-800 pb-2 mb-4 mt-6 text-left uppercase tracking-wide">
            {line.substring(2)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        parsedElements.push(
          <h2 key={`h2-${keyIdx++}`} className="text-base font-mono text-slate-300 font-bold mb-3 mt-5 text-left flex items-center border-l-2 border-orange-500/50 pl-2">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        parsedElements.push(
          <h3 key={`h3-${keyIdx++}`} className="text-sm font-mono text-slate-400 font-bold mb-2 mt-4 text-left">
            {line.substring(4)}
          </h3>
        );
      } 
      // Bullet list lines
      else if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
        const text = line.trim().substring(2);
        parsedElements.push(
          <div key={`li-${keyIdx++}`} className="flex items-start text-xs font-mono text-slate-400 mb-1.5 pl-4 text-left">
            <span className="text-orange-500 mr-2 shrink-0 select-none">•</span>
            <span>{text}</span>
          </div>
        );
      } 
      // Tables parser
      else if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i+1].trim().includes("---")) {
        // Simple parsed table block renderer
        const headers = line.split("|").map(h => h.trim()).filter(Boolean);
        const rows: string[][] = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim().startsWith("|")) {
          rows.push(lines[j].split("|").map(r => r.trim()).filter(Boolean));
          j++;
        }
        i = j - 1; // skip parsed lines

        parsedElements.push(
          <div key={`table-${keyIdx++}`} className="overflow-x-auto my-4 border border-slate-800 rounded">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-900 border-b border-slate-800">
                  {headers.map((h, idx) => (
                    <th key={idx} className="p-3 text-slate-300 uppercase font-bold tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-slate-900/60 hover:bg-zinc-900/20 last:border-0">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="p-3 text-slate-400">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      // Standard paragraphs
      else if (line.trim()) {
        // Highlight inline code segments `code`
        const inlineCodeRegex = /`([^`]+)`/g;
        let lineWithHighlights = line;
        
        parsedElements.push(
          <p key={`p-${keyIdx++}`} className="text-xs font-sans text-slate-400 leading-relaxed mb-3 text-left">
            {line}
          </p>
        );
      }
    }

    return parsedElements;
  };

  return (
    <div className="flex-1 overflow-hidden p-6 flex flex-col h-full text-slate-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 shrink-0">
        <div className="text-left">
          <h1 className="text-xl font-mono text-orange-500 uppercase tracking-wider font-bold">DaemonForge Docs Hub</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Technical instructions and guidelines for SML Profiles, steamCMD and FRM monitoring</p>
        </div>
        <div className="text-xs font-mono text-slate-400 mt-2 md:mt-0 flex items-center bg-zinc-900 border border-slate-800 px-3 py-1.5 rounded">
          <FileText className="w-4 h-4 text-orange-500 mr-2" />
          Documentation Index: <span className="text-orange-500 ml-1 font-bold">{docs.length} MANIFESTS</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        
        {/* Left Side Sidebar select */}
        <div className="lg:col-span-1 space-y-3 shrink-0">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActiveDocId(doc.id)}
              className={`w-full text-left p-3 rounded border transition-all cursor-pointer flex flex-col space-y-1 ${
                activeDocId === doc.id
                  ? "bg-orange-500/10 border-orange-500 text-orange-400 shadow-md"
                  : "bg-zinc-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <span className="text-xs font-mono font-bold tracking-tight uppercase flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-orange-500" /> {doc.title}
              </span>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                {doc.desc}
              </p>
            </button>
          ))}

          {/* Quick FAQ info block */}
          <div className="bg-zinc-900/60 border border-slate-800 rounded p-4 text-left font-mono text-[10px] space-y-1.5">
            <span className="text-slate-300 font-bold uppercase flex items-center text-[11px] mb-1">
              <HelpCircle className="w-4 h-4 text-orange-500 mr-1.5" /> SML Port Reference
            </span>
            <p className="text-slate-500 leading-relaxed">
              • Satisfactory Game V2 combines game, beacon and query into port <span className="text-orange-400 font-bold">7777 UDP</span>.
            </p>
            <p className="text-slate-500 leading-relaxed">
              • SML Modding requires installing <span className="text-orange-400 font-bold">SML</span> as a base dependency via ficsit-cli.
            </p>
          </div>
        </div>

        {/* Right Side Parsed Markdown doc details */}
        <div className="lg:col-span-3 bg-zinc-900 border border-slate-800 rounded-lg p-6 overflow-y-auto h-[520px] shadow-lg flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
              <Loader className="w-8 h-8 text-orange-500 animate-spin mb-2" />
              Loading document from DaemonForge server...
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center text-rose-500 font-mono text-xs">
              <AlertTriangle className="w-8 h-8 mb-2" />
              Failed to load document: {error}
            </div>
          ) : (
            <article className="prose prose-invert max-w-none text-slate-300 space-y-1">
              {parseMarkdown(docContent)}
            </article>
          )}
        </div>

      </div>

    </div>
  );
}
