"use client";

import { useEffect, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  designation: string | null;
  salary_per_day: number;
  commission_percent: number;
  status: number;
  delete_flag: number;
};

export default function MechanicsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Mechanic[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname, contact, designation, salary_per_day, commission_percent, status, delete_flag")
        .eq("delete_flag", 0)
        .order("id", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data || []) as Mechanic[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage title="Mechanics" subtitle="Mechanic directory (preview).">
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
          <div className="px-5 py-10 text-center text-slate-600 text-sm">No mechanics found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Designation</th>
                  <th className="text-right px-4 py-3">Salary/Day</th>
                  <th className="text-right px-4 py-3">Commission %</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((m) => {
                  const nm = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
                  return (
                    <tr key={m.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-200 font-bold">{nm}</td>
                      <td className="px-4 py-3 text-slate-400">{m.contact}</td>
                      <td className="px-4 py-3 text-slate-500">{m.designation || "Mechanic"}</td>
                      <td className="px-4 py-3 text-right text-slate-200 font-bold">Rs.{Number(m.salary_per_day || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-black">{Number(m.commission_percent || 0).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-slate-500">{m.status === 1 ? "Active" : "Inactive"}</td>
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

