"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import SearchableSelect from "@/components/SearchableSelect";
import { logActivity } from "@/lib/activity";
import {
  Plus, Trash2, RefreshCw, X, CheckCircle2, AlertCircle,
  Loader2, Truck, ClipboardList, ArrowRight, FileText, Wallet, CalendarDays,
  Search, Clock, ArrowLeft,
} from "lucide-react";

type POStatus = "pending" | "ordered" | "received" | "cancelled";

interface PO {
  id: number;
  po_code: string;
  supplier_id: number | null;
  supplier_name: string;
  status: POStatus;
  expected_date: string | null;
  notes: string;
  total_amount: number;
  received_date: string | null;
  date_created: string;
  items: POItem[];
}

interface POItem {
  id: number;
  product_id: number;
  product_name: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
}

interface Supplier { id: number; name: string; }

interface DraftItem {
  product_id: number;
  product_name: string;
  qty: number;
  unit_cost: number;
}

const STATUS_META: Record<POStatus, { label: string; cls: string; dot: string }> = {
  pending:   { label: "Pending",   cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",   dot: "bg-amber-400"   },
  ordered:   { label: "Ordered",   cls: "bg-sky-500/10 text-sky-400 border-sky-500/20",        dot: "bg-sky-400"     },
  received:  { label: "Received",  cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-400 border-red-500/20",        dot: "bg-red-400"     },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PurchaseOrdersPage() {
  const [pos,       setPos]      = useState<PO[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [search,    setSearch]   = useState("");
  const [statusF,   setStatusF]  = useState<"all" | POStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [acting,    setActing]   = useState<number | null>(null);

  const fetchPos = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [poRes, supRes] = await Promise.all([
        supabase.from("purchase_orders").select("*").order("date_created", { ascending: false }),
        supabase.from("suppliers").select("id, name").eq("delete_flag", 0),
      ]);
      const supplierMap = new Map((supRes.data || []).map(s => [s.id, s.name]));
      const poRows = (poRes.data || []) as Array<{
        id: number; po_code: string; supplier_id: number | null; status: string;
        expected_date: string | null; notes: string; total_amount: number;
        received_date: string | null; date_created: string;
      }>;

      const itemMap = new Map<number, POItem[]>();
      if (poRows.length) {
        const { data: itRes } = await supabase
          .from("purchase_order_items").select("*").in("purchase_order_id", poRows.map(p => p.id));
        const { data: prodRes } = await supabase
          .from("product_list").select("id, name").in("id", [...new Set((itRes || []).map(i => i.product_id))]);
        const prodMap = new Map((prodRes || []).map(p => [p.id, p.name]));
        (itRes || []).forEach(i => {
          const list = itemMap.get(i.purchase_order_id) || [];
          list.push({
            id: i.id, product_id: i.product_id,
            product_name: prodMap.get(i.product_id) || `#${i.product_id}`,
            qty_ordered: i.qty_ordered, qty_received: i.qty_received, unit_cost: i.unit_cost,
          });
          itemMap.set(i.purchase_order_id, list);
        });
      }

      setPos(poRows.map(p => ({
        ...p,
        supplier_name: p.supplier_id ? supplierMap.get(p.supplier_id) || "Unknown" : "—",
        status: (p.status as POStatus),
        items: itemMap.get(p.id) || [],
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPos(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  const updateStatus = async (po: PO, status: POStatus) => {
    if (!confirm(`Mark PO ${po.po_code} as "${status}"?`)) return;
    setActing(po.id);
    try {
      const payload: Record<string, unknown> = { status, date_updated: new Date().toISOString() };
      if (status === "received") payload.received_date = todayIST();
      const { error } = await supabase.from("purchase_orders").update(payload).eq("id", po.id);
      if (error) throw error;
      await logActivity('PO Status Updated', 'Inventory', po.id, `${po.po_code}: marked as ${status}`);
      fetchPos();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(null);
    }
  };

  const receiveStock = async (po: PO) => {
    if (!confirm(`Receive all items from ${po.po_code} into stock?`)) return;
    setActing(po.id);
    try {
      const rows = po.items.map(i => ({
        product_id: i.product_id,
        quantity: Math.max(0, i.qty_ordered - i.qty_received),
        place: "PO: " + po.po_code,
        stock_date: todayIST(),
        supplier_id: po.supplier_id,
        purchase_cost: i.unit_cost,
        courier_charges: 0,
      })).filter(r => r.quantity > 0);
      if (rows.length === 0) throw new Error("No remaining quantity to receive");

      const { error } = await supabase.from("inventory_list").insert(rows);
      if (error) throw error;

      const { error: updErr } = await supabase
        .from("purchase_orders")
        .update({ status: "received", received_date: todayIST(), date_updated: new Date().toISOString() })
        .eq("id", po.id);
      if (updErr) throw updErr;

      await logActivity('PO Received', 'Inventory', po.id, `${po.po_code}: ${rows.length} item(s) stocked in`);
      fetchPos();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(null);
    }
  };

  const deletePo = async (po: PO) => {
    if (po.status !== "pending") { alert("Only pending POs can be deleted"); return; }
    if (!confirm(`Delete PO ${po.po_code}?`)) return;
    const { error } = await supabase.from("purchase_orders").delete().eq("id", po.id);
    if (!error) { await logActivity('PO Deleted', 'Inventory', po.id, `${po.po_code} deleted`); fetchPos(); }
    else alert("Failed: " + error.message);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pos.filter(p => {
      if (statusF !== "all" && p.status !== statusF) return false;
      if (q && !p.po_code.toLowerCase().includes(q) && !p.supplier_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pos, search, statusF]);

  const totals = useMemo(() => ({
    pending: pos.filter(p => p.status === "pending").length,
    ordered: pos.filter(p => p.status === "ordered").length,
    received: pos.reduce((s, p) => s + (p.status === "received" ? p.total_amount : 0), 0),
    all: pos.length,
  }), [pos]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <ClipboardList size={28} className="text-blue-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-blue-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Purchase Orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-600/8 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/inventory"
                className="flex-shrink-0 p-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all" title="Back to Inventory">
                <ArrowLeft size={16} />
              </Link>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                  <ClipboardList size={26} className="text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#0d1117]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                    Purchase Orders
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider">
                    New
                  </span>
                </div>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-1">
                  Reorder → PO → Stock-in
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchPos(true)} disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20">
                <Plus size={13} /> New Purchase Order
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Total POs",   value: totals.all,        icon: FileText,      color: "from-blue-600/20 to-blue-700/5",    border: "border-blue-500/20",    text: "text-blue-400"   },
              { label: "Pending",     value: totals.pending,    icon: Clock,         color: "from-amber-600/20 to-amber-700/5", border: "border-amber-500/20",  text: "text-amber-400"  },
              { label: "Ordered",     value: totals.ordered,    icon: Truck,         color: "from-sky-600/20 to-sky-700/5",     border: "border-sky-500/20",     text: "text-sky-400"    },
              { label: "Received Val",value: `₹${(totals.received / 1000).toFixed(1)}K`, icon: Wallet, color: "from-emerald-600/20 to-emerald-700/5", border: "border-emerald-500/20", text: "text-emerald-400" },
            ].map(({ label, value, icon: Icon, color, border, text }) => (
              <div key={label}
                className={`relative bg-gradient-to-br ${color} border ${border} rounded-2xl px-4 py-3.5 overflow-hidden hover:scale-[1.02] transition-transform`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xl font-black ${text}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{label}</div>
                  </div>
                  <Icon size={16} className={`${text} opacity-50`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PO code or supplier..."
              className="w-full pl-10 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "pending", "ordered", "received", "cancelled"] as const).map(f => (
              <button key={f} onClick={() => setStatusF(f)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  statusF === f
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-[#161b27] text-slate-600 border-[#21293d] hover:border-emerald-500/30 hover:text-slate-400"
                }`}>
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PO LIST ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {filtered.length === 0 ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl py-20 text-center">
            <ClipboardList size={36} className="mx-auto text-slate-800 mb-3" />
            <p className="text-slate-600 font-bold text-sm">No purchase orders found</p>
            <p className="text-slate-700 text-xs mt-1">Create one from the top-right button</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(po => {
              const meta = STATUS_META[po.status];
              const remaining = po.items.reduce((s, i) => s + (i.qty_ordered - i.qty_received), 0);
              return (
                <div key={po.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden hover:border-[#2b3750] transition-colors">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#21293d] bg-[#111520]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <FileText size={16} className="text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{po.po_code}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${meta.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {po.supplier_name} · {fmtDate(po.date_created)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold mr-2">
                        ₹{po.total_amount.toLocaleString("en-IN")}
                      </span>
                      {po.status === "ordered" && remaining > 0 && (
                        <button onClick={() => receiveStock(po)} disabled={acting === po.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                          {acting === po.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                          Receive ({remaining})
                        </button>
                      )}
                      {po.status === "pending" && (
                        <>
                          <button onClick={() => updateStatus(po, "ordered")} disabled={acting === po.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                            <Truck size={12} /> Mark Ordered
                          </button>
                          <button onClick={() => updateStatus(po, "cancelled")} disabled={acting === po.id}
                            className="px-3 py-1.5 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg text-xs font-bold transition-all">
                            Cancel
                          </button>
                        </>
                      )}
                      {po.status === "pending" && (
                        <button onClick={() => deletePo(po)} disabled={acting === po.id}
                          className="p-2 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body: items */}
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {po.items.map(item => {
                        return (
                          <div key={item.id} className="bg-[#111520] border border-[#21293d] rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <Link href={`/inventory/${item.product_id}`}
                                className="text-xs font-bold text-slate-300 hover:text-emerald-300 transition-colors truncate">
                                {item.product_name}
                              </Link>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold border border-slate-500/20 text-slate-400">
                                <Wallet size={8} /> ₹{item.unit_cost.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Ordered</span>
                                <span className="text-sm font-black text-slate-200">{item.qty_ordered}</span>
                              </div>
                              {item.qty_received > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Recv</span>
                                  <span className="text-sm font-black text-emerald-400">{item.qty_received}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {po.items.length === 0 && (
                        <p className="text-slate-700 text-xs">No items on this PO.</p>
                      )}
                    </div>

                    {po.notes && (
                      <p className="text-[11px] text-slate-600 mt-3 border-t border-[#21293d] pt-3">
                        <span className="text-slate-700 font-bold">Notes:</span> {po.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CREATE PO MODAL ── */}
      {modalOpen && <CreatePOModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchPos(); }} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function CreatePOModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [lines, setLines] = useState<DraftItem[]>([{ product_id: 0, product_name: "", qty: 1, unit_cost: 0 }]);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayIST();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("suppliers").select("id, name").eq("delete_flag", 0).order("name")
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
    supabase.from("product_list").select("id, name").eq("delete_flag", 0).eq("status", 1).order("name")
      .then(({ data }) => setProducts((data || []).map(p => ({ id: p.id, name: p.name }))));
  }, []);

  const setLine = (idx: number, patch: Partial<DraftItem>) =>
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const total = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = lines.filter(l => l.product_id > 0 && l.qty > 0);
    if (valid.length === 0) { setError("Add at least one product"); return; }

    setSaving(true);
    try {
      const poCode = "PO-" + Date.now().toString().slice(-6);
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert([{
          po_code: poCode,
          supplier_id: supplierId ? Number(supplierId) : null,
          status: "pending",
          expected_date: expectedDate || null,
          notes: notes.trim(),
          total_amount: total,
        }])
        .select()
        .single();
      if (poErr) throw poErr;

      const { error: itErr } = await supabase
        .from("purchase_order_items")
        .insert(valid.map(l => ({
          purchase_order_id: po.id,
          product_id: l.product_id,
          qty_ordered: l.qty,
          qty_received: 0,
          unit_cost: l.unit_cost,
        })));
      if (itErr) throw itErr;

      await logActivity('PO Created', 'Inventory', po.id, `${poCode}: ${valid.length} item(s), ₹${total}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const addLine = () => setLines(ls => [...ls, { product_id: 0, product_name: "", qty: 1, unit_cost: 0 }]);
  const removeLine = (idx: number) => setLines(ls => ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl bg-[#161b27] border border-[#21293d] sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col"
        style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/25">
              <Plus size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-none">New Purchase Order</h3>
              <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                Reorder stock from supplier
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs font-bold">{error}</p>
              </div>
            )}

            {/* Supplier + expected date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                  Supplier (Optional)
                </label>
                <SearchableSelect
                  value={supplierId || null}
                  options={suppliers.map(s => ({ id: s.id, label: s.name }))}
                  onSelect={v => setSupplierId(v)}
                  placeholder="-- Select Supplier --"
                  clearLabel="-- No Supplier --"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={10} className="text-slate-700" /> Expected Date
                  </span>
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  min={today}
                  onChange={e => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Line items */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                Products to Reorder
              </label>
              <div className="space-y-2.5">
                {lines.map((l, idx) => (
                  <div key={idx} className="bg-[#111520] border border-[#21293d] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <SearchableSelect
                        value={l.product_id || null}
                        options={products.map(p => ({ id: p.id, label: p.name }))}
                        onSelect={v => {
                          const found = products.find(p => String(p.id) === v);
                          setLine(idx, { product_id: found ? found.id : 0, product_name: found ? found.name : "" });
                        }}
                        placeholder="-- Select Product --"
                        searchPlaceholder="Search product..."
                        emptyText="No product found"
                      />
                      <button type="button" onClick={() => removeLine(idx)}
                        className="p-2 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all flex-shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">Qty</label>
                        <input
                          type="number" min={1}
                          value={l.qty}
                          onChange={e => setLine(idx, { qty: Math.max(1, Number(e.target.value)) })}
                          className="w-full px-3 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">Unit Cost (₹)</label>
                        <input
                          type="number" min={0} step="0.01"
                          value={l.unit_cost}
                          onChange={e => setLine(idx, { unit_cost: Math.max(0, Number(e.target.value)) })}
                          className="w-full px-3 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addLine}
                className="mt-2.5 w-full py-2.5 rounded-xl border border-dashed border-[#21293d] hover:border-emerald-500/40 hover:bg-emerald-500/5 text-slate-500 hover:text-emerald-400 text-xs font-bold transition-all">
                + Add another product
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Urgent restock, shelf placement..."
                className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#21293d] flex items-center gap-3">
            <div className="flex-1">
              <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest block">Total</span>
              <span className="text-xl font-black text-emerald-400">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </div>
            <button type="button" onClick={onClose}
              className="px-5 py-3 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-sm transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><CheckCircle2 size={16} /> Create PO</>}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
