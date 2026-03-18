"use client";

import { useEffect, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";

type Service = {
  id: number;
  name: string;
  description: string;
  price: number;
  status: number;
  delete_flag: number;
};

export default function ServicesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Service[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("service_list")
        .select("id, name, description, price, status, delete_flag")
        .eq("delete_flag", 0)
        .order("id", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data || []) as Service[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminPage title="Services" subtitle="Service catalog (preview).">
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
          <div className="px-5 py-10 text-center text-slate-600 text-sm">No services found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500">{s.id}</td>
                    <td className="px-4 py-3 text-slate-200 font-bold">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.description}</td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-black">Rs.{Number(s.price || 0).toFixed(2)}</td>
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

