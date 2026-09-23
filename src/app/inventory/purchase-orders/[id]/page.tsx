"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import PageLoader from "@/components/PageLoader";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { todayIST } from "@/lib/dateUtils";
import { toast } from "@/lib/toast";
import {
  ArrowLeft,
  ClipboardList,
  Truck,
  User,
  CalendarDays,
  StickyNote,
  PackageX,
  Printer,
  Pencil,
  ArrowRight,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  MessageCircle,
} from "lucide-react";

type POStatus = "pending" | "ordered" | "partially_received" | "received" | "cancelled";

type PODetail = {
  id: number;
  po_code: string;
  supplier_id: number | null;
  contact_person_id: number | null;
  status: POStatus;
  expected_date: string | null;
  notes: string | null;
  total_amount: number;
  expenses: number;
  received_date: string | null;
  date_created: string;
};

type POItemRow = {
  id: number;
  product_id: number;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const STATUS_META: Record<POStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
  ordered: { label: "Ordered", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20", dot: "bg-sky-400" },
  partially_received: {
    label: "Partially Received",
    cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    dot: "bg-teal-400",
  },
  received: { label: "Received", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-400" },
};

const STATUS_FLOW: POStatus[] = ["pending", "ordered", "partially_received", "received"];

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PODetail | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [items, setItems] = useState<Array<POItemRow & { product_name: string }>>([]);
  const [acting, setActing] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [firmMobile, setFirmMobile] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  // WhatsApp modal state
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waCopied, setWaCopied] = useState(false);

  // Receive modal state
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
  const [receiveCosts, setReceiveCosts] = useState<Record<number, { unit_cost: number; sell_price: number }>>({});
  const [receiveExpenses, setReceiveExpenses] = useState(0);

  const fetchPO = useCallback(async () => {
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }
    const poRes = await supabase
      .from("purchase_orders")
      .select("id, po_code, supplier_id, contact_person_id, status, expected_date, notes, total_amount, expenses, received_date, date_created")
      .eq("id", id)
      .maybeSingle();
    const header = (poRes.data || null) as PODetail | null;
    if (!header) {
      setPo(null);
      setLoading(false);
      return;
    }

    header.status = (
      ["pending", "ordered", "partially_received", "received", "cancelled"].includes(header.status as string)
        ? header.status
        : "pending"
    ) as POStatus;

    const [supRes, pRes, itRes, sysRes] = await Promise.all([
      header.supplier_id
        ? supabase.from("suppliers").select("name, contact").eq("id", header.supplier_id).maybeSingle()
        : Promise.resolve({ data: null }),
      header.contact_person_id
        ? supabase
            .from("supplier_contact_persons")
            .select("name")
            .eq("id", header.contact_person_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("purchase_order_items")
        .select("id, product_id, qty_ordered, qty_received, unit_cost")
        .eq("purchase_order_id", id),
      supabase.from("system_info").select("meta_field, meta_value"),
    ]);

    const supName = (supRes.data as { name: string; contact: string | null } | null)?.name || null;
    const supPhone = (supRes.data as { name: string; contact: string | null } | null)?.contact || "";
    const person = (pRes.data as { name: string } | null)?.name || null;
    const itemRows = (itRes.data || []) as POItemRow[];

    let prodMap = new Map<number, string>();
    if (itemRows.length) {
      const pIds = [...new Set(itemRows.map((i) => i.product_id))];
      const { data: prods } = await supabase
        .from("product_list")
        .select("id, name")
        .in("id", pIds);
      prodMap = new Map((prods || []).map((p) => [p.id, p.name]));
    }

    setPo(header);
    setSupplierName(supName);
    setSupplierPhone(supPhone);
    setPersonName(person);
    setItems(itemRows.map((i) => ({ ...i, product_name: prodMap.get(i.product_id) || `#${i.product_id}` })));

    // Firm info
    const sysInfo: Record<string, string> = {};
    (sysRes.data || []).forEach((r: { meta_field: string; meta_value: string }) => {
      sysInfo[r.meta_field] = r.meta_value;
    });
    setFirmName(sysInfo.name || "V-Technologies");
    setFirmMobile(sysInfo.contact || "");
    setFirmAddress(sysInfo.address || "");

    // Owner name (logged-in user)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        setOwnerName(prof?.full_name || user.user_metadata?.full_name || "");
      }
    } catch { /* ignore */ }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchPO();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchPO]);

  // Initialize receive defaults when modal opens
  useEffect(() => {
    if (showReceive) {
      const qtys: Record<number, number> = {};
      items.forEach((i) => {
        qtys[i.product_id] = Math.max(0, i.qty_ordered - i.qty_received);
      });
      setReceiveQtys(qtys);
      setReceiveCosts({});
      setReceiveExpenses(0);
    }
  }, [showReceive, items]);

  const updateStatus = async (status: POStatus) => {
    if (!po) return;
    const label = status === "cancelled" ? "Cancel" : `Mark as "${status}"`;
    if (!confirm(`${label} PO ${po.po_code}?`)) return;
    setActing(true);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "received") payload.received_date = todayIST();
      const { error } = await supabase.from("purchase_orders").update(payload).eq("id", po.id);
      if (error) throw error;
      await logActivity("PO Status Updated", "Inventory", po.id, `PO: ${po.po_code} → ${status}`);
      fetchPO();
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(false);
    }
  };

  const deletePo = async () => {
    if (!po) return;
    if (!confirm(`Delete PO ${po.po_code}?`)) return;
    setActing(true);
    try {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", po.id);
      if (error) throw error;
      await logActivity("PO Deleted", "Inventory", po.id, `PO: ${po.po_code} deleted`);
      router.push("/inventory/purchase-orders");
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
      setActing(false);
    }
  };

  const submitReceive = async () => {
    if (!po) return;
    setActing(true);
    try {
      const lines = items
        .map((i) => {
          const qty = receiveQtys[i.product_id] || 0;
          const cost = receiveCosts[i.product_id];
          return {
            product_id: i.product_id,
            qty,
            unit_cost: cost?.unit_cost || 0,
            sell_price: cost?.sell_price || 0,
          };
        })
        .filter((l) => l.qty > 0);
      if (lines.length === 0) throw new Error("Enter a quantity for at least one item");

      const { error } = await supabase.rpc("receive_po_receipt", {
        p_po_id: po.id,
        p_lines: lines,
        p_expenses: receiveExpenses || 0,
      });
      if (error) throw new Error(error.message);
      await logActivity("PO Received", "Inventory", po.id, `PO: ${po.po_code} | ${lines.length} line(s) received`);
      setShowReceive(false);
      fetchPO();
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <AdminPage title="Purchase Order" subtitle="Loading...">
        <PageLoader icon={ClipboardList} label="loading PO..." tone="emerald" />
      </AdminPage>
    );
  }

  if (!po) {
    return (
      <AdminPage title="Purchase Order" subtitle="Not found">
        <div className="p-6 text-center space-y-4">
          <PackageX size={32} className="mx-auto text-muted-2" />
          <p className="text-sm text-muted">This purchase order does not exist.</p>
          <Link
            href="/inventory/purchase-orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            <ArrowLeft size={13} /> Back to Purchase Orders
          </Link>
        </div>
      </AdminPage>
    );
  }

  const statusMeta = STATUS_META[po.status] || STATUS_META.pending;
  const totalReceived = items.reduce((s, i) => s + (i.qty_received || 0), 0);
  const totalOrdered = items.reduce((s, i) => s + (i.qty_ordered || 0), 0);
  const outstanding = totalOrdered - totalReceived;
  const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const currentStep = STATUS_FLOW.indexOf(po.status);
  const canEdit = po.status === "pending" || po.status === "cancelled";
  const canReceive = (po.status === "ordered" || po.status === "partially_received") && outstanding > 0;
  const canMarkOrdered = po.status === "pending";
  const canCancel = po.status === "pending" || po.status === "ordered" || po.status === "partially_received";
  const canDelete = po.status === "pending";

  const openWhatsApp = () => {
    if (!po) return;
    const itemsList = items
      .map((item, idx) => `${idx + 1}. ${item.product_name} — Qty: ${item.qty_ordered}`)
      .join("\n");
    // Strip owner/firm name from address start to avoid repetition
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleanAddress = firmAddress
      .replace(new RegExp(`^\\s*(?:${[ownerName, firmName].filter(Boolean).map(esc).join("|")})\\s*[,\-–.]?\\s*`, "i"), "")
      .trim();
    const msg = [
      `Namaste ${supplierName || "Supplier"},`,
      "",
      `Purchase Order: *${po.po_code}*`,
      `Date: ${fmtDate(po.date_created)}`,
      "",
      "Items:",
      itemsList,
      "",
      `Total Items: ${items.length}`,
      po.notes ? `Notes: ${po.notes}` : "",
      "",
      "—",
      ownerName,
      cleanAddress,
      firmMobile,
    ]
      .filter(Boolean)
      .join("\n");

    setWaMessage(msg);
    setWaPhone(supplierPhone.replace(/[^0-9]/g, ""));
    setWaCopied(false);
    setWaModalOpen(true);
  };

  const sendWhatsApp = () => {
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`, "_blank");
  };

  const copyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(waMessage);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = waMessage;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 2000);
    }
  };

  // Receive modal helpers
  const receiveTotalQty = items.reduce((s, i) => s + (receiveQtys[i.product_id] || 0), 0);
  const receiveCost = (pid: number) => receiveCosts[pid]?.unit_cost || 0;
  const receiveSell = (pid: number) => receiveCosts[pid]?.sell_price || 0;
  const expensePerUnit = receiveTotalQty > 0 ? receiveExpenses / receiveTotalQty : 0;

  return (
    <AdminPage title={po.po_code} subtitle="Purchase Order">
      <div className="space-y-4">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link
            href="/inventory/purchase-orders"
            className="text-sm text-muted hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.open(`/api/print-purchase-order?po_id=${po.id}`, "_blank")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
            >
              <Printer size={13} /> Print
            </button>
            {supplierPhone && (
              <button
                onClick={openWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
              >
                <MessageCircle size={13} /> WhatsApp
              </button>
            )}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${statusMeta.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* ── STATUS STEPPER ── */}
        <div className="bg-panel border border-app rounded-2xl p-4">
          <div className="flex items-center justify-between gap-1">
            {STATUS_FLOW.map((s, idx) => {
              const meta = STATUS_META[s];
              const isActive = idx <= currentStep && po.status !== "cancelled";
              const isCurrent = idx === currentStep;
              return (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                        isActive
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                          : "border-app bg-panel-2 text-app"
                      } ${isCurrent ? "ring-2 ring-emerald-500/30" : ""}`}
                    >
                      {idx + 1}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? "text-muted" : "text-app"}`}>
                      {s === "partially_received" ? "Partial" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <div className={`h-0.5 flex-1 mt-[-14px] rounded ${idx < currentStep ? "bg-emerald-500" : "bg-panel-2"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── PROGRESS BAR ── */}
        <div className="bg-panel border border-app rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-2">Receive Progress</span>
            <span className="text-sm font-black text-emerald-400">{progressPct}%</span>
          </div>
          <div className="w-full h-3 bg-panel-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: progressPct === 100
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : "linear-gradient(90deg, #0ea5e9, #14b8a6)",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
            <span>{totalReceived} received of {totalOrdered} ordered</span>
            <span>{outstanding} outstanding</span>
          </div>
        </div>

        {/* ── ACTION BAR ── */}
        <div className="bg-panel border border-app rounded-2xl p-4 flex items-center gap-2 flex-wrap">
          {canMarkOrdered && (
            <button
              onClick={() => updateStatus("ordered")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <Truck size={13} /> Mark Ordered
            </button>
          )}
          {canReceive && (
            <button
              onClick={() => setShowReceive(true)}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <ArrowRight size={13} /> Receive ({outstanding} pending)
            </button>
          )}
          {canEdit && (
            <Link
              href="/inventory/purchase-orders"
              className="flex items-center gap-1.5 px-4 py-2 bg-panel-2 hover:bg-amber-600/30 border border-app hover:border-amber-500/40 text-muted hover:text-amber-400 rounded-xl text-xs font-bold transition-all"
            >
              <Pencil size={13} /> Edit PO
            </Link>
          )}
          {canCancel && (
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 bg-panel-2 hover:bg-red-600/30 border border-app hover:border-red-500/40 text-muted hover:text-red-400 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <XCircle size={13} /> Cancel
            </button>
          )}
          {canDelete && (
            <button
              onClick={deletePo}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 bg-panel-2 hover:bg-red-600/30 border border-app hover:border-red-500/40 text-muted hover:text-red-400 rounded-xl text-xs font-bold transition-all ml-auto disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          {acting && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>

        {/* ── Order Details ── */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-app flex items-center gap-2">
            <ClipboardList size={13} className="text-violet-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-2">Order Details</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Truck size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Supplier</p>
                {po.supplier_id ? (
                  <Link href={`/suppliers/${po.supplier_id}`} className="text-sm font-bold text-app-2 hover:text-blue-400 transition-colors">
                    {supplierName || `#${po.supplier_id}`}
                  </Link>
                ) : (
                  <p className="text-sm font-bold text-app-2">—</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Contact Person</p>
                <p className="text-sm font-bold text-app-2">{personName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={14} className="text-sky-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Expected Date</p>
                <p className="text-sm font-bold text-app-2">{fmtDate(po.expected_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={14} className="text-sky-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Created / Received</p>
                <p className="text-sm font-bold text-app-2">{fmtDate(po.date_created)} · {fmtDate(po.received_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Total Amount</p>
                <p className="text-sm font-bold text-muted italic">
                  {po.total_amount > 0 ? `₹${po.total_amount.toLocaleString("en-IN")}` : "As per supplier invoice"}
                </p>
              </div>
            </div>
            {(po.expenses || 0) > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <Truck size={14} className="text-rose-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-2">Expenses</p>
                  <p className="text-sm font-bold text-rose-400">₹{(po.expenses || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Notes ── */}
        {po.notes && (
          <div className="bg-panel border border-app rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <StickyNote size={13} className="text-muted" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-2">Notes</h3>
            </div>
            <p className="text-sm text-muted whitespace-pre-wrap">{po.notes}</p>
          </div>
        )}

        {/* ── Items ── */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-app flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-2">Items</h3>
            <span className="text-[11px] text-muted">{items.length} line{items.length === 1 ? "" : "s"}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-2 text-center py-8">No items found for this PO.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-muted-2 border-b border-app">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-center px-4 py-3">Ordered</th>
                    <th className="text-center px-4 py-3">Received</th>
                    <th className="text-center px-4 py-3">Outstanding</th>
                    <th className="text-center px-4 py-3 w-32">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {items.map((item) => {
                    const itemOutstanding = Math.max(0, (item.qty_ordered || 0) - (item.qty_received || 0));
                    const itemPct = item.qty_ordered > 0 ? Math.round((item.qty_received / item.qty_ordered) * 100) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-app-2">
                          <Link href={`/inventory/${item.product_id}`} className="text-blue-400 hover:underline">
                            {item.product_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-muted">{item.qty_ordered}</td>
                        <td className="px-4 py-3 text-center text-emerald-400 font-bold">{item.qty_received}</td>
                        <td className="px-4 py-3 text-center text-amber-400 font-bold">{itemOutstanding}</td>
                        <td className="px-4 py-3">
                          <div className="w-full h-1.5 bg-panel-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${itemPct}%`,
                                background: itemPct === 100 ? "#10b981" : "#0ea5e9",
                              }}
                            />
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
      </div>

      {/* ═══════════════════════════════ RECEIVE MODAL ═══════════════════════════════ */}
      {showReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !acting && setShowReceive(false)} />
          <div className="relative w-full max-w-2xl bg-panel border border-app rounded-2xl overflow-hidden shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col">
            <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/25">
                  <Truck size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white leading-none">Receive Stock</h3>
                  <p className="text-[10px] text-muted-2 font-bold mt-0.5 uppercase tracking-wider">
                    Enter qty, purchase price &amp; sell price
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReceive(false)}
                disabled={acting}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-panel-2 hover:bg-white/5 text-muted hover:text-app-2 border border-app transition-all"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              {/* Expenses */}
              <div className="bg-panel-2 border border-app rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-app-2">Total PO Expenses</div>
                    <div className="text-[10px] text-muted-2">Freight, handling, packing (distributed per unit)</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted text-sm font-bold">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={receiveExpenses || ""}
                      onChange={(e) => setReceiveExpenses(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-28 px-3 py-2 bg-panel border border-app text-app-2 rounded-lg outline-none focus:border-emerald-500/60 text-sm text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Per-item */}
              {items.map((item) => {
                const outstanding = Math.max(0, item.qty_ordered - item.qty_received);
                if (outstanding <= 0) return null;
                const qty = receiveQtys[item.product_id] || 0;
                const uc = receiveCost(item.product_id);
                const sp = receiveSell(item.product_id);
                const costWithExpense = uc + expensePerUnit;
                return (
                  <div key={item.id} className="bg-panel-2 border border-app rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-app-2 truncate">{item.product_name}</div>
                        <div className="text-[10px] text-muted-2 mt-0.5">
                          Open: <span className="text-emerald-400 font-bold">{outstanding}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-2 font-bold">Qty:</span>
                        <input
                          type="number"
                          min={0}
                          max={outstanding}
                          value={qty}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(outstanding, Number(e.target.value) || 0));
                            setReceiveQtys((q) => ({ ...q, [item.product_id]: v }));
                          }}
                          className="w-20 px-3 py-2 bg-panel border border-app text-app-2 rounded-lg outline-none focus:border-emerald-500/60 text-sm text-center"
                        />
                      </div>
                    </div>
                    {qty > 0 && (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-2 mb-1">Purchase Price (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={uc || ""}
                            onChange={(e) =>
                              setReceiveCosts((c) => ({
                                ...c,
                                [item.product_id]: { ...c[item.product_id], unit_cost: Math.max(0, Number(e.target.value) || 0) },
                              }))
                            }
                            placeholder="Supplier price"
                            className="w-full px-3 py-2 bg-panel border border-app text-app-2 rounded-lg outline-none focus:border-emerald-500/60 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-2 mb-1">Sell Price (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={sp || ""}
                            onChange={(e) =>
                              setReceiveCosts((c) => ({
                                ...c,
                                [item.product_id]: { ...c[item.product_id], sell_price: Math.max(0, Number(e.target.value) || 0) },
                              }))
                            }
                            placeholder="Our selling price"
                            className="w-full px-3 py-2 bg-panel border border-app text-app-2 rounded-lg outline-none focus:border-emerald-500/60 text-sm"
                          />
                        </div>
                        {uc > 0 && (
                          <div className="col-span-2 flex items-center gap-2 text-[10px] text-muted border-t border-app pt-2">
                            <span>Cost: ₹{uc.toFixed(2)}</span>
                            {expensePerUnit > 0 && <> + ₹{expensePerUnit.toFixed(2)} exp = <span className="text-emerald-400 font-bold">₹{costWithExpense.toFixed(2)}</span></>}
                            {sp > 0 && costWithExpense > 0 && (
                              <span className="ml-auto text-amber-400 font-bold">Margin: {(((sp - costWithExpense) / costWithExpense) * 100).toFixed(1)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-app flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[10px] text-app font-bold uppercase tracking-widest block">Receiving</span>
                <span className="text-xl font-black text-emerald-400">{receiveTotalQty} units</span>
              </div>
              <button
                onClick={() => setShowReceive(false)}
                disabled={acting}
                className="px-5 py-3 bg-panel-2 hover:bg-white/5 border border-app text-muted hover:text-app-2 rounded-xl font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitReceive}
                disabled={acting || receiveTotalQty <= 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
              >
                {acting ? (
                  <><Loader2 size={16} className="animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle2 size={16} /> Confirm Receive</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP MODAL ── */}
      {waModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWaModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-panel border border-app rounded-2xl overflow-hidden shadow-2xl shadow-black/50 max-h-[85vh] flex flex-col">
            <div className="h-0.5 w-full bg-gradient-to-r from-green-500 to-emerald-600" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-green-500/10 border-green-500/25">
                  <MessageCircle size={16} className="text-green-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white leading-none">WhatsApp Message</h3>
                  <p className="text-[10px] text-muted-2 font-bold mt-0.5 uppercase tracking-wider">
                    Edit, copy or send directly
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-panel-2 hover:bg-white/5 text-muted hover:text-app-2 border border-app transition-all"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={14}
                className="w-full px-4 py-3 bg-panel-2 border border-app text-app-2 rounded-xl outline-none focus:border-green-500/60 text-sm font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="px-5 py-4 border-t border-app flex items-center gap-3">
              <div className="flex-1 text-[10px] text-muted-2">
                {waMessage.length} characters
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                className="px-4 py-2.5 bg-panel-2 hover:bg-white/5 border border-app text-muted hover:text-app-2 rounded-xl font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={copyWhatsApp}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border ${
                  waCopied
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                    : "bg-panel-2 hover:bg-blue-600/30 border-app hover:border-blue-500/40 text-muted hover:text-blue-400"
                }`}
              >
                {waCopied ? <><CheckCircle2 size={13} /> Copied!</> : "Copy"}
              </button>
              <button
                onClick={sendWhatsApp}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-green-500/20"
              >
                <MessageCircle size={13} /> Send on WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
