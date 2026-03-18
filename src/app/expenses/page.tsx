"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";

type Expense = {
  id: number;
  category: string;
  amount: number;
  remarks: string | null;
  date_created: string;
};

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Expense[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("expense_list")
        .select("id, category, amount, remarks, date_created")
        .order("date_created", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setItems((data || []) as Expense[]);
      setLoading(false);
    })();
  }, []);

  const total = useMemo(() => items.reduce((s, e) => s + Number(e.amount || 0), 0), [items]);

  return (
    <AdminPage title="Pay Outs" subtitle="Expenses / payouts list (preview).">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            Last {items.length} entries
          </div>
          <div className="text-sm font-black text-slate-200">Total: Rs.{total.toFixed(2)}</div>
        </div>

        {err && <div className="px-5 py-4 text-red-400 text-sm border-b border-[#21293d]">{err}</div>}

        {loading ? (
          <div className="px-5 py-10 text-center text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-600 text-sm">
            No expenses found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Remarks</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300">{String(e.date_created).slice(0, 10)}</td>
                    <td className="px-4 py-3 text-slate-200 font-bold">{e.category}</td>
                    <td className="px-4 py-3 text-slate-500">{e.remarks || "—"}</td>
                    <td className="px-4 py-3 text-right text-red-300 font-black">Rs.{Number(e.amount || 0).toFixed(2)}</td>
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

