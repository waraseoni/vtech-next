"use client";

import { useState } from "react";
import { MessageCircle, X, Copy, Send, Check } from "lucide-react";

/**
 * Sprint 3 #14 — shared WhatsApp message preview modal.
 * Har WA send path (jobs bulk/single, clients, purchase-orders...) isi se
 * guzrega: rendered chat-bubble preview + optional editor + Copy/Send.
 * New pages me inline wa.me modal mat banao — ye component reuse karo.
 */
export default function WaPreviewModal({
  title = "Send WhatsApp Message",
  note,
  message,
  editable = true,
  onMessageChange,
  onSend,
  onClose,
  sendLabel = "Send",
}: {
  title?: string;
  note?: string;
  message: string;
  editable?: boolean;
  onMessageChange?: (v: string) => void;
  onSend: (finalText: string) => void;
  onClose: () => void;
  sendLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-panel border border-app-2 dark:border-app rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="bg-emerald-600 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <h3 className="font-black !text-white text-sm flex items-center gap-2">
            <MessageCircle size={16} className="!text-white" /> {title}
          </h3>
          <button onClick={onClose} className="!text-white/80 hover:!text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {note && (
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-3 py-2">
              {note}
            </p>
          )}
          {/* Rendered preview — client ko exactly aisa dikhega */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
              Preview
            </p>
              {/* Rendered preview — theme-aware bubble (app token system) */}
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl rounded-tr-sm px-3.5 py-2.5 shadow-sm ml-6">
              {/* NOTE: .text-app plain class hai (var-based, dono themes me sahi) —
                  ispar dark: prefix mat lagao, dead code ban jata hai */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-app">
                {message || <span className="opacity-50 italic">Empty message…</span>}
              </p>
              <p className="text-[10px] text-right mt-1 text-muted-2">
                {message.length} chars
              </p>
            </div>
          </div>
          {editable && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                Edit message
              </p>
              {/* Edit box: plain theme-aware tokens (.bg-panel/.text-app-2).
                  dark:bg-app / dark:text-app-2 DEAD hain (plain classes par
                  dark: kaam nahi karta) — wahi purana white-bg bug tha. */}
              <textarea
                rows={6}
                value={message}
                onChange={(e) => onMessageChange?.(e.target.value)}
                className="w-full bg-panel border border-emerald-500/40 text-app-2 rounded-xl p-3 text-sm font-mono leading-relaxed outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 resize-none"
              />
            </div>
          )}
        </div>
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-panel-2 flex items-center justify-end gap-2 border-t border-app-2 dark:border-app flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-app dark:text-muted bg-panel-2 hover:bg-panel-2 dark:bg-panel-2 dark:hover:bg-[#2a3550] transition-colors"
          >
            Close
          </button>
          <button
            onClick={copyText}
            className="px-4 py-2 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-600/15 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-600/25 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => onSend(message)}
            className="px-4 py-2 rounded-xl text-sm font-bold !text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Send size={13} className="!text-white" /> {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
