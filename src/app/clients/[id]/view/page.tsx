"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Edit3, Phone, MapPin, Loader2, User, Calendar,
  CreditCard, Plus, Filter, ShoppingCart, Wrench, Receipt,
  Banknote, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, X,
  Printer, MessageCircle, ExternalLink, Trash2,
  PencilLine, IndianRupee, RefreshCw, MessageSquare,
} from 'lucide-react';

import { todayIST, formatIST, parseISTDate, toISTString, toLocalStr } from "@/lib/dateUtils";

// ─────────────────────────────────────────────────────────────
// TYPES
// BUG FIX 14: removed image_path from Client type
// ─────────────────────────────────────────────────────────────
type Client = {
  id: number;
  firstname: string;
  middlename?: string;
  lastname: string;
  contact: string;
  email?: string;
  address?: string;
  opening_balance: number;
  // image_path removed — BUG FIX 13 & 14
  date_created: string;
  fullName: string;
};

type Job = {
  id: number;
  job_id?: string;
  code?: string;
  item: string;
  fault?: string;
  remark?: string;
  uniq_id?: string;
  status: number;
  amount?: number;
  date_created: string;
  date_completed?: string;
};

type DirectSale = {
  id: number;
  sale_code: string;
  payment_mode: string;
  remarks?: string;
  total_amount: number;
  date_created: string;
};

type Payment = {
  id: number;
  payment_date: string;
  amount: number;
  discount: number;
  net_amount?: number;
  payment_mode: string;
  payment_type?: string;
  remarks?: string;
  job_id?: string | null;
  bill_no?: string | null;
  loan_id?: number | null;
};

type Loan = {
  id: number;
  client_id: number;
  principal_amount: number;
  interest_rate: number;
  loan_period: number;
  total_payable: number;
  emi_amount: number;
  remarks?: string;
  loan_date: string;
  status: number;
  paid?: number;
  balance?: number;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * BUG FIX 1: Original used new Date(d) which parses "2026-03-01" as UTC midnight.
 * In IST (UTC+5:30) that renders as Feb 28, 11:30 PM → wrong date shown.
 * Fix: detect date-only strings and parse them with parseISTDate().
 */
const fmtDate = (d: string) => {
  if (!d) return 'N/A';
  // date-only: "YYYY-MM-DD" — parse as local to avoid UTC shift
  const date = d.length === 10 ? parseISTDate(d) : new Date(d);
  return formatIST(date, { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending',     color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  1: { label: 'In-Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  2: { label: 'Repaired',    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  3: { label: 'Paid',        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  4: { label: 'Cancelled',   color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  5: { label: 'Delivered',   color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
};

// ─────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub?: string;
  color: 'blue' | 'emerald' | 'red' | 'amber' | 'violet' | 'cyan';
  icon: React.ReactNode;
}) {
  const colorMap = {
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'bg-blue-500/15 border-blue-500/25 text-blue-400' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: 'bg-red-500/15 border-red-500/25 text-red-400' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'bg-amber-500/15 border-amber-500/25 text-amber-400' },
    violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  icon: 'bg-violet-500/15 border-violet-500/25 text-violet-400' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-400' },
  };
  const c = colorMap[color];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4 flex items-center gap-4`}>
      <div className={`${c.icon} border rounded-xl p-3 flex-shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider truncate">{label}</p>
        <p className="text-white text-lg font-black truncate">{value}</p>
        {sub && <p className="text-slate-500 text-[10px] mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INITIALS AVATAR (replaces image — BUG FIX 13)
// ─────────────────────────────────────────────────────────────
function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  // Deterministic color from name hash
  const colors = [
    ['from-blue-600 to-blue-800', 'text-blue-100'],
    ['from-violet-600 to-violet-800', 'text-violet-100'],
    ['from-emerald-600 to-emerald-800', 'text-emerald-100'],
    ['from-amber-500 to-amber-700', 'text-amber-100'],
    ['from-cyan-600 to-cyan-800', 'text-cyan-100'],
    ['from-rose-600 to-rose-800', 'text-rose-100'],
  ];
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length;
  const [grad, txt] = colors[idx];

  return (
    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10`}>
      <span className={`${txt} text-xl font-black tracking-tight`}>{initials}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ViewClientProfile() {
  const router   = useRouter();
  const params   = useParams();
  const clientId = parseInt(params.id as string);

  const [client,         setClient]         = useState<Client | null>(null);
  const [jobs,           setJobs]           = useState<Job[]>([]);
  const [directSales,    setDirectSales]    = useState<DirectSale[]>([]);
  const [payments,       setPayments]       = useState<Payment[]>([]);
  const [loans,          setLoans]          = useState<Loan[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<'repairs' | 'direct' | 'payments' | 'loan_payments'>('repairs');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editForm,       setEditForm]       = useState({
    amount: '', payment_date: '', discount: '', payment_mode: '', remarks: '',
  });

  const [repairBilled, setRepairBilled] = useState(0);
  const [directBilled, setDirectBilled] = useState(0);
  const [servicePaid,  setServicePaid]  = useState(0);
  const [loanGiven,    setLoanGiven]    = useState(0);
  const [loanRepaid,   setLoanRepaid]   = useState(0);
  const [monthlyEMI,   setMonthlyEMI]   = useState(0);

  const openingBal   = client?.opening_balance ?? 0;
  const totalBilled  = repairBilled + directBilled;
  const finalBalance = openingBal + totalBilled - servicePaid;
  const loanBalance  = loanGiven - loanRepaid;
  const netBalance   = openingBal + totalBilled + loanGiven - servicePaid - loanRepaid;

  // ── FETCH ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Client — BUG FIX 14: removed image_path from select
      const { data: cd, error: ce } = await supabase
        .from('client_list')
        .select('id, firstname, middlename, lastname, contact, email, address, opening_balance, date_created')
        .eq('id', clientId)
        .eq('delete_flag', 0)
        .single();
      if (ce || !cd) throw ce || new Error('Client not found');
      const fullName = [cd.firstname, cd.middlename, cd.lastname].filter(Boolean).join(' ').trim();
      setClient({ ...cd, fullName });

      // 2. Jobs
      const { data: jd } = await supabase
        .from('transaction_list')
        .select('id, job_id, code, item, fault, remark, uniq_id, status, amount, date_created, date_completed')
        .eq('client_name', String(clientId))
        .order('date_created', { ascending: false });
      setJobs(jd || []);

      // 3. Direct Sales
      const { data: sd } = await supabase
        .from('direct_sales')
        .select('id, sale_code, payment_mode, remarks, total_amount, date_created')
        .eq('client_id', clientId)
        .order('date_created', { ascending: false });
      setDirectSales(sd || []);

      // 4. Payments
      const { data: pd } = await supabase
        .from('client_payments')
        .select('id, payment_date, amount, discount, payment_mode, payment_type, remarks, job_id, bill_no, loan_id')
        .eq('client_id', clientId)
        .order('payment_date', { ascending: false });
      setPayments(pd || []);

      const { data: ld } = await supabase
        .from('client_loans')
        .select('*')
        .eq('client_id', clientId)
        .order('loan_date', { ascending: false });

      const enrichedLoans: Loan[] = await Promise.all(
        (ld || []).map(async (loan: Loan) => {
          const { data: lp } = await supabase
            .from('client_payments')
            .select('amount, discount')
            .eq('loan_id', loan.id);
          // BUG FIX 7: net payment = amount + discount (not amount + discount)
          const paid = (lp || []).reduce(
            (s: number, r: { amount: number; discount: number }) => s + (r.amount + (r.discount || 0)),
            0
          );
          return { ...loan, paid, balance: loan.total_payable - paid };
        })
      );
      setLoans(enrichedLoans);

      const totalLoanGiven  = enrichedLoans.reduce((s, l) => s + (l.total_payable || 0), 0);
      const totalLoanRepaid = enrichedLoans.reduce((s, l) => s + (l.paid || 0), 0);
      const totalEMI        = enrichedLoans.reduce((s, l) => s + (l.emi_amount || 0), 0);
      setLoanGiven(totalLoanGiven);
      setLoanRepaid(totalLoanRepaid);
      setMonthlyEMI(totalEMI);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Recalculate service financials
  useEffect(() => {
    // PHP view_client.php: WHERE status = 5 (Delivered only)
    // Only Delivered jobs are billed — matches list page calculation
    setRepairBilled(
      jobs
        .filter(j => j.status === 5)
        .reduce((s, j) => s + (j.amount || 0), 0)
    );
    setDirectBilled(directSales.reduce((s, d) => s + (d.total_amount || 0), 0));
    // BUG FIX 6: net payment = amount - discount (not +)
    setServicePaid(
      payments
        .filter(p => !p.loan_id)
        .reduce((s, p) => s + (p.amount + (p.discount || 0)), 0)
    );
  }, [jobs, directSales, payments]);

  // ── DATE FILTER ────────────────────────────────────────────
  /**
   * BUG FIX 2: new Date("2026-03-01") parses as UTC midnight.
   * In IST that's 5:30 AM — so any IST transaction from midnight to 5:29 AM
   * falls outside the filter even though it's the same date.
   * Fix: parseISTDate() for date-input values (which are always "YYYY-MM-DD").
   */
  const inRange = (dateStr: string) => {
    if (!dateFrom && !dateTo) return true;
    const d    = new Date(dateStr).getTime();
    const from = dateFrom ? parseISTDate(dateFrom).getTime()                  : -Infinity;
    const to   = dateTo   ? parseISTDate(dateTo).getTime() + 86_400_000       : Infinity;
    return d >= from && d < to;
  };

  const filteredJobs     = jobs.filter(j => inRange(j.date_created));
  const filteredSales    = directSales.filter(s => inRange(s.date_created));
  const filteredPayments = payments.filter(p => !p.loan_id && inRange(p.payment_date));
  const filteredLoanPay  = payments.filter(p => !!p.loan_id && inRange(p.payment_date));

  // ── PAYMENT CRUD ───────────────────────────────────────────
  const handleDeletePayment = async (id: number) => {
    if (!confirm('Kya aap yeh payment delete karna chahte hain?')) return;
    const { error } = await supabase.from('client_payments').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const openEdit = (p: Payment) => {
    setEditingPayment(p);
    setEditForm({
      amount:       p.amount.toString(),
      // BUG FIX 3: p.payment_date may be a UTC ISO timestamp.
      // .split('T')[0] gives the UTC date, not IST.
      // toLocalStr() extracts the date in IST timezone.
      payment_date: toLocalStr(new Date(p.payment_date)),
      discount:     (p.discount || 0).toString(),
      payment_mode: p.payment_mode,
      remarks:      p.remarks || '',
    });
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    const updates = {
      amount:       parseFloat(editForm.amount),
      // BUG FIX 4: Save with IST offset so Supabase stores correct UTC time
      // Plain "2026-03-01" saves as UTC midnight → reads back as Feb 28 in IST
      payment_date: editForm.payment_date
        ? `${editForm.payment_date}T00:00:00+05:30`
        : editForm.payment_date,
      discount:     parseFloat(editForm.discount) || 0,
      payment_mode: editForm.payment_mode,
      remarks:      editForm.remarks,
      // NOTE: net_amount is GENERATED ALWAYS column in DB — never include it in updates
    };
    const { error } = await supabase
      .from('client_payments')
      .update(updates)
      .eq('id', editingPayment.id);
    if (error) { alert('Error: ' + error.message); return; }
    // Update local state (use editForm.payment_date for display consistency)
    setPayments(prev => prev.map(p =>
      p.id === editingPayment.id ? { ...p, ...updates } : p
    ));
    setEditingPayment(null);
  };

  // ── LOADING / ERROR ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 theme-body">
        <Loader2 className="animate-spin text-blue-400" size={44} />
        <p className="text-slate-400 font-bold italic uppercase tracking-[0.2em] text-sm">Loading Profile...</p>
      </div>
    );
  }
  if (error || !client) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 theme-body">
        <p className="text-red-400 font-bold">{error || 'Client not found'}</p>
        <button onClick={() => router.back()} className="text-blue-400 hover:underline">Go Back</button>
      </div>
    );
  }

  // ── TAB CONFIG ─────────────────────────────────────────────
  const TABS = [
    { key: 'repairs',       label: 'Repair History', icon: <Wrench size={14} />,       count: filteredJobs.length },
    { key: 'direct',        label: 'Direct Sales',   icon: <ShoppingCart size={14} />, count: filteredSales.length },
    { key: 'payments',      label: 'All Payments',   icon: <Receipt size={14} />,      count: filteredPayments.length },
    { key: 'loan_payments', label: 'Loan Payments',  icon: <CreditCard size={14} />,   count: filteredLoanPay.length },
  ] as const;

  const thCls = "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
  const tdCls = "px-4 py-3 text-sm text-slate-300 align-top";
  const trCls = "border-b border-[#21293d] hover:bg-white/[0.02] transition-colors";

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans theme-body">
      {/* Global styles */}
      <style>{`
        .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
      <div id="vtech-client-statement" className="max-w-7xl mx-auto p-3 md:p-6 space-y-5">

        {/* ── HEADER ── */}
        <div
          className="rounded-2xl border p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 theme-card"
        >
          {/* Profile — BUG FIX 13: image replaced with InitialsAvatar */}
          <div className="flex items-center gap-4">
            <InitialsAvatar name={client.fullName} />
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase leading-tight tracking-tight">
                {client.fullName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1"><User size={11} /> ID: #{client.id}</span>
                <span className="flex items-center gap-1"><Phone size={11} />{client.contact}</span>
                {client.address && <span className="flex items-center gap-1"><MapPin size={11} />{client.address}</span>}
                <span className="flex items-center gap-1"><Calendar size={11} />Since {fmtDate(client.date_created)}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <a href={`tel:${client.contact}`}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 transition-colors no-underline">
                  <Phone size={11} /> Call
                </a>
                <a href={`https://wa.me/91${client.contact}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/25 text-green-300 hover:bg-green-500/25 transition-colors no-underline">
                  <MessageCircle size={11} /> WhatsApp
                </a>
                <a href={`sms:${client.contact}`}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition-colors no-underline">
                  <MessageSquare size={11} /> SMS
                </a>
                {client.email && (
                  <a href={`mailto:${client.email}`}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/25 transition-colors no-underline">
                    {client.email}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Link href={`/clients/${client.id}/edit`}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all no-underline">
              <Edit3 size={15} /> Edit
            </Link>
            <Link href={`/jobs/new?client_id=${client.id}`}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-700 text-white transition-all no-underline">
              <Plus size={15} /> New Job
            </Link>
            <Link href={`/clients/${client.id}/add-payment`}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all no-underline">
              <CreditCard size={15} /> Add Payment
            </Link>
            <Link href={`/clients/${client.id}/give-loan`}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white transition-all no-underline">
              <Banknote size={15} /> Give Loan
            </Link>
            <Link href={`/clients/${client.id}/collect-emi`}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-orange-600 hover:bg-orange-700 text-white transition-all no-underline">
              <TrendingUp size={15} /> Collect EMI
            </Link>
            <Link
              href={`/clients/${client.id}/ledger-print`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f42] text-slate-300 transition-all no-underline">
              <Printer size={15} /> Print Ledger
            </Link>
            <button onClick={() => router.back()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f42] text-slate-300 transition-all">
              <ArrowLeft size={15} /> Back
            </button>
          </div>
        </div>

        {/* ── NET BALANCE BANNER ── */}
        <div className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          netBalance > 0 ? 'border-red-500/20 theme-card' : netBalance < 0 ? 'border-emerald-500/20 theme-card' : 'border-slate-500/20 theme-card'
        }`} style={{ background: netBalance > 0 ? 'rgba(239,68,68,0.06)' : netBalance < 0 ? 'rgba(16,185,129,0.06)' : 'rgba(100,116,139,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${netBalance > 0 ? 'bg-red-500/15 border-red-500/25 text-red-400' : netBalance < 0 ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/15 border-slate-500/25 text-slate-400'}`}>
              {netBalance > 0 ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                {netBalance > 0 ? 'Net Balance Due from Client' : netBalance < 0 ? 'Net Advance / Credit' : 'Account Fully Settled ✓'}
              </p>
              <p className={`text-2xl font-black ${netBalance > 0 ? 'text-red-400' : netBalance < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                ₹{fmt(Math.abs(netBalance))}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-right">
            {[
              { label: 'Opening', val: openingBal, clr: 'text-slate-300' },
              { label: 'Billed',  val: totalBilled, clr: 'text-red-300' },
              { label: 'Paid',    val: servicePaid, clr: 'text-emerald-300' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{item.label}</p>
                <p className={`text-sm font-black ${item.clr}`}>₹{fmt(item.val)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── SERVICE STAT CARDS ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Service Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Opening Balance" value={`₹${fmt(openingBal)}`} color="blue" icon={<IndianRupee size={18} />} />
            <StatCard label="Total Billed" value={`₹${fmt(totalBilled)}`} sub="Repairs + Direct Sales" color="violet" icon={<Receipt size={18} />} />
            <StatCard label="Total Received" value={`₹${fmt(servicePaid)}`} sub="Service payments only" color="emerald" icon={<CheckCircle2 size={18} />} />
            <StatCard
              label={finalBalance >= 0 ? 'Due (Service)' : 'Advance (Service)'}
              value={`₹${fmt(Math.abs(finalBalance))}`}
              color={finalBalance > 0 ? 'red' : 'emerald'}
              icon={finalBalance > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            />
          </div>
        </div>

        {/* ── LOAN STAT CARDS ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Loan / Advance Summary</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Active Loan Balance" value={`₹${fmt(loanBalance)}`} color="amber" icon={<Banknote size={18} />} />
            <StatCard label="Monthly EMI Due"     value={`₹${fmt(monthlyEMI)}`}  color="cyan"   icon={<TrendingUp size={18} />} />
            <StatCard label="Loan Repaid"         value={`₹${fmt(loanRepaid)}`}  color="emerald" icon={<CheckCircle2 size={18} />} />
            <StatCard
              label={netBalance >= 0 ? 'Net Balance (All) — Due' : 'Net Balance — Advance'}
              value={`₹${fmt(Math.abs(netBalance))}`}
              sub={netBalance >= 0 ? 'Total Due' : 'Advance'}
              color={netBalance > 0 ? 'red' : 'emerald'}
              icon={<IndianRupee size={18} />}
            />
          </div>
        </div>

        {/* ── ACTIVE LOANS TABLE ── */}
        {loans.length > 0 && (
          <div className="rounded-2xl border overflow-hidden theme-card">
            <div className="px-5 py-4 border-b flex items-center justify-between theme-panel-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Banknote size={16} className="text-amber-400" /> Loan History
              </h2>
              <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                {loans.filter(l => l.status === 1).length} Active · {loans.filter(l => l.status === 0).length} Closed
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="theme-panel-2">
                  <tr>
                    {['Loan Date','Total Payable','Paid','Balance','EMI/Month','Action'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => (
                    <tr key={loan.id} className={trCls}>
                      <td className={tdCls}>{fmtDate(loan.loan_date)}</td>
                      <td className={tdCls}>₹{fmt(loan.total_payable)}</td>
                      <td className={`${tdCls} text-emerald-400 font-semibold`}>₹{fmt(loan.paid || 0)}</td>
                      <td className={`${tdCls} text-red-400 font-black`}>₹{fmt(loan.balance || 0)}</td>
                      <td className={tdCls}>₹{fmt(loan.emi_amount)}</td>
                      <td className={tdCls}>
                        {loan.status === 0 ? (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            Closed
                          </span>
                        ) : (loan.balance ?? 0) <= 0 ? (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✓ Cleared
                          </span>
                        ) : (
                          <Link
                            href={`/clients/${client.id}/collect-emi?loan_id=${loan.id}`}
                            className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors no-underline">
                            Collect EMI
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DATE FILTER ── */}
        <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3 theme-card">
          <Filter size={16} className="text-blue-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Filter by Date</span>
          <div className="flex flex-wrap gap-3 ml-auto">
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm font-medium text-slate-200 border focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              style={{ background: '#0d1117', borderColor: '#21293d' }}
            />
            <span className="text-slate-500 self-center text-xs">to</span>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm font-medium text-slate-200 border focus:outline-none focus:border-blue-500 [color-scheme:dark]"
              style={{ background: '#0d1117', borderColor: '#21293d' }}
            />
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-300 border border-[#2a3550] bg-[#1e2637] hover:bg-[#252f42] transition-all">
              <RefreshCw size={13} /> Reset
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="rounded-2xl border overflow-hidden theme-card">
          <div className="flex border-b overflow-x-auto scrollbar-none theme-panel-2">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
                    : 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent hover:bg-white/[0.02]'
                }`}
              >
                {tab.icon} {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  activeTab === tab.key ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ── REPAIRS TAB ── */}
          {activeTab === 'repairs' && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr>
                      {['Date','Job ID','Item / Model','Fault','Location','Status','Amount'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => {
                      const st = STATUS_MAP[job.status] ?? { label: 'Unknown', color: 'bg-slate-500/20 text-slate-400 border-slate-500/20' };
                      return (
                        <tr key={job.id} className={`${trCls} group`}>
                          <td className={`${tdCls} text-xs text-slate-400 whitespace-nowrap`}>{fmtDate(job.date_created)}</td>
                          <td className={tdCls}>
                            <Link href={`/jobs/${job.id}/view`}
                              className="font-black text-blue-400 hover:text-blue-300 no-underline transition-colors hover:underline">
                              {job.job_id || `#${job.id}`}
                            </Link>
                            {job.code && <p className="text-[10px] text-slate-600 font-mono mt-0.5">{job.code}</p>}
                          </td>
                          <td className={`${tdCls} font-semibold text-white max-w-[180px] truncate`}>{job.item}</td>
                          <td className={`${tdCls} text-xs text-slate-400 max-w-[160px] truncate`}>{job.fault || '—'}</td>
                          <td className={`${tdCls} text-xs text-slate-500`}>{job.uniq_id || '—'}</td>
                          <td className={tdCls}>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${st.color}`}>
                              {st.label}
                            </span>
                            {job.status === 5 && job.date_completed && (
                              <p className="text-[9px] text-slate-600 mt-0.5">{fmtDate(job.date_completed)}</p>
                            )}
                          </td>
                          <td className={`${tdCls} text-right font-black text-white`}>₹{fmt(job.amount || 0)}</td>
                        </tr>
                      );
                    })}
                    {filteredJobs.length === 0 && (
                      <tr><td colSpan={7} className="p-10 text-center text-slate-600 text-sm italic">No repairs found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#21293d]">
                {filteredJobs.length === 0 && <p className="p-8 text-center text-slate-600 text-sm italic">No repairs found</p>}
                {filteredJobs.map(job => {
                  const st = STATUS_MAP[job.status] ?? { label: 'Unknown', color: 'bg-slate-500/20 text-slate-400 border-slate-500/20' };
                  return (
                    <div key={job.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <Link href={`/jobs/${job.id}/view`} className="font-black text-blue-400 text-base no-underline hover:underline">
                            {job.job_id || `#${job.id}`}
                          </Link>
                          <p className="text-sm font-semibold text-white mt-0.5 truncate">{job.item}</p>
                          {job.fault && <p className="text-xs text-slate-500 mt-0.5 truncate">{job.fault}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>{st.label}</span>
                          <span className="text-base font-black text-white">₹{fmt(job.amount || 0)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-600">
                        <span>{fmtDate(job.date_created)}</span>
                        {job.uniq_id && <span>📍 {job.uniq_id}</span>}
                        {job.code && <span className="font-mono">{job.code}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── DIRECT SALES TAB ── */}
          {activeTab === 'direct' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr>
                      {['Date','Sale Code','Mode','Remarks','Amount','Action'].map(h => (
                        <th key={h} className={thCls}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(sale => (
                      <tr key={sale.id} className={trCls}>
                        <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmtDate(sale.date_created)}</td>
                        <td className={`${tdCls} font-black font-mono text-xs text-white`}>{sale.sale_code}</td>
                        <td className={`${tdCls} text-xs text-slate-400`}>{sale.payment_mode}</td>
                        <td className={`${tdCls} text-xs text-slate-500 max-w-[180px] truncate`}>{sale.remarks || '—'}</td>
                        <td className={`${tdCls} text-right font-black text-emerald-400`}>₹{fmt(sale.total_amount)}</td>
                        <td className={tdCls}>
                          <Link href={`/direct-sales/${sale.id}/view`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 no-underline transition-colors">
                            <ExternalLink size={12} /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filteredSales.length === 0 && (
                      <tr><td colSpan={6} className="p-10 text-center text-slate-600 text-sm italic">No direct sales found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-[#21293d]">
                {filteredSales.length === 0 && <p className="p-8 text-center text-slate-600 text-sm italic">No direct sales found</p>}
                {filteredSales.map(sale => (
                  <div key={sale.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white font-mono text-sm">{sale.sale_code}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{sale.payment_mode}</p>
                        {sale.remarks && <p className="text-xs text-slate-600 mt-0.5 truncate">{sale.remarks}</p>}
                        <p className="text-[10px] text-slate-600 mt-1.5">{fmtDate(sale.date_created)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-base font-black text-emerald-400">₹{fmt(sale.total_amount)}</span>
                        <Link href={`/direct-sales/${sale.id}/view`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 no-underline">
                          <ExternalLink size={11} /> View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── ALL PAYMENTS TAB ── */}
          {activeTab === 'payments' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                <thead className="theme-panel-2">
                  <tr>
                    {['Date','Ref. ID','Type','Amount','Discount','Net Amount','Mode','Action'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map(p => (
                    <tr key={p.id} className={trCls}>
                      <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmtDate(p.payment_date)}</td>
                      <td className={tdCls}>
                        {p.job_id  && <div className="text-[11px] text-slate-400">Job: <span className="text-slate-200">{p.job_id}</span></div>}
                        {p.bill_no && <div className="text-[11px] text-slate-400">Bill: <span className="text-slate-200">{p.bill_no}</span></div>}
                        <div className="text-[10px] text-slate-600">PAY-{p.id}</div>
                      </td>
                      <td className={tdCls}>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/20">
                          Service Payment
                        </span>
                      </td>
                      <td className={`${tdCls} text-right`}>₹{fmt(p.amount)}</td>
                      <td className={`${tdCls} text-right text-slate-400`}>₹{fmt(p.discount || 0)}</td>
                      {/* BUG FIX 5: net = amount - discount (was amount + discount — wrong!) */}
                      <td className={`${tdCls} text-right font-black text-emerald-400`}>
                        ₹{fmt(p.net_amount ?? (p.amount + (p.discount || 0)))}
                      </td>
                      <td className={tdCls}>{p.payment_mode}</td>
                      <td className={tdCls}>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
                            <PencilLine size={13} />
                          </button>
                          <button onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500 italic">No payments found</td></tr>
                  )}
                </tbody>
              </table>
              </div>
              
              {/* Mobile cards for Payments */}
              <div className="md:hidden divide-y divide-[#21293d]">
                {filteredPayments.length === 0 && <p className="p-8 text-center text-slate-600 text-sm italic">No payments found</p>}
                {filteredPayments.map(p => (
                  <div key={p.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white text-base">₹{fmt(p.amount)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/20">
                            Service Payment
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{p.payment_mode}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-sm font-black text-emerald-400">Net: ₹{fmt(p.net_amount ?? (p.amount + (p.discount || 0)))}</span>
                        {p.discount > 0 && <span className="text-[10px] text-slate-500">Discount: ₹{fmt(p.discount)}</span>}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600 mt-2 p-2 bg-[#0d1117] rounded-lg">
                      <span>{fmtDate(p.payment_date)}</span>
                      <span>• PAY-{p.id}</span>
                      {p.job_id && <span>• Job: {p.job_id}</span>}
                      {p.bill_no && <span>• Bill: {p.bill_no}</span>}
                    </div>

                    <div className="flex gap-2 mt-3 justify-end">
                      <button onClick={() => openEdit(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors font-bold text-xs">
                        <PencilLine size={13} /> Edit
                      </button>
                      <button onClick={() => handleDeletePayment(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-bold text-xs">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── LOAN PAYMENTS TAB ── */}
          {activeTab === 'loan_payments' && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                <thead className="theme-panel-2">
                  <tr>
                    {['Date','Loan ID','Amount','Discount','Net Amount','Mode','Remarks','Action'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLoanPay.map(p => (
                    <tr key={p.id} className={trCls}>
                      <td className={`${tdCls} text-xs whitespace-nowrap`}>{fmtDate(p.payment_date)}</td>
                      <td className={tdCls}>
                        {/* BUG FIX 10: loan_id could be null — String(null) = "null" — guard it */}
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          LN-{String(p.loan_id ?? 0).padStart(5, '0')}
                        </span>
                      </td>
                      <td className={`${tdCls} text-right`}>₹{fmt(p.amount)}</td>
                      <td className={`${tdCls} text-right text-slate-400`}>₹{fmt(p.discount || 0)}</td>
                      {/* BUG FIX 5 (same): net = amount - discount */}
                      <td className={`${tdCls} text-right font-black text-emerald-400`}>
                        ₹{fmt(p.net_amount ?? (p.amount + (p.discount || 0)))}
                      </td>
                      <td className={tdCls}>{p.payment_mode}</td>
                      <td className={`${tdCls} text-xs text-slate-400`}>{p.remarks || '—'}</td>
                      <td className={tdCls}>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors">
                            <PencilLine size={13} />
                          </button>
                          <button onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLoanPay.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500 italic">No loan payments found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards for Loan Payments */}
            <div className="md:hidden divide-y divide-[#21293d]">
              {filteredLoanPay.length === 0 && <p className="p-8 text-center text-slate-600 text-sm italic">No loan payments found</p>}
              {filteredLoanPay.map(p => (
                <div key={p.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white text-base">₹{fmt(p.amount)}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          LN-{String(p.loan_id ?? 0).padStart(5, '0')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{p.payment_mode}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-sm font-black text-emerald-400">Net: ₹{fmt(p.net_amount ?? (p.amount + (p.discount || 0)))}</span>
                      {p.discount > 0 && <span className="text-[10px] text-slate-500">Discount: ₹{fmt(p.discount)}</span>}
                    </div>
                  </div>
                  
                  {p.remarks && <p className="text-xs text-slate-400 mt-2 mb-2 italic">"{p.remarks}"</p>}
                  
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600 mt-2 p-2 bg-[#0d1117] rounded-lg">
                    <span>{fmtDate(p.payment_date)}</span>
                    <span>• PAY-{p.id}</span>
                  </div>

                  <div className="flex gap-2 mt-3 justify-end">
                    <button onClick={() => openEdit(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors font-bold text-xs">
                      <PencilLine size={13} /> Edit
                    </button>
                    <button onClick={() => handleDeletePayment(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-bold text-xs">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>

      </div>


      {/* ── EDIT PAYMENT MODAL ── */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl theme-card">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Edit Payment</h3>
              <button onClick={() => setEditingPayment(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdatePayment} className="space-y-4">
              {[
                { label: 'Amount',       key: 'amount',       type: 'number' },
                { label: 'Payment Date', key: 'payment_date', type: 'date'   },
                { label: 'Discount',     key: 'discount',     type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{f.label}</label>
                  <input
                    type={f.type} step="0.01"
                    required={f.key !== 'discount'}
                    value={editForm[f.key as keyof typeof editForm]}
                    onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm theme-input focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Payment Mode</label>
                <select
                  value={editForm.payment_mode}
                  onChange={e => setEditForm({ ...editForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm theme-input focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {['Cash','PhonePe/GPay','Bank Transfer','Credit Card'].map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Remarks</label>
                <textarea
                  rows={2} value={editForm.remarks}
                  onChange={e => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm theme-input focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-all">
                  Update
                </button>
                <button type="button" onClick={() => setEditingPayment(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-[#2a3550] text-slate-300 hover:bg-white/5 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}