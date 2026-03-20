"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Settings2, Save, Loader2, CheckCircle, AlertCircle,
  Building2, Phone, Mail, MapPin, Tag, ShieldCheck,
  Clock, Calendar,
} from "lucide-react";

// ─── system_info table: meta_field → meta_value (key-value store) ────────────
// Fields: name, short_name, email, contact, address, logo, cover, gstin

const inputCls  = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const labelCls  = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const fieldsets = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const fHdr      = "flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r border-b border-[#21293d]";

type SysInfo = Record<string, string>;

export default function SettingsPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ type: "success"|"error"; msg: string } | null>(null);

  // Form fields — matching PHP system_info meta_fields
  const [name,       setName]       = useState("");
  const [shortName,  setShortName]  = useState("");
  const [email,      setEmail]      = useState("");
  const [contact,    setContact]    = useState("");
  const [address,    setAddress]    = useState("");
  const [gstin,      setGstin]      = useState("");  // extra for GST bills
  const [bizHours,   setBizHours]   = useState({ open: "09:00", close: "19:00", days: "Mon-Sat" });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Admin check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "admin") { router.push("/"); return; }

      // Fetch all system_info rows
      const { data, error } = await supabase
        .from("system_info")
        .select("meta_field, meta_value");

      if (error) {
        console.error("system_info fetch:", error.message);
        setToast({ type: "error", msg: "Settings load nahi hui: " + error.message });
        setLoading(false);
        return;
      }

      // Convert rows to key-value map
      const info: SysInfo = {};
      (data || []).forEach(r => { info[r.meta_field] = r.meta_value; });

      setName(info.name      || "");
      setShortName(info.short_name || "");
      setEmail(info.email    || "");
      setContact(info.contact || "");
      setAddress(info.address || "");
      setGstin(info.gstin    || "");
      const bOpen = info.biz_open || "09:00";
      const bClose = info.biz_close || "19:00";
      const bDays = info.biz_days || "Mon-Sat";
      setBizHours({ open: bOpen, close: bClose, days: bDays });

      setLoading(false);
    })();
  }, [router]);

  // ── Save helper — update existing row, insert if not found ─────────────
  const upsertField = async (field: string, value: string) => {
    // Try update first
    const { data: existing } = await supabase
      .from("system_info")
      .select("id")
      .eq("meta_field", field)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("system_info")
        .update({ meta_value: value })
        .eq("meta_field", field);
      if (error) throw new Error(`${field} update failed: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("system_info")
        .insert({ meta_field: field, meta_value: value });
      if (error) throw new Error(`${field} insert failed: ${error.message}`);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setToast({ type: "error", msg: "System name zaroori hai!" }); return; }

    setSaving(true);
    try {
      await Promise.all([
        upsertField("name",       name.trim()),
        upsertField("short_name", shortName.trim()),
        upsertField("email",      email.trim()),
        upsertField("contact",    contact.trim()),
        upsertField("address",    address.trim()),
        upsertField("gstin",      gstin.trim()),
        upsertField("biz_open",   bizHours.open),
        upsertField("biz_close",  bizHours.close),
        upsertField("biz_days",   bizHours.days),
      ]);
      setToast({ type: "success", msg: "Settings save ho gayi! ✅" });
    } catch (err: unknown) {
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save failed!" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={36}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading Settings...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

          {/* Header */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-700 rounded-xl flex items-center justify-center">
                <Settings2 size={18} className="text-white"/>
              </div>
              <div>
                <h1 className="text-lg font-black text-white">System Information</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Panel · Settings</p>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {saving ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : <><Save size={14}/> Update</>}
            </button>
          </div>

          {/* System Name */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-blue-600/20 to-transparent`}>
              <Tag size={14} className="text-blue-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">System Identity</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>System Name *</label>
                <div className="relative">
                  <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="V-Technologies Repair Shop" required
                    className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Short Name</label>
                <input type="text" value={shortName} onChange={e => setShortName(e.target.value)}
                  placeholder="V-Tech" className={inputCls}/>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-emerald-600/20 to-transparent`}>
              <Phone size={14} className="text-emerald-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Contact Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vtech.jbp@gmail.com"
                    className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Contact No.</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input type="text" value={contact} onChange={e => setContact(e.target.value)}
                    placeholder="9179105875"
                    className={`${inputCls} pl-9`}/>
                </div>
              </div>
              <div>
                <label className={labelCls}>Office Address</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-3.5 text-slate-600 pointer-events-none"/>
                  <textarea value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="F4, Hotel Plaza, Marhatal, Jabalpur - 482002"
                    rows={3} className={`${inputCls} pl-9 resize-none`}/>
                </div>
              </div>
            </div>
          </div>

          {/* GST Info */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-amber-600/20 to-transparent`}>
              <ShieldCheck size={14} className="text-amber-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">GST Information</h3>
            </div>
            <div className="p-5">
              <div>
                <label className={labelCls}>GSTIN</label>
                <input type="text" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5" maxLength={15}
                  className={`${inputCls} font-mono tracking-widest`}/>
                <p className="text-[10px] text-slate-700 mt-1">
                  GST Invoice print hone par yeh number dikhega।
                </p>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className={fieldsets}>
            <div className={`${fHdr} from-teal-600/20 to-transparent`}>
              <Clock size={14} className="text-teal-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Business Hours</h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Working Days</label>
                <input type="text" value={bizHours.days} onChange={e => setBizHours(b => ({ ...b, days: e.target.value }))}
                  placeholder="Mon-Sat" className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Open Time</label>
                <input type="time" value={bizHours.open} onChange={e => setBizHours(b => ({ ...b, open: e.target.value }))}
                  className={inputCls}/>
              </div>
              <div>
                <label className={labelCls}>Close Time</label>
                <input type="time" value={bizHours.close} onChange={e => setBizHours(b => ({ ...b, close: e.target.value }))}
                  className={inputCls}/>
              </div>
            </div>
          </div>

          {/* Preview card */}
          <div className="bg-[#0d1f35] border border-blue-500/20 rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-3">Preview — Bills & Reports mein aise dikhega</p>
            <div className="space-y-1">
              <p className="text-white font-black text-base">{name || "System Name"}</p>
              {shortName && <p className="text-blue-400 text-xs font-bold">{shortName}</p>}
              <p className="text-slate-400 text-xs">{address || "Address"}</p>
              <p className="text-slate-400 text-xs">
                {contact && <span>📞 {contact}</span>}
                {contact && email && <span className="mx-2">|</span>}
                {email && <span>✉ {email}</span>}
              </p>
              {gstin && <p className="text-amber-400 text-xs font-mono">GSTIN: {gstin}</p>}
            </div>
          </div>

          {/* Bottom save */}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30">
            {saving ? <><Loader2 size={16} className="animate-spin"/>Saving...</> : <><Save size={16}/> Update Settings</>}
          </button>

        </div>
      </form>
    </div>
  );
}