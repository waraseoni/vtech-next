"use client";
import { useState, useEffect, useCallback, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import {
  Loader2,
  Printer,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Package,
  ListChecks,
  IndianRupee,
  User,
  CalendarDays,
  PackageCheck,
} from "lucide-react";

import { currentMonthIST, parseISTDate, formatIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDay = (v: string) =>
  formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statColors: Record<string, string> = {
  blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
  emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20",
  amber: "from-amber-500 to-amber-700 shadow-amber-500/20",
  violet: "from-violet-500 to-violet-700 shadow-violet-500/20",
};

type SaleRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  product_name: string;
  price: number;
  qty: number;
  total: number;
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

function MonthlySalesContent() {
  const searchParams = useSearchParams();

  const currentMonth = currentMonthIST();
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SaleRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${month}-01T00:00:00+05:30`;
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

      const { data: txns } = await pageAll(
        supabase
          .from("transaction_list")
          .select("id, code, client_name, status, date_updated")
          .gte("date_updated", from)
          .lte("date_updated", to)
          .neq("status", 4)
      );

      const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
      const { data: tpData } = txnIds.length
        ? await pageAll(
            supabase
              .from("transaction_products")
              .select("transaction_id, product_id, product_name, price, qty")
              .in("transaction_id", txnIds)
          )
        : { data: [] };

      const { data: clients } = await pageAll(
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname")
          .eq("delete_flag", 0)
      );

      const { data: products } = await pageAll(
        supabase.from("product_list").select("id, name").eq("delete_flag", 0)
      );

      const saleRows: SaleRow[] = [];
      for (const tp of tpData || []) {
        const txn = (txns || []).find((t) => t.id === tp.transaction_id);
        if (!txn) continue;
        const client = (clients || []).find((c) => c.id === txn.client_name);
        const product = (products || []).find((p) => p.id === tp.product_id);
        saleRows.push({
          date_updated: txn.date_updated,
          code: txn.code,
          client_name: client
            ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
            : "Walk-in",
          product_name: product?.name || tp.product_name || "Unknown",
          price: tp.price || 0,
          qty: tp.qty || 1,
          total: (tp.price || 0) * (tp.qty || 1),
        });
      }
      saleRows.sort(
        (a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
      );
      setRows(saleRows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const totalQty = rows.reduce((s, r) => s + (r.qty || 0), 0);
  const invoiceCount = new Set(rows.map((r) => r.code)).size;
  const monthLabel = parseISTDate(month + "-01").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (diff: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + diff, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              Monthly Sales Report
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5 truncate">
              Product-wise sales for the month
            </p>
          </div>
        </div>
        <button
          onClick={() => window.open(`/api/print-monthly-sales?month=${month}`, "_blank")}
          disabled={loading || rows.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 shrink-0 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-blue-500/40 hover:bg-[#151b28] disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Month navigation */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => shiftMonth(-1)}
            title="Previous month"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2">
            <CalendarDays size={14} className="text-blue-400/70 shrink-0" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 outline-none [color-scheme:dark]"
            />
          </div>
          <button
            onClick={() => shiftMonth(1)}
            title="Next month"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-[#0d1117] border border-[#21293d] text-slate-400 hover:text-white hover:border-blue-500/40 transition"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setMonth(currentMonth)}
            className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition"
          >
            This Month
          </button>
        </div>
        <span className="text-xs font-black text-amber-400/90 tracking-wide ml-auto">
          {monthLabel}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<Package size={18} />} label="Invoices" value={invoiceCount} color="blue" />
        <StatCard
          icon={<ListChecks size={18} />}
          label="Total Qty"
          value={totalQty}
          color="amber"
        />
        <StatCard
          icon={<IndianRupee size={18} />}
          label="Total Amount"
          value={inr(total)}
          color="emerald"
        />
        <StatCard
          icon={<CalendarDays size={18} />}
          label="Month"
          value={monthLabel}
          color="violet"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-[#21293d]">
        {loading ? (
          <LoadingBlock label="Loading sales..." />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No sales found for this month." />
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="text-left px-4 py-3.5">#</th>
                  <th className="text-left px-4 py-3.5">Date</th>
                  <th className="text-left px-4 py-3.5">Bill / Client</th>
                  <th className="text-left px-4 py-3.5">Product</th>
                  <th className="text-right px-4 py-3.5">Rate</th>
                  <th className="text-right px-4 py-3.5">Qty</th>
                  <th className="text-right px-4 py-3.5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {fmtDay(r.date_updated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-blue-400">{r.code || "—"}</div>
                      <div className="text-xs text-slate-500">{r.client_name}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-100">{r.product_name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{inr(r.price)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-200">{r.qty}</td>
                    <td className="px-4 py-3 text-right font-black text-emerald-400">
                      {inr(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-4 py-3 text-right" colSpan={5}>
                    Total Monthly Sales
                  </th>
                  <th className="px-4 py-3 text-right text-slate-200">{totalQty}</th>
                  <th className="px-4 py-3 text-right text-emerald-400">{inr(total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <LoadingBlock label="Loading sales..." />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No sales found for this month." />
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-100 truncate">{r.product_name}</p>
                    <p className="text-[10px] font-bold text-blue-400 mt-0.5">
                      #{i + 1} · {r.code || "—"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-emerald-400">{inr(r.total)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-[#1a2234] space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-400 min-w-0">
                      <User size={11} className="text-blue-300/70 shrink-0" />
                      <span className="truncate">{r.client_name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
                      <CalendarDays size={11} className="text-slate-600" />
                      {fmtDay(r.date_updated)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Qty <span className="text-slate-100 font-bold">{r.qty}</span>
                    </span>
                    <span className="text-slate-500">
                      Rate <span className="text-slate-200 font-bold">{inr(r.price)}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MonthlySalesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-blue-400" />
        </div>
      }
    >
      <MonthlySalesContent />
    </Suspense>
  );
}
