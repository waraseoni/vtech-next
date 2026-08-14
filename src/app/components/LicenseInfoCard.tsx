"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, Store, KeyRound, CalendarClock, CheckCircle2,
  AlertTriangle, ShieldX,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/license/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body && typeof body === "object") setLicense(body);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    </section>
  );
}
