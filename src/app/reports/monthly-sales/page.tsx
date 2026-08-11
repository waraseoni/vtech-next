"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { Loader2, Printer, ShoppingCart } from "lucide-react";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type SaleRow = {
  date_updated: string;
  code: string | null;
  client_name: string;
  product_name: string;
  price: number;
  qty: number;
  total: number;
};

import { currentMonthIST, parseISTDate } from "@/lib/dateUtils";

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

      const { data: txns } = await pageAll(supabase
        .from("transaction_list").select("id, code, client_name, status, date_updated")
        .gte("date_updated", from).lte("date_updated", to).neq("status", 4));

      const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
      const { data: tpData } = txnIds.length
        ? await pageAll(supabase.from("transaction_products").select("transaction_id, product_id, product_name, price, qty").in("transaction_id", txnIds))
        : { data: [] };

      const { data: clients } = await pageAll(supabase
        .from("client_list").select("id, firstname, middlename, lastname")
        .eq("delete_flag", 0));

      const { data: products } = await pageAll(supabase
        .from("product_list").select("id, name").eq("delete_flag", 0));

      const saleRows: SaleRow[] = [];
      for (const tp of tpData || []) {
        const txn = (txns || []).find((t) => t.id === tp.transaction_id);
        if (!txn) continue;
        const client = (clients || []).find((c) => c.id === txn.client_name);
        const product = (products || []).find((p) => p.id === tp.product_id);
        saleRows.push({
          date_updated: txn.date_updated,
          code: txn.code,
          client_name: client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : "Walk-in",
          product_name: product?.name || tp.product_name || "Unknown",
          price: tp.price || 0,
          qty: tp.qty || 1,
          total: (tp.price || 0) * (tp.qty || 1),
        });
      }
      saleRows.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());
      setRows(saleRows);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = rows.reduce((s, r) => s + r.total, 0);
  const monthLabel = parseISTDate(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <ShoppingCart size={18} className="text-blue-400" /> Monthly Sales Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Product-wise sales for the month</p>
        </div>
        <button onClick={() => window.open(`/api/print-monthly-sales?month=${month}`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
          <Printer size={13} /> Print
        </button>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
          </div>
          <div className="ml-auto text-sm font-black text-white">{monthLabel}</div>
        </div>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["#", "Date", "Code / Client", "Product", "Price", "Qty", "Total"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-600 text-xs font-bold">No sales found for this month</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">
                    {new Date(r.date_updated).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs font-bold text-blue-400">{r.code || "—"}</div>
                    <div className="text-[10px] text-slate-500">{r.client_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.product_name}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.price)}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-slate-300">{r.qty}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">{inr(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/5">
                <td colSpan={5} className="px-3 py-3 text-xs font-black text-slate-400 text-right">Total Monthly Sales:</td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-sm text-right font-black text-emerald-400">{inr(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function MonthlySalesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <MonthlySalesContent />
    </Suspense>
  );
}
