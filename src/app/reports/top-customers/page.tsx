"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, Star, X } from "lucide-react";
import { todayIST, formatIST, startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

type DbRow = ReturnType<typeof JSON.parse>;

type SupaBuilder = {
  eq: (column: string, value: unknown) => SupaBuilder;
  gte: (column: string, value: unknown) => SupaBuilder;
  lte: (column: string, value: unknown) => SupaBuilder;
  in: (column: string, values: unknown[]) => SupaBuilder;
  order: (column: string, opts?: { ascending?: boolean }) => SupaBuilder;
  range: (from: number, to: number) => PromiseLike<{ data: DbRow[] | null; error: unknown }>;
};

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
  const today = todayIST();
  const currentYear = parseInt(today.slice(0, 4));
  const currentMonth = parseInt(today.slice(5, 7));
  const [filterType, setFilterType] = useState<"monthly" | "yearly" | "all">("all");
  const [selYear, setSelYear] = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TopCustomer[]>([]);

  const [modalClient, setModalClient] = useState<{ id: number; name: string; type: "revenue" | "payment" } | null>(null);
  const [modalData, setModalData] = useState<DbRow[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

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
        to = "2099-12-31T23:59:59+05:30";
      }

      const fetchList = async (table: string, select: string, queryModifier: (q: SupaBuilder) => SupaBuilder) => {
        const list: DbRow[] = [];
        let page = 0;
        while (true) {
          let q: SupaBuilder = supabase.from(table).select(select) as unknown as SupaBuilder;
          q = queryModifier(q);
          const { data } = await q.range(page * 1000, (page + 1) * 1000 - 1);
          if (data) list.push(...data);
          if (!data || data.length < 1000) break;
          page++;
        }
        return list;
      };

      const [clients, allTxns, allPmts, allDirectSales] = await Promise.all([
        fetchList("client_list", "id, firstname, middlename, lastname, contact", q => q.eq("delete_flag", 0)),
        fetchList("transaction_list", "client_name, amount", q => q.eq("status", 5).gte("date_created", from).lte("date_created", to)),
        fetchList("client_payments", "client_id, amount, discount", q => q.gte("payment_date", from.split("T")[0]).lte("payment_date", to.split("T")[0])),
        fetchList("direct_sales", "client_id, total_amount", q => q.gte("date_created", from).lte("date_created", to))
      ]);

      const txnsByClient = new Map<number, { amount: number, count: number }>();
      const pmtsByClient = new Map<number, { amount: number }>();

      for (const t of allTxns || []) {
        if (!t.client_name) continue;
        const cId = parseInt(String(t.client_name), 10);
        const curr = txnsByClient.get(cId) || { amount: 0, count: 0 };
        curr.amount += (t.amount || 0);
        curr.count += 1;
        txnsByClient.set(cId, curr);
      }

      for (const s of allDirectSales || []) {
        if (!s.client_id) continue;
        const cId = parseInt(String(s.client_id), 10);
        const curr = txnsByClient.get(cId) || { amount: 0, count: 0 };
        curr.amount += (s.total_amount || 0);
        curr.count += 1;
        txnsByClient.set(cId, curr);
      }

      for (const p of allPmts || []) {
        if (!p.client_id) continue;
        const cId = parseInt(String(p.client_id), 10);
        const curr = pmtsByClient.get(cId) || { amount: 0 };
        curr.amount += (p.amount || 0) + (p.discount || 0);
        pmtsByClient.set(cId, curr);
      }

      const topRows: TopCustomer[] = [];
      for (const c of clients || []) {
        const tData = txnsByClient.get(c.id);
        const pData = pmtsByClient.get(c.id);

        const totalAmt = tData?.amount || 0;
        const totalPmt = pData?.amount || 0;

        if (totalAmt > 0 || totalPmt > 0) {
          const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
          topRows.push({
            client_id: c.id, customer_name: name, contact: c.contact,
            total_jobs: tData?.count || 0,
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

  useEffect(() => {
    if (!modalClient) return;
    setModalLoading(true);
    setModalData([]);
    
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
      to = "2099-12-31T23:59:59+05:30";
    }

    const fetchModalData = async () => {
      try {
        if (modalClient.type === "revenue") {
          const [txnsRes, salesRes] = await Promise.all([
            supabase.from("transaction_list").select("id, amount, date_created, code").eq("client_name", modalClient.id).eq("status", 5).gte("date_created", from).lte("date_created", to),
            supabase.from("direct_sales").select("id, total_amount, date_created, sale_code").eq("client_id", modalClient.id).gte("date_created", from).lte("date_created", to)
          ]);
          
          const combined: DbRow[] = [];
          if (txnsRes.data) combined.push(...txnsRes.data.map((t) => ({ ...t, source: "job" })));
          if (salesRes.data) combined.push(...salesRes.data.map((s) => ({ id: s.id, amount: s.total_amount, date_created: s.date_created, code: s.sale_code, source: "sale" })));
          
          combined.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
          setModalData(combined);
        } else {
          const { data } = await supabase
            .from("client_payments")
            .select("id, amount, discount, payment_date, payment_mode")
            .eq("client_id", modalClient.id)
            .gte("payment_date", from.split("T")[0]).lte("payment_date", to.split("T")[0])
            .order("payment_date", { ascending: false });
          setModalData(data || []);
        }
      } catch (e) { console.error(e); }
      finally { setModalLoading(false); }
    };
    fetchModalData();
  }, [modalClient, filterType, selYear, selMonth]);

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
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as "monthly" | "yearly" | "all")}
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
                    <Link href={`/clients/${r.client_id}/view`} className="text-sm font-bold text-blue-400 hover:text-blue-300 hover:underline">
                      {r.customer_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-400">{r.contact || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-center text-slate-300">{r.total_jobs}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-emerald-400">
                    <button onClick={() => setModalClient({ id: r.client_id, name: r.customer_name, type: "revenue" })} className="hover:underline decoration-emerald-500/50 underline-offset-2">
                      {inr(r.total_amount)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">
                    <button onClick={() => setModalClient({ id: r.client_id, name: r.customer_name, type: "payment" })} className="hover:underline decoration-teal-500/50 underline-offset-2">
                      {inr(r.total_payment)}
                    </button>
                  </td>
                  <td className={`px-3 py-2.5 text-xs text-right font-bold ${r.current_balance >= 0 ? "text-blue-400" : "text-red-400"}`}>{inr(Math.abs(r.current_balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-xl shadow-black/40 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-[#21293d] bg-[#111520]">
              <div>
                <h3 className="text-sm font-black text-white">{modalClient.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{modalClient.type === "revenue" ? "Transaction History" : "Payment History"}</p>
              </div>
              <button onClick={() => setModalClient(null)} className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {modalLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-400" /></div>
              ) : modalData.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-bold">No records found.</div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#21293d]">
                      <th className="pb-2 text-[10px] font-black uppercase text-slate-600 tracking-widest">{modalClient.type === "revenue" ? "Job Info" : "Date"}</th>
                      <th className="pb-2 text-[10px] font-black uppercase text-slate-600 tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((d, idx) => (
                      <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="py-3">
                          {modalClient.type === "revenue" ? (
                            <div>
                              <div className="text-xs font-bold text-slate-200">
                                {d.source === "sale" ? "Direct Sale " : "Job "}#{d.id} {d.code ? `(${d.code})` : ""}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">{formatIST(d.date_created, { dateStyle: "medium" })}</div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-xs font-bold text-slate-200">{formatIST(d.payment_date, { dateStyle: "medium" })}</div>
                              {d.payment_mode && <div className="text-[10px] text-blue-400 mt-0.5">{d.payment_mode}</div>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="text-xs font-bold text-emerald-400">{inr(d.amount + (d.discount || 0))}</div>
                          {d.discount > 0 && <div className="text-[10px] text-slate-500">inc. {inr(d.discount)} disc.</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
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
