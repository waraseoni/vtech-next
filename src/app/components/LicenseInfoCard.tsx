"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, Store, KeyRound, CalendarClock, CheckCircle2,
  AlertTriangle, ShieldX, Clock, User, Phone, MessageCircle, MapPin, Pencil,
} from "lucide-react";
import type { LicenseStatus } from "@/lib/license";
import { formatIST } from "@/lib/dateUtils";

const fmtExpiry = (d: string) =>
  formatIST(d, { day: "2-digit", month: "short", year: "numeric" });

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

export default function LicenseInfoCard() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [seller, setSeller] = useState<{ name?: string | null; phone?: string | null; whatsapp?: string | null; address?: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/license/status?force=true", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body && typeof body === "object") setLicense(body);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/license/seller-contact", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body && typeof body === "object") {
          setSeller(body);
          setForm({
            name: body.name || "",
            phone: body.phone || "",
            whatsapp: body.whatsapp || "",
            address: body.address || "",
          });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveSeller = async () => {
    setSaving(true);
    try {
      await fetch("/api/license/seller-contact", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSeller({ ...form });
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!license?.activated || !license.valid) return null;

  const dl = daysLeft(license.expiresAt ?? null);
  const expired = dl !== null && dl < 0;
  const soon = !expired && dl !== null && dl <= 30;

  const badge = dl === null
    ? { label: "Lifetime", cls: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10" }
    : expired
      ? { label: "Expired", cls: "text-red-400 border-red-500/25 bg-red-500/10" }
      : { label: `${dl} days left`, cls: soon ? "text-amber-400 border-amber-500/25 bg-amber-500/10" : "text-emerald-400 border-emerald-500/25 bg-emerald-500/10" };

  return (
    <section className={`rounded-3xl border p-4 md:p-5 ${expired ? "border-red-500/25 bg-red-500/[0.03]" : soon ? "border-amber-500/25 bg-amber-500/[0.03]" : "border-[#21293d] bg-[#161b27]"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            expired ? "bg-red-500/15 border border-red-500/25" : "bg-emerald-500/15 border border-emerald-500/25"
          }`}>
            {expired
              ? <ShieldX size={20} className="text-red-400" />
              : dl !== null && dl <= 30
                ? <AlertTriangle size={20} className="text-amber-400" />
                : <ShieldCheck size={20} className="text-emerald-400" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-white">License</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400 text-[9px] font-black uppercase tracking-wider">
                {license.plan || "standard"}
              </span>
              {license.valid && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                  <CheckCircle2 size={10} /> Active
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Store size={11} className="shrink-0 text-slate-600" />
                <span className="truncate font-bold text-slate-300">
                  {license.shopName || "—"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={11} className="shrink-0 text-slate-600" />
                <span className="font-mono font-bold text-slate-300">{license.keyMasked || "—"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={11} className="shrink-0 text-slate-600" />
                <span className="font-bold text-slate-300">
                  {license.expiresAt ? fmtExpiry(license.expiresAt) : "Lifetime"}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className={`shrink-0 px-3.5 py-2 rounded-2xl border text-center ${badge.cls}`}>
          <p className="text-sm font-black leading-none">{badge.label}</p>
        </div>
      </div>

      {/* ── Expiry Warning Banner ── */}
      {soon && dl !== null && license.expiresAt && (
        <div className="mt-3 flex items-start gap-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-3.5 py-3">
          <Clock size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            Aapka license <span className="font-black text-amber-300">{fmtExpiry(license.expiresAt)}</span> ko expire ho jayega.
            Krupaya samay rehte seller se sampark karein aur license renew karwayein taaki aapka system bina ruke chalta rahe.
          </p>
        </div>
      )}

      {/* ── Seller Contact Info ── */}
      {(seller?.name || seller?.phone || seller?.whatsapp || seller?.address || editing) && (
        <div className="mt-3 bg-blue-500/[0.04] border border-blue-500/15 rounded-xl px-3.5 py-3">
          {editing ? (
            <div className="space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70">Seller Contact Info</p>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Naam" className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500/50" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone Number" className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500/50" />
              <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="WhatsApp Number (country code ke saath)" className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500/50" />
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full px-3 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-200 outline-none focus:border-blue-500/50" />
              <div className="flex gap-2">
                <button onClick={saveSeller} disabled={saving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[11px] font-bold text-white transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400/70 mb-2">Seller Contact</p>
                {seller?.name && (
                  <div className="flex items-center gap-2">
                    <User size={11} className="text-slate-500" />
                    <span className="text-[11px] text-slate-300">{seller.name}</span>
                  </div>
                )}
                {seller?.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={11} className="text-slate-500" />
                    <span className="text-[11px] text-slate-300">{seller.address}</span>
                  </div>
                )}
                {seller?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={11} className="text-slate-500" />
                    <a href={`tel:${seller.phone}`} className="text-[11px] text-blue-400 hover:text-blue-300">{seller.phone}</a>
                  </div>
                )}
                {seller?.whatsapp && (
                  <div className="flex items-center gap-2">
                    <MessageCircle size={11} className="text-emerald-500" />
                    <a href={`https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-400 hover:text-emerald-300">
                      WhatsApp par message karein
                    </a>
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors shrink-0" title="Edit seller info">
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add seller info button (if none set yet) ── */}
      {!seller?.name && !seller?.phone && !seller?.whatsapp && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#21293d] text-[11px] font-bold text-slate-500 hover:text-slate-300 hover:border-slate-500/50 transition-all"
        >
          <Pencil size={11} /> Seller contact info add karein
        </button>
      )}
    </section>
  );
}
