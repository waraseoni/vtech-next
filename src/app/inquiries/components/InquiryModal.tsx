"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  X, User, Phone, Mail, Calendar, MessageSquare,
  CheckCircle2, Clock, Send, Loader2, Inbox, Sparkles, Copy, RefreshCw,
} from "lucide-react";

interface Inquiry {
  id: number;
  fullname: string;
  contact: string;
  email: string;
  message: string;
  status: 0 | 1;
  date_created: string;
}

interface Props {
  inquiryId: number;
  onClose: () => void;
  onUpdate: () => void;
}

const fmtIST = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

export default function InquiryModal({ inquiryId, onClose, onUpdate }: Props) {
  const [inquiry,  setInquiry]  = useState<Inquiry | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [marking,  setMarking]  = useState(false);
  // BUG FIX 1: Local status state so badge updates instantly without full refetch
  const [isRead,   setIsRead]   = useState(false);
  const [receivedAgo, setReceivedAgo] = useState("");
  const [aiReply,  setAiReply]  = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,  setAiError]  = useState<string | null>(null);

  // BUG FIX 2: onClose/onUpdate intentionally NOT in deps — parent re-creates them
  // each render → including them would re-run the effect on every parent render
  const fetchInquiry = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("message_list").select("*").eq("id", inquiryId).single();

    if (error || !data) {
      console.error(error);
      onClose(); // only call if truly not found
      return;
    }
    setInquiry(data);
    setIsRead(data.status === 1);
    setLoading(false);
    const diff = Math.floor((Date.now() - new Date(data.date_created).getTime()) / 86400000);
    setReceivedAgo(diff === 0 ? "Today" : diff === 1 ? "Yesterday" : `${diff}d ago`);

    // BUG FIX 3: Original auto-marked as read but never updated local state
    // so badge still showed "Unread" until re-fetch. Fixed: update isRead immediately
    if (data.status === 0) {
      await supabase.from("message_list").update({ status: 1 }).eq("id", inquiryId);
      setIsRead(true);
      // Notify parent so list updates unread count — but don't close modal
      onUpdate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- BUG FIX 2: onClose/onUpdate are recreated each parent render; including them would refetch on every render
  }, [inquiryId]); // BUG FIX 2: removed onClose from deps

  useEffect(() => {
    fetchInquiry();
  }, [fetchInquiry]);

  // BUG FIX 4: handleMarkRead did not update local state — badge stayed "Unread"
  const handleMarkRead = async () => {
    if (isRead) return;
    setMarking(true);
    const { error } = await supabase
      .from("message_list").update({ status: 1 }).eq("id", inquiryId);
    if (!error) {
      setIsRead(true);
      onUpdate(); // refresh parent list
    }
    setMarking(false);
  };

  // ── AI Reply (WhatsApp) ───────────────────────────────────────────────────
  const generateReply = async () => {
    if (!inquiry || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inquiry.message,
          type: "whatsapp",
          context: { customerName: inquiry.fullname },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Reply generate nahi ho paya");
      setAiReply(data.response || "");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Reply generate nahi ho paya");
    } finally {
      setAiLoading(false);
    }
  };

  const copyReply = async () => {
    if (!aiReply) return;
    try {
      await navigator.clipboard.writeText(aiReply);
    } catch { /* clipboard unavailable — ignore */ }
  };

  // Escape key close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-blue-400" />
          <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (!inquiry) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Top accent bar by status ── */}
        <div className={`h-1 w-full ${isRead ? "bg-emerald-500" : "bg-blue-500"}`} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d] bg-[#111520]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
              <MessageSquare size={14} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Inquiry Details</h3>
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
                ID #{inquiry.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
              isRead
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                : "bg-blue-500/10 border-blue-500/25 text-blue-400"
            }`}>
              {isRead
                ? <><CheckCircle2 size={9} /> Read</>
                : <><Inbox size={9} /> Unread</>
              }
            </span>
            <button onClick={onClose}
              className="w-8 h-8 bg-[#21293d] hover:bg-white/10 border border-[#21293d] rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-3">

          {/* Name */}
          <div className="flex items-center gap-3 bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <User size={13} className="text-purple-400" />
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-0.5">Name</div>
              <div className="text-sm font-extrabold text-white">{inquiry.fullname}</div>
            </div>
          </div>

          {/* Contact + Email side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone size={12} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-0.5">Phone</div>
                <a href={`https://wa.me/91${inquiry.contact.replace(/\D/g, "")}`} target="_blank"
                  className="text-xs font-extrabold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors truncate">
                  <Send size={9} /> {inquiry.contact}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail size={12} className="text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-0.5">Email</div>
                <a href={`mailto:${inquiry.email}`}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors truncate block">
                  {inquiry.email}
                </a>
              </div>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 bg-[#111520] border border-[#21293d] rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar size={12} className="text-amber-400" />
            </div>
            <div>
              <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-0.5">Received</div>
              <div className="text-xs font-semibold text-slate-300">{fmtIST(inquiry.date_created)}</div>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-700">
              <Clock size={9} />
              {receivedAgo}
            </div>
          </div>

          {/* Message */}
          <div className="bg-[#111520] border border-[#21293d] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21293d]">
              <MessageSquare size={11} className="text-blue-400" />
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600">Message</span>
              <span className="ml-auto text-[9px] text-slate-700 font-bold">
                {inquiry.message.length} chars
              </span>
            </div>
            <div className="px-4 py-3.5 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {inquiry.message}
            </div>
          </div>

          {/* ── AI Reply (WhatsApp) ── */}
          <div className="bg-[#111520] border border-[#21293d] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#21293d]">
              <Sparkles size={11} className="text-purple-400" />
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600">AI Reply</span>
              {!aiReply && !aiLoading && !aiError && (
                <button onClick={generateReply}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/25 text-purple-300 rounded-lg text-[10px] font-extrabold transition-all">
                  <Sparkles size={10} /> Generate Reply
                </button>
              )}
            </div>

            {aiLoading ? (
              <div className="px-4 py-6 flex flex-col items-center gap-2">
                <Loader2 size={18} className="animate-spin text-purple-400" />
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">AI reply likh raha hai...</p>
              </div>
            ) : aiError ? (
              <div className="px-4 py-4">
                <p className="text-xs text-red-400 mb-2">{aiError}</p>
                <button onClick={generateReply}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/25 text-purple-300 rounded-lg text-[10px] font-extrabold transition-all">
                  <RefreshCw size={10} /> Retry
                </button>
              </div>
            ) : aiReply ? (
              <div className="p-3 space-y-2">
                <textarea
                  value={aiReply}
                  onChange={e => setAiReply(e.target.value)}
                  rows={4}
                  className="w-full bg-[#0d1117] border border-[#21293d] focus:border-purple-500/40 text-slate-200 rounded-lg px-3 py-2.5 text-xs leading-relaxed outline-none resize-y"
                />
                <div className="flex items-center justify-between gap-2">
                  <button onClick={generateReply}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b27] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-purple-300 rounded-lg text-[10px] font-extrabold transition-all">
                    <RefreshCw size={10} /> Regenerate
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={copyReply}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b27] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-white rounded-lg text-[10px] font-extrabold transition-all">
                      <Copy size={10} /> Copy
                    </button>
                    <a href={`https://wa.me/91${inquiry.contact.replace(/\D/g, "")}?text=${encodeURIComponent(aiReply)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/25 text-emerald-300 rounded-lg text-[10px] font-extrabold transition-all">
                      <Send size={10} /> Open WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#21293d] bg-[#111520]">
          <button onClick={onClose}
            className="px-4 py-2 bg-[#161b27] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-white rounded-xl text-xs font-extrabold transition-all">
            Close
          </button>
          {!isRead ? (
            <button onClick={handleMarkRead} disabled={marking}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
              {marking
                ? <><Loader2 size={12} className="animate-spin" /> Marking...</>
                : <><CheckCircle2 size={13} /> Mark as Read</>
              }
            </button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-extrabold">
              <CheckCircle2 size={13} /> Already Read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}