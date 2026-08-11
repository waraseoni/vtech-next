"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { Loader2, Printer, CreditCard } from "lucide-react";

import { currentMonthIST, formatIST } from "@/lib/dateUtils";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type LoanRow = {
  id: number;
  client_name: string;
  principal_amount: number;
  interest_rate: number;
  total_payable: number;
  emi_amount: number;
  received: number;
  pending: number;
  status: number;
  remaining_installments?: number;
};

function LoanReportContent() {
  const searchParams = useSearchParams();

  const currentMonth = currentMonthIST();
  const [month, setMonth] = useState(searchParams.get("month") || currentMonth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LoanRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const y = parseInt(month.slice(0, 4));
      const m = parseInt(month.slice(5, 7));
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

      const { data: loans } = await pageAll(supabase
        .from("client_loans").select("id, client_id, loan_date, principal_amount, interest_rate, total_payable, emi_amount, status")
        .lte("loan_date", monthEnd)
        .gte("status", 0));

      const { data: clients } = await pageAll(supabase
        .from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0));

      const { data: payments } = await pageAll(supabase
        .from("client_payments").select("loan_id, amount, discount, payment_date")
        .not("loan_id", "is", null)
        .lte("payment_date", monthEnd));

      const loanRows: LoanRow[] = [];
      for (const l of loans || []) {
        const client = (clients || []).find((c) => c.id === l.client_id);
        if (!client) continue;
        const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");
        const loanPmts = payments?.filter((p) => p.loan_id === l.id) || [];
        const received = loanPmts.reduce((s, p) => s + (p.amount || 0) + (p.discount || 0), 0);
        const targetEmi = l.emi_amount || 0;
        const pending = Math.max(0, targetEmi - received);

        loanRows.push({
          id: l.id, client_name: name,
          principal_amount: l.principal_amount || 0,
          interest_rate: l.interest_rate || 0,
          total_payable: l.total_payable || 0,
          emi_amount: targetEmi,
          received,
          pending,
          remaining_installments: (targetEmi > 0) ? Math.ceil(((l.total_payable || 0) - received > 0 ? (l.total_payable || 0) - received : 0) / targetEmi) : 0,
          status: l.status || 0,
        });
      }
      setRows(loanRows);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tPrincipal = rows.reduce((s, r) => s + r.principal_amount, 0);
  const tInterest = rows.reduce((s, r) => s + (r.total_payable - r.principal_amount), 0);
  const tTarget = rows.reduce((s, r) => s + r.emi_amount, 0);
  const tReceived = rows.reduce((s, r) => s + r.received, 0);
  const tPending = rows.reduce((s, r) => s + r.pending, 0);
  const tRemainingInstallments = rows.reduce((s, r) => s + (r.remaining_installments || 0), 0);
  const monthLabel = formatIST(month + "-01", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <CreditCard size={18} className="text-blue-400" /> Loan Report
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Client loans monthly performance</p>
        </div>
        <button onClick={() => window.open(`/api/print-loan?month=${month}`, "_blank")}
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
          <div className="ml-auto text-sm font-black text-white">Loan Performance — {monthLabel}</div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Principal</p>
          <p className="text-base font-black text-blue-400 mt-1">{inr(tPrincipal)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Interest</p>
          <p className="text-base font-black text-emerald-400 mt-1">{inr(tInterest)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Target EMI</p>
          <p className="text-base font-black text-slate-300 mt-1">{inr(tTarget)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Received</p>
          <p className="text-base font-black text-teal-400 mt-1">{inr(tReceived)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 text-center">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Pending</p>
          <p className="text-base font-black text-red-400 mt-1">{inr(tPending)}</p>
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest mt-1">Inst. Left</p>
          <p className="text-base font-black text-yellow-400 mt-1">{tRemainingInstallments}</p>
        </div>
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                {["#", "Client", "Principal", "Interest Rate", "Interest Val", "EMI", "Received", "Pending", "Inst. Left"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 size={20} className="animate-spin text-blue-400 mx-auto" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-600 text-xs font-bold">No loan data found</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-500 text-center">{i + 1}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-slate-200">{r.client_name}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.principal_amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-center text-slate-400">{r.interest_rate}%</td>
                  <td className="px-3 py-2.5 text-xs text-right text-emerald-400">{inr(r.total_payable - r.principal_amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-slate-300">{inr(r.emi_amount)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-teal-400">{inr(r.received)}</td>
                  <td className="px-3 py-2.5 text-xs text-right font-bold text-red-400">{inr(r.pending)}</td>
                  <td className="px-3 py-2.5 text-xs text-center font-bold text-yellow-400">{r.remaining_installments}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-blue-500/30 bg-blue-500/5">
                <td colSpan={2} className="px-3 py-3 text-xs font-black text-slate-400 text-right">Total:</td>
                <td className="px-3 py-3 text-xs text-right font-black text-blue-400">{inr(tPrincipal)}</td>
                <td />
                <td className="px-3 py-3 text-xs text-right font-black text-emerald-400">{inr(tInterest)}</td>
                <td className="px-3 py-3 text-xs text-right font-black text-slate-300">{inr(tTarget)}</td>
                <td className="px-3 py-3 text-xs text-right font-black text-teal-400">{inr(tReceived)}</td>
                <td className="px-3 py-3 text-xs text-right font-black text-red-400">{inr(tPending)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function LoanReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 size={24} className="animate-spin text-blue-400" /></div>}>
      <LoanReportContent />
    </Suspense>
  );
}
