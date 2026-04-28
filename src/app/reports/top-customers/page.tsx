"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, Users, TrendingUp, Star, BarChart2 } from "lucide-react";
import { todayIST, formatIST, parseISTDate, toISTString, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

type TopCustomer = {
  client_id: number;
  customer_name: string;
  contact: string | null;
  total_jobs: number;
  total_amount: number;
  total_payment: number;
  opening_balance: number;
  current_balance: number;
};

function TopCustomersContent() {
  const searchParams = useSearchParams();

  const today = todayIST();
  const currentYear = parseInt(today.slice(0, 4));
  const currentMonth = parseInt(today.slice(5, 7));
  const [filterType, setFilterType] = useState<"monthly" | "yearly" | "all">("yearly");
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TopCustomer[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let from: string, to: string;
      if (filterType === "monthly") {
        const d = new Date(selYear, selMonth - 1, 1);
        from = startOfMonthIST(d) + "T00:00:00+05:30";
        to = endOfMonthIST(d) + "T23:59:59+05:30";
      } else if (filterType === "yearly") {
        from = `${selYear}-01-01T00:00:00+05:30`;
        to = `${selYear}-12-31T23:59:59+05:30`;
      } else {
        from = "2000-01-01T00:00:00+05:30";
        to = toISTString();
      }

      const { data: clients } = await supabase
        .from("client_list").select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0);

      const topRows: TopCustomer[] = [];
      for (const c of clients || []) {
        const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");

        const { data: txns } = await supabase
          .from("transaction_list").select("id, amount, date_created")
          .eq("client_name", c.id).in("status", [3, 5])
          .gte("date_created", from).lte("date_created", to);

        const { data: pmts } = await supabase
          .from("client_payments").select("amount, discount, payment_date")
          .eq("client_id", c.id)
          .gte("payment_date", from.split("T")[0]).lte("payment_date", to.split("T")[0]);

        const totalAmt = txns?.reduce((s, t) => s + (t.amount || 0), 0) || 0;
        const totalPmt = pmts?.reduce((s, p) => s + (p.amount || 0) + (p.discount || 0), 0) || 0;

        if (totalAmt > 0 || totalPmt > 0) {
          topRows.push({
            client_id: c.id, customer_name: name, contact: c.contact,
            total_jobs: txns?.length || 0,
            total_amount: totalAmt, total_payment: totalPmt,
            opening_balance: 0, current_balance: totalAmt - totalPmt,
          });
        }
      }

      topRows.sort((a, b) => b.total_amount - a.total_amount);
      setRows(topRows.slice(0, 20));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterType, selYear, selMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0);
  const grandPayment = rows.reduce((s, r) => s + r.total_payment, 0);
  const grandBalance = rows.reduce((s, r) => s + r.current_balance, 0);

  const filterLabel = filterType === "monthly"
    ? `${formatIST(`${selYear}-${String(selMonth).padStart(2, "0")}-01`, { month: "long", year: "numeric" })}`
    : filterType === "yearly" ? `${selYear}` : "All Time";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Star size={18} className="text-amber-400" /> Top Customers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Customers by total repair amount</p>
        </div>
        <button onClick={() => window.open(`/api/print-top-customers?filterType=${filterType}&selYear=${selYear}&selMonth=${selMonth}`, "_blank")}
          className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
          <Printer size={13} /> Print
        </button>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Filter</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="all">All Time</option>
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {filterType !== "all" && (
            <>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Year</label>
                <input type="number" value={selYear} onChange={(e) => setSelYear(parseInt(e.target.value))} min={2020} max={new Date().getFullYear() + 1}
                  className="w-24 px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
              </div>
              {filterType === "monthly" && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Month</label>
                  <select value={selMonth} onChange={(e) => setSelMonth(parseInt(e.target.value))}
                    className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString("en", { month: "long" })}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="text-sm font-black text-white ml-auto">{filterLabel}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Total Revenue</p>
          <p className="text-lg font-black text-emerald-400 mt-1">{inr(grandTotal)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Total Collected</p>
          <p className="text-lg font-black text-teal-400 mt-1">{inr(grandPayment)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Outstanding</p>
          <p className="text-lg font-black text-blue-400 mt-1">{inr(grandBalance)}</p>
        </div>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["Rank", "Customer", "Contact", "Jobs", "Total Amount", "Payment", "Balance"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600 text-xs font-bold">No data found</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.client_id} className={`border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors ${i < 3 ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-2.5 text-center">
                    {i === 0 ? <span className="text-amber-400 text-lg">🥇</span>
                      : i === 1 ? <span className="text-slate-300 text-lg">🥈</span>
                      : i === 2 ? <span className="text-amber-700 text-lg">🥉</span>
                      : <span className="text-slate-500 text-xs font-bold">{i + 1}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-sm font-bold text-slate-200">{r.customer_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{r.contact || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-center text-slate-300">{r.total_jobs}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(r.total_amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(r.total_payment)}</td>
                  <td className={`px-3 py-2.5 text-xs text-right font-bold ${r.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(Math.abs(r.current_balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function TopCustomersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <TopCustomersContent />
    </Suspense>
  );
}
