"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

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
const fmtDate = (v: string) => formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (v: string) => formatIST(v, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

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
        const tx  = txMap.get(item.transaction_id);
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

  useEffect(() => { fetchData(); }, [fetchData]);

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
    setTimeout(() => { popup.print(); setTimeout(() => popup.close(), 300); }, 300);
  };

  return (
    <AdminPage title="Daily Sales" subtitle="Product-wise daily sales report">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDay(-1)} className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
              <Calendar size={14} className="text-slate-600" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-transparent text-sm text-slate-200 outline-none" />
            </div>
            <button onClick={() => shiftDay(1)} className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setDate(todayIST())} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
              Today
            </button>
          </div>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
            <Printer size={14} /> Print
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#1a2234] bg-[#0d1117]/50 grid grid-cols-4 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div>Items: <span className="text-slate-300 font-bold ml-1">{totals.count}</span></div>
          <div>Qty: <span className="text-slate-300 font-bold ml-1">{totals.qty}</span></div>
          <div>Total: <span className="text-emerald-400 font-bold ml-1">{inr(totals.amount)}</span></div>
          <div>Date: <span className="text-slate-300 font-bold ml-1">{fmtDate(date)}</span></div>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        <div id="print-area">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="subtitle text-sm">Daily Sales Report — {fmtDate(date)}</p>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center">
              <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
              <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-600 text-sm">No sales found for this date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">DateTime</th>
                    <th className="text-left px-4 py-3">Code / Client</th>
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-right px-4 py-3">Price</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {items.map((item, i) => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 text-slate-600">{i + 1}</td>
                      <td className="px-4 py-3.5 text-slate-400">{fmtDateTime(item.date_updated)}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-300">{item.transaction_code}</div>
                        <div className="text-xs text-slate-600">Client: {item.client_name}</div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-200 font-bold">{item.product_name}</td>
                      <td className="px-4 py-3.5 text-right text-blue-400">{inr(item.price)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-300 font-bold">{item.qty}</td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400">{inr(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <th className="px-4 py-3 text-right" colSpan={4}>Total</th>
                    <th className="px-4 py-3 text-right text-blue-400">—</th>
                    <th className="px-4 py-3 text-right text-slate-300">{totals.qty}</th>
                    <th className="px-4 py-3 text-right text-emerald-400">{inr(totals.amount)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
