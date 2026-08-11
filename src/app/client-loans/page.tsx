"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { formatIST, toISTDatePart } from "@/lib/dateUtils";
import { Search, Plus, Edit3, Trash2, ToggleLeft, ToggleRight, X, Loader2, Check, AlertCircle, Eye, CreditCard } from "lucide-react";

type Client = { id: number; firstname: string; middlename: string | null; lastname: string; contact: string | null };
type Loan = {
  id: number;
  client_id: number;
  loan_date: string;
  principal: number;
  loan_period: number;
  interest_rate: number;
  total_payable: number;
  emi_amount: number;
  status: number;
  paid: number;
  balance: number;
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (v: string) => formatIST(v, { day: "2-digit", month: "short", year: "numeric" });
function todayIST() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()); }

export default function ClientLoansPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [viewing, setViewing] = useState<Loan | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");

  const [form, setForm] = useState({
    client_id: "",
    loan_date: todayIST(),
    principal: "",
    loan_period: "",
    interest_rate: "",
    total_payable: "",
    emi_amount: "",
  });
  const [formErr, setFormErr] = useState("");

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
      const [loanRes, clientRes, paymentsRes] = await Promise.all([
        supabase.from("client_loans").select("*").order("loan_date", { ascending: false }).limit(500),
        supabase.from("client_list").select("id, firstname, middlename, lastname, contact").eq("delete_flag", 0).order("firstname"),
        pageAll(supabase.from("client_payments").select("id, loan_id, amount, discount").not("loan_id", "is", null)),
      ]);
      if (loanRes.error) throw loanRes.error;
      if (clientRes.error) throw clientRes.error;
      const payments = paymentsRes.data || [];
      const paymentByLoan = new Map<number, number>();
      payments.forEach(p => {
        const current = paymentByLoan.get(p.loan_id) || 0;
        paymentByLoan.set(p.loan_id, current + p.amount + p.discount);
      });
      const loans = (loanRes.data || []).map(loan => ({
        ...loan,
        principal: loan.principal_amount,
        paid: paymentByLoan.get(loan.id) || 0,
        balance: (loan.total_payable || 0) - (paymentByLoan.get(loan.id) || 0),
      }));
      setRows(loans as Loan[]);
      setClients((clientRes.data || []) as Client[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clientById = useMemo(() => {
    const m = new Map<number, Client>();
    clients.forEach(c => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = rows.filter(loan => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const client = clientById.get(loan.client_id);
    const name = client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : "";
    return (
      name.toLowerCase().includes(term) ||
      String(loan.id).includes(term) ||
      String(loan.principal).includes(term)
    );
  });

  const clientName = (c?: Client | null) => !c ? "-" : [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");

  const openAdd = () => {
    setEditing(null);
    setForm({ client_id: "", loan_date: todayIST(), principal: "", loan_period: "", interest_rate: "", total_payable: "", emi_amount: "" });
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (loan: Loan) => {
    setEditing(loan);
    setForm({
      client_id: String(loan.client_id),
      loan_date: toISTDatePart(loan.loan_date),
      principal: String(loan.principal || ""),
      loan_period: String(loan.loan_period || ""),
      interest_rate: String(loan.interest_rate || ""),
      total_payable: String(loan.total_payable || ""),
      emi_amount: String(loan.emi_amount || ""),
    });
    setFormErr("");
    setShowModal(true);
  };

  const openView = (loan: Loan) => { setViewing(loan); setShowViewModal(true); };

  const calcEMI = (p: number, r: number, n: number) => {
    if (!p || !r || !n) return 0;
    const rate = r / 12 / 100;
    return (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
  };

  const autoFill = () => {
    const p = parseFloat(form.principal) || 0;
    const n = parseInt(form.loan_period) || 0;
    const r = parseFloat(form.interest_rate) || 0;
    if (p && n && r) {
      const total = calcEMI(p, r, n) * n;
      const emi = calcEMI(p, r, n);
      setForm(f => ({ ...f, total_payable: total.toFixed(2), emi_amount: emi.toFixed(2) }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) { setFormErr("Client select karo!"); return; }
    const principal = parseFloat(form.principal);
    if (!principal || principal <= 0) { setFormErr("Valid principal amount daalo!"); return; }
    const tenure = parseInt(form.loan_period);
    if (!tenure || tenure <= 0) { setFormErr("Valid tenure daalo!"); return; }
    const rate = parseFloat(form.interest_rate) || 0;
    const totalPayable = parseFloat(form.total_payable) || 0;
    const emi = parseFloat(form.emi_amount) || 0;

    setSaving(true);
    try {
      const payload = {
        client_id: parseInt(form.client_id),
        loan_date: form.loan_date,
        principal_amount: principal,
        loan_period: tenure,
        interest_rate: rate,
        total_payable: totalPayable,
        emi_amount: emi,
        status: editing ? editing.status : 1,
      };
      if (editing) {
        const { error } = await supabase.from("client_loans").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_loans").insert([payload]);
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

  const handleDelete = async (id: number) => {
    if (userRole !== "admin") { alert("Sirf Admin delete kar sakta hai!"); return; }
    if (!confirm("Kya aap is loan ko delete karna chahte hain?")) return;
    await supabase.from("client_loans").delete().eq("id", id);
    fetchData();
  };

  const toggleStatus = async (loan: Loan) => {
    if (userRole !== "admin") { alert("Sirf Admin status change kar sakta hai!"); return; }
    await supabase.from("client_loans").update({ status: loan.status === 1 ? 0 : 1 }).eq("id", loan.id);
    fetchData();
  };

  const totals = useMemo(() => ({
    principal: filtered.reduce((s, l) => s + (l.principal || 0), 0),
    payable: filtered.reduce((s, l) => s + (l.total_payable || 0), 0),
    paid: filtered.reduce((s, l) => s + (l.paid || 0), 0),
    balance: filtered.reduce((s, l) => s + (l.balance || 0), 0),
  }), [filtered]);

  return (
    <AdminPage title="Client Loans" subtitle="Loans diye hue clients ko">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by client, loan ID..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
            <Plus size={14} /> Add Loan
          </button>
        </div>

        {err && <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">{err}</div>}

        <div className="px-5 py-2 border-b border-[#1a2234] bg-[#0d1117]/50 grid grid-cols-4 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div>Total Principal: <span className="text-slate-300 font-bold">{inr(totals.principal)}</span></div>
          <div>Total Paid: <span className="text-amber-400 font-bold">{inr(totals.paid)}</span></div>
          <div>Total Payable: <span className="text-emerald-400 font-bold">{inr(totals.payable)}</span></div>
          <div>Total Balance: <span className="text-red-400 font-bold">{inr(totals.balance)}</span></div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3">Loan ID</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Principal</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-right px-4 py-3">Tenure</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Paid</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map(loan => {
                  const client = clientById.get(loan.client_id);
                  return (
                    <tr key={loan.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-black text-blue-400">CL-{String(loan.id).padStart(5, "0")}</span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-200">{clientName(client)}</td>
                      <td className="px-4 py-3.5 text-slate-400">{fmtDate(loan.loan_date)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-200">{inr(loan.principal)}</td>
                      <td className="px-4 py-3.5 text-right text-blue-400">{Number(loan.interest_rate || 0).toFixed(1)}%</td>
                      <td className="px-4 py-3.5 text-right text-slate-500">{loan.loan_period} mo</td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-400">{inr(loan.total_payable)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-amber-400">{inr(loan.paid)}</td>
                      <td className="px-4 py-3.5 text-right font-black text-red-400">{inr(loan.balance)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button onClick={() => toggleStatus(loan)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            loan.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
                          }`}>
                          {loan.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {loan.status === 1 ? "Active" : "Closed"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openView(loan)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition">
                            <Eye size={13} />
                          </button>
                          <button onClick={() => openEdit(loan)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                            <Edit3 size={13} />
                          </button>
                          {userRole === "admin" && (
                            <button onClick={() => handleDelete(loan.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? <><Edit3 size={16} className="text-blue-400" /> Edit Client Loan</> : <><Plus size={16} className="text-blue-400" /> Add Client Loan</>}
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

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Client <span className="text-red-400">*</span></label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={String(c.id)}>{clientName(c)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Loan Date</label>
                <input type="date" value={form.loan_date}
                  onChange={e => setForm(p => ({ ...p, loan_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Principal (₹) <span className="text-red-400">*</span></label>
                  <input type="number" step="0.01" value={form.principal}
                    onChange={e => setForm(p => ({ ...p, principal: e.target.value }))}
                    placeholder="Loan amount"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Tenure (Months) <span className="text-red-400">*</span></label>
                  <input type="number" value={form.loan_period}
                    onChange={e => setForm(p => ({ ...p, loan_period: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Interest Rate (%)</label>
                  <input type="number" step="0.1" value={form.interest_rate}
                    onChange={e => setForm(p => ({ ...p, interest_rate: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    Total Payable (₹)
                    <button type="button" onClick={autoFill}
                      className="ml-2 text-blue-400 text-[9px] hover:text-blue-300">(Auto Calculate)</button>
                  </label>
                  <input type="number" step="0.01" value={form.total_payable}
                    onChange={e => setForm(p => ({ ...p, total_payable: e.target.value }))}
                    placeholder="Auto or manual"
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">EMI Amount (₹)</label>
                <input type="number" step="0.01" value={form.emi_amount}
                  onChange={e => setForm(p => ({ ...p, emi_amount: e.target.value }))}
                  placeholder="Monthly EMI"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500" />
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

      {showViewModal && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-400" /> Client Loan Details
              </h3>
              <button onClick={() => setShowViewModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Loan ID" value={`CL-${String(viewing.id).padStart(5, "0")}`} />
                <DetailItem label="Client" value={clientName(clientById.get(viewing.client_id))} />
                <DetailItem label="Date" value={fmtDate(viewing.loan_date)} />
                <DetailItem label="Status" value={viewing.status === 1 ? "Active" : "Closed"} valueClass={viewing.status === 1 ? "text-emerald-400" : "text-slate-500"} />
                <DetailItem label="Principal" value={inr(viewing.principal)} valueClass="text-slate-200 font-bold" />
                <DetailItem label="Interest Rate" value={`${Number(viewing.interest_rate || 0).toFixed(1)}%`} />
                <DetailItem label="Tenure" value={`${viewing.loan_period} months`} />
                <DetailItem label="Total Payable" value={inr(viewing.total_payable)} valueClass="text-emerald-400 font-bold" />
                <DetailItem label="Paid" value={inr(viewing.paid)} valueClass="text-amber-400 font-bold" />
                <DetailItem label="Balance" value={inr(viewing.balance)} valueClass="text-red-400 font-bold" />
                <DetailItem label="EMI Amount" value={inr(viewing.emi_amount)} valueClass="text-amber-400 font-bold" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowViewModal(false); openEdit(viewing); }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  <Edit3 size={14} /> Edit
                </button>
                <button onClick={() => setShowViewModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
