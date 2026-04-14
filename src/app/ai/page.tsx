"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Sparkles, X, Bot, User, Trash2, Cpu, Zap, Activity, MessageSquare } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isNew?: boolean;
};

// Fancy Markdown Parser without dependencies
function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <div className="space-y-3 leading-relaxed text-[15px] sm:text-[16px] text-slate-300">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const match = part.match(/```([a-z0-9]*)\n([\s\S]*?)```/);
          const lang = match?.[1] || "code";
          const code = match?.[2] || part.slice(3, -3);
          
          return (
            <div key={index} className="my-5 bg-[#090b10] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center px-4 py-3 bg-[#10141d] border-b border-[#21293d]/50">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]"></div>
                </div>
                <span className="ml-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{lang}</span>
              </div>
              <div className="p-5 overflow-x-auto text-[13px] font-mono text-emerald-400 scrollbar-thin scrollbar-thumb-[#21293d] scrollbar-track-transparent">
                <pre><code>{code}</code></pre>
              </div>
            </div>
          );
        }
        
        const lines = part.split('\n');
        let currentP: React.ReactNode[] = [];
        const result: React.ReactNode[] = [];
        
        const pushP = () => {
          if (currentP.length > 0) {
            result.push(<p key={`p-${result.length}`} className="mb-3">{currentP}</p>);
            currentP = [];
          }
        };

        lines.forEach((line, i) => {
          if (line.match(/^#{1,3}\s/)) {
            pushP();
            const level = line.match(/^(#{1,3})\s/)?.[1].length || 3;
            const text = line.replace(/^#{1,3}\s/, '');
            const Tag = `h${level}` as any;
            const sizes = { 
              1: "text-2xl font-black mt-8 mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400", 
              2: "text-xl font-bold mt-6 mb-3 text-white", 
              3: "text-lg font-bold mt-5 mb-2 text-slate-200" 
            };
            result.push(<Tag key={`h-${i}`} className={`${sizes[level as keyof typeof sizes]} tracking-tight`}>{parseInline(text)}</Tag>);
          } else if (line.match(/^[\-\*]\s/)) {
            pushP();
            result.push(<li key={`li-${i}`} className="ml-5 list-none relative mb-2 pl-2 before:content-['•'] before:absolute before:-left-5 before:text-purple-500 before:text-lg before:leading-none">{parseInline(line.substring(2))}</li>);
          } else if (line.match(/^\d+\.\s/)) {
            pushP();
            const num = line.match(/^(\d+)\.\s/)?.[1];
            result.push(<li key={`ol-${i}`} className="ml-5 list-none relative mb-2 pl-2"><span className="absolute -left-6 top-0 font-bold text-blue-500 text-sm">{num}.</span>{parseInline(line.replace(/^\d+\.\s/, ''))}</li>);
          } else if (line.trim() === '') {
            pushP();
          } else {
            if (currentP.length > 0) currentP.push(' ');
            currentP.push(<span key={`span-${i}`}>{parseInline(line)}</span>);
          }
        });
        pushP();

        return <div key={index}>{result}</div>;
      })}
    </div>
  );
}

function parseInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-slate-400 not-italic font-medium">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-[#1c2231] text-blue-300 px-1.5 py-0.5 rounded leading-none font-mono text-[13px] border border-[#2d3748] mx-0.5">{part.slice(1, -1)}</code>;
    }
    return <span key={i}>{part}</span>;
  });
}

const INIT_MESSAGE = "Namaste! 🙏\n\nMain **V-Technologies** ka AI Assistant hoon. Aap mujhe business ke baare mein kuch bhi poochh sakte hain:\n\n* **Profits & Loss:** Is month ka total profit kya hai?\n* **Clients:** Kaunsa customer sabse zyada balance ka hai?\n* **Workload:** Is week kitne jobs huye?\n* **Staff:** Staff ka performance kaisa hai?\n\nAapka sawaal likhein, aur main turant data analyse karke bataunga!";

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: INIT_MESSAGE,
      timestamp: new Date(),
      isNew: true
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState("groq");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Make textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
      isNew: true
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const allMessages = [...messages, userMessage];
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim(), messages: allMessages, type: "chat", provider: aiProvider }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Mafi chahunga, main abhi ye data process nahi kar pa raha. Phir se try karein.",
        timestamp: new Date(),
        isNew: true
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Network issue lag raha hai. Kripya apna internet connection check karein.",
        timestamp: new Date(),
        isNew: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "1",
        role: "assistant",
        content: INIT_MESSAGE,
        timestamp: new Date(),
        isNew: true
      },
    ]);
  };

  const quickQuestions = [
    { title: "Dashboard Stats", q: "Is month ka total profit aur revenue kya hai?", icon: <Activity size={14} /> },
    { title: "Client Dues", q: "Top 5 customers with maximum pending balance?", icon: <User size={14} /> },
    { title: "Weekly Report", q: "Please summarize this week's jobs and attendance.", icon: <MessageSquare size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#090b10] flex flex-col font-sans overflow-hidden pattern-bg">
      <style dangerouslySetInnerHTML={{__html: `
        .pattern-bg {
           background-image: radial-gradient(circle at center, #1b213b 0%, #090b10 100%);
        }
        @keyframes message-appear {
          0% { opacity: 0; transform: translateY(15px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .msg-enter {
          animation: message-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .glass-panel {
          background: rgba(22, 27, 39, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .typing-dot {
          animation: typing-dot 1.4s infinite ease-in-out both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}} />

      {/* Header */}
      <div className="glass-panel border-b border-[#21293d]/50 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl blur-[10px] opacity-50"></div>
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center border border-white/20 shadow-lg">
                <Sparkles className="text-white" size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">V-Tech Copilot</h1>
              <div className="flex items-center mt-0.5 gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d1117]/80 border border-[#21293d] shadow-inner">
                  <Cpu size={10} className="text-purple-400" />
                  <select 
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-300 bg-transparent outline-none appearance-none cursor-pointer"
                    title="Select AI Engine"
                  >
                    <option value="groq">Groq Engine</option>
                    <option value="gemini">Gemini Pro</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Online</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="p-2.5 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all shadow-sm group"
            title="Clear Conversation"
          >
            <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-8 pb-10">
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"} ${msg.isNew ? 'msg-enter' : ''}`}
              style={{ animationDelay: `${0.05 * i}s` }}
            >
              {msg.role === "assistant" && (
                <div className="relative flex-shrink-0 mt-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg backdrop-blur-md">
                    <Bot className="text-purple-400" size={20} />
                  </div>
                </div>
              )}
              
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl px-6 py-4 shadow-xl ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-sm border border-blue-500/50"
                    : "glass-panel text-slate-200 rounded-tl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="text-[15px] sm:text-[16px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <FormattedMessage content={msg.content} />
                )}
                <div className={`flex items-center gap-2 mt-3 pt-2 border-t text-[10px] uppercase font-bold tracking-widest ${msg.role === "user" ? "text-blue-300/80 border-blue-500/30 font-medium" : "text-slate-500 border-white/5"}`}>
                  <span>{msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  {msg.role === "assistant" && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Zap size={10} className="text-amber-500/70" /> Generated by {aiProvider.toUpperCase()}</span>
                    </>
                  )}
                </div>
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg border border-white/10">
                    <User className="text-white" size={18} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4 justify-start msg-enter">
              <div className="relative flex-shrink-0 mt-1">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl blur-[8px] animate-pulse opacity-60"></div>
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/80 to-blue-500/80 flex items-center justify-center shadow-lg border border-white/20">
                  <Bot className="text-white" size={20} />
                </div>
              </div>
              <div className="glass-panel border border-[#21293d]/50 rounded-3xl rounded-tl-sm px-6 py-5 shadow-xl flex items-center gap-2">
                <div className="flex gap-1.5 pt-1">
                  <div className="w-2.5 h-2.5 bg-purple-500 rounded-full typing-dot"></div>
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full typing-dot"></div>
                  <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full typing-dot"></div>
                </div>
                <span className="ml-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Analysing Data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="glass-panel border-t border-[#21293d]/50 p-4 shrink-0 relative z-20">
        <div className="max-w-4xl mx-auto">
          {/* Quick Questions Chips */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q.q); textareaRef.current?.focus(); }}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#090b10]/80 border border-[#21293d] hover:border-purple-500/50 transition-all shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                >
                  <span className="text-purple-400 group-hover:text-purple-300">{q.icon}</span>
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">{q.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <div className="relative flex items-end gap-2 bg-[#090b10] border border-[#21293d] rounded-2xl p-2 shadow-inner">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask your AI Assistant anything about the business..."
                className="flex-1 max-h-48 px-4 py-3 bg-transparent text-white placeholder-slate-500 outline-none resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#21293d] text-[15px] sm:text-[16px] leading-relaxed"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-3.5 mb-0.5 shrink-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl text-white shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-500 hover:to-blue-500 transition-all group/btn"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />}
              </button>
            </div>
          </div>
          <div className="text-center mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            AI can make mistakes. Always verify critical business metrics.
          </div>
        </div>
      </div>
    </div>
  );
}

