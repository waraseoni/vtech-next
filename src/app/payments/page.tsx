"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { 
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, IndianRupee, 
  Loader2, Pencil, Plus, Receipt, RotateCcw, Search, Trash2, X,
  Calendar, DollarSign
} from "lucide-react";
import { todayIST, formatIST, startOfMonthIST, endOfMonthIST, parseISTDate, toISTDatePart } from "@/lib/dateUtils";
import { exportToCSV, printTable } from "@/lib/exportUtils";

type Client = { id: number; firstname: string; middlename: string | null; lastname: string; contact: string | null };
type PaymentRow = { id: number; client_id: number; payment_date: string; amount: number; discount: number | null; payment_mode: string; remarks: string | null };
type PaymentForm = { id: number | null; client_id: string; payment_date: string; amount: string; discount: string; payment_mode: string; remarks: string };
type Toast = { type: "success" | "error"; msg: string };

const istToday = todayIST();

const fmtMoney = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (date: string) => formatIST(date.slice(0, 10), { day: "2-digit", month: "short", year: "numeric" });
const paymentCode = (id: number) => `PY-${String(id).padStart(4, "0")}`;
const clientName = (c?: Client | null) => c ? [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim() : "-";

function getMonthRange(monthOffset: number, baseDate?: string) {
  const d = baseDate ? parseISTDate(baseDate) : new Date();
  d.setMonth(d.getMonth() + monthOffset);
  return { from: startOfMonthIST(d), to: endOfMonthIST(d) };
}

function PaymentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [clientFilter, setClientFilter] = useState(searchParams.get("client") || "all");
  const [fromDate, setFromDate] = useState(searchParams.get("from") || startOfMonthIST());
  const [toDate, setToDate] = useState(searchParams.get("to") || endOfMonthIST());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>({ id: null, client_id: "", payment_date: istToday, amount: "", discount: "0", payment_mode: "Cash", remarks: "" });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<PaymentRow | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const qs = params.toString();
    if (qs !== searchParams.toString()) router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router, searchParams, search, clientFilter, fromDate, toDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cData, error: cErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from("client_list").select("id, firstname, middlename, lastname, contact").eq("delete_flag", 0).order("firstname"),
        supabase.from("client_payments").select("*").order("payment_date", { ascending: false }).order("id", { ascending: false }).limit(1000),
      ]);
      if (cErr) throw cErr;
      if (pErr) throw pErr;
      setClients((cData || []) as Client[]);
      setPayments((pData || []) as PaymentRow[]);
    } catch (e) { console.error(e); setErr("Data load failed"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const clientMap = useMemo(() => { const m = new Map<number, Client>(); clients.forEach(c => m.set(c.id, c)); return m; }, [clients]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const pd = p.payment_date.slice(0, 10);
      if (fromDate && pd < fromDate) return false;
      if (toDate && pd > toDate) return false;
      if (clientFilter !== "all" && p.client_id !== Number(clientFilter)) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const cn = clientName(clientMap.get(p.client_id));
      return paymentCode(p.id).includes(term) || cn.toLowerCase().includes(term) || (p.payment_mode || "").toLowerCase().includes(term);
    });
  }, [payments, fromDate, toDate, clientFilter, search, clientMap]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => itemsPerPage === -1 ? filtered : filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filtered, currentPage, itemsPerPage]);
  const handleItemsPerPage = (val: number) => { setItemsPerPage(val); setCurrentPage(1); };

  const totals = useMemo(() => filtered.reduce((a, p) => ({ amount: a.amount + p.amount, discount: a.discount + (p.discount || 0) }), { amount: 0, discount: 0 }), [filtered]);

  const openCreate = () => { setForm({ id: null, client_id: "", payment_date: istToday, amount: "", discount: "0", payment_mode: "Cash", remarks: "" }); setModalOpen(true); };
  const openEdit = (p: PaymentRow) => { setForm({ id: p.id, client_id: String(p.client_id), payment_date: p.payment_date.slice(0, 10), amount: String(p.amount), discount: String(p.discount || 0), payment_mode: p.payment_mode || "Cash", remarks: p.remarks || "" }); setModalOpen(true); };
  const closeModal = () => { if (saving) return; setModalOpen(false); setForm({ id: null, client_id: "", payment_date: istToday, amount: "", discount: "0", payment_mode: "Cash", remarks: "" }); };

  const handleExportCSV = () => {
    const data = filtered.map(p => ({
      ID: paymentCode(p.id),
      Date: fmtDate(p.payment_date),
      Client: clientName(clientMap.get(p.client_id)),
      Amount: p.amount,
      Discount: p.discount || 0,
      Mode: p.payment_mode,
      Remarks: p.remarks || "",
    }));
    exportToCSV(data, "payments");
  };
  const handlePrint = () => printTable("payments-table", "Payments Report");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = Number(form.client_id);
    const amt = Number(form.amount);
    if (!cid || !amt) { setToast({ type: "error", msg: "Client & amount required" }); return; }
    setSaving(true);
    try {
      const payload = { client_id: cid, payment_date: form.payment_date, amount: amt, discount: Number(form.discount) || 0, payment_mode: form.payment_mode, remarks: form.remarks.trim() || null };
      const { error } = form.id ? await supabase.from("client_payments").update(payload).eq("id", form.id) : await supabase.from("client_payments").insert(payload);
      if (error) throw error;
      setToast({ type: "success", msg: form.id ? "Updated" : "Saved" });
      closeModal();
      await loadData();
    } catch (e) { console.error(e); setToast({ type: "error", msg: "Save failed" }); }
    finally { setSaving(false); }
  };

  const deleteP = async (id: number) => {
    if (!confirm("Delete payment?")) return;
    try {
      const { error } = await supabase.from("client_payments").delete().eq("id", id);
      if (error) throw error;
      setToast({ type: "success", msg: "Deleted" });
      await loadData();
    } catch { setToast({ type: "error", msg: "Delete failed" }); }
  };

  const viewReceipt = (p: PaymentRow) => { setReceiptPayment(p); setReceiptOpen(true); };
  const applyMonth = (offset: number) => { const r = getMonthRange(offset, fromDate); setFromDate(r.from); setToDate(r.to); setCurrentPage(1); };
  const reset = () => { const r = getMonthRange(0); setSearch(""); setClientFilter("all"); setFromDate(r.from); setToDate(r.to); setCurrentPage(1); };

  return (
    <AdminPage title="Payments" subtitle="Client payments management">
      {toast && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl ${toast.type === "success" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" : "border-red-500/30 bg-red-500/15 text-red-400"}`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Glassy Header */}
      <div className="relative overflow-hidden mb-6 border-b border-[#21293d] bg-gradient-to-b from-[#111520] to-[#0d1117] rounded-[2rem] p-6 md:p-8">
        <div className="absolute -top-24 -left-20 w-64 h-64 bg-emerald-600/10 blur-[100px] rounded-full" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-20 left-1/3 w-40 h-40 bg-blue-600/8 blur-[80px] rounded-full" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse" />
                <div className="w-14 h-14 rounded-2xl bg-[#161b27] border border-[#21293d] flex items-center justify-center shadow-2xl relative z-10">
                  <DollarSign size={28} className="text-emerald-400" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                  Client Payments
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                    {filtered.length}
                  </span>
                </h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <Calendar size={13} className="text-slate-500 shrink-0" />
                  <p className="text-slate-400 text-sm font-semibold truncate">
                    {fromDate && toDate ? `${fmtDate(fromDate)} - ${fmtDate(toDate)}` : "All time"}
                  </p>
                </div>
              </div>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg active:scale-95">
              <Plus size={16} /> NEW PAYMENT
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-[#161b27] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 rounded-xl text-xs font-black transition-all">
              Print
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-[#161b27] border border-[#21293d] hover:bg-[#1a2234] text-slate-400 rounded-xl text-xs font-black transition-all">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 mb-6">
        <div className="grid gap-4 xl:grid-cols-[1fr_200px_150px_150px]">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60 transition-all pl-9"
                placeholder="ID, client, mode..." />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Client</label>
            <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60 transition-all">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={String(c.id)}>{clientName(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">From Date</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60 transition-all" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">To Date</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60 transition-all" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => { setFromDate(istToday); setToDate(istToday); setCurrentPage(1); }} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all">Today</button>
          <button onClick={() => applyMonth(0)} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all">This Month</button>
          <button onClick={() => { const d = new Date(fromDate); d.setDate(d.getDate() - 1); const s = toISTDatePart(d); setFromDate(s); setToDate(s); setCurrentPage(1); }} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all flex items-center gap-1">
            <ChevronLeft size={14} /> Prev Day
          </button>
          <button onClick={() => { const d = new Date(toDate); d.setDate(d.getDate() + 1); const s = toISTDatePart(d); setFromDate(s); setToDate(s); setCurrentPage(1); }} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all flex items-center gap-1">
            Next Day <ChevronRight size={14} />
          </button>
          <button onClick={() => applyMonth(-1)} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all flex items-center gap-1">
            <ChevronLeft size={14} /> Prev Month
          </button>
          <button onClick={() => applyMonth(1)} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all flex items-center gap-1">
            Next Month <ChevronRight size={14} />
          </button>
          <button onClick={reset} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] hover:bg-[#1a2234] rounded-xl text-xs font-bold text-slate-400 transition-all flex items-center gap-1">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <div className="inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 border-blue-500/20">Total</div>
          <p className="mt-3 text-xl font-black text-white">{filtered.length}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <div className="inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border-emerald-500/20">Amount</div>
          <p className="mt-3 text-xl font-black text-emerald-400">{fmtMoney(totals.amount)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <div className="inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border-amber-500/20">Discount</div>
          <p className="mt-3 text-xl font-black text-amber-400">{fmtMoney(totals.discount)}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
          <div className="inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border-purple-500/20">Net Received</div>
          <p className="mt-3 text-xl font-black text-purple-400">{fmtMoney(totals.amount + totals.discount)}</p>
        </div>
      </div>

      {err && <div className="bg-[#161b27] border border-red-500/30 rounded-2xl p-4 text-sm text-red-400 mb-6">{err}</div>}

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-purple-400" size={32} />
          </div>
        ) : paginated.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">No payments found</div>
        ) : (
          <>
            <div className="overflow-x-auto hidden lg:block" id="payments-table">
              <table className="w-full text-sm">
                <thead className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {paginated.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <button className="font-black text-purple-400 hover:text-purple-300" onClick={() => viewReceipt(p)}>
                          {paymentCode(p.id)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{fmtDate(p.payment_date)}</td>
                      <td className="px-4 py-3 font-bold text-slate-200">{clientName(clientMap.get(p.client_id))}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-400">{fmtMoney(p.amount)}</td>
                      <td className="px-4 py-3 text-right font-black text-amber-400">{fmtMoney(p.discount || 0)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-300">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => viewReceipt(p)} className="p-2 hover:bg-[#1a2234] rounded-lg text-slate-400 hover:text-white"><Receipt size={14} /></button>
                          <button onClick={() => openEdit(p)} className="p-2 hover:bg-[#1a2234] rounded-lg text-slate-400 hover:text-white"><Pencil size={14} /></button>
                          <button onClick={() => deleteP(p.id)} className="p-2 hover:bg-[#1a2234] rounded-lg text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid gap-3 p-3">
              {paginated.map(p => (
                <div key={p.id} className="rounded-2xl border border-[#21293d] bg-[#111520] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <button className="text-sm font-black text-purple-400" onClick={() => viewReceipt(p)}>{paymentCode(p.id)}</button>
                      <div className="text-xs text-slate-500 mt-1">{fmtDate(p.payment_date)}</div>
                    </div>
                    <span className="inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-300">{p.payment_mode}</span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">{clientName(clientMap.get(p.client_id))}</div>
                  <div className="text-xs text-slate-500 mb-3">{clientMap.get(p.client_id)?.contact || ""}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="rounded-lg bg-[#0d1117] p-2">
                      <div className="text-slate-500">Amount</div>
                      <div className="font-black text-emerald-400">{fmtMoney(p.amount)}</div>
                    </div>
                    <div className="rounded-lg bg-[#0d1117] p-2">
                      <div className="text-slate-500">Discount</div>
                      <div className="font-black text-amber-400">{fmtMoney(p.discount || 0)}</div>
                    </div>
                  </div>
                  {p.remarks && <div className="text-xs text-slate-400 mb-3 bg-[#0d1117] rounded-lg p-2">{p.remarks}</div>}
                  <div className="flex gap-2">
                    <button onClick={() => viewReceipt(p)} className="flex-1 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-1"><Receipt size={12} /> Receipt</button>
                    <button onClick={() => openEdit(p)} className="flex-1 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 flex items-center justify-center gap-1"><Pencil size={12} /> Edit</button>
                    <button onClick={() => deleteP(p.id)} className="py-2 px-3 bg-red-600/20 border border-red-500/30 rounded-xl text-xs font-bold text-red-400"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t border-[#21293d]">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Show</span>
                  <select value={itemsPerPage} onChange={(e) => handleItemsPerPage(Number(e.target.value))} className="bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1.5 text-white text-xs font-bold">
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={-1}>All</option>
                  </select>
                  <span>of {filtered.length} entries</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] disabled:opacity-40">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-purple-600 text-white' : 'bg-[#0d1117] border border-[#21293d] text-slate-400 hover:bg-[#1a2234]'}`}>
                        {pageNum}
                      </button>
                    );
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234] disabled:opacity-40">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#21293d] bg-[#161b27] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#21293d] px-5 py-4">
              <div>
                <h3 className="text-base font-black text-white">{form.id ? "Edit Payment" : "New Payment"}</h3>
                <p className="text-xs text-slate-500">Client payment details</p>
              </div>
              <button onClick={closeModal} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={save} className="space-y-4 px-5 py-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Client</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={String(c.id)}>{clientName(c)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Date</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Mode</label>
                  <select value={form.payment_mode} onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60">
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Amount</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Discount</label>
                  <input type="number" step="0.01" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Remarks</label>
                <input type="text" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-purple-500/60" placeholder="Optional..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm font-bold text-slate-400 hover:bg-[#1a2234]">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : (form.id ? "Update" : "Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptOpen && receiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#21293d] bg-[#161b27] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#21293d] px-5 py-4">
              <div className="flex items-center gap-2 text-base font-black text-white">
                <IndianRupee size={18} /> Payment Receipt
              </div>
              <button onClick={() => setReceiptOpen(false)} className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1a2234]">
                <X size={13} className="mr-1 inline" /> Close
              </button>
            </div>
            <div className="p-5">
              <div className="rounded-2xl bg-white p-6 text-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-black">V-Technologies</h3>
                    <p className="text-sm text-slate-500">Client Payment Receipt</p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-lg font-black">{paymentCode(receiptPayment.id)}</div>
                    <div className="text-sm text-slate-500">{fmtDate(receiptPayment.payment_date)}</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-400">Received From</div>
                    <div className="mt-1 font-black">{clientName(clientMap.get(receiptPayment.client_id))}</div>
                    <div className="text-sm text-slate-500">{clientMap.get(receiptPayment.client_id)?.contact || ""}</div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-400">Mode</div>
                    <span className="mt-1 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700">{receiptPayment.payment_mode}</span>
                  </div>
                </div>
                <table className="mt-5 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border border-slate-200 bg-slate-50">
                      <th className="border border-slate-200 px-3 py-2 text-left font-black">Description</th>
                      <th className="border border-slate-200 px-3 py-2 text-right font-black">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border border-slate-200">
                      <td className="border border-slate-200 px-3 py-2 font-semibold">Payment Received</td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-black text-emerald-600">{fmtMoney(receiptPayment.amount)}</td>
                    </tr>
                    {(receiptPayment.discount || 0) > 0 && (
                      <tr className="border border-slate-200">
                        <td className="border border-slate-200 px-3 py-2 font-semibold">Discount</td>
                        <td className="border border-slate-200 px-3 py-2 text-right font-black text-amber-600">-{fmtMoney(receiptPayment.discount || 0)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border border-slate-200 bg-slate-100">
                      <td className="border border-slate-200 px-3 py-2 font-black">Total</td>
                      <td className="border border-slate-200 px-3 py-2 text-right font-black text-lg text-emerald-600">
                        {fmtMoney(receiptPayment.amount + (receiptPayment.discount || 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {receiptPayment.remarks && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <strong>Remarks:</strong> {receiptPayment.remarks}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PaymentsPageInner />
    </Suspense>
  );
}
