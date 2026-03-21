"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";

import { formatIST } from "@/lib/dateUtils";

type Row = {
  id: number;
  payment_date: string;
  client_id: number;
  amount: number;
  discount: number | null;
  payment_mode: string;
  remarks: string | null;
};

export default function ClientPaymentReportPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      setErr("");
      setLoading(true);
      const { data, error } = await supabase
        .from("client_payments")
        .select("id, payment_date, client_id, amount, discount, payment_mode, remarks")
        .order("payment_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data || []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0) + Number(r.discount || 0), 0),
    [rows]
  );

  return (
    <AdminPage title="Clients Payment" subtitle="Latest client payments (preview).">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            Showing last {rows.length} payments
          </div>
          <div className="text-sm font-black text-slate-200">
            Total: Rs.{total.toFixed(2)}
          </div>
        </div>

        {err && (
          <div className="px-5 py-4 text-red-400 text-sm border-b border-[#21293d]">
            {err}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-10 text-center text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-600 text-sm">
            No payments found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Client ID</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Discount</th>
                  <th className="text-right px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((r) => {
                  const net = Number(r.amount || 0) - Number(r.discount || 0);
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-300">{formatIST(r.payment_date, { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td className="px-4 py-3 text-slate-400">{r.client_id}</td>
                      <td className="px-4 py-3 text-slate-400">{r.payment_mode}</td>
                      <td className="px-4 py-3 text-right text-slate-200 font-bold">Rs.{Number(r.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">Rs.{Number(r.discount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-black">Rs.{net.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
}

