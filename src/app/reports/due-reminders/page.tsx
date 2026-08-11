"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CalendarClock, Search, MessageCircle, Loader2, ArrowLeft,
  AlertTriangle, CalendarOff, Clock, CheckCircle2, Calendar, X, ExternalLink, Save,
} from "lucide-react";
import Link from "next/link";
import { todayIST, parseISTDate, toLocalStr } from "@/lib/dateUtils";
import { substituteTemplate, firmVars } from "@/lib/whatsapp";
import { pageAll } from "@/lib/fetch-all";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

type DueRow = {
  id: number;
  name: string;
  contact: string;
  opening_balance: number;
  payment_due_date: string | null;
  payment_due_remarks: string | null;
  total_repairs: number;
  total_direct_sales: number;
  total_loans: number;
  total_payments: number;
  last_reminder: string | null;
  reminder_count: number;
  balance: number;
  status_key: "overdue" | "today" | "upcoming" | "future" | "no_date";
};

const STATUS_META: Record<DueRow["status_key"], { label: string; icon: React.ReactNode; card: string; chip: string }> = {
  overdue:  { label: "Overdue",  icon: <AlertTriangle size={20} />, card: "from-red-600 to-red-800",        chip: "bg-red-500/15 text-red-300 border-red-500/30" },
  today:    { label: "Due Today", icon: <Clock size={20} />,       card: "from-orange-500 to-orange-700",  chip: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  upcoming: { label: "Upcoming (7d)", icon: <CalendarClock size={20} />, card: "from-cyan-600 to-cyan-800", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  future:   { label: "Future",   icon: <Calendar size={20} />,     card: "from-slate-500 to-slate-700",    chip: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  no_date:  { label: "No Date",  icon: <CalendarOff size={20} />,  card: "from-slate-700 to-slate-900",    chip: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const FALLBACK_REMINDER = `नमस्ते {client_name} जी! 🙏

आपका बकाया बैलेंस (सेवा + लोन) *₹{balance}* है।

कृपया शीघ्र भुगतान करने का कष्ट करें।

🔸 *Payment Methods:*
• Cash (Shop पर)
• Bank Transfer
• UPI/Google Pay

🔸 *Payment Details:*
Account: {firm_name}
Contact: {firm_phone}

आपका समय देने के लिए धन्यवाद! 🙏

{firm_owner}
{firm_name}`;

function DueRemindersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DueRow[]>([]);

  // Firm info for templates
  const [firmInfo, setFirmInfo] = useState<Record<string, string>>({});
  const [reminderTpl, setReminderTpl] = useState(FALLBACK_REMINDER);

  // Due date modal
  const [dueModal, setDueModal] = useState<{ client: DueRow } | null>(null);
  const [dueForm, setDueForm] = useState({ due_date: "", due_remarks: "" });
  const [savingDue, setSavingDue] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Firm info + reminder template from system_info
      const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (sys || []).forEach(r => { info[r.meta_field] = r.meta_value; });
      setFirmInfo(info);
      setReminderTpl(info.whatsapp_reminder || FALLBACK_REMINDER);

      // All clients
      const { data: clients, error } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, opening_balance, payment_due_date, payment_due_remarks")
        .eq("delete_flag", 0);
      if (error) throw error;
      if (!clients || clients.length === 0) { setRows([]); return; }

      // Aggregates (batch, paginated to bypass the 1000-row PostgREST cap)
      const [repairs, sales, loans, payments, reminders] = await Promise.all([
        pageAll(supabase.from("transaction_list").select("client_name, amount").eq("status", 5)),
        pageAll(supabase.from("direct_sales").select("client_id, total_amount")),
        pageAll(supabase.from("client_loans").select("client_id, total_payable")),
        pageAll(supabase.from("client_payments").select("client_id, amount, discount")),
        pageAll(supabase.from("payment_reminders").select("client_id, reminder_date")),
      ]);

      const sumBy = (arr: ReturnType<typeof JSON.parse>[] | null, key: string, valFn: (r: ReturnType<typeof JSON.parse>) => number) => {
        const m = new Map<number, number>();
        (arr || []).forEach(r => {
          const id = Number(r[key]);
          if (!id) return;
          m.set(id, (m.get(id) || 0) + valFn(r));
        });
        return m;
      };
      const repairsMap = sumBy(repairs.data, "client_name", r => Number(r.amount) || 0);
      const salesMap   = sumBy(sales.data,   "client_id",   r => Number(r.total_amount) || 0);
      const loansMap   = sumBy(loans.data,   "client_id",   r => Number(r.total_payable) || 0);
      const payMap     = sumBy(payments.data, "client_id",  r => (Number(r.amount) || 0) + (Number(r.discount) || 0));
      const lastRemMap = new Map<number, string>();
      const countMap   = new Map<number, number>();
      (reminders.data || []).forEach(r => {
        const id = Number(r.client_id);
        if (!id) return;
        countMap.set(id, (countMap.get(id) || 0) + 1);
        const d = r.reminder_date;
        if (d && (!lastRemMap.has(id) || d > lastRemMap.get(id)!)) lastRemMap.set(id, d);
      });

      const today = parseISTDate(todayIST());
      const todayMs = today.getTime();

      const built: DueRow[] = clients.map(c => {
        const balance = (Number(c.opening_balance) || 0)
          + (repairsMap.get(c.id) || 0)
          + (salesMap.get(c.id) || 0)
          + (loansMap.get(c.id) || 0)
          - (payMap.get(c.id) || 0);

        let status_key: DueRow["status_key"] = "no_date";
        if (c.payment_due_date) {
          const dueMs = parseISTDate(c.payment_due_date).getTime();
          const diff = Math.round((dueMs - todayMs) / 86400000);
          status_key = diff < 0 ? "overdue" : diff === 0 ? "today" : diff <= 7 ? "upcoming" : "future";
        }

        return {
          id: c.id,
          name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
          contact: c.contact || "",
          opening_balance: Number(c.opening_balance) || 0,
          payment_due_date: c.payment_due_date || null,
          payment_due_remarks: c.payment_due_remarks || null,
          total_repairs: repairsMap.get(c.id) || 0,
          total_direct_sales: salesMap.get(c.id) || 0,
          total_loans: loansMap.get(c.id) || 0,
          total_payments: payMap.get(c.id) || 0,
          last_reminder: lastRemMap.get(c.id) || null,
          reminder_count: countMap.get(c.id) || 0,
          balance,
          status_key,
        };
      });

      setRows(built.filter(r => r.balance > 0.01));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filters ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      if (status !== "all" && r.status_key !== status) return false;
      if (from && r.payment_due_date && r.payment_due_date.slice(0, 10) < from) return false;
      if (to && r.payment_due_date && r.payment_due_date.slice(0, 10) > to) return false;
      if (q && !`${r.name} ${r.contact}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, from, to, search]);

  const stats = useMemo(() => {
    const s = { total: 0, overdue: 0, today: 0, upcoming: 0, no_date: 0, amount: 0 };
    filtered.forEach(r => {
      s.amount += r.balance;
      if (r.status_key === "overdue") s.overdue++;
      else if (r.status_key === "today") s.today++;
      else if (r.status_key === "upcoming") s.upcoming++;
      else if (r.status_key === "no_date") s.no_date++;
    });
    s.total = filtered.length;
    return s;
  }, [filtered]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(searchParams.toString());
    if (status === "all") p.delete("status"); else p.set("status", status);
    if (from) p.set("from", from); else p.delete("from");
    if (to) p.set("to", to); else p.delete("to");
    router.replace("?" + p.toString(), { scroll: false });
  };

  // ── WhatsApp reminder ──
  const sendWhatsApp = async (r: DueRow) => {
    const clean = r.contact.replace(/\D/g, "");
    if (clean.length < 10) return alert("Valid mobile number nahi mila!");
    const dueInfo = r.payment_due_date
      ? ` Aapki promised due date ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parseISTDate(r.payment_due_date))} hai.`
      : "";
    let msg = substituteTemplate(reminderTpl, {
      client_name: r.name,
      balance: inr(r.balance),
      ...firmVars(firmInfo),
    });
    if (dueInfo) msg = msg.replace("आपका समय देने के लिए धन्यवाद!", `${dueInfo}\n\nआपका समय देने के लिए धन्यवाद!`);
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, "_blank");

    // Log reminder to payment_reminders
    const { error } = await supabase
      .from("payment_reminders")
      .insert({ client_id: r.id, amount_due: r.balance, channel: "WhatsApp", status: "Sent", remarks: "Type: due_reminder" });
    if (error) console.error("log reminder:", error.message);
    fetchData();
  };

  // ── Set / clear due date ──
  const openDueModal = (r: DueRow) => {
    setDueForm({
      due_date: r.payment_due_date ? toLocalStr(new Date(r.payment_due_date)) : todayIST(),
      due_remarks: r.payment_due_remarks || "",
    });
    setDueModal({ client: r });
  };

  const saveDueDate = async (clear = false) => {
    if (!dueModal) return;
    setSavingDue(true);
    try {
      const updates: Record<string, string | null> = {
        payment_due_date: clear || !dueForm.due_date ? null : `${dueForm.due_date}T00:00:00+05:30`,
        payment_due_remarks: clear ? null : dueForm.due_remarks.trim() || null,
      };
      const { error } = await supabase
        .from("client_list")
        .update(updates)
        .eq("id", dueModal.client.id);
      if (error) throw error;
      setDueModal(null);
      fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingDue(false);
    }
  };

  const STAT_CARDS = [
    { key: "all",      label: "Clients With Due",  val: stats.total,   amt: stats.amount,   card: "from-violet-600 to-violet-800", icon: <CheckCircle2 size={22} /> },
    { key: "overdue",  label: "Overdue",           val: stats.overdue, amt: 0,              card: STATUS_META.overdue.card,         icon: STATUS_META.overdue.icon },
    { key: "today",    label: "Due Today",         val: stats.today,   amt: 0,              card: STATUS_META.today.card,           icon: STATUS_META.today.icon },
    { key: "upcoming", label: "Upcoming (7d)",     val: stats.upcoming, amt: 0,             card: STATUS_META.upcoming.card,        icon: STATUS_META.upcoming.icon },
    { key: "no_date",  label: "Due · No Date",     val: stats.no_date,  amt: 0,             card: STATUS_META.no_date.card,         icon: STATUS_META.no_date.icon },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link href="/reports" className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-blue-600/10 hover:border-blue-500/40 transition-all group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-700 rounded-3xl flex items-center justify-center shadow-xl shadow-red-500/20 ring-4 ring-red-500/10">
              <CalendarClock size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Due Reminders</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Promised Payment Dues</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#0d1117] border border-red-500/20 px-6 py-3 rounded-2xl flex flex-col items-end">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Total Due Amount</span>
              <span className="text-2xl font-black text-white">{inr(stats.amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAT_CARDS.map(c => (
          <button key={c.key} onClick={() => setStatus(c.key)}
            className={`bg-gradient-to-br ${c.card} rounded-2xl p-4 text-left text-white shadow-xl transition-all hover:scale-[1.02] cursor-pointer ring-2 ${status === c.key ? "ring-white/40" : "ring-transparent"}`}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{c.label}</div>
              {c.icon}
            </div>
            <div className="text-3xl font-black mt-1">{c.val}</div>
            {c.amt > 0 && <div className="text-sm font-bold opacity-90 mt-1">{inr(c.amt)}</div>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 flex flex-wrap items-end gap-6">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-6 flex-1">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="px-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-red-500 transition-all cursor-pointer">
              <option value="all">All Dues</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="upcoming">Upcoming (7d)</option>
              <option value="future">Future</option>
              <option value="no_date">No Due Date</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Due From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-red-500 transition-all [color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-2">Due To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-red-500 transition-all [color-scheme:dark]" />
          </div>
          <button type="submit" className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-red-600/20">
            Refresh Report
          </button>
        </form>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input type="text" placeholder="Search client or mobile..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-red-500 transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0d1117] text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
              <tr>
                <th className="px-6 py-5">Client</th>
                <th className="px-6 py-5 text-right">Balance Due</th>
                <th className="px-6 py-5">Due Date</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Remarks</th>
                <th className="px-6 py-5 text-center">Last Reminder</th>
                <th className="px-6 py-5 text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-8"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-600 italic">Koi client dues ke saath nahi mila. 🎉</td>
                </tr>
              ) : filtered.map((r) => {
                const meta = STATUS_META[r.status_key];
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <Link href={`/clients/${r.id}/view`} className="text-white font-black hover:text-red-400 transition-colors">{r.name}</Link>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">{r.contact}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-black text-red-400 text-base">{inr(r.balance)}</span>
                      <div className="text-[9px] text-slate-600 mt-0.5 font-semibold">
                        Open {inr(r.opening_balance)} · Rep {inr(r.total_repairs)} · DS {inr(r.total_direct_sales)} · Loan {inr(r.total_loans)} · Paid {inr(r.total_payments)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {r.payment_due_date
                        ? <span className="font-bold text-slate-200">{new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parseISTDate(r.payment_due_date))}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${meta.chip}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-slate-400 max-w-[180px] truncate block" title={r.payment_due_remarks || ""}>
                        {r.payment_due_remarks || <span className="text-slate-600">—</span>}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-xs text-slate-400">
                        {r.last_reminder
                          ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(r.last_reminder))
                          : <span className="text-slate-600">Never</span>}
                        <span className="block text-[9px] text-slate-600">{r.reminder_count} total</span>
                      </span>
                    </td>
                    <td className="px-6 py-5 no-print">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => sendWhatsApp(r)}
                          title="WhatsApp Reminder"
                          className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm">
                          <MessageCircle size={16} />
                        </button>
                        <button onClick={() => openDueModal(r)}
                          title="Set Due Date"
                          className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                          <Calendar size={16} />
                        </button>
                        {r.payment_due_date && (
                          <button onClick={async () => { if (confirm(`Kya aap ${r.name} ki due date clear karna chahte hain?`)) { setDueModal({ client: r }); setDueForm({ due_date: "", due_remarks: "" }); await saveDueDate(true); } }}
                            title="Clear Due Date"
                            className="p-2.5 bg-slate-500/10 border border-slate-500/20 text-slate-400 rounded-xl hover:bg-slate-500 hover:text-white transition-all shadow-sm">
                            <X size={16} />
                          </button>
                        )}
                        <Link href={`/clients/${r.id}/view`}
                          className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                          <ExternalLink size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SET DUE DATE MODAL ── */}
      {dueModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl bg-[#161b27] border-[#21293d]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar size={16} className="text-red-400" /> Set Due Date — <span className="text-slate-400 font-semibold">{dueModal.client.name}</span>
              </h3>
              <button onClick={() => setDueModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Promised Payment Date</label>
                <input type="date" value={dueForm.due_date} onChange={e => setDueForm({ ...dueForm, due_date: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[#0d1117] border-[#21293d] text-white focus:outline-none focus:border-red-500 transition-colors [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Promise Note / Remarks</label>
                <textarea rows={3} value={dueForm.due_remarks} onChange={e => setDueForm({ ...dueForm, due_remarks: e.target.value })}
                  placeholder="e.g. PhonePe se denge, cheque bhejenge..."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm bg-[#0d1117] border-[#21293d] text-white focus:outline-none focus:border-red-500 transition-colors resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => saveDueDate(false)} disabled={savingDue}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingDue ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Due Date
                </button>
                <button onClick={() => setDueModal(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-[#2a3550] text-slate-300 hover:bg-white/5 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DueRemindersReport() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-48"><Loader2 size={48} className="animate-spin text-red-500" /></div>}>
      <DueRemindersContent />
    </Suspense>
  );
}
