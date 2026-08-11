"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2, CheckCircle, Phone, Mail, MapPin, MessageCircle, Send, Clock,
} from "lucide-react";
import { SITE, WHATSAPP_LINK } from "../site";

const SERVICE_OPTIONS = [
  "Stage Lighting",
  "Industrial Electronics",
  "Power Supply",
  "EV Charger",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState({ fullname: "", contact: "", email: "", service: SERVICE_OPTIONS[0], message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullname.trim()) { setError("Naam zaroori hai!"); return; }
    if (!form.contact.trim()) { setError("Mobile number zaroori hai!"); return; }
    if (!form.message.trim()) { setError("Message zaroori hai!"); return; }

    setSending(true);
    setError("");
    try {
      await supabase.from("message_list").insert([{
        fullname: form.fullname.trim(),
        contact: form.contact.trim(),
        email: form.email.trim() || "not provided",
        message: `[${form.service}] ${form.message.trim()}`,
        status: 0,
      }]);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const waText = `Namaste ${SITE.name}! Main ${form.fullname.trim()} (${form.contact.trim()}).\nService: ${form.service}\n${form.message.trim()}`;

  const inputCls =
    "w-full min-h-11 px-4 py-3 bg-white/[0.04] border border-white/[0.1] rounded-xl text-[14px] text-white font-medium placeholder:text-slate-600 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all";

  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-4">
            <MessageCircle size={13} /> Contact &amp; Inquiry
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
            Apna message bhejo — <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">hum jaldi reply karenge</span>
          </h1>
          <p className="mt-4 text-[14px] sm:text-base text-slate-400 max-w-2xl">
            Repair inquiry, estimate, ya koi bhi sawaal — form bharo ya seedha call/WhatsApp karo.
          </p>
        </div>
      </section>

      {/* ═══ BODY ═════════════════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Contact info */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08]">
                <h2 className="font-display text-lg font-black mb-5">Contact Information</h2>
                <div className="space-y-3">
                  <a href={SITE.phoneHref} className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <Phone size={17} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Call / WhatsApp</p>
                      <p className="text-[14px] font-bold text-white mt-0.5">{SITE.phone}</p>
                    </div>
                  </a>
                  <a href={`mailto:${SITE.email}`} className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/15 flex items-center justify-center">
                      <Mail size={17} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Email</p>
                      <p className="text-[14px] font-bold text-white mt-0.5 break-all">{SITE.email}</p>
                    </div>
                  </a>
                  <div className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                      <MapPin size={17} className="text-cyan-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Location</p>
                      <p className="text-[13px] text-slate-300 leading-relaxed mt-0.5">{SITE.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      <Clock size={17} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Timing</p>
                      <p className="text-[13px] font-bold text-white mt-0.5">Mon–Sat · 9:00 AM – 8:00 PM</p>
                    </div>
                  </div>
                </div>

                <a href={SITE.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/25 text-[#4ade80] text-[14px] font-black active:scale-[0.99] transition-transform">
                  <MessageCircle size={17} /> WhatsApp par turant baat karein
                </a>
              </div>
            </div>

            {/* Inquiry form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08]">
                <h2 className="font-display text-lg font-black mb-1">Send Inquiry</h2>
                <p className="text-[13px] text-slate-500 mb-6">Bina login ke — form bharo, hum contact karenge.</p>

                {sent ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                      <CheckCircle size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="font-display text-xl font-black mb-2">Message Sent!</h3>
                    <p className="text-[14px] text-slate-400 mb-6">Hum jaldi aapse sampark karenge. Urgent ho to WhatsApp par bhi follow-up karo.</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <a href={WHATSAPP_LINK(waText)} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-[#04170c] text-[14px] font-black active:scale-95 transition-transform">
                        <MessageCircle size={16} /> WhatsApp Follow-up
                      </a>
                      <button onClick={() => { setSent(false); setForm({ fullname: "", contact: "", email: "", service: SERVICE_OPTIONS[0], message: "" }); }}
                        className="px-6 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-[14px] font-bold text-slate-300 active:scale-95 transition-transform">
                        Naya inquiry bhejo
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Aapka Naam *</label>
                        <input type="text" value={form.fullname} onChange={e => setForm(p => ({ ...p, fullname: e.target.value }))}
                          placeholder="e.g. Rahul Sharma" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Mobile Number *</label>
                        <input type="tel" inputMode="tel" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                          placeholder="10-digit mobile number" className={inputCls} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Email (optional)</label>
                        <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="aapka@email.com" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Service *</label>
                        <select value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
                          className={`${inputCls} appearance-none bg-[#0b0b1a]`}>
                          {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Message *</label>
                      <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                        rows={5} placeholder="Kya problem hai? Item, brand, fault — jitna detail ho utna better."
                        className={`${inputCls} resize-none`} />
                    </div>

                    <button type="submit" disabled={sending}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-[15px] font-black shadow-lg shadow-blue-600/25 disabled:opacity-60 active:scale-[0.99] transition-all">
                      {sending
                        ? <><Loader2 size={17} className="animate-spin" /> Bhej rahe hain...</>
                        : <><Send size={16} /> Inquiry Bhejo</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
