"use client";
import React, { useState, useEffect, use, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Edit3, Phone, Mail, MapPin, Loader2,
  Plus, Wallet, CreditCard, Printer, MessageCircle,
  X, Save, CheckCircle2,
  AlertTriangle, TrendingUp, Wrench, Package,
  Eye, Trash2, MessageSquare,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr = (v: number, sign = true) => `${sign && v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
import { todayIST } from "@/lib/dateUtils";

// ─── Types ────────────────────────────────────────────────────────────────────
type Client = {
  id: number; firstname: string; middlename?: string; lastname: string;
  contact: string; email?: string; address?: string; image_path?: string;
  opening_balance: number; date_created: string;
};
type Repair = { id: number; job_id: string; code: string; item: string; fault: string; remark: string; uniq_id: string; amount: number; status: number; date_created: string; date_completed?: string; date_updated: string };
type Payment = { id: number; amount: number; discount: number; payment_date: string; payment_mode: string; remarks?: string; job_id?: string; loan_id?: number; created_at: string };
type Loan = { id: number; principal_amount: number; interest_rate: number; loan_period: number; total_payable: number; emi_amount: number; loan_date: string; status: number; created_at: string };
type DirectSale = { id: number; sale_code: string; total_amount: number; payment_mode: string; remarks?: string; date_created: string };
type Toast = { type: "success" | "error" | "info"; msg: string };

const STATUS_MAP: Record<number, string> = { 0: "Pending", 1: "On-Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered" };
const STATUS_COLORS: Record<number, string> = { 0: "bg-slate-600", 1: "bg-blue-600", 2: "bg-cyan-600", 3: "bg-emerald-600", 4: "bg-red-600", 5: "bg-purple-600" };

// ─── FIRM DETAILS ─────────────────────────────────────────────────────────────
export default function ViewClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const clientId = parseInt(resolvedParams.id);

  // Data
  const [client, setClient] = useState<Client | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [directSales, setDirectSales] = useState<DirectSale[]>([]);
  const [userRole, setUserRole] = useState<string>("staff");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Tab
  const [activeTab, setActiveTab] = useState<"repairs" | "sales" | "payments" | "loans">("repairs");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Add Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDiscount, setPayDiscount] = useState("0");
  const [payMode, setPayMode] = useState("Cash");
  const [payRemarks, setPayRemarks] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  // Add Loan Modal
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanRate, setLoanRate] = useState("0");
  const [loanPeriod, setLoanPeriod] = useState("12");
  const [loanRemarks, setLoanRemarks] = useState("");
  const [savingLoan, setSavingLoan] = useState(false);

  // Collect EMI Modal
  const [showEmiModal, setShowEmiModal] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [emiAmount, setEmiAmount] = useState("");
  const [emiRemarks, setEmiRemarks] = useState("");
  const [savingEmi, setSavingEmi] = useState(false);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!clientId || isNaN(clientId)) { router.push("/clients"); return; }
    setLoading(true);
    try {
      // User role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        setUserRole(p?.role || "staff");
      }

      // Client
      const { data: c, error: cErr } = await supabase.from("client_list").select("*").eq("id", clientId).single();
      if (cErr || !c) { router.push("/clients"); return; }
      setClient(c as Client);

      // Repairs
      const { data: r } = await supabase.from("transaction_list").select("*").eq("client_name", String(clientId)).order("date_created", { ascending: false });
      setRepairs((r || []) as Repair[]);

      // Payments (all)
      const { data: p } = await supabase.from("client_payments").select("*").eq("client_id", clientId).order("payment_date", { ascending: false });
      setPayments((p || []) as Payment[]);

      // Loans
      const { data: l } = await supabase.from("client_loans").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      setLoans((l || []) as Loan[]);

      // Direct Sales
      const { data: ds } = await supabase.from("direct_sales").select("*").eq("client_id", clientId).order("date_created", { ascending: false });
      setDirectSales((ds || []) as DirectSale[]);

    } catch (err) { console.error("fetchData:", err); }
    finally { setLoading(false); }
  }, [clientId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculations
  const repairBilled = repairs.filter(r => r.status === 5).reduce((s, r) => s + toNum(r.amount), 0);
  const saleBilled = directSales.reduce((s, d) => s + toNum(d.total_amount), 0);
  const totalBilled = repairBilled + saleBilled;
  const totalPaid = payments.reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
  const loanGiven = loans.reduce((s, l) => s + toNum(l.total_payable), 0);
  const loanBalance = loans.filter(l => l.status === 1).reduce((s, l) => {
    const p = payments.filter(pay => pay.loan_id === l.id).reduce((acc, pay) => acc + toNum(pay.amount) + toNum(pay.discount), 0);
    return s + (toNum(l.total_payable) - p);
  }, 0);
  const netBalance = (toNum(client?.opening_balance) || 0) + repairBilled + saleBilled + loanGiven - totalPaid;
  const monthlyEmi = loans.filter(l => l.status === 1).reduce((s, l) => s + toNum(l.emi_amount), 0);

  // Filtered repairs by date
  const filteredRepairs = repairs.filter(r => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(r.date_created);
    if (dateFrom && d < new Date(dateFrom + "T00:00:00+05:30")) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59+05:30")) return false;
    return true;
  });

  // Print Full Ledger
  const printFullLedger = () => {
    window.open(`/api/print-client-ledger?id=${clientId}`, "_blank");
  };

  // Add Payment
  const handleAddPayment = async () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) { setToast({ type: "error", msg: "Valid amount daalo!" }); return; }
    setSavingPay(true);
    const { error } = await supabase.from("client_payments").insert({
      client_id: clientId, amount: amt, discount: parseFloat(payDiscount) || 0,
      payment_mode: payMode, remarks: payRemarks.trim() || null,
      payment_date: todayIST(),
    });
    if (error) setToast({ type: "error", msg: "Payment save nahi hua: " + error.message });
    else { setToast({ type: "success", msg: "Payment save ho gayi! ✅" }); setShowPayModal(false); fetchData(); }
    setSavingPay(false);
  };

  // Give Loan
  const handleGiveLoan = async () => {
    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) { setToast({ type: "error", msg: "Valid amount daalo!" }); return; }
    setSavingLoan(true);
    const rate = parseFloat(loanRate) || 0;
    const period = parseInt(loanPeriod) || 12;
    const total = amt * (1 + rate / 100);
    const emi = total / period;
    const { error } = await supabase.from("client_loans").insert({
      client_id: clientId, principal_amount: amt, interest_rate: rate,
      loan_period: period, total_payable: total, emi_amount: emi,
      remarks: loanRemarks.trim() || null, loan_date: todayIST(),
      status: 1,
    });
    if (error) setToast({ type: "error", msg: "Loan save nahi hua: " + error.message });
    else { setToast({ type: "success", msg: "Loan de di gayi! ✅" }); setShowLoanModal(false); fetchData(); }
    setSavingLoan(false);
  };

  // Collect EMI
  const handleCollectEmi = async () => {
    const amt = parseFloat(emiAmount);
    if (isNaN(amt) || amt <= 0) { setToast({ type: "error", msg: "Valid amount daalo!" }); return; }
    if (!selectedLoanId) { setToast({ type: "error", msg: "Loan select karo!" }); return; }
    setSavingEmi(true);
    const { error } = await supabase.from("client_payments").insert({
      client_id: clientId, loan_id: selectedLoanId, amount: amt,
      discount: 0, payment_mode: "Cash",
      remarks: emiRemarks.trim() || null,
      payment_date: todayIST(),
    });
    if (error) setToast({ type: "error", msg: "EMI save nahi hua: " + error.message });
    else { setToast({ type: "success", msg: "EMI collect ho gayi! ✅" }); setShowEmiModal(false); fetchData(); }
    setSavingEmi(false);
  };

  // Delete Payment
  const handleDeletePayment = async (id: number) => {
    if (userRole !== "admin") { setToast({ type: "error", msg: "Sirf Admin delete kar sakta hai!" }); return; }
    if (!confirm("Payment delete karein?")) return;
    const { error } = await supabase.from("client_payments").delete().eq("id", id);
    if (error) setToast({ type: "error", msg: "Delete nahi hua!" });
    else { setToast({ type: "success", msg: "Payment delete ho gayi!" }); fetchData(); }
  };

  // Close Loan
  const handleCloseLoan = async (id: number) => {
    if (!confirm("Loan close karein?")) return;
    const { error } = await supabase.from("client_loans").update({ status: 0 }).eq("id", id);
    if (error) setToast({ type: "error", msg: "Loan close nahi hua!" });
    else { setToast({ type: "success", msg: "Loan close ho gaya!" }); fetchData(); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center theme-body">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-[#475569] dark:text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Loading Client…</p>
    </div>
  );

  if (!client) return null;

  const clientName = `${client.firstname} ${client.middlename || ""} ${client.lastname}`.trim();
  const phone = client.contact?.replace(/\D/g, "") || "";

  return (
    <div className="min-h-screen theme-body text-slate-200 font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : toast.type === "error" ? "bg-red-500/15 border-red-500/30 text-red-400"
          : "bg-blue-500/15 border-blue-500/30 text-blue-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-20 theme-topbar backdrop-blur border-b border-[#21293d] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/clients" className="w-10 h-10 flex items-center justify-center theme-panel border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all">
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-black text-white dark:text-slate-100 text-lg leading-none">{clientName}</h1>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Client #{clientId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={printFullLedger} className="flex items-center gap-1.5 px-3 py-2 theme-panel border border-[#21293d] hover:border-slate-500 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
              <Printer size={13} /> Print Ledger
            </button>
            <Link href={`/clients/${clientId}/edit`} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold no-underline transition-all">
              <Edit3 size={13} /> Edit
            </Link>
            {userRole === "admin" && (
              <button onClick={() => { if(confirm(`"${clientName}" ko delete karein?`)) router.push("/clients"); }} className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-400 rounded-xl text-xs font-bold transition-all">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* ── PROFILE + QUICK ACTIONS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Profile Card */}
          <div className="lg:col-span-4 theme-card border border-[#21293d] rounded-2xl p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Contact Information</h3>
            <div className="space-y-3">
              {client.contact && (
                <a href={`tel:${client.contact}`} className="flex items-center gap-3 text-slate-300 hover:text-blue-400 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Phone size={14} className="text-blue-400" />
                  </div>
                  <span className="font-medium">{client.contact}</span>
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-3 text-slate-300 hover:text-red-400 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Mail size={14} className="text-red-400" />
                  </div>
                  <span className="font-medium">{client.email}</span>
                </a>
              )}
              {client.address && (
                <div className="flex items-start gap-3 text-slate-300">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={14} className="text-amber-400" />
                  </div>
                  <span className="text-sm">{client.address}</span>
                </div>
              )}
            </div>
            <hr className="border-[#21293d] my-4" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowPayModal(true)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all">
                <Plus size={13} /> Payment
              </button>
              <button onClick={() => setShowLoanModal(true)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all">
                <Wallet size={13} /> Give Loan
              </button>
              <button onClick={() => { setSelectedLoanId(loans.find(l => l.status === 1)?.id || null); setShowEmiModal(true); }} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all">
                <CreditCard size={13} /> Collect EMI
              </button>
              <Link href={`/jobs/new?client_id=${clientId}`} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold no-underline transition-all">
                <Wrench size={13} /> New Job
              </Link>
            </div>
            {phone && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => window.open(`https://wa.me/91${phone}`, "_blank")} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#4ade80] rounded-xl text-xs font-bold transition-all">
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button onClick={() => window.open(`sms:${phone}`, "_blank")} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#6366f1]/15 hover:bg-[#6366f1]/25 border border-[#6366f1]/30 text-indigo-400 rounded-xl text-xs font-bold transition-all">
                  <MessageSquare size={14} /> SMS
                </button>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="lg:col-span-8 space-y-3">
            {/* Main Balance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Opening</p>
                <p className="text-lg font-black text-blue-400">{inr(toNum(client.opening_balance))}</p>
              </div>
              <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Total Billed</p>
                <p className="text-lg font-black text-slate-200">{inr(totalBilled)}</p>
              </div>
              <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Total Paid</p>
                <p className="text-lg font-black text-emerald-400">{inr(totalPaid)}</p>
              </div>
              <div className={`theme-card border rounded-xl p-4 text-center ${netBalance > 0 ? "border-red-500/30" : "border-emerald-500/30"}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Net Balance</p>
                <p className={`text-lg font-black ${netBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(netBalance)}</p>
              </div>
            </div>
            {/* Loan Cards */}
            {loanGiven > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Loan Given</p>
                  <p className="text-lg font-black text-amber-400">{inr(loanGiven)}</p>
                </div>
                <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">EMI Due/Month</p>
                  <p className="text-lg font-black text-purple-400">{inr(monthlyEmi)}</p>
                </div>
                <div className="theme-card border border-[#21293d] rounded-xl p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Loan Balance</p>
                  <p className={`text-lg font-black ${loanBalance > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(loanBalance)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ACTIVE LOANS TABLE ── */}
        {loans.filter(l => l.status === 1).length > 0 && (
          <div className="theme-card border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#21293d]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                <TrendingUp size={13} className="text-amber-400" /> Active Loans
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="theme-panel-2">
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-right">Principal</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-right">EMI</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#21293d]">
                  {loans.filter(l => l.status === 1).map(loan => {
                    const paid = payments.filter(p => p.loan_id === loan.id).reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
                    const bal = toNum(loan.total_payable) - paid;
                    return (
                      <tr key={loan.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-slate-300">{fmtDate(loan.loan_date)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{inr(toNum(loan.principal_amount))}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{loan.interest_rate}%</td>
                        <td className="px-4 py-2.5 text-right font-bold text-white">{inr(toNum(loan.total_payable))}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400 font-medium">{inr(toNum(loan.emi_amount))}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {bal <= 0 ? (
                            <button onClick={() => handleCloseLoan(loan.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold">
                              Close Loan
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-600">{inr(bal)} due</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TABS SECTION ── */}
        <div className="theme-card border border-[#21293d] rounded-2xl overflow-hidden">
          {/* Tab Headers */}
          <div className="flex border-b border-[#21293d] overflow-x-auto">
            {([
              { id: "repairs", label: "Repair History", icon: Wrench, count: repairs.length },
              { id: "sales", label: "Direct Sales", icon: Package, count: directSales.length },
              { id: "payments", label: "Payments", icon: Wallet, count: payments.length },
              { id: "loans", label: "Loan History", icon: CreditCard, count: loans.length },
            ] as const).map(({ id, label, icon: Icon, count }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === id
                    ? "border-blue-500 text-blue-400 bg-blue-500/5"
                    : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
                }`}>
                <Icon size={13} /> {label}
                <span className="px-1.5 py-0.5 bg-[#21293d] rounded text-[9px] font-black">{count}</span>
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#21293d] theme-panel-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Filter:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1 bg-[#161b27] border border-[#21293d] rounded text-xs text-slate-300 outline-none" />
            <span className="text-slate-700">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1 bg-[#161b27] border border-[#21293d] rounded text-xs text-slate-300 outline-none" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] text-red-400 font-bold hover:underline">
                Clear
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {/* Repairs Tab */}
            {activeTab === "repairs" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Job ID</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {filteredRepairs.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-600 text-sm">No repairs found</td></tr>
                    ) : filteredRepairs.map(r => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(r.date_created)}</td>
                        <td className="px-3 py-2.5 text-blue-400 font-bold">{r.job_id}</td>
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">{r.code || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.item}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 ${STATUS_COLORS[r.status]} text-white rounded text-[10px] font-bold`}>
                            {STATUS_MAP[r.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-200">{inr(toNum(r.amount))}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Link href={`/jobs/${r.id}/view`} className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center justify-center gap-1">
                            <Eye size={12} /> View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Direct Sales Tab */}
            {activeTab === "sales" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Sale Code</th>
                      <th className="px-3 py-2 text-left">Mode</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {directSales.length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-600 text-sm">No direct sales</td></tr>
                    ) : directSales.map(s => (
                      <tr key={s.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(s.date_created)}</td>
                        <td className="px-3 py-2.5 text-slate-200 font-mono">{s.sale_code}</td>
                        <td className="px-3 py-2.5 text-slate-400">{s.payment_mode}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-400">{inr(toNum(s.total_amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === "payments" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Ref</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">Disc.</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-left">Mode</th>
                      {userRole === "admin" && <th className="px-3 py-2 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {payments.length === 0 ? (
                      <tr><td colSpan={userRole === "admin" ? 8 : 7} className="px-3 py-8 text-center text-slate-600 text-sm">No payments found</td></tr>
                    ) : payments.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(p.payment_date)}</td>
                        <td className="px-3 py-2.5 text-slate-300 text-xs">{p.job_id || "Direct"}</td>
                        <td className="px-3 py-2.5">
                          {p.loan_id ? (
                            <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded text-[10px] font-bold">EMI</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-500/15 border border-slate-500/30 text-slate-400 rounded text-[10px] font-bold">Service</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-emerald-400 font-medium">{inr(toNum(p.amount))}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{inr(toNum(p.discount))}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-400">{inr(toNum(p.amount) + toNum(p.discount))}</td>
                        <td className="px-3 py-2.5 text-slate-400">{p.payment_mode}</td>
                        {userRole === "admin" && (
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => handleDeletePayment(p.id)} className="text-red-400 hover:text-red-300">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Loan History Tab */}
            {activeTab === "loans" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="theme-panel-2">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Principal</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">EMI</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {loans.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-600 text-sm">No loans found</td></tr>
                    ) : loans.map(l => (
                      <tr key={l.id} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{fmtDate(l.loan_date)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{inr(toNum(l.principal_amount))}</td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{l.interest_rate}%</td>
                        <td className="px-3 py-2.5 text-right font-bold text-white">{inr(toNum(l.total_payable))}</td>
                        <td className="px-3 py-2.5 text-right text-amber-400">{inr(toNum(l.emi_amount))}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${l.status === 1 ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-slate-500/15 border border-slate-500/30 text-slate-400"}`}>
                            {l.status === 1 ? "Active" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── ADD PAYMENT MODAL ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-card border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white dark:text-slate-100 flex items-center gap-2"><Plus size={16} className="text-emerald-400" /> Add Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 flex items-center justify-center theme-panel-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Amount <span className="text-red-400">*</span></label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Discount</label>
                <input type="number" value={payDiscount} onChange={e => setPayDiscount(e.target.value)} placeholder="0.00"
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)}
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-emerald-500">
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Remarks</label>
                <textarea value={payRemarks} onChange={e => setPayRemarks(e.target.value)} rows={2} placeholder="Optional notes..."
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-[#21293d]">
              <button onClick={handleAddPayment} disabled={savingPay}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {savingPay ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><Save size={15} />Save Payment</>}
              </button>
              <button onClick={() => setShowPayModal(false)} className="px-6 py-2.5 theme-panel-2 border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GIVE LOAN MODAL ── */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-card border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white dark:text-slate-100 flex items-center gap-2"><Wallet size={16} className="text-amber-400" /> Give Loan</h3>
              <button onClick={() => setShowLoanModal(false)} className="w-8 h-8 flex items-center justify-center theme-panel-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Amount <span className="text-red-400">*</span></label>
                <input type="number" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="Loan amount"
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Interest Rate (%)</label>
                  <input type="number" value={loanRate} onChange={e => setLoanRate(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Period (months)</label>
                  <input type="number" value={loanPeriod} onChange={e => setLoanPeriod(e.target.value)} placeholder="12"
                    className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-amber-500" />
                </div>
              </div>
              {loanAmount && (
                <div className="theme-panel-2 border border-[#21293d] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500"><span>Total Payable:</span><span className="font-bold text-white dark:text-slate-100">{inr(parseFloat(loanAmount || "0") * (1 + parseFloat(loanRate || "0") / 100))}</span></div>
                  <div className="flex justify-between text-xs text-slate-500"><span>Monthly EMI:</span><span className="font-bold text-amber-400">{inr((parseFloat(loanAmount || "0") * (1 + parseFloat(loanRate || "0") / 100)) / parseInt(loanPeriod || "12"))}</span></div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Remarks</label>
                <textarea value={loanRemarks} onChange={e => setLoanRemarks(e.target.value)} rows={2} placeholder="Optional notes..."
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-amber-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-[#21293d]">
              <button onClick={handleGiveLoan} disabled={savingLoan}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {savingLoan ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><Save size={15} />Give Loan</>}
              </button>
              <button onClick={() => setShowLoanModal(false)} className="px-6 py-2.5 theme-panel-2 border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COLLECT EMI MODAL ── */}
      {showEmiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="theme-card border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white dark:text-slate-100 flex items-center gap-2"><CreditCard size={16} className="text-purple-400" /> Collect EMI</h3>
              <button onClick={() => setShowEmiModal(false)} className="w-8 h-8 flex items-center justify-center theme-panel-2 rounded-lg text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Select Loan</label>
                <select value={selectedLoanId || ""} onChange={e => setSelectedLoanId(parseInt(e.target.value) || null)}
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-purple-500">
                  <option value="">Select Loan</option>
                  {loans.filter(l => l.status === 1).map(l => (
                    <option key={l.id} value={l.id}>Loan #{l.id} - {inr(toNum(l.emi_amount))}/month</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Amount</label>
                <input type="number" value={emiAmount} onChange={e => setEmiAmount(e.target.value)} placeholder="EMI amount"
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1.5">Remarks</label>
                <textarea value={emiRemarks} onChange={e => setEmiRemarks(e.target.value)} rows={2} placeholder="Optional notes..."
                  className="w-full px-3 py-2.5 theme-panel-2 border border-[#21293d] rounded-xl text-white dark:text-slate-100 text-sm outline-none focus:border-purple-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-[#21293d]">
              <button onClick={handleCollectEmi} disabled={savingEmi}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                {savingEmi ? <><Loader2 size={15} className="animate-spin" />Saving…</> : <><Save size={15} />Collect EMI</>}
              </button>
              <button onClick={() => setShowEmiModal(false)} className="px-6 py-2.5 theme-panel-2 border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
