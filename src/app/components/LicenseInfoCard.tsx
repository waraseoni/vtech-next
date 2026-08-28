"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Store,
  KeyRound,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ShieldX,
  Clock,
  User,
  Phone,
  MessageCircle,
  MapPin,
  Mail,
  ChevronDown,
} from "lucide-react";
import type { LicenseStatus } from "@/lib/license";
import { SELLER_INFO } from "@/lib/seller-info";
import { formatIST } from "@/lib/dateUtils";

const fmtExpiry = (d: string) => formatIST(d, { day: "2-digit", month: "short", year: "numeric" });

function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

export default function LicenseInfoCard() {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/license/status?force=true", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body && typeof body === "object") {
          setLicense(body);
          const exp = body.expiresAt;
          if (exp) {
            const days = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
            if (days >= 0 && days <= 30) setContactOpen(true);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!license?.activated || !license.valid) return null;

  const dl = daysLeft(license.expiresAt ?? null);
  const expired = dl !== null && dl < 0;
  const soon = !expired && dl !== null && dl <= 30;

  const badge =
    dl === null
      ? { label: "Lifetime", cls: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10" }
      : expired
        ? { label: "Expired", cls: "text-red-400 border-red-500/25 bg-red-500/10" }
        : {
            label: `${dl} days left`,
            cls: soon
              ? "text-amber-400 border-amber-500/25 bg-amber-500/10"
              : "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
          };

  return (
    <section
      className={`rounded-3xl border p-4 md:p-5 ${expired ? "border-red-500/25 bg-red-500/[0.03]" : soon ? "border-amber-500/25 bg-amber-500/[0.03]" : "border-slate-200 dark:border-[#21293d] bg-slate-50 dark:bg-[#161b27]"}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              expired
                ? "bg-red-500/15 border border-red-500/25"
                : "bg-emerald-500/15 border border-emerald-500/25"
            }`}
          >
            {expired ? (
              <ShieldX size={20} className="text-red-400" />
            ) : dl !== null && dl <= 30 ? (
              <AlertTriangle size={20} className="text-amber-400" />
            ) : (
              <ShieldCheck size={20} className="text-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-slate-900 dark:text-white">License</p>
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
                <span className="truncate font-bold text-slate-700 dark:text-slate-300">
                  {license.shopName || "—"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={11} className="shrink-0 text-slate-600" />
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  {license.keyMasked || "—"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={11} className="shrink-0 text-slate-600" />
                <span className="font-bold text-slate-700 dark:text-slate-300">
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
          <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
            Aapka license{" "}
            <span className="font-black text-amber-700 dark:text-amber-300">
              {fmtExpiry(license.expiresAt)}
            </span>{" "}
            ko expire ho jayega. Krupaya samay rehte seller se sampark karein aur license renew
            karwayein taaki aapka system bina ruke chalta rahe.
          </p>
        </div>
      )}

      {/* ── Seller Contact (collapsible) ── */}
      <button
        type="button"
        onClick={() => setContactOpen(!contactOpen)}
        className="mt-3 w-full flex items-center justify-between gap-2 bg-blue-500/[0.04] border border-blue-500/15 rounded-xl px-3.5 py-2.5 hover:bg-blue-500/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Phone size={11} className="text-blue-400 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
            {SELLER_INFO.name}
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">·</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">{SELLER_INFO.phone}</span>
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-500 shrink-0 transition-transform ${contactOpen ? "rotate-180" : ""}`}
        />
      </button>
      {contactOpen && (
        <div className="mt-1.5 bg-slate-100 dark:bg-[#0f1a2e] border border-blue-500/10 rounded-xl px-3.5 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <User size={11} className="text-slate-500" />
            <span className="text-[11px] text-slate-700 dark:text-slate-300">
              {SELLER_INFO.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={11} className="text-slate-500" />
            <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
              {SELLER_INFO.address}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={11} className="text-slate-500" />
            <a
              href={`tel:${SELLER_INFO.phone}`}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              {SELLER_INFO.phone}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle size={11} className="text-emerald-500" />
            <a
              href={`https://wa.me/${SELLER_INFO.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-400 hover:text-emerald-300"
            >
              WhatsApp
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={11} className="text-slate-500" />
            <a
              href={`mailto:${SELLER_INFO.email}`}
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              {SELLER_INFO.email}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
