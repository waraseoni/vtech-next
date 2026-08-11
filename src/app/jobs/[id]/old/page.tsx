"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Plus, X, Wrench, Package, Settings2,
  User, Hash, Loader2, AlertTriangle, CheckCircle,
  UserPlus, IndianRupee,
} from "lucide-react";

// ─── IST Helpers ─────────────────────────────────────────────────────────────
function todayISTDateTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date()).replace(", ", "T").replace(",", "T");
}
function nowIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Client { id: number; firstname: string; middlename: string; lastname: string; contact: string; }
interface Mechanic { id: number; firstname: string; middlename: string; lastname: string; designation: string; commission_percent: number; }
interface Service { id: number; name: string; price: number; }
interface Product { id: number; name: string; price: number; }
interface SelService { service_id: number; service_name: string; price: number; }
interface SelProduct { product_id: number; product_name: string; qty: number; price: number; }

const iCls  = "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all";
const lCls  = "block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5";
const fmtN  = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ManageJobPage() {
  const params = useParams();
  const router = useRouter();
  const editId = params?.id as string | undefined; // present only on edit route
  const isEdit = !!editId;

  // Master data
  const [clients,   setClients]   = useState<Client[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [services,  setServices]  = useState<Service[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [userRole,  setUserRole]  = useState("staff");
  const [,setUserMechId]= useState<number | null>(null);

  // Form fields
  const [clientId,    setClientId]    = useState("");
  const [dateCreated, setDateCreated] = useState(todayISTDateTime());
  const [jobId,       setJobId]       = useState("");
  const [item,        setItem]        = useState("");
  const [fault,       setFault]       = useState("");
  const [uniqId,      setUniqId]      = useState("");
  const [remark,      setRemark]      = useState("");
  const [mechanicId,  setMechanicId]  = useState("");
  const [mechAmount,  setMechAmount]  = useState("0");
  const [selServices, setSelServices] = useState<SelService[]>([]);
  const [selProducts, setSelProducts] = useState<SelProduct[]>([]);
  const [selSvc,      setSelSvc]      = useState("");
  const [selProd,     setSelProd]     = useState("");

  // UI state
  const [loading,  setLoading]  = useState(isEdit);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ type: "success"|"error"; msg: string } | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch master data ──────────────────────────────────────────────────────
  const fetchMaster = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from("profiles")
        .select("role, mechanic_id").eq("id", user.id).single();
      setUserRole(p?.role || "staff");
      setUserMechId(p?.mechanic_id || null);
      if (p?.role !== "admin" && p?.mechanic_id) {
        setMechanicId(String(p.mechanic_id));
      }
    }

    const [cRes, mRes, sRes, pRes] = await Promise.all([
      supabase.from("client_list").select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0).order("firstname"),
      supabase.from("mechanic_list").select("id, firstname, middlename, lastname, designation, commission_percent")
        .eq("status", 1).order("firstname"),
      supabase.from("service_list").select("id, name, price")
        .eq("delete_flag", 0).eq("status", 1).order("name"),
      supabase.from("product_list").select("id, name, price")
        .eq("delete_flag", 0).eq("status", 1).order("name"),
    ]);

    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    setServices(sRes.data || []);
    setProducts(pRes.data || []);

    // Old entry page: Job ID manually entered by user — do NOT auto-fill from counter
  }, []);

  // ── Fetch existing job for edit ────────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    if (!isEdit || !editId) return;
    const numId = Number(editId);
    const { data: job, error } = await supabase
      .from("transaction_list").select("*").eq("id", numId).single();
    if (error || !job) { router.push("/jobs"); return; }

    setClientId(String(job.client_name));
    setJobId(job.job_id);
    setDateCreated(job.date_created
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date(job.date_created)).replace(", ", "T").replace(",", "T")
      : todayISTDateTime());
    setItem(job.item || "");
    setFault(job.fault || "");
    setUniqId(job.uniq_id || "");
    setRemark(job.remark || "");
    setMechanicId(job.mechanic_id ? String(job.mechanic_id) : "");
    setMechAmount(String(job.mechanic_amount || 0));

    // Existing services
    const { data: svcs } = await supabase.from("transaction_services")
      .select("service_id, service_name, price").eq("transaction_id", numId);
    setSelServices((svcs || []) as SelService[]);

    // Existing products
    const { data: prods } = await supabase.from("transaction_products")
      .select("product_id, product_name, qty, price").eq("transaction_id", numId);
    setSelProducts((prods || []) as SelProduct[]);
  }, [isEdit, editId, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchMaster();
      if (isEdit) await fetchJob();
      setLoading(false);
    })();
  }, [fetchMaster, fetchJob, isEdit]);

  // ── Auto-calc mechanic amount from commission ──────────────────────────────
  useEffect(() => {
    const mech = mechanics.find(m => m.id === parseInt(mechanicId));
    if (mech && mech.commission_percent > 0) {
      setMechAmount(((totalAmount * mech.commission_percent) / 100).toFixed(2));
    }
  }, [mechanicId, mechanics]); // eslint-disable-line

  // ── Derived totals ─────────────────────────────────────────────────────────
  const svcTotal  = selServices.reduce((s, r) => s + r.price, 0);
  const prodTotal = selProducts.reduce((s, r) => s + r.price * r.qty, 0);
  const totalAmount = svcTotal + prodTotal;

  // ── Add service ────────────────────────────────────────────────────────────
  const addService = () => {
    if (!selSvc) return;
    const svc = services.find(s => s.id === parseInt(selSvc));
    if (!svc) return;
    if (selServices.find(s => s.service_id === svc.id)) {
      setToast({ type: "error", msg: "Service already added!" }); return;
    }
    setSelServices(prev => [...prev, { service_id: svc.id, service_name: svc.name, price: svc.price }]);
    setSelSvc("");
  };

  // ── Add product ────────────────────────────────────────────────────────────
  const addProduct = () => {
    if (!selProd) return;
    const prod = products.find(p => p.id === parseInt(selProd));
    if (!prod) return;
    if (selProducts.find(p => p.product_id === prod.id)) {
      setToast({ type: "error", msg: "Product already added!" }); return;
    }
    setSelProducts(prev => [...prev, { product_id: prod.id, product_name: prod.name, qty: 1, price: prod.price }]);
    setSelProd("");
  };

  // ── Generate daily code (YYYYMMDD + 2-digit seq) ──────────────────────────
  const genCode = async (): Promise<string> => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const p: Record<string, string> = {};
    parts.forEach(x => { p[x.type] = x.value; });
    const prefix = `${p.year}${p.month}${p.day}`;
    const { data } = await supabase.from("transaction_list")
      .select("code").like("code", `${prefix}%`).order("code", { ascending: false }).limit(1);
    const lastSeq = data?.[0]?.code ? parseInt(data[0].code.slice(8)) || 0 : 0;
    return `${prefix}${String(lastSeq + 1).padStart(2, "0")}`;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!clientId)       { setToast({ type: "error", msg: "Client select karo!" }); return; }
    if (!item.trim())    { setToast({ type: "error", msg: "Item naam likho!" }); return; }
    if (!fault.trim())   { setToast({ type: "error", msg: "Fault likho!" }); return; }
    if (!jobId.trim())   { setToast({ type: "error", msg: "Job ID required!" }); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile }  = await supabase.from("profiles")
        .select("mechanic_id").eq("id", user!.id).single();
      const userId = profile?.mechanic_id || 0;

      const mech = mechanics.find(m => m.id === parseInt(mechanicId));
      const commAmt = mech
        ? parseFloat(((totalAmount * (mech.commission_percent || 0)) / 100).toFixed(2))
        : 0;

      const txnData = {
        client_name:                  String(clientId),
        job_id:                       jobId,
        item:                         item.trim(),
        fault:                        fault.trim(),
        remark:                       remark.trim() || "",
        uniq_id:                      uniqId.trim() || "",
        amount:                       totalAmount,
        status:                       0,
        del_status:                   0,
        mechanic_id:                  mechanicId ? parseInt(mechanicId) : null,
        mechanic_amount:              parseFloat(mechAmount) || 0,
        mechanic_commission_amount:   commAmt,
        user_id:                      userId,
        date_created:                 `${dateCreated}:00+05:30`,
        date_updated:                 nowIST(),
      };

      let txnId: number;

      if (isEdit) {
        const { error } = await supabase.from("transaction_list").update(txnData).eq("id", Number(editId));
        if (error) throw error;
        txnId = Number(editId);
        // Delete old services & products, re-insert
        await Promise.all([
          supabase.from("transaction_services").delete().eq("transaction_id", txnId),
          supabase.from("transaction_products").delete().eq("transaction_id", txnId),
        ]);
      } else {
        const code = await genCode();
        const { data: ins, error } = await supabase.from("transaction_list")
          .insert({ ...txnData, code }).select("id").single();
        if (error) throw error;
        txnId = ins.id;
        // Old entry page — do NOT update job_id_counter
        // (counter is only updated by the new job page to keep sequence intact)
      }

      // Insert services
      if (selServices.length > 0) {
        await supabase.from("transaction_services").insert(
          selServices.map(s => ({
            transaction_id: txnId, service_id: s.service_id,
            service_name: s.service_name, price: s.price,
          }))
        );
      }
      // Insert products
      if (selProducts.length > 0) {
        await supabase.from("transaction_products").insert(
          selProducts.map(p => ({
            transaction_id: txnId, product_id: p.product_id,
            product_name: p.product_name, qty: p.qty, price: p.price,
          }))
        );
      }

      setToast({ type: "success", msg: isEdit ? "Job updated!" : "Job saved!" });
      setTimeout(() => router.push(`/jobs/${txnId}`), 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed!";
      setToast({ type: "error", msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={38}/>
      <p className="text-slate-600 text-xs font-black uppercase tracking-widest">Loading...</p>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-5 pt-4 space-y-4">

        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">
                {isEdit ? `Edit Transaction — ${item || editId}` : "Old Job Entry (Manual)"}
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                {isEdit ? "Update existing transaction" : "Old / backdated job entry — Job ID manually set"}
                {!isEdit && jobId && <span className="ml-2 text-blue-400 font-black">Job #{jobId}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/jobs" className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl text-xs font-bold no-underline transition-all">
              <ArrowLeft size={13}/> Cancel
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30">
              {saving ? <><Loader2 size={13} className="animate-spin"/>Saving...</> : <><Save size={13}/> Save Transaction</>}
            </button>
          </div>
        </div>

        {/* ── ROW 1: Client · Date · Job ID ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Client */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={lCls}>Client Name *</label>
                <Link href="/clients/new" className="flex items-center gap-1 text-[9px] font-black text-blue-400 hover:text-blue-300 no-underline uppercase tracking-wider">
                  <UserPlus size={10}/> New Client
                </Link>
              </div>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={iCls} required>
                <option value="">Search Client...</option>
                {clients.map(c => {
                  const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
                  return <option key={c.id} value={c.id}>{name}{c.contact ? ` (${c.contact})` : ""}</option>;
                })}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className={lCls}>Transaction Date *</label>
              <input type="datetime-local" value={dateCreated}
                onChange={e => setDateCreated(e.target.value)}
                className={`${iCls} [color-scheme:dark]`}/>
            </div>

            {/* Job ID */}
            <div>
              <label className={lCls}>Job Sheet No. *</label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
                <input type="text" value={jobId} onChange={e => setJobId(e.target.value)}
                  placeholder="Enter job ID manually"
                  className={`${iCls} pl-8`}/>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: Item · Fault · Uniq ID ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Package size={13}/> Item Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={lCls}>Item / Model *</label>
              <input type="text" value={item} onChange={e => setItem(e.target.value)}
                placeholder="e.g. Sharpy 10R Axis" className={iCls}/>
            </div>
            <div>
              <label className={lCls}>Fault Reported *</label>
              <input type="text" value={fault} onChange={e => setFault(e.target.value)}
                placeholder="e.g. No light output" className={iCls}/>
            </div>
            <div>
              <label className={lCls}>Unique ID / Location</label>
              <input type="text" value={uniqId} onChange={e => setUniqId(e.target.value)}
                placeholder="e.g. Shelf A3" className={iCls}/>
            </div>
          </div>
          <div>
            <label className={lCls}>Remarks</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2}
              placeholder="Any additional notes..."
              className={`${iCls} resize-none`}/>
          </div>
        </div>

        {/* ── ROW 3: Services + Products side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Services */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600/20 to-transparent border-b border-[#21293d]">
              <Settings2 size={14} className="text-blue-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Services</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <select value={selSvc} onChange={e => setSelSvc(e.target.value)} className={`${iCls} flex-1`}>
                  <option value="">Select Service...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — Rs.{fmtN(s.price)}</option>)}
                </select>
                <button onClick={addService}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1">
                  <Plus size={13}/>
                </button>
              </div>
              {selServices.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#0d1117]">
                    <th className="px-3 py-2 text-left text-slate-600 font-bold">Service</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-bold">Price</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {selServices.map((s, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-300">{s.service_name}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" step="0.01" value={s.price}
                            onChange={e => setSelServices(prev => prev.map((x,j) => j===i ? {...x, price: parseFloat(e.target.value)||0} : x))}
                            className="w-24 px-2 py-1 bg-[#0d1117] border border-[#21293d] rounded text-right text-slate-200 outline-none focus:border-blue-500"/>
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => setSelServices(prev => prev.filter((_,j) => j!==i))}
                            className="text-red-400 hover:text-red-300 transition-colors">
                            <X size={13}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-[#0d1117] border-t border-[#21293d]">
                    <td className="px-3 py-2 text-right text-slate-500 text-[10px] font-bold uppercase">Total:</td>
                    <td className="px-3 py-2 text-right text-blue-400 font-black">Rs.{fmtN(svcTotal)}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              ) : (
                <p className="text-center text-slate-700 text-xs py-4 italic">No services added</p>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600/20 to-transparent border-b border-[#21293d]">
              <Package size={14} className="text-emerald-400"/>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Products Used</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <select value={selProd} onChange={e => setSelProd(e.target.value)} className={`${iCls} flex-1`}>
                  <option value="">Select Product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} — Rs.{fmtN(p.price)}</option>)}
                </select>
                <button onClick={addProduct}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1">
                  <Plus size={13}/>
                </button>
              </div>
              {selProducts.length > 0 ? (
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#0d1117]">
                    <th className="px-3 py-2 text-left text-slate-600 font-bold">Product</th>
                    <th className="px-2 py-2 text-center text-slate-600 font-bold">Qty</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-bold">Price</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-bold">Total</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-[#21293d]">
                    {selProducts.map((p, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-300">{p.product_name}</td>
                        <td className="px-2 py-2">
                          <input type="number" min="1" value={p.qty}
                            onChange={e => setSelProducts(prev => prev.map((x,j) => j===i ? {...x, qty: parseInt(e.target.value)||1} : x))}
                            className="w-14 px-2 py-1 bg-[#0d1117] border border-[#21293d] rounded text-center text-slate-200 outline-none focus:border-blue-500"/>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" value={p.price}
                            onChange={e => setSelProducts(prev => prev.map((x,j) => j===i ? {...x, price: parseFloat(e.target.value)||0} : x))}
                            className="w-24 px-2 py-1 bg-[#0d1117] border border-[#21293d] rounded text-right text-slate-200 outline-none focus:border-blue-500"/>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-200 font-bold">Rs.{fmtN(p.qty * p.price)}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => setSelProducts(prev => prev.filter((_,j) => j!==i))}
                            className="text-red-400 hover:text-red-300 transition-colors">
                            <X size={13}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-[#0d1117] border-t border-[#21293d]">
                    <td colSpan={3} className="px-3 py-2 text-right text-slate-500 text-[10px] font-bold uppercase">Products Total:</td>
                    <td className="px-3 py-2 text-right text-emerald-400 font-black">Rs.{fmtN(prodTotal)}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              ) : (
                <p className="text-center text-slate-700 text-xs py-4 italic">No products added</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Total + Mechanic ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Total Payable */}
          <div className="bg-[#161b27] border border-indigo-500/20 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Payable Amount</p>
              <p className="text-3xl font-black text-white mt-1">Rs.{fmtN(totalAmount)}</p>
              {svcTotal > 0 && <p className="text-[10px] text-slate-600 mt-1">Services: Rs.{fmtN(svcTotal)} · Products: Rs.{fmtN(prodTotal)}</p>}
            </div>
            <IndianRupee size={36} className="text-indigo-400/30"/>
          </div>

          {/* Mechanic Assignment */}
          {(userRole === "admin" || userRole === "manager") && (
            <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <User size={13}/> Assign Technician
              </h3>
              <select value={mechanicId} onChange={e => setMechanicId(e.target.value)} className={`${iCls} mb-3`}>
                <option value="">Unassigned</option>
                {mechanics.map(m => {
                  const n = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
                  return <option key={m.id} value={m.id}>{n}{m.commission_percent > 0 ? ` (${m.commission_percent}% comm)` : ""}</option>;
                })}
              </select>
              {mechanicId && (
                <div>
                  <label className={lCls}>Mechanic Amount (Rs.)</label>
                  <input type="number" step="0.01" value={mechAmount}
                    onChange={e => setMechAmount(e.target.value)}
                    className={iCls}/>
                  {(() => {
                    const m = mechanics.find(x => x.id === parseInt(mechanicId));
                    return m && m.commission_percent > 0
                      ? <p className="text-[10px] text-slate-600 mt-1">Auto: {m.commission_percent}% of Rs.{fmtN(totalAmount)}</p>
                      : null;
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Save */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/jobs" className="px-6 py-3 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl font-bold text-sm no-underline transition-all">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/30">
            {saving ? <><Loader2 size={16} className="animate-spin"/>Saving...</> : <><Save size={16}/> Save Transaction</>}
          </button>
        </div>

      </div>
    </div>
  );
}