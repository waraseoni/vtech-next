"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Loader2, ChevronLeft, ChevronRight, Calendar, FileText, Eye,
  Printer, Users, DollarSign, TrendingUp
} from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
};

type Commission = {
  id: number;
  job_id: string;
  code: string;
  date_created: string;
  mechanic_id: number;
  mechanic_commission_amount: number;
  m_name: string;
  service_amount: number;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function CommissionHistoryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [mechanicId, setMechanicId] = useState("all");
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCommission, setTotalCommission] = useState(0);

  const fetchMechanics = useCallback(async () => {
    const { data } = await supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .eq("delete_flag", 0)
      .order("firstname", { ascending: true });
    setMechanics(data || []);
  }, []);

  const fetchCommission = useCallback(async () => {
    setLoading(true);
    const from = `${month}-01 00:00:00`;
    const lastDay = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")} 23:59:59`;

    let query = supabase
      .from("transaction_list")
      .select(`
        id, job_id, code, date_created, mechanic_id, mechanic_commission_amount,
        mechanic_list (
          firstname, middlename, lastname
        )
      `)
      .gte("date_created", from)
      .lte("date_created", to)
      .neq("mechanic_commission_amount", 0)
      .order("date_created", { ascending: false });

    if (mechanicId !== "all") {
      query = query.eq("mechanic_id", parseInt(mechanicId));
    }

    const { data } = await query;

    // Fetch service amounts for each transaction
    const result = await Promise.all((data || []).map(async (item: any) => {
      const { data: services } = await supabase
        .from("transaction_services")
        .select("price")
        .eq("transaction_id", item.id);
      const serviceAmount = (services || []).reduce((s: number, sv: any) => s + (sv.price || 0), 0);
      return {
        ...item,
        m_name: item.mechanic_list ? [item.mechanic_list.firstname, item.mechanic_list.middlename, item.mechanic_list.lastname].filter(Boolean).join(" ") : "Unknown",
        service_amount: serviceAmount,
      };
    }));

    setCommissions(result);
    setTotalCommission(result.reduce((s, c) => s + (c.mechanic_commission_amount || 0), 0));
    setLoading(false);
  }, [month, mechanicId]);

  useEffect(() => { fetchMechanics(); }, [fetchMechanics]);
  useEffect(() => { fetchCommission(); }, [fetchCommission]);

  const shiftMonth = (dir: -1 | 1) => {
    const [y, m] = month.split("-").map(Number);
    const newDate = new Date(y, m - 1 + dir, 1);
    setMonth(newDate.toISOString().slice(0, 7));
  };

  const monthDisplay = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-xl flex items-center justify-center">
            <TrendingUp size={18} className="text-white"/>
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Commission History</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Staff commission report</p>
          </div>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition">
          <Printer size={14}/> Print
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Month:</span>
          <button onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-2">
            <Calendar size={14} className="text-slate-600" />
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-200 outline-none"/>
          </div>
          <button onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 transition">
            <ChevronRight size={14} />
          </button>

          <div className="h-6 w-px bg-[#21293d] mx-2"/>

          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Staff:</span>
          <select value={mechanicId} onChange={e => setMechanicId(e.target.value)}
            className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500">
            <option value="all">All Staff</option>
            {mechanics.map(m => (
              <option key={m.id} value={String(m.id)}>
                {[m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#21293d] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300">Commission Statement — {monthDisplay}</h2>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-500">Total Commission</p>
            <p className="text-lg font-black text-emerald-400">{inr(totalCommission)}</p>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2"/>
            <p className="text-slate-600 text-xs font-black uppercase">Loading...</p>
          </div>
        ) : commissions.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600">
            <FileText size={36} className="mx-auto mb-2 text-slate-700"/>
            <p>No commission records found for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Job ID / Code</th>
                  <th className="text-left px-4 py-3">Staff Name</th>
                  <th className="text-right px-4 py-3">Service Amount</th>
                  <th className="text-right px-4 py-3">Commission</th>
                  <th className="text-center px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {commissions.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(c.date_created).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <Link href={`/jobs/${c.id}`} className="font-bold text-blue-400 hover:text-blue-300 no-underline">
                          {c.job_id}
                        </Link>
                        <p className="text-xs text-slate-600">{c.code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.m_name}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{inr(c.service_amount)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-400">{inr(c.mechanic_commission_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/jobs/${c.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold no-underline transition">
                        <Eye size={11}/> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <td colSpan={4} className="px-4 py-3 text-right">Total Commission:</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-black" style={{ fontSize: "1.1rem" }}>{inr(totalCommission)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
