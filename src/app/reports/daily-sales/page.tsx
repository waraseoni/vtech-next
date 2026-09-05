"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ShoppingCart,
  Package,
  ListChecks,
  IndianRupee,
  CalendarDays,
  User,
  PackageCheck,
} from "lucide-react";

import { todayIST, formatIST, parseISTDate } from "@/lib/dateUtils";

type SaleItem = {
  id: number;
  product_name: string;
  price: number;
  qty: number;
  transaction_code: string;
  client_name: string;
  date_updated: string;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtDateTime = (v: string) =>
  formatIST(v, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const fmtTime = (v: string) => formatIST(v, { hour: "2-digit", minute: "2-digit", hour12: true });

const statColors: Record<string, string> = {
  blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20",
  amber: "from-amber-500 to-amber-700 shadow-amber-500/20",
  violet: "from-violet-500 to-violet-700 shadow-violet-500/20",
};

function StatCard({
  icon,
  label,
  value,
  color = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
      <div
        className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 bg-gradient-to-br ${
          statColors[color] || statColors.blue
        } rounded-xl flex items-center justify-center text-white shadow-lg`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">
          {label}
        </p>
        <p className="text-sm sm:text-base font-black text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-500">
      <Loader2 size={22} className="animate-spin text-blue-400" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest">{label}</p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-slate-600">
      <PackageCheck size={24} className="text-slate-700" />
      <p className="mt-2 text-xs font-bold">{message}</p>
    </div>
  );
}

export default function DailySalesReportPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [date, setDate] = useState(todayIST());
  const [err, setErr] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // Step 1: Get transaction IDs for the selected date (filter on transaction_list.date_updated, exclude cancelled)
      // transaction_products has no date column — only transaction_id, product_id, qty, price
      const { data: txData, error: txErr } = await supabase
        .from("transaction_list")
        .select("id, code, client_name, status, date_updated")
        .gte("date_updated", date + "T00:00:00+05:30")
        .lte("date_updated", date + "T23:59:59+05:30")
        .neq("status", 4)
        .order("date_updated", { ascending: true });
      if (txErr) throw txErr;

      const txList = txData || [];
      if (txList.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const txIds = txList.map((t) => t.id);
      const txMap = new Map(txList.map((t) => [t.id, t]));

      // Step 2: Get products for those transactions
      const { data: tpData, error: tpErr } = await supabase
        .from("transaction_products")
        .select("transaction_id, product_id, price, qty")
        .in("transaction_id", txIds);
      if (tpErr) throw tpErr;

      const itemsData = tpData || [];
      if (itemsData.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Step 3: Get product names and client names
      const prodIds = [...new Set(itemsData.map((d) => d.product_id))];
      const { data: prodData } = await supabase
        .from("product_list")
        .select("id, name")
        .in("id", prodIds);
      const prodMap = new Map(prodData?.map((p) => [p.id, p]) || []);

      const clientIds = [...new Set(txList.map((t) => t.client_name).filter(Boolean))];
      const { data: clientData } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname")
        .in("id", clientIds);
      const clientMap = new Map(clientData?.map((c) => [c.id, c]) || []);

      const mapped = itemsData.map((item, i) => {
        const tx = txMap.get(item.transaction_id);
        const prod = prodMap.get(item.product_id);
        const client = clientMap.get(tx?.client_name);
        return {
          id: i,
          product_name: prod?.name || "Unknown",
          price: item.price,
          qty: item.qty,
          transaction_code: tx?.code || "",
          client_name: client
            ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
            : "Walk-in",
          date_updated: tx?.date_updated || "",
        };
      }) as SaleItem[];

      setItems(mapped);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totals = {
    count: items.length,
    qty: items.reduce((s, i) => s + (i.qty || 0), 0),
    amount: items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0),
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
    popup.document.write(`<html><head><title>Daily Sales Report - ${fmtDate(date)}</title>
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
    setTimeout(() => {
      popup.print();
      setTimeout(() => popup.close(), 300);
    }, 300);
  };

  return (
    <AdminPage>
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                Daily Sales Report
              </h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5 truncate">
                Product-wise daily sales
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={loading || items.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 shrink-0 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-blue-500/40 hover:bg-[#151b28] disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            <Printer size={14} /> Print
          </button>
        </div>

        {/* Date navigation */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => shiftDay(-1)}
              title="Previous day"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 transition"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2">
              <Calendar size={14} className="text-blue-400/70 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-200 outline-none [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => shiftDay(1)}
              title="Next day"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 transition"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setDate(todayIST())}
              className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition"
            >
              Today
            </button>
          </div>
          <span className="text-xs font-black text-amber-400/90 tracking-wide ml-auto">
            {fmtDate(date)}
          </span>
        </div>

        {err && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {err}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={<Package size={18} />}
            label="Items Sold"
            value={totals.count}
            color="blue"
          />
          <StatCard
            icon={<ListChecks size={18} />}
            label="Total Qty"
            value={totals.qty}
            color="amber"
          />
          <StatCard
            icon={<IndianRupee size={18} />}
            label="Total Amount"
            value={inr(totals.amount)}
            color="emerald"
          />
          <StatCard
            icon={<CalendarDays size={18} />}
            label="Report Date"
            value={fmtDate(date)}
            color="violet"
          />
        </div>

        {/* Desktop table (inside print area) */}
        <div id="print-area" className="hidden md:block">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="subtitle text-sm">Daily Sales Report — {fmtDate(date)}</p>
          </div>
          {loading ? (
            <LoadingBlock label="Loading sales..." />
          ) : items.length === 0 ? (
            <EmptyBlock message="No sales found for this date." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#21293d]">
              <div className="overflow-auto max-h-[calc(100vh-340px)]">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="sticky top-0 z-10 bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="text-left px-4 py-3.5">#</th>
                      <th className="text-left px-4 py-3.5">Date & Time</th>
                      <th className="text-left px-4 py-3.5">Bill / Client</th>
                      <th className="text-left px-4 py-3.5">Product</th>
                      <th className="text-right px-4 py-3.5">Rate</th>
                      <th className="text-right px-4 py-3.5">Qty</th>
                      <th className="text-right px-4 py-3.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {items.map((item, i) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {fmtDateTime(item.date_updated)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black text-blue-400">{item.transaction_code}</div>
                          <div className="text-xs text-slate-500">Client: {item.client_name}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-100">{item.product_name}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{inr(item.price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-200">
                          {item.qty}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-400">
                          {inr(item.price * item.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-4 py-3 text-right" colSpan={4}>
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-slate-400">—</th>
                      <th className="px-4 py-3 text-right text-slate-200">{totals.qty}</th>
                      <th className="px-4 py-3 text-right text-emerald-400">
                        {inr(totals.amount)}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden">
          {loading ? (
            <LoadingBlock label="Loading sales..." />
          ) : items.length === 0 ? (
            <EmptyBlock message="No sales found for this date." />
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={item.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-100 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-[10px] font-bold text-blue-400 mt-0.5">
                        #{i + 1} · {item.transaction_code || "—"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-emerald-400">
                      {inr(item.price * item.qty)}
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#1a2234] space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                        <User size={11} className="text-blue-300/70 shrink-0" />
                        <span className="truncate">{item.client_name}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                        <CalendarDays size={11} className="text-slate-600" />
                        {fmtTime(item.date_updated)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">
                        Qty <span className="text-slate-100 font-bold">{item.qty}</span>
                      </span>
                      <span className="text-slate-500">
                        Rate <span className="text-slate-200 font-bold">{inr(item.price)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
