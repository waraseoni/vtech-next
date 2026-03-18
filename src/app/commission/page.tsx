"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, Printer, Eye } from "lucide-react";

type Mechanic = {
  id: number;
  firstname: string;
  lastname: string;
};

type Txn = {
  id: number;
  job_id: string;
  code: string;
  mechanic_id: number | null;
  mechanic_commission_amount: number | null;
  date_created: string;
};

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;

function ym(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function addMonths(month: string, diff: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1 + diff, 1);
  return ym(dt);
}
function monthRange(month: string) {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m, 0);
  const to = `${month}-${String(dt.getDate()).padStart(2, "0")}`;
  return { from, to };
}
function money(n: number) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}
function fmtDate(d: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export default function CommissionPage() {
  const [month, setMonth] = useState<string>(ym());
  const [mechanicId, setMechanicId] = useState<"all" | string>("all");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [mechs, setMechs] = useState<Mechanic[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [svcTotals, setSvcTotals] = useState<Map<number, number>>(new Map());

  const mechById = useMemo(() => {
    const m = new Map<number, string>();
    for (const x of mechs) m.set(x.id, `${x.firstname} ${x.lastname}`.trim());
    return m;
  }, [mechs]);

  const totalCommission = useMemo(
    () => txns.reduce((s, t) => s + Number(t.mechanic_commission_amount || 0), 0),
    [txns]
  );

  useEffect(() => {
    (async () => {
      setErr("");
      const { data, error } = await supabase
        .from("mechanic_list")
        .select("id, firstname, lastname")
        .eq("delete_flag", 0)
        .order("firstname", { ascending: true });
      if (error) {
        setErr(error.message);
        return;
      }
      setMechs((data || []) as Mechanic[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const { from, to } = monthRange(month);
        let q = supabase
          .from("transaction_list")
          .select("id, job_id, code, mechanic_id, mechanic_commission_amount, date_created")
          .gte("date_created", `${from}T00:00:00+05:30`)
          .lte("date_created", `${to}T23:59:59+05:30`)
          .order("date_created", { ascending: false });

        if (mechanicId !== "all") q = q.eq("mechanic_id", Number(mechanicId));

        const { data: tData, error: tErr } = await q;
        if (tErr) throw tErr;
        const list = (tData || []) as Txn[];
        setTxns(list);

        const ids = list.map((t) => t.id);
        if (ids.length === 0) {
          setSvcTotals(new Map());
          setLoading(false);
          return;
        }

        const { data: sData, error: sErr } = await supabase
          .from("transaction_services")
          .select("transaction_id, price")
          .in("transaction_id", ids);
        if (sErr) throw sErr;

        const m = new Map<number, number>();
        for (const r of (sData || []) as Array<{ transaction_id: number; price: number }>) {
          m.set(r.transaction_id, (m.get(r.transaction_id) || 0) + Number(r.price || 0));
        }
        setSvcTotals(m);
      } catch (e: any) {
        setErr(e?.message || "Failed to load commission history");
      } finally {
        setLoading(false);
      }
    })();
  }, [month, mechanicId]);

  return (
    <AdminPage title="Commission" subtitle="PHP parity: month-wise commission history">
      <div className="flex flex-col gap-4">
        <div className={`${card} p-4`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <div className={label}>Select Month</div>
              <div className="flex items-center gap-2">
                <button className={btnGhost} onClick={() => setMonth(addMonths(month, -1))} title="Last Month">
                  <ChevronLeft size={16} />
                </button>
                <input className={input} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                <button className={btnGhost} onClick={() => setMonth(addMonths(month, 1))} title="Next Month">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className={label}>Select Staff/Mechanic</div>
              <select className={input} value={mechanicId} onChange={(e) => setMechanicId(e.target.value as any)}>
                <option value="all">All Staff</option>
                {mechs.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.firstname} {m.lastname}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <button className={btnGhost} onClick={() => window.print()}>
                <span className="inline-flex items-center gap-2">
                  <Printer size={14} /> Print
                </span>
              </button>
            </div>
          </div>
        </div>

        {err && <div className={`${card} p-4 text-red-400 text-sm`}>{err}</div>}

        {loading ? (
          <div className={`${card} p-10 flex items-center justify-center gap-2 text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]`}>
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div className={card}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Job ID / Code</th>
                    <th className="text-left px-4 py-3">Staff Name</th>
                    <th className="text-right px-4 py-3">Service Amount</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {txns.length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-600" colSpan={6}>
                        No commission records found for this period.
                      </td>
                    </tr>
                  ) : (
                    txns.map((t) => {
                      const mName = t.mechanic_id ? mechById.get(t.mechanic_id) : "—";
                      const sTotal = svcTotals.get(t.id) || 0;
                      return (
                        <tr key={t.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 text-slate-400">{fmtDate(t.date_created)}</td>
                          <td className="px-4 py-3">
                            <div className="text-slate-200 font-black">{t.job_id}</div>
                            <div className="text-slate-600 text-xs">{t.code}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-bold">{mName}</td>
                          <td className="px-4 py-3 text-right text-slate-200 font-bold">{money(sTotal)}</td>
                          <td className="px-4 py-3 text-right text-amber-300 font-black">
                            {money(Number(t.mechanic_commission_amount || 0))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link className={btnGhost} href={`/jobs/${t.id}/view`}>
                              <span className="inline-flex items-center gap-2">
                                <Eye size={14} /> View
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.03]">
                    <td className="px-4 py-3 text-right text-slate-600 font-black uppercase tracking-widest" colSpan={4}>
                      Total Commission
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-black text-base">
                      {money(totalCommission)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          a, button, input, select { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </AdminPage>
  );
}

