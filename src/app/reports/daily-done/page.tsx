"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Loader2, Printer, ChevronLeft, ChevronRight, Calendar, CheckSquare, Wrench, User, Clock } from "lucide-react";
import Link from "next/link";
import { todayIST, formatIST, parseISTDate } from "@/lib/dateUtils";

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
  client_id: string;
  client_name: string;
  mechanic_name: string;
};

type Mechanic = {
  id: string;
  name: string;
};

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: "Pending", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
  1: { label: "In-Progress", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  2: { label: "Done", color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
  3: { label: "Paid", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  4: { label: "Cancelled", color: "text-red-500 bg-red-500/10 border-red-500/20" },
  5: { label: "Delivered", color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (v: string) => formatIST(v.includes("T") ? v : v + "T00:00:00+05:30", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (v: string) => formatIST(v, { hour: "2-digit", minute: "2-digit", hour12: true });

export default function DailyDoneReportPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DailyDoneItem[]>([]);
  const [date, setDate] = useState(todayIST());
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedMechanic, setSelectedMechanic] = useState<string>("all");
  const [err, setErr] = useState("");

  const fetchMechanics = async () => {
    try {
      const { data, error } = await supabase
        .from("mechanic_list")
        .select("id, firstname, lastname")
        .eq("status", 1)
        .order("firstname");
      if (error) throw error;
      if (data) {
        setMechanics(data.map((m) => ({
          id: m.id.toString(),
          name: `${m.firstname} ${m.lastname}`.trim()
        })));
      }
    } catch (e) {
      console.error("Error fetching mechanics:", e);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // 1. Fetch transactions updated on the selected date that have status 2 (Done), 3 (Paid), or 5 (Delivered)
      let txQuery = supabase
        .from("transaction_list")
        .select("*")
        .in("status", [2, 3, 5])
        .gte("date_updated", date + "T00:00:00+05:30")
        .lte("date_updated", date + "T23:59:59+05:30")
        .order("date_updated", { ascending: true });

      if (selectedMechanic !== "all") {
        txQuery = txQuery.eq("mechanic_id", selectedMechanic);
      }
      
      const { data: txData, error: txErr } = await txQuery;
      if (txErr) throw txErr;
      
      const uniqueTransactions = txData || [];
      if (uniqueTransactions.length === 0) {
         setItems([]);
         setLoading(false);
         return;
      }

      // 2. Fetch clients
      const clientIds = [...new Set(uniqueTransactions.map(t => t.client_name).filter(Boolean))];
      const { data: clientData } = await supabase.from("client_list").select("id, firstname, lastname").in("id", clientIds);
      const clientMap = new Map(clientData?.map(c => [c.id.toString(), c]) || []);

      // 3. Fetch mechanics for these transactions
      const mechIds = [...new Set(uniqueTransactions.map(t => t.mechanic_id).filter(Boolean))];
      const { data: mechData } = await supabase.from("mechanic_list").select("id, firstname, lastname").in("id", mechIds);
      const mechMap = new Map(mechData?.map(m => [m.id.toString(), m]) || []);

      const mapped: DailyDoneItem[] = uniqueTransactions.map(tx => {
        const client = clientMap.get(tx.client_name?.toString() || "");
        const mech = mechMap.get(tx.mechanic_id?.toString() || "");

        return {
          id: tx.id.toString(),
          done_at: tx.date_updated || tx.date_created, // fallback if date_updated is null
          transaction_id: tx.id.toString(),
          job_id: tx.job_id || "-",
          code: tx.code || "-",
          item: tx.item || "-",
          amount: Number(tx.amount) || 0,
          remark: tx.remark || "",
          status: tx.status,
          client_id: client?.id?.toString() || "",
          client_name: client ? `${client.firstname} ${client.lastname}`.trim() : "Unknown",
          mechanic_name: mech ? `${mech.firstname} ${mech.lastname}`.trim() : "Not Assigned"
        };
      }).filter(Boolean) as DailyDoneItem[];

      setItems(mapped);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [date, selectedMechanic]);

  useEffect(() => { 
    fetchMechanics();
  }, []);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const totals = {
    count: items.length,
    amount: items.reduce((s, i) => s + (i.amount || 0), 0),
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
    <AdminPage title="Daily Done" subtitle="Report of jobs completed on a specific day">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        
        {/* Header Controls */}
        <div className="px-5 py-4 border-b border-[#21293d] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => shiftDay(-1)} className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
                <Calendar size={14} className="text-teal-500" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="bg-transparent text-sm text-slate-200 outline-none font-medium" />
              </div>
              <button onClick={() => shiftDay(1)} className="p-2 rounded-xl bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setDate(todayIST())} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition">
                Today
              </button>
            </div>

            <div className="w-px h-6 bg-[#21293d] hidden md:block" />

            {/* Mechanic Filter */}
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2 flex-1 min-w-[200px]">
              <Wrench size={14} className="text-slate-500" />
              <select 
                value={selectedMechanic} 
                onChange={e => setSelectedMechanic(e.target.value)}
                className="bg-transparent text-sm text-slate-200 outline-none font-medium w-full"
              >
                <option value="all">All Mechanics</option>
                {mechanics.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] transition shrink-0">
            <Printer size={14} /> Print Report
          </button>
        </div>

        {/* Summary Dashboard */}
        <div className="px-5 py-4 border-b border-[#1a2234] bg-[#0d1117]/30 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/5 border border-teal-500/20 flex items-center gap-4">
            <div className="p-3 bg-teal-500/20 rounded-xl">
              <CheckSquare size={24} className="text-teal-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-teal-500">Items Completed Today</p>
              <h3 className="text-2xl font-black text-white mt-0.5">{totals.count} <span className="text-sm text-slate-400 font-medium ml-1">Jobs</span></h3>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <span className="text-2xl font-black text-orange-400 leading-none">₹</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Estimated Billable Value</p>
              <h3 className="text-2xl font-black text-white mt-0.5">{inr(totals.amount)}</h3>
            </div>
          </div>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        {/* Print Area & Table */}
        <div id="print-area">
          <div className="hidden print:block mb-6">
            <h2 className="text-xl font-black">V-Technologies</h2>
            <p className="subtitle text-sm">Daily Done Transactions Report — {fmtDate(date)}</p>
          </div>

          {loading ? (
            <div className="px-5 py-16 text-center">
              <Loader2 size={24} className="animate-spin text-teal-500 mx-auto mb-3" />
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Compiling Report...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-20 flex flex-col items-center text-center">
              <div className="p-4 bg-white/5 rounded-full mb-3">
                <CheckSquare size={32} className="text-slate-600" />
              </div>
              <p className="text-slate-300 font-bold">No jobs were marked as &quot;Done&quot; on this date.</p>
              <p className="text-xs text-slate-500 mt-1">Try selecting a different date or mechanic.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="text-center px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3 w-28">Done Time</th>
                    <th className="text-left px-4 py-3 w-40">Job ID & Status</th>
                    <th className="text-left px-4 py-3">Remark</th>
                    <th className="text-left px-4 py-3">Client & Item</th>
                    <th className="text-left px-4 py-3 w-40">Assigned Mechanic</th>
                    <th className="text-right px-4 py-3 w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {items.map((item, i) => {
                    const statusConfig = statusMap[item.status] || { label: "Unknown", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" };
                    return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-4 py-3.5 text-center text-slate-600 font-medium">{i + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="px-2 py-1 bg-[#0d1117] border border-[#21293d] rounded text-xs font-bold text-slate-300 inline-flex items-center gap-1.5">
                          <Clock size={10} className="text-teal-500" />
                          {fmtTime(item.done_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/jobs/${item.transaction_id}/view`} className="font-bold text-blue-400 hover:text-blue-300 transition-colors block">
                          #{item.job_id}
                        </Link>
                        <div className="text-[10px] text-slate-500 mb-1">Code: {item.code}</div>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 italic">
                        {item.remark || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/clients/${item.client_id}`} className="font-bold text-slate-200 hover:text-teal-400 transition-colors block">
                          {item.client_name}
                        </Link>
                        <div className="text-xs text-slate-500">{item.item}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs font-bold text-blue-400 inline-flex items-center gap-1.5 truncate max-w-[140px]">
                          <User size={12} />
                          {item.mechanic_name}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-teal-400">
                        {inr(item.amount)}
                      </td>
                    </tr>
                  )})}
                </tbody>
                <tfoot className="bg-[#111520]">
                  <tr className="text-xs font-black uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-4 text-right" colSpan={6}>Grand Total Today:</th>
                    <th className="px-4 py-4 text-right text-teal-400 text-base">{inr(totals.amount)}</th>
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
