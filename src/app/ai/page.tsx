"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Sparkles, X, Bot, User, Trash2 } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Namaste! 🙏\n\nMain V-Technologies ka AI Assistant hoon. Aap mujhe poochh sakte hain:\n\n• Is month ka total profit kya hai?\n• Kaunsa customer sabse zyada balance ka hai?\n• Is week kitne jobs huye?\n• Staff ka performance kaisa hai?\n• Koi bhi business-related sawaal!\n\nAapka sawaal likhein, main help karunga!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "Sorry, kuch gadbad ho gayi. Phir se try karein.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, connection error ho gaya. Internet check karein.",
        timestamp: new Date(),
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
        content: "Namaste! 🙏\n\nMain V-Technologies ka AI Assistant hoon. Aap mujhe poochh sakte hain:\n\n• Is month ka total profit kya hai?\n• Kaunsa customer sabse zyada balance ka hai?\n• Is week kitne jobs huye?\n• Staff ka performance kaisa hai?\n• Koi bhi business-related sawaal!\n\nAapka sawaal likhein, main help karunga!",
        timestamp: new Date(),
      },
    ]);
  };

  const quickQuestions = [
    "Is month ka total profit kya hai?",
    "Top 5 customers with due?",
    "This week kitne jobs huye?",
    "Staff performance report",
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="bg-[#161b27] border-b border-[#21293d] px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">AI Assistant</h1>
              <p className="text-xs text-slate-400">Powered by Gemini AI</p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 hover:text-white transition"
            title="Clear Chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="text-white" size={16} />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-[#161b27] border border-[#21293d] text-slate-200"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-2 ${msg.role === "user" ? "text-blue-200" : "text-slate-500"}`}>
                  {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="text-white" size={16} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Bot className="text-white" size={16} />
              </div>
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-4 py-3">
                <Loader2 className="animate-spin text-purple-400" size={20} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(q);
                }}
                className="px-3 py-1.5 rounded-full bg-[#161b27] border border-[#21293d] text-xs text-slate-400 hover:text-white hover:border-purple-500/50 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-[#161b27] border-t border-[#21293d] p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Aapka sawaal likhein..."
            className="flex-1 px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-white placeholder-slate-500 outline-none focus:border-purple-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-500 hover:to-blue-500 transition"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
