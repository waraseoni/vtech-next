"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Mail, Phone, MapPin, Send, CheckCircle2, ArrowLeft,
  Loader2, User, MessageSquare, AlertTriangle, ChevronRight,
  Sparkles,
} from "lucide-react";

interface SystemInfo { email: string; contact: string; address: string; }

const inputCls = "w-full bg-[#0d1117] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/15 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ContactPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({ email: "", contact: "", address: "" });
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState("");
  const [formData,   setFormData]   = useState({ fullname: "", contact: "", email: "", message: "" });
  // BUG FIX 1: track char count for message live
  const msgRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_info").select("meta_field, meta_value");
      if (data) {
        const info: SystemInfo = { email: "", contact: "", address: "" };
        data.forEach(r => {
          if (r.meta_field === "email")   info.email   = r.meta_value;
          if (r.meta_field === "contact") info.contact = r.meta_value;
          if (r.meta_field === "address") info.address = r.meta_value;
        });
        setSystemInfo(info);
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // BUG FIX 2: basic phone validation — original allowed empty string as "required" passed HTML only
    if (!/^\d{7,15}$/.test(formData.contact.replace(/[\s\-+]/g, ""))) {
      setError("Please enter a valid contact number (7–15 digits)."); return;
    }
    setSubmitting(true);
    try {
      const { error: se } = await supabase.from("message_list").insert([{
        fullname: formData.fullname.trim(),
        contact:  formData.contact.trim(),
        email:    formData.email.trim(),
        message:  formData.message.trim(),
        status:   0,
        // BUG FIX 3: original didn't send date_created — relied on DB default
        // which may not exist on all setups. Explicit is safer.
        date_created: new Date().toISOString(),
      }]);
      if (se) throw se;
      setSubmitted(true);
      setFormData({ fullname: "", contact: "", email: "", message: "" });
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Mail size={28} className="text-blue-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-blue-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-16 left-1/4 w-80 h-80 bg-blue-600/6 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 mb-4 font-bold uppercase tracking-wider">
            <Link href="/inquiries" className="hover:text-slate-500 transition-colors">Inquiries</Link>
            <ChevronRight size={10} />
            <span className="text-slate-500">New Inquiry</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/inquiries"
              className="mt-1 p-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-slate-300 transition-all flex-shrink-0">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/25 flex-shrink-0">
                <MessageSquare size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">New Inquiry</h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  Send us a message
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid md:grid-cols-5 gap-4">

          {/* ── LEFT: Contact Info (2 cols) ── */}
          <div className="md:col-span-2 space-y-4">

            {/* Company card */}
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 overflow-hidden shadow-2xl shadow-blue-500/20">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full" />
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-blue-200" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-200">V-Technologies</span>
                </div>
                <p className="text-white/80 text-xs leading-relaxed">
                  We're here to help. Fill in the form and our team will get back to you as soon as possible.
                </p>
              </div>
            </div>

            {/* Contact info cards */}
            {[
              {
                icon: Phone, label: "Phone", value: systemInfo.contact,
                color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
                href: systemInfo.contact ? `tel:${systemInfo.contact}` : undefined,
              },
              {
                icon: Mail, label: "Email", value: systemInfo.email,
                color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20",
                href: systemInfo.email ? `mailto:${systemInfo.email}` : undefined,
              },
              {
                icon: MapPin, label: "Address", value: systemInfo.address,
                color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20",
                href: undefined,
              },
            ].map(({ icon: Icon, label, value, color, bg, border, href }) => (
              <div key={label} className={`flex items-start gap-3 ${bg} border ${border} rounded-2xl p-4`}>
                <div className={`w-9 h-9 bg-[#0d1117]/40 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1">{label}</div>
                  {href ? (
                    <a href={href} className={`text-sm font-bold ${color} hover:opacity-80 transition-opacity break-all`}>
                      {value || "Not set"}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-slate-300 leading-relaxed">{value || "Not set"}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Response time note */}
            <div className="flex items-center gap-2.5 bg-[#161b27] border border-[#21293d] rounded-xl px-4 py-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
              <p className="text-[11px] text-slate-500 font-medium">
                Typically responds within <span className="text-emerald-400 font-bold">24 hours</span>
              </p>
            </div>
          </div>

          {/* ── RIGHT: Form (3 cols) ── */}
          <div className="md:col-span-3">
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">

              {/* Form header */}
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#21293d] bg-[#111520]">
                <Send size={12} className="text-blue-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Contact Form
                </span>
              </div>

              <div className="p-5 sm:p-6">

                {/* ── Success state ── */}
                {submitted ? (
                  <div className="py-10 flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white mb-2">Message Sent!</h3>
                      <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                        We've received your inquiry. Our team will get back to you shortly.
                      </p>
                    </div>
                    <div className="flex gap-2.5 mt-2">
                      <button onClick={() => setSubmitted(false)}
                        className="px-5 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-extrabold transition-all">
                        Send Another
                      </button>
                      <Link href="/inquiries"
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-500/20 transition-all">
                        View Inquiries
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Error */}
                    {error && (
                      <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                        <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-400 text-sm">{error}</p>
                        <button type="button" onClick={() => setError("")}
                          className="ml-auto text-red-400/40 hover:text-red-400 text-base leading-none">×</button>
                      </div>
                    )}

                    {/* Name + Contact */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Full Name" required>
                        <div className="relative">
                          <User size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                          <input type="text" required placeholder="Ramesh Kumar"
                            value={formData.fullname} onChange={set("fullname")}
                            className={`${inputCls} pl-9`} />
                        </div>
                      </Field>
                      <Field label="Contact Number" required>
                        <div className="relative">
                          <Phone size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                          <input type="tel" required placeholder="9876543210"
                            value={formData.contact} onChange={set("contact")}
                            className={`${inputCls} pl-9`} />
                        </div>
                      </Field>
                    </div>

                    {/* Email */}
                    <Field label="Email Address" required>
                      <div className="relative">
                        <Mail size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                        <input type="email" required placeholder="you@example.com"
                          value={formData.email} onChange={set("email")}
                          className={`${inputCls} pl-9`} />
                      </div>
                    </Field>

                    {/* Message */}
                    <Field label="Message" required>
                      <div className="relative">
                        <textarea ref={msgRef} required rows={5}
                          placeholder="Describe your inquiry..."
                          value={formData.message} onChange={set("message")}
                          className={`${inputCls} resize-none`} />
                        <div className="absolute bottom-3 right-3 text-[9px] text-slate-700 font-bold">
                          {formData.message.length} chars
                        </div>
                      </div>
                    </Field>

                    {/* Submit */}
                    <button type="submit" disabled={submitting}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-extrabold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" /> Sending...</>
                        : <><Send size={15} /> Send Message</>
                      }
                    </button>

                    <p className="text-center text-[10px] text-slate-700">
                      By submitting, you agree to be contacted by our team.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}