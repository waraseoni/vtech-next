"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell, ChevronDown, ChevronRight, RefreshCw, Loader2,
  AlertTriangle, PackageX, CalendarClock, UserCheck, Wallet, Sparkles, X,
} from "lucide-react";

type NotificationItem = {
  name?: string;
  firstname?: string;
  lastname?: string;
  job_id?: string;
  item?: string;
  product_id?: number;
  mechanic_id?: number;
  client_id?: number;
  loan_id?: number;
  quantity?: number;
  alert_quantity?: number;
  days_pending?: number;
  outstanding?: number;
  due_date?: string;
  contact?: string;
  opening_balance?: number;
  total_payable?: number;
};

type AlertGroup = { type: string; severity: string; title: string; items: NotificationItem[] };
type AlertsResponse = { count: number; alerts: AlertGroup[]; note?: string; generated_at?: string };

const STORAGE_KEY = "vtech_ai_alerts_hidden";

const GROUP_ICON: Record<string, { icon: typeof PackageX; color: string }> = {
  low_stock: { icon: PackageX, color: "text-amber-400" },
  pending_jobs: { icon: CalendarClock, color: "text-sky-400" },
  attendance_missing: { icon: UserCheck, color: "text-cyan-400" },
  high_outstanding: { icon: Wallet, color: "text-violet-400" },
  active_loans: { icon: Wallet, color: "text-fuchsia-400" },
  due_payment_date: { icon: AlertTriangle, color: "text-red-400" },
};

export default function AIAlertsWidget() {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1"
  );
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/ai/alerts");
      if (!res.ok) throw new Error("unauthorized");
      const body = await res.json();
      const alerts = body?.alerts?.alerts;
      setData(alerts ? { ...body.alerts } : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dismissed) return;
    load();
  }, [dismissed, load]);

  const hide = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* storage unavailable */ }
    setDismissed(true);
  };

  const show = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
    setDismissed(false);
    setOpen(true);
    load();
  };

  // Hidden — slim pill se wapas dikhaya ja sakta hai
  if (dismissed) {
    return (
      <button onClick={show}
        className="flex items-center gap-2 self-start bg-[#161b27] border border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-blue-400 px-3 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all">
        <Bell size={14} /> AI Alerts <ChevronRight size={12} />
      </button>
    );
  }

  if (loading) return null;
  if (error) return null;
  if (!data || !data.alerts || data.alerts.length === 0) return null;

  const totalItems = data.alerts.reduce((s, g) => s + (g.items?.length || 0), 0);
  const hasWarn = data.alerts.some((a) => a.severity === "warning");

  return (
    <section className={`rounded-3xl border overflow-hidden ${hasWarn ? "border-amber-500/25 bg-amber-500/[0.03]" : "border-sky-500/25 bg-sky-500/[0.03]"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button onClick={() => setOpen(v => !v)} className="flex-1 flex items-center gap-3 text-left">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl border flex items-center justify-center bg-[#161b27] border-[#21293d]">
              <Bell size={16} className={hasWarn ? "text-amber-400" : "text-sky-400"} />
            </div>
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
              {totalItems}
            </span>
          </div>
          <div>
            <p className="text-sm font-black text-white flex items-center gap-2">
              AI Alerts
              <Sparkles size={12} className="text-blue-400" />
            </p>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{data.count} groups · fresh</p>
          </div>
          <ChevronDown size={16} className={`ml-auto text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button onClick={load} title="Refresh"
          className="w-8 h-8 bg-[#161b27] border border-[#21293d] hover:border-slate-600 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-all">
          <RefreshCw size={13} />
        </button>
        <Link href="/ai" title="AI Sahayak"
          className="w-8 h-8 bg-blue-600/15 border border-blue-500/25 hover:bg-blue-600/25 rounded-xl flex items-center justify-center text-blue-400 transition-all">
          <Sparkles size={13} />
        </Link>
        <button onClick={hide} title="Hide"
          className="w-8 h-8 bg-[#161b27] border border-[#21293d] hover:border-red-500/40 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 transition-all">
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      {open && (
        <div className="px-5 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto">
          {data.alerts.map((group, gi) => {
            const meta = GROUP_ICON[group.type] || { icon: AlertTriangle, color: "text-slate-400" };
            const Icon = meta.icon;
            const isWarn = group.severity === "warning";
            return (
              <div key={gi} className="rounded-2xl bg-[#111520] border border-[#21293d] p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className={meta.color} />
                  <span className="text-xs font-bold text-slate-200">{group.title}</span>
                  <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    isWarn ? "text-amber-400 border-amber-500/20 bg-amber-500/10" : "text-sky-400 border-sky-500/20 bg-sky-500/10"
                  }`}>{group.items.length}</span>
                </div>
                <div className="space-y-1">
                  {group.items.slice(0, 5).map((it, ii) => {
                    const label = it.name || `${it.firstname || ""} ${it.lastname || ""}`.trim() || it.job_id || it.item || `#${it.product_id || it.mechanic_id || it.client_id || it.loan_id || ""}`;
                    const sub = it.quantity !== undefined
                      ? `Qty ${it.quantity} (alert ${it.alert_quantity})`
                      : it.days_pending !== undefined ? `${it.days_pending}d`
                      : it.outstanding !== undefined ? `₹${Number(it.outstanding).toLocaleString("en-IN")}`
                      : it.due_date || it.contact
                      || (it.opening_balance !== undefined ? `₹${Number(it.opening_balance).toLocaleString("en-IN")}` : "")
                      || (it.total_payable !== undefined ? `₹${Number(it.total_payable).toLocaleString("en-IN")}` : "");
                    return (
                      <div key={ii} className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="truncate">{label}</span>
                        {sub && <span className="shrink-0 font-bold text-slate-500">{sub}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {data.note && (
            <p className="lg:col-span-2 text-[10px] text-slate-600 font-bold italic">{data.note}</p>
          )}

          <Link href="/ai" className="lg:col-span-2 flex items-center justify-center gap-2 bg-[#161b27] border border-[#21293d] hover:border-blue-500/30 text-slate-400 hover:text-blue-400 rounded-xl py-2.5 text-[11px] font-extrabold uppercase tracking-wider transition-all no-underline">
            AI Sahayak me baat karein <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Loading overlay for refresh */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-blue-400" />
        </div>
      )}
    </section>
  );
}
