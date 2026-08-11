"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { formatIST, toISTDatePart } from "@/lib/dateUtils";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle, Eye, CreditCard, History } from "lucide-react";

type Lender = {
  id: number;
  fullname: string;
  contact: string;
  start_date: string;
  loan_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  reason: string | null;
  status: number;
};

type LoanPayment = {
  id: number;
  lender_id: number;
  amount_paid: number;
  payment_date: string;
  remarks: string | null;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (v: string) => formatIST(v, { day: "2-digit", month: "short", year: "numeric" });
function todayIST() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()); }

export default function LendersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Lender[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editing, setEditing] = useState<Lender | null>(null);
  const [viewing, setViewing] = useState<Lender | null>(null);
  const [payingLender, setPayingLender] = useState<Lender | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({
    fullname: "",
    contact: "",
    start_date: todayIST(),
    loan_amount: "",
    interest_rate: "",
    tenure_months: "",
    emi_amount: "",
    reason: "",
    status: "1",
  });
  const [formErr, setFormErr] = useState("");

  const [payForm, setPayForm] = useState({ amount_paid: "", payment_date: todayIST(), remarks: "" });
  const [payErr, setPayErr] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lenderRes, paymentRes] = await Promise.all([
        supabase.from("lender_list").select("*").order("fullname").limit(500),
        supabase.from("loan_payments").select("*").order("payment_date", { ascending: false }).limit(1000),
      ]);
      if (lenderRes.error) throw lenderRes.error;
      if (paymentRes.error) throw paymentRes.error;
      setRows((lenderRes.data || []) as Lender[]);
      setPayments((paymentRes.data || []) as LoanPayment[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const paymentsByLender = useMemo(() => {
    const m = new Map<number, LoanPayment[]>();
    payments.forEach(p => {
      const arr = m.get(p.lender_id) || [];
      arr.push(p);
      m.set(p.lender_id, arr);
    });
    return m;
  }, [payments]);

  const filtered = rows.filter(l => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      l.fullname.toLowerCase().includes(term) ||
      l.contact?.includes(term) ||
      String(l.loan_amount).includes(term)
    );
  });

  const getLenderTotals = useCallback((lender: Lender) => {
    const lPayments = paymentsByLender.get(lender.id) || [];
    const totalPaid = lPayments.reduce((s, p) => s + (p.amount_paid || 0), 0);
    const totalToPay = (lender.emi_amount || 0) * (lender.tenure_months || 0);
    const balance = totalToPay - totalPaid;
    return { totalPaid, totalToPay, balance };
  }, [paymentsByLender]);

  const openAdd = () => {
    setEditing(null);
    setForm({ fullname: "", contact: "", start_date: todayIST(), loan_amount: "", interest_rate: "", tenure_months: "", emi_amount: "", reason: "", status: "1" });
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (l: Lender) => {
    setEditing(l);
    setForm({
      fullname: l.fullname,
      contact: l.contact || "",
      start_date: toISTDatePart(l.start_date),
      loan_amount: String(l.loan_amount || ""),
      interest_rate: String(l.interest_rate || ""),
      tenure_months: String(l.tenure_months || ""),
      emi_amount: String(l.emi_amount || ""),
      reason: l.reason || "",
      status: String(l.status),
    });
    setFormErr("");
    setShowModal(true);
  };

  const openView = (l: Lender) => { setViewing(l); setShowViewModal(true); };

  const openPayEMI = (l: Lender) => { setPayingLender(l); setPayForm({ amount_paid: String(l.emi_amount || ""), payment_date: todayIST(), remarks: "" }); setPayErr(""); setShowPayModal(true); };

  const calcEMI = (p: number, r: number, n: number) => {
    if (!p || !r || !n) return 0;
    const rate = r / 12 / 100;
    return (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
  };

  const autoFill = () => {
    const p = parseFloat(form.loan_amount) || 0;
    const n = parseInt(form.tenure_months) || 0;
    const r = parseFloat(form.interest_rate) || 0;
    if (p && n && r) {
      const emi = calcEMI(p, r, n);
      setForm(f => ({ ...f, emi_amount: emi.toFixed(2) }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullname.trim()) { setFormErr("Lender name zaroori hai!"); return; }
    if (!form.contact.trim()) { setFormErr("Contact zaroori hai!"); return; }
    const amount = parseFloat(form.loan_amount);
    if (!amount || amount <= 0) { setFormErr("Valid loan amount daalo!"); return; }
    const tenure = parseInt(form.tenure_months);
    if (!tenure || tenure <= 0) { setFormErr("Valid tenure daalo!"); return; }
    const rate = parseFloat(form.interest_rate) || 0;
    const emi = parseFloat(form.emi_amount) || 0;

    setSaving(true);
    try {
      const payload = {
        fullname: form.fullname.trim(),
        contact: form.contact.trim(),
        start_date: form.start_date,
        loan_amount: amount,
        interest_rate: rate,
        tenure_months: tenure,
        emi_amount: emi,
        reason: form.reason.trim() || null,
        status: parseInt(form.status),
      };
      if (editing) {
        const { error } = await supabase.from("lender_list").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lender_list").insert([payload]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormErr((err instanceof Error ? err.message : String(err)) || "Save mein galti!");
    } finally {
      setSaving(false);
    }
  };

  const handlePayEMI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLender) return;
    const amount = parseFloat(payForm.amount_paid);
    if (!amount || amount <= 0) { setPayErr("Valid amount daalo!"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("loan_payments").insert({
        lender_id: payingLender.id,
        amount_paid: amount,
        payment_date: payForm.payment_date,
        remarks: payForm.remarks.trim() || null,
      });
      if (error) throw error;
      setShowPayModal(false);
      fetchData();
    } catch (err) {
      setPayErr((err instanceof Error ? err.message : String(err)) || "EMI payment save nahi hui!");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm("Kya aap is payment ko delete karna chahte hain?")) return;
    await supabase.from("loan_payments").delete().eq("id", id);
    fetchData();
  };

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna hai?`)) return;
    await supabase.from("lender_list").delete().eq("id", id);
    fetchData();
  };

  const toggleStatus = async (l: Lender) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("lender_list").update({ status: l.status === 1 ? 2 : 1 }).eq("id", l.id);
    fetchData();
  };

  const totals = useMemo(() => {
    let principal = 0;
    let paid = 0;
    let balance = 0;
    rows.forEach(l => {
      const t = getLenderTotals(l);
      principal += l.loan_amount || 0;
      paid += t.totalPaid;
      balance += t.balance;
    });
    return { principal, paid, balance };
  }, [rows, getLenderTotals]);

  return (
    <AdminPage title="Lenders" subtitle="Loan liye hue lenders se">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, contact..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Lender
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        <div className="px-5 py-2 border-b border-[#1a2234] bg-[#0d1117]/50 grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div>Total Loan: <span className="text-slate-300 font-bold">{inr(totals.principal)}</span></div>
          <div>Total Paid: <span className="text-emerald-400 font-bold">{inr(totals.paid)}</span></div>
          <div>Total Balance: <span className="text-amber-400 font-bold">{inr(totals.balance)}</span></div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No lenders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Lender</th>
                  <th className="text-left px-4 py-3">Loan Details</th>
                  <th className="text-right px-4 py-3">Monthly EMI</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map(lender => {
                  const { totalPaid, balance } = getLenderTotals(lender);
                  return (
                    <tr key={lender.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-200">{lender.fullname}</div>
                        <div className="text-xs text-slate-600">{lender.contact}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <span className="text-slate-400">P: </span><span className="font-bold text-slate-200">{inr(lender.loan_amount)}</span>
                          <span className="text-slate-600 ml-2">R: </span><span className="text-blue-400">{Number(lender.interest_rate || 0).toFixed(1)}%</span>
                          <span className="text-slate-600 ml-2">N: </span><span className="text-slate-400">{lender.tenure_months} mo</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">Start: {fmtDate(lender.start_date)}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-amber-400">{inr(lender.emi_amount)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400">{inr(totalPaid)}</td>
                      <td className={`px-4 py-3.5 text-right font-black ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(balance)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleStatus(lender)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            lender.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}>
                          {lender.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {lender.status === 1 ? "Active" : "Closed"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openPayEMI(lender)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition" title="Pay EMI">
                            <CreditCard size={13} />
                          </button>
                          <button onClick={() => openView(lender)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition" title="View">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => openEdit(lender)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition" title="Edit">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(lender.id, lender.fullname)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" title="Delete">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Lender Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Lender</> : <><Plus size={16} className="text-blue-400" /> Add Lender</>}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lender Name <span className="text-red-400">*</span></label>
                  <input value={form.fullname} onChange={e => setForm(p => ({ ...p, fullname: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Contact <span className="text-red-400">*</span></label>
                  <input value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
                    placeholder="Phone number"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Start Date</label>
                <input type="date" value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Loan Amount (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.loan_amount}
                    onChange={e => setForm(p => ({ ...p, loan_amount: e.target.value }))}
                    placeholder="Principal"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Rate (%)</label>
                  <input type="number" step="0.1" value={form.interest_rate}
                    onChange={e => setForm(p => ({ ...p, interest_rate: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Tenure (mo)</label>
                  <input type="number" value={form.tenure_months}
                    onChange={e => setForm(p => ({ ...p, tenure_months: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Monthly EMI (₹)
                    <button type="button" onClick={autoFill} className="ml-2 text-blue-400 text-[9px] hover:text-blue-300">(Auto)</button>
                  </label>
                  <input type="number" step="0.01" value={form.emi_amount}
                    onChange={e => setForm(p => ({ ...p, emi_amount: e.target.value }))}
                    placeholder="Monthly EMI"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500">
                    <option value="1">Active</option>
                    <option value="2">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Remarks / Reason</label>
                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> {editing ? "Update" : "Save"}</>}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay EMI Modal */}
      {showPayModal && payingLender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-400" /> Pay EMI — {payingLender.fullname}
              </h3>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePayEMI} className="p-5 space-y-4">
              {payErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {payErr}
                </div>
              )}
              <div className="p-3 bg-[#0d1117] rounded-xl border border-[#21293d] text-xs text-slate-500">
                Monthly EMI: <span className="font-black text-amber-400 ml-1">{inr(payingLender.emi_amount)}</span>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Amount Paid (₹) <span className="text-red-400">*</span></label>
                <input type="number" step="0.01" value={payForm.amount_paid}
                  onChange={e => setPayForm(p => ({ ...p, amount_paid: e.target.value }))}
                  placeholder="EMI amount"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Payment Date</label>
                <input type="date" value={payForm.payment_date}
                  onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Remarks</label>
                <input value={payForm.remarks}
                  onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><CreditCard size={14} /> Record Payment</>}
                </button>
                <button type="button" onClick={() => setShowPayModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewing && (() => {
        const lPayments = paymentsByLender.get(viewing.id) || [];
        const { totalPaid, totalToPay, balance } = getLenderTotals(viewing);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <History size={16} className="text-blue-400" /> Lender Details
                </h3>
                <button onClick={() => setShowViewModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <DetailItem label="Lender" value={viewing.fullname} />
                  <DetailItem label="Contact" value={viewing.contact || "-"} />
                  <DetailItem label="Loan Amount" value={inr(viewing.loan_amount)} valueClass="text-emerald-400 font-bold" />
                  <DetailItem label="Interest Rate" value={`${Number(viewing.interest_rate || 0).toFixed(1)}%`} />
                  <DetailItem label="Tenure" value={`${viewing.tenure_months} months`} />
                  <DetailItem label="Monthly EMI" value={inr(viewing.emi_amount)} valueClass="text-amber-400 font-bold" />
                  <DetailItem label="Total Payable" value={inr(totalToPay)} valueClass="text-emerald-400 font-bold" />
                  <DetailItem label="Total Paid" value={inr(totalPaid)} valueClass="text-blue-400 font-bold" />
                  <DetailItem label="Balance" value={inr(balance)} valueClass={`font-bold ${balance > 0 ? "text-red-400" : "text-emerald-400"}`} />
                  <DetailItem label="Start Date" value={fmtDate(viewing.start_date)} />
                  <DetailItem label="Status" value={viewing.status === 1 ? "Active" : "Completed"} valueClass={viewing.status === 1 ? "text-emerald-400" : "text-slate-500"} />
                </div>
                {viewing.reason && (
                  <div className="rounded-xl border border-[#21293d] bg-[#0d1117] p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">Remarks</div>
                    <div className="text-sm text-slate-400">{viewing.reason}</div>
                  </div>
                )}

                {lPayments.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">Payment History</div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {lPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#21293d] bg-[#0d1117]">
                          <div>
                            <div className="text-xs font-bold text-slate-200">{inr(p.amount_paid)}</div>
                            <div className="text-[10px] text-slate-600">{fmtDate(p.payment_date)}</div>
                          </div>
                          {userRole === "admin" && (
                            <button onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-red-400/50 hover:text-red-400 transition">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setShowViewModal(false); openPayEMI(viewing); }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <CreditCard size={14} /> Pay EMI
                  </button>
                  <button onClick={() => { setShowViewModal(false); openEdit(viewing); }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <Edit3 size={14} /> Edit
                  </button>
                  <button onClick={() => setShowViewModal(false)}
                    className="px-5 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminPage>
  );
}

function DetailItem({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-[#21293d] bg-[#0d1117] p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">{label}</div>
      <div className={`text-sm font-bold text-slate-200 ${valueClass || ""}`}>{value}</div>
    </div>
  );
}
