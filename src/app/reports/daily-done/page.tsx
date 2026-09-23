"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Loader2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckSquare,
  Wrench,
  Clock,
  Package,
  ListChecks,
  IndianRupee,
  Eye,
  FileText,
  MessageCircle,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { todayIST, formatIST, parseISTDate } from "@/lib/dateUtils";
import { JOB_STATUS } from "@/lib/status-colors";
import { openImageLightbox } from "@/components/ImageLightbox";
import { safeImageSrc } from "@/lib/image-utils";
import { resolveTemplate, substituteTemplate, firmVars } from "@/lib/whatsapp";
import { toast } from "@/lib/toast";

type DailyDoneItem = {
  id: string;
  done_at: string;
  transaction_id: string;
  job_id: string;
  code: string;
  item: string;
  amount: number;
  remark: string;
  status: number;
  delivered_at: string | null;
  client_id: string;
  client_name: string;
  client_contact: string;
  client_image: string | null;
  mechanic_name: string;
  mechanic_image: string | null;
};

type Mechanic = {
  id: string;
  name: string;
  image: string | null;
};

// activity_logs se resolve hui transaction_list row (sirf jo fields use hote hain)
type TxnRow = {
  id: number | string;
  job_id?: string | number | null;
  client_name?: string | number | null;
  mechanic_id?: number | string | null;
  code?: string | null;
  item?: string | null;
  amount?: number | string | null;
  remark?: string | null;
  status: number;
  date_completed?: string | null;
};

const mechInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const MechAvatar = ({
  image,
  name,
  cls = "w-6 h-6 text-[9px]",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) =>
  image ? (
    <Image
      src={image}
      alt={name}
      width={24}
      height={24}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-blue-500/20 shadow-sm cursor-zoom-in`}
      onDoubleClick={() => openImageLightbox(image, name)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0 shadow-inner`}
    >
      {mechInitials(name)}
    </div>
  );

const clientInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const ClientAvatar = ({
  image,
  name,
  cls = "w-8 h-8 text-xs",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) => {
  const src = safeImageSrc(image);
  return src ? (
    <Image
      src={src}
      alt={name}
      width={32}
      height={32}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-violet-500/20 shadow-sm cursor-zoom-in`}
      onDoubleClick={() => openImageLightbox(src, name)}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-violet-500/30 rounded-full flex items-center justify-center font-bold text-violet-400 flex-shrink-0 shadow-inner`}
    >
      {clientInitials(name)}
    </div>
  );
};

const statusMap: Record<number, { label: string; color: string }> = Object.fromEntries(
  Object.entries(JOB_STATUS).map(([k, v]) => [Number(k), { label: v.label, color: v.cls }])
);

// ─── Dual-era status-log helpers ─────────────────────────────────────────────
// Sanam ka "done" tab hota hai jab status-change log me transition "→ Done"
// dikha — chahe us dinn kuch bhi ho. Dono yug ke log formats handle karte hain:
//   legacy (PHP):  "Job #28957 | Pending → Done | ..."        (module Transactions)
//   modern (Next): "Status changed to: Done"                   (module Jobs)
// Date/Time Display Rule (DATA_MIGRATION_NOTES):
//   - done-time log se derive karo (date_updated kabhi nahi)
//   - legacy meta_id = transaction_list.id, modern = id (fallback job_id)
const DONE_LABELS = new Set(["done", "ready"]);
const STATUS_LABEL_RE = /(?:→|->)\s*(done|ready|on-progress|pending|paid|cancelled|delivered)/i;
const parseDoneTransition = (details?: string | null): boolean => {
  if (!details) return false;
  const direct = details.match(/Status changed to:\s*([A-Za-z][A-Za-z\s-]*)/i);
  if (direct) return DONE_LABELS.has(direct[1].trim().toLowerCase());
  const arrowMatch = details.match(STATUS_LABEL_RE);
  if (arrowMatch) return DONE_LABELS.has(arrowMatch[1].toLowerCase());
  return false;
};

const STATUS_WA_KEY: Record<number, string> = {
  0: "whatsapp_status_pending",
  1: "whatsapp_status_repairing",
  2: "whatsapp_status_ready",
  3: "whatsapp_status_delivered",
  4: "whatsapp_status_cancelled",
  5: "whatsapp_status_delivered",
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const inrShort = (n: number) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");
const fmtDate = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtTime = (v: string) => formatIST(v, { hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDateTime = (v: string) =>
  formatIST(v, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

const sendDoneWA = (item: DailyDoneItem, firmInfo: Record<string, string>) => {
  const phone = (item.client_contact || "").replace(/\D/g, "");
  if (phone.length < 10) {
    toast.error("Valid mobile number nahi mila!");
    return;
  }
  const amt = (item.amount || 0).toLocaleString("en-IN");
  const key = STATUS_WA_KEY[item.status] || "whatsapp_status_pending";
  const tpl = resolveTemplate(firmInfo, key);
  const msg = substituteTemplate(tpl, {
    client_name: item.client_name,
    item: item.item,
    job_id: item.job_id,
    code: item.code,
    amount: amt,
    ...firmVars(firmInfo),
  });
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
};

export default function DailyDoneReportPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DailyDoneItem[]>([]);
  const [date, setDate] = useState(todayIST());
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedMechanic, setSelectedMechanic] = useState<string>("all");
  const [err, setErr] = useState("");
  const [firmInfo, setFirmInfo] = useState<Record<string, string>>({});

  const fetchMechanics = async () => {
    try {
      const { data, error } = await supabase
        .from("mechanic_list")
        .select("id, firstname, lastname, image_path")
        .eq("status", 1)
        .order("firstname");
      if (error) throw error;
      if (data) {
        setMechanics(
          data.map((m) => ({
            id: m.id.toString(),
            name: `${m.firstname} ${m.lastname}`.trim(),
            image: m.image_path || null,
          }))
        );
      }
    } catch (e) {
      console.error("Error fetching mechanics:", e);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const dayStart = date + "T00:00:00+05:30";
      const dayEnd = date + "T23:59:59+05:30";

      // 1) Dono yug ke status-change logs is din ke — done = "→ Done" transition.
      //    (meta_id: legacy → transaction_list.id, modern → id/job_id)
      const eraConfigs = [
        { module: "Transactions", action: "Transaction Status Changed" },
        { module: "Jobs", action: "Updated Job Status" },
      ];
      const doneLogs: Array<{ meta_id: string; date_created: string }> = [];
      for (const era of eraConfigs) {
        const { data: logs, error } = await supabase
          .from("activity_logs")
          .select("meta_id, details, date_created")
          .eq("module", era.module)
          .eq("action", era.action)
          .gte("date_created", dayStart)
          .lte("date_created", dayEnd);
        if (error) throw error;
        for (const log of logs || []) {
          if (parseDoneTransition(log.details) && log.meta_id) {
            doneLogs.push({ meta_id: String(log.meta_id), date_created: log.date_created });
          }
        }
      }
      if (doneLogs.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // meta_id → us din ka earliest done-log time
      const doneTimeByMeta = new Map<string, string>();
      for (const log of doneLogs) {
        const cur = doneTimeByMeta.get(log.meta_id);
        if (!cur || log.date_created < cur) doneTimeByMeta.set(log.meta_id, log.date_created);
      }

      // 2) Meta ids ko transaction_list par resolve karo — id pehla, job_id fallback.
      const metaIds = [...doneTimeByMeta.keys()];
      const txnById = await supabase
        .from("transaction_list")
        .select("*")
        .in("status", [2, 3, 5])
        .in("id", metaIds);
      if (txnById.error) throw txnById.error;
      const txnByJob = await supabase
        .from("transaction_list")
        .select("*")
        .in("status", [2, 3, 5])
        .in("job_id", metaIds);
      if (txnByJob.error) throw txnByJob.error;

      const seen = new Set<string>();
      const doneMap = new Map<string, { txn: TxnRow; doneAt: string }>();
      const rows = [...(txnById.data || []), ...(txnByJob.data || [])] as TxnRow[];
      for (const row of rows) {
        const key = String(row.id);
        if (seen.has(key)) continue;
        seen.add(key);
        // Lookup pehle txn.id (canonical), phir txn.job_id
        const doneAt =
          doneTimeByMeta.get(String(row.id)) || doneTimeByMeta.get(String(row.job_id));
        if (!doneAt) continue;
        doneMap.set(key, { txn: row, doneAt });
      }

      let uniqueTransactions = [...doneMap.values()];
      if (selectedMechanic !== "all") {
        uniqueTransactions = uniqueTransactions.filter(
          (e) => String(e.txn.mechanic_id) === selectedMechanic
        );
      }
      uniqueTransactions.sort((a, b) => a.doneAt.localeCompare(b.doneAt));

      if (uniqueTransactions.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const clientIds = [...new Set(uniqueTransactions.map((e) => e.txn.client_name).filter(Boolean))];
      const { data: clientData } = await supabase
        .from("client_list")
        .select("id, firstname, lastname, image_path, contact")
        .in("id", clientIds);
      const clientMap = new Map(clientData?.map((c) => [c.id.toString(), c]) || []);

      const mechIds = [...new Set(uniqueTransactions.map((e) => e.txn.mechanic_id).filter(Boolean))];
      const { data: mechData } = await supabase
        .from("mechanic_list")
        .select("id, firstname, lastname, image_path")
        .in("id", mechIds);
      const mechMap = new Map(mechData?.map((m) => [m.id.toString(), m]) || []);

      const mapped: DailyDoneItem[] = uniqueTransactions.map(({ txn: tx, doneAt }) => {
        const client = clientMap.get(tx.client_name?.toString() || "");
        const mech = mechMap.get(tx.mechanic_id?.toString() || "");
        return {
          id: tx.id.toString(),
          done_at: doneAt,
          transaction_id: tx.id.toString(),
          job_id: tx.job_id ? String(tx.job_id) : "-",
          code: tx.code || "-",
          item: tx.item || "-",
          amount: Number(tx.amount) || 0,
          remark: tx.remark || "",
          status: tx.status,
          delivered_at: tx.date_completed || null,
          client_id: client?.id?.toString() || "",
          client_name: client ? `${client.firstname} ${client.lastname}`.trim() : "Unknown",
          client_contact: client?.contact || "",
          client_image: client?.image_path || null,
          mechanic_name: mech ? `${mech.firstname} ${mech.lastname}`.trim() : "Not Assigned",
          mechanic_image: mech?.image_path || null,
        };
      });

      setItems(mapped);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [date, selectedMechanic]);

  useEffect(() => { fetchMechanics(); }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => { info[r.meta_field] = r.meta_value; });
      setFirmInfo(info);
    })();
  }, []);

  const totals = {
    count: items.length,
    amount: items.reduce((s, i) => s + (i.amount || 0), 0),
    uniqueMechanics: new Set(items.map((i) => i.mechanic_name)).size,
    uniqueClients: new Set(items.map((i) => i.client_name)).size,
  };

  const shiftDay = (diff: number) => {
    const d = parseISTDate(date);
    d.setDate(d.getDate() + diff);
    setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d));
  };

  const handlePrint = () => {
    const printContent = document.getElementById("print-area")?.innerHTML;
    if (!printContent) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    popup.document.write(`<html><head><title>Daily Done Report - ${fmtDate(date)}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111827}
        h2{text-align:center;margin-bottom:4px} .subtitle{text-align:center;color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #ddd;padding:8px;font-size:13px}
        th{background:#f1f5f9;text-align:left;font-weight:600}
        .text-right{text-align:right}.text-center{text-align:center}
        tfoot th{background:#f1f5f9;text-align:right;font-size:14px}
        @media print{body{padding:0}}
      </style></head><body>${printContent}</body></html>`);
    popup.document.close();
    setTimeout(() => { popup.print(); setTimeout(() => popup.close(), 300); }, 300);
  };

  return (
    <AdminPage allowStaff>
      <div className="space-y-3.5 w-full max-w-[1550px] mx-auto pb-12 px-2 sm:px-3 lg:px-4">
        {/* Top Header Card */}
        <div className="bg-panel border border-app rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 border border-white/10 flex-shrink-0">
              <ListChecks size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Daily Done Report
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  {fmtDate(date)}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted font-medium">
                Jobs marked Done on this day (delivery kabhi bhi ho sakti hai)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Link
              href="/reports/delivered"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-app hover:bg-panel-2 border border-app rounded-xl text-[11px] font-bold text-app-2 hover:text-white transition-all shadow-sm active:scale-95 no-underline"
            >
              <Package size={12} /> Delivered
            </Link>
            <button
              onClick={handlePrint}
              className="p-1.5 bg-app hover:bg-panel-2 border border-app rounded-xl text-muted hover:text-white transition-all flex-shrink-0"
              title="Print Report"
            >
              <Printer size={13} />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between text-muted mb-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Done Jobs</span>
              <CheckSquare size={13} className="text-teal-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-white tracking-tight">{totals.count}</p>
            <p className="text-[9px] text-muted">{totals.uniqueMechanics} mechanics</p>
          </div>
          <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between text-muted mb-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Total Value</span>
              <IndianRupee size={13} className="text-emerald-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-emerald-400 tracking-tight">{inrShort(totals.amount)}</p>
            <p className="text-[9px] text-muted">Billable amount</p>
          </div>
          <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between text-muted mb-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Clients</span>
              <Wrench size={13} className="text-blue-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-white tracking-tight">{totals.uniqueClients}</p>
            <p className="text-[9px] text-muted">Unique clients</p>
          </div>
          <div className="bg-panel border border-app rounded-xl p-2.5 sm:p-3 shadow-sm">
            <div className="flex items-center justify-between text-muted mb-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Avg Bill</span>
              <IndianRupee size={13} className="text-amber-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-300 tracking-tight">
              {totals.count > 0 ? inrShort(totals.amount / totals.count) : "₹0"}
            </p>
            <p className="text-[9px] text-muted">Per job</p>
          </div>
        </div>

        {/* Date & Mechanic Toolbar */}
        <div className="bg-panel border border-app rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between sm:justify-start gap-1 bg-app p-1 rounded-xl border border-app">
            <button
              onClick={() => shiftDay(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-0.5 relative">
              <Calendar size={13} className="text-blue-400 flex-shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer [color-scheme:dark] min-w-[110px]"
              />
            </div>
            <button
              onClick={() => shiftDay(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              <ChevronRight size={15} />
            </button>
            {date !== todayIST() && (
              <button
                onClick={() => setDate(todayIST())}
                className="ml-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500 hover:text-white transition-all"
              >
                Today
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:flex-initial sm:w-48">
              <Wrench size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <select
                value={selectedMechanic}
                onChange={(e) => setSelectedMechanic(e.target.value)}
                className="w-full pl-7 pr-6 py-1 bg-app border border-app rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500/60 transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Mechanics</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {err && (
          <div className="px-4 py-2.5 bg-rose-950/50 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold">
            {err}
          </div>
        )}

        <div id="print-area">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="text-sm text-gray-600">Daily Done Transactions Report — {fmtDate(date)}</p>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-panel border border-app rounded-2xl overflow-hidden shadow-lg w-full">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-app border-b border-app text-[10px] font-bold uppercase text-muted tracking-wider select-none">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">Done Time</th>
                    <th className="py-2.5 px-3">Job ID & Status</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Item / Remark</th>
                    <th className="py-2.5 px-3">Mechanic</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]/50">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="py-3 px-3">
                          <div className="h-3 bg-slate-800/60 rounded-full w-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 px-3 text-center">
                        <div className="max-w-xs mx-auto text-center space-y-1.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-muted">
                            <CheckSquare size={15} />
                          </div>
                          <p className="text-white font-bold text-xs">No done jobs found</p>
                          <p className="text-muted text-[10px]">Try selecting a different date or mechanic.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, i) => {
                      const statusConfig = statusMap[item.status] || {
                        label: "Unknown",
                        color: "text-muted bg-muted/10 border-muted/20",
                      };
                      return (
                        <tr key={item.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                          <td className="py-2 px-3 text-center text-muted font-bold text-[10px]">{i + 1}</td>
                          <td className="py-2 px-3">
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-app border border-app rounded-lg text-[10px] font-bold text-app-2">
                              <Clock size={10} className="text-teal-500" />
                              {fmtTime(item.done_at)}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Link href={`/jobs/${item.transaction_id}/view`} className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                              #{item.job_id}
                            </Link>
                            <span className={`ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                            {item.status === 5 && item.delivered_at && (
                              <p className="text-[9px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                                <Clock size={9} /> {fmtDateTime(item.delivered_at)}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ClientAvatar image={item.client_image} name={item.client_name} cls="w-7 h-7 text-[10px]" />
                              <div className="min-w-0">
                                <Link href={`/clients/${item.client_id}/view`} className="text-white font-bold hover:text-blue-400 transition-colors block truncate max-w-[120px] text-[11px]">
                                  {item.client_name}
                                </Link>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {item.client_contact ? (
                                    <>
                                      <a href={`tel:${item.client_contact.replace(/\D/g, "")}`} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold truncate max-w-[90px]">
                                        {item.client_contact}
                                      </a>
                                      <a href={`tel:${item.client_contact.replace(/\D/g, "")}`} className="p-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-md text-emerald-400 transition-all" title="Call">
                                        <Phone size={9} />
                                      </a>
                                      <button onClick={() => sendDoneWA(item, firmInfo)} className="p-0.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-md text-green-400 transition-all" title="WhatsApp">
                                        <MessageCircle size={9} />
                                      </button>
                                    </>
                                  ) : (
                                    <p className="text-[10px] text-muted font-medium">—</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <p className="text-[11px] text-app-2 truncate max-w-[160px]">{item.item}</p>
                            <p className="text-[10px] text-muted italic truncate max-w-[160px]">{item.remark || "—"}</p>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MechAvatar image={item.mechanic_image} name={item.mechanic_name} cls="w-5 h-5 text-[9px]" />
                              <span className="text-[10px] text-blue-400 font-bold truncate max-w-[100px]">{item.mechanic_name}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-black text-emerald-400 text-xs">{inr(item.amount)}</td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link href={`/jobs/${item.transaction_id}/view`} className="p-1 text-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all" title="View Job">
                                <Eye size={11} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && items.length > 0 && (
                  <tfoot>
                    <tr className="bg-app border-t border-app font-bold text-xs">
                      <td colSpan={6} className="py-2 px-3 text-right uppercase tracking-wider text-muted text-[10px]">
                        Total ({totals.count} jobs):
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-black">{inr(totals.amount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-panel border border-app rounded-2xl p-4 animate-pulse space-y-3">
                  <div className="h-5 bg-slate-800/60 rounded-full w-1/2"></div>
                  <div className="h-14 bg-slate-800/40 rounded-xl w-full"></div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="bg-panel border border-app rounded-2xl p-8 text-center space-y-2">
                <CheckSquare size={20} className="text-muted mx-auto" />
                <p className="text-white font-bold text-xs">No done jobs found</p>
                <p className="text-muted text-[11px]">Try selecting a different date or mechanic.</p>
              </div>
            ) : (
              items.map((item) => {
                const statusConfig = statusMap[item.status] || {
                  label: "Unknown",
                  color: "text-muted bg-muted/10 border-muted/20",
                };
                return (
                  <div key={item.id} className="bg-panel border border-app rounded-2xl p-3.5 shadow-md space-y-3 hover:border-muted transition-all">
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <ClientAvatar image={item.client_image} name={item.client_name} cls="w-10 h-10 text-xs" />
                        <div className="min-w-0">
                          <Link href={`/clients/${item.client_id}/view`} className="text-white font-black text-sm hover:text-blue-400 transition-colors truncate block">
                            {item.client_name}
                          </Link>
                          <div className="flex items-center gap-1 mt-0.5">
                            {item.client_contact ? (
                              <>
                                <a href={`tel:${item.client_contact.replace(/\D/g, "")}`} className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold truncate">
                                  <Phone size={9} className="flex-shrink-0" />
                                  <span className="truncate">{item.client_contact}</span>
                                </a>
                                <button
                                  onClick={() => sendDoneWA(item, firmInfo)}
                                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-md text-green-400 transition-all"
                                  title="WhatsApp status"
                                >
                                  <MessageCircle size={9} />
                                </button>
                              </>
                            ) : (
                              <p className="text-[10px] text-muted font-medium">—</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="text-[11px] leading-none">
                          <Link href={`/jobs/${item.transaction_id}/view`} className="inline-block text-blue-400 font-black hover:text-blue-300">
                            #{item.job_id}
                          </Link>
                          {item.code !== "-" && (
                            <span className="text-[9px] text-muted font-bold ml-1">{item.code}</span>
                          )}
                        </p>
                        <span className={`inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        <p className="text-[9px] font-bold text-muted flex items-center gap-1 justify-end">
                          <Clock size={9} />
                          {item.status === 5 && item.delivered_at ? fmtDateTime(item.delivered_at) : fmtTime(item.done_at)}
                        </p>
                      </div>
                    </div>

                    {/* Inner Box - 4 Corners */}
                    <div className="bg-app p-3 rounded-xl border border-app/80">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Mechanic</span>
                          <div className="flex items-center gap-1.5">
                            <MechAvatar image={item.mechanic_image} name={item.mechanic_name} cls="w-5 h-5 text-[8px]" />
                            <p className="font-bold text-blue-400 text-[11px] truncate max-w-[80px]">{item.mechanic_name}</p>
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Item</span>
                          <p className="font-bold text-app-2 text-[11px] truncate">{item.item}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Remark</span>
                          <p className="font-bold text-muted text-[11px] truncate">{item.remark || "—"}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Amount</span>
                          <p className="font-black text-emerald-400 text-xs">{inr(item.amount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
