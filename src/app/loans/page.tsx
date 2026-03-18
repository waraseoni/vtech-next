"use client";

import { useEffect, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";

type Lender = {
  id: number;
  fullname: string;
  contact: string;
  loan_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  status: number;
  start_date: string;
};

export default function LoansPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Lender[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("lender_list")
        .select("id, fullname, contact, loan_amount, interest_rate, tenure_months, emi_amount, status, start_date")
        .order("id", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data || []) as Lender[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage title="Loans" subtitle="Lender loans (preview).">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            Total: {rows.length}
          </div>
        </div>

        {err && <div className="px-5 py-4 text-red-400 text-sm border-b border-[#21293d]">{err}</div>}

        {loading ? (
          <div className="px-5 py-10 text-center text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-600 text-sm">No loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Lender</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-right px-4 py-3">Loan</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-right px-4 py-3">Tenure</th>
                  <th className="text-right px-4 py-3">EMI</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-200 font-bold">{r.fullname}</td>
                    <td className="px-4 py-3 text-slate-400">{r.contact}</td>
                    <td className="px-4 py-3 text-right text-slate-200 font-bold">Rs.{Number(r.loan_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{Number(r.interest_rate || 0).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.tenure_months} mo</td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-black">Rs.{Number(r.emi_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">{r.status === 1 ? "Active" : "Closed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

