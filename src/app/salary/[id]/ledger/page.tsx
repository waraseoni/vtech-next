"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { Loader2, ArrowLeft, Printer, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";

import { startOfMonthIST, endOfMonthIST, parseISTDate, toISTDatePart } from "@/lib/dateUtils";

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  daily_salary: number | null;
};

type Attendance = { curr_date: string; status: number };
type SalaryHist = { id: number; salary: number; effective_date: string };
type TxnComm = { mechanic_commission_amount: number | null; date_created: string };
type Advance = { amount: number; date_paid: string };

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnNavy = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

function money(n: number) {
  return `Rs.${Number(n || 0).toFixed(2)}`;
}

function pickBaseRate(m: Mechanic): number {
  const b = Number(m.daily_salary ?? NaN);
  return !Number.isNaN(b) && b > 0 ? b : 0;
}

function rateForDate(history: SalaryHist[], baseRate: number, date: string) {
  for (const h of history) if (h.effective_date <= date) return Number(h.salary || 0);
  return baseRate;
}

function addMonthToDate(dateStr: string, diff: number) {
  const d = parseISTDate(dateStr);
  const dt = new Date(d.getFullYear(), d.getMonth() + diff, 1);
  return { from: startOfMonthIST(dt), to: endOfMonthIST(dt) };
}

export default function MechanicLedgerPage() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const mechId = Number(params.id);
  const from0 = sp.get("from") || startOfMonthIST();
  const to0 = sp.get("to") || endOfMonthIST();

  const [from, setFrom] = useState(from0);
  const [to, setTo] = useState(to0);

  const [loading, setLoading] = useState(true);
  const [mech, setMech] = useState<Mechanic | null>(null);
  const [hist, setHist] = useState<SalaryHist[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [comm, setComm] = useState<TxnComm[]>([]);
  const [adv, setAdv] = useState<Advance[]>([]);
  const [prevAtt, setPrevAtt] = useState<Attendance[]>([]);
  const [prevComm, setPrevComm] = useState<TxnComm[]>([]);
  const [prevAdv, setPrevAdv] = useState<Advance[]>([]);
  const [err, setErr] = useState("");

  const prevDateLimit = useMemo(() => {
    const d = parseISTDate(from);
    d.setDate(d.getDate() - 1);
    return toISTDatePart(d);
  }, [from]);

  useEffect(() => {
    setFrom(from0);
    setTo(to0);
     
  }, [from0, to0, mechId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const mechRes = await supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname, daily_salary")
          .eq("id", mechId)
          .single();
        if (mechRes.error) throw mechRes.error;
        setMech(mechRes.data as Mechanic);

        const [histRes, prevAttRes, prevCommRes, prevAdvRes, attRes, commRes, advRes] = await Promise.all([
          pageAll(supabase
            .from("mechanic_salary_history")
            .select("id, salary, effective_date")
            .eq("mechanic_id", mechId)
            .lte("effective_date", to)
            .order("effective_date", { ascending: false })
            .order("id", { ascending: false })),

          pageAll(supabase
            .from("attendance_list")
            .select("curr_date, status")
            .eq("mechanic_id", mechId)
            .in("status", [1, 3])
            .lte("curr_date", prevDateLimit)),

          pageAll(supabase
            .from("transaction_list")
            .select("mechanic_commission_amount, date_created")
            .eq("mechanic_id", mechId)
            .lte("date_created", `${prevDateLimit}T23:59:59`)),

          pageAll(supabase
            .from("advance_payments")
            .select("amount, date_paid")
            .eq("mechanic_id", mechId)
            .lte("date_paid", prevDateLimit)),

          pageAll(supabase
            .from("attendance_list")
            .select("curr_date, status")
            .eq("mechanic_id", mechId)
            .gte("curr_date", from)
            .lte("curr_date", to)),

          pageAll(supabase
            .from("transaction_list")
            .select("mechanic_commission_amount, date_created")
            .eq("mechanic_id", mechId)
            .gte("date_created", `${from}T00:00:00`)
            .lte("date_created", `${to}T23:59:59`)),

          pageAll(supabase
            .from("advance_payments")
            .select("amount, date_paid")
            .eq("mechanic_id", mechId)
            .gte("date_paid", from)
            .lte("date_paid", to)),
        ]);

        setHist((histRes.data || []) as SalaryHist[]);
        setPrevAtt((prevAttRes.data || []) as Attendance[]);
        setPrevComm((prevCommRes.data || []) as TxnComm[]);
        setPrevAdv((prevAdvRes.data || []) as Advance[]);
        setAtt((attRes.data || []) as Attendance[]);
        setComm((commRes.data || []) as TxnComm[]);
        setAdv((advRes.data || []) as Advance[]);
      } catch (e) {
        setErr((e instanceof Error && e.message ? e.message : "") || "Failed to load ledger");
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to, mechId, prevDateLimit]);

  const mechName = useMemo(() => {
    if (!mech) return "";
    return [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ");
  }, [mech]);

  const histSorted = useMemo(() => {
    const arr = [...hist];
    arr.sort((a, b) => (a.effective_date < b.effective_date ? 1 : a.effective_date > b.effective_date ? -1 : b.id - a.id));
    return arr;
  }, [hist]);

  const openingBalance = useMemo(() => {
    if (!mech) return 0;
    const base = pickBaseRate(mech);
    let earned = 0;
    for (const a of prevAtt) {
      const r = rateForDate(histSorted, base, a.curr_date);
      earned += a.status === 3 ? r / 2 : r;
    }
    const commSum = prevComm.reduce((s, r) => s + Number(r.mechanic_commission_amount || 0), 0);
    const advSum = prevAdv.reduce((s, r) => s + Number(r.amount || 0), 0);
    return (earned + commSum) - advSum;
  }, [mech, prevAtt, prevComm, prevAdv, histSorted]);

  const dailyRows = useMemo(() => {
    if (!mech) return [];
    const base = pickBaseRate(mech);
    const attByDate = new Map(att.map((a) => [a.curr_date, a.status]));
    const advByDate = new Map<string, number>();
    for (const a of adv) advByDate.set(a.date_paid, (advByDate.get(a.date_paid) || 0) + Number(a.amount || 0));
    const commByDate = new Map<string, number>();
    for (const c of comm) {
      const d = String(c.date_created).slice(0, 10);
      commByDate.set(d, (commByDate.get(d) || 0) + Number(c.mechanic_commission_amount || 0));
    }

    const out: Array<{
      date: string;
      statusLabel: string;
      statusTone: string;
      earned: number;
      commission: number;
      advance: number;
      running: number;
    }> = [];

    let running = openingBalance;
    for (let d = new Date(from); d <= new Date(to); d = new Date(d.getTime() + 86400000)) {
      const ds = toISTDatePart(d);
      const st = attByDate.get(ds);
      let earned = 0;
      let statusLabel = "-";
      let statusTone = "text-slate-600";
      if (st === 1) {
        statusLabel = "Present";
        statusTone = "text-emerald-300";
        earned = rateForDate(histSorted, base, ds);
      } else if (st === 3) {
        statusLabel = "Half Day";
        statusTone = "text-amber-300";
        earned = rateForDate(histSorted, base, ds) / 2;
      } else if (st === 0) {
        statusLabel = "Absent";
        statusTone = "text-red-300";
      }

      const commission = commByDate.get(ds) || 0;
      const advance = advByDate.get(ds) || 0;
      running += earned + commission - advance;
      out.push({ date: ds, statusLabel, statusTone, earned, commission, advance, running });
    }
    return out;
  }, [mech, att, comm, adv, from, to, histSorted, openingBalance]);

  const closingBalance = useMemo(() => {
    if (dailyRows.length === 0) return openingBalance;
    return dailyRows[dailyRows.length - 1].running;
  }, [dailyRows, openingBalance]);

  const exportExcel = () => {
    const el = document.getElementById("ledger-table");
    if (!el) return;
    const html = el.outerHTML;
    const url = "data:application/vnd.ms-excel," + encodeURIComponent(html);
    const link = document.createElement("a");
    link.download = `Ledger_${mechName.replace(/\s+/g, "_")}.xls`;
    link.href = url;
    link.click();
  };

  const printLedger = () => window.print();

  const goMonth = (diff: number) => {
    const n = addMonthToDate(from, diff);
    router.push(`/salary/${mechId}/ledger?from=${n.from}&to=${n.to}`);
  };

  return (
    <AdminPage title="Mechanic Ledger" subtitle={`${mechName || "—"} · ${from} → ${to}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/salary" className={`${btnGhost} inline-flex items-center gap-2`}>
            <ArrowLeft size={14} /> Back
          </Link>
          <div className="flex items-center gap-2">
            <button className={btnGhost} onClick={() => goMonth(-1)} title="Prev Month">
              <ChevronLeft size={16} />
            </button>
            <button className={btnGhost} onClick={() => goMonth(1)} title="Next Month">
              <ChevronRight size={16} />
            </button>
            <button className={btnGhost} onClick={printLedger}>
              <span className="inline-flex items-center gap-2"><Printer size={14} /> Print</span>
            </button>
            <button className={btnNavy} onClick={exportExcel}>
              <span className="inline-flex items-center gap-2"><FileSpreadsheet size={14} /> Excel</span>
            </button>
          </div>
        </div>

        <div className={card}>
          <div className="p-4 border-b border-[#21293d]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className={label}>From</div>
                <input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <div className={label}>To</div>
                <input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button
                  className={btnNavy}
                  onClick={() => router.push(`/salary/${mechId}/ledger?from=${from}&to=${to}`)}
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>

          {err && <div className="p-4 text-red-400 text-sm border-b border-[#21293d]">{err}</div>}

          {loading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-slate-600 text-xs font-extrabold uppercase tracking-[0.3em]">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table id="ledger-table" className="w-full text-sm">
                <thead className="bg-[#111520] text-slate-600 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Earned Wage</th>
                    <th className="text-right px-4 py-3">Commission</th>
                    <th className="text-right px-4 py-3">Advance/Paid</th>
                    <th className="text-right px-4 py-3">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  <tr className="bg-amber-500/10">
                    <td className="px-4 py-3 text-slate-500" colSpan={5}>
                      Opening Balance (Old Balance)
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-black">{money(openingBalance)}</td>
                  </tr>
                  {dailyRows.map((r) => (
                    <tr key={r.date} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-300">{r.date}</td>
                      <td className={`px-4 py-3 font-black ${r.statusTone}`}>{r.statusLabel}</td>
                      <td className="px-4 py-3 text-right text-slate-200 font-bold">{money(r.earned)}</td>
                      <td className="px-4 py-3 text-right text-blue-300 font-black">{money(r.commission)}</td>
                      <td className="px-4 py-3 text-right text-red-300 font-black">{money(r.advance)}</td>
                      <td className="px-4 py-3 text-right text-slate-200 font-black">{money(r.running)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-500" colSpan={5}>
                      Closing Balance (Net Total)
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-black">{money(closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        @media print {
          a, button, input { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </AdminPage>
  );
}

