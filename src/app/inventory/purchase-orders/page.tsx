"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import SearchableSelect from "@/components/SearchableSelect";
import SupplierPicker from "@/components/SupplierPicker";
import { logActivity } from "@/lib/activity";
import { toast } from "@/lib/toast";
import PageLoader from "@/components/PageLoader";
import {
  Plus,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Truck,
  ClipboardList,
  ArrowRight,
  FileText,
  Wallet,
  CalendarDays,
  Search,
  Clock,
  ArrowLeft,
  Pencil,
  Eye,
  Printer,
  MessageCircle,
} from "lucide-react";

type POStatus = "pending" | "ordered" | "partially_received" | "received" | "cancelled";

interface PO {
  id: number;
  po_code: string;
  supplier_id: number | null;
  contact_person_id?: number | null;
  transaction_id: number | null;
  supplier_name: string;
  supplier_phone: string;
  person_name?: string;
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

interface DraftItem {
  product_id: number;
  product_name: string;
  qty: number;
}

const STATUS_META: Record<POStatus, { label: string; cls: string; dot: string }> = {
  pending: {
    label: "Pending",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dot: "bg-amber-400",
  },
  ordered: {
    label: "Ordered",
    cls: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    dot: "bg-sky-400",
  },
  partially_received: {
    label: "Partially Received",
    cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    dot: "bg-teal-400",
  },
  received: {
    label: "Received",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-red-500/10 text-red-400 border-red-500/20",
    dot: "bg-red-400",
  },
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | POStatus>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PO | null>(null);
  const [editTarget, setEditTarget] = useState<PO | null>(null);
  const [initialDraft, setInitialDraft] = useState<DraftItem[] | null>(null);
  const [initialSupplierId, setInitialSupplierId] = useState("");
  const [firmName, setFirmName] = useState("");
  const [firmMobile, setFirmMobile] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  // WhatsApp modal state
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waCopied, setWaCopied] = useState(false);

  const fetchPos = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [poRes, supRes, personRes, sysRes] = await Promise.all([
        supabase.from("purchase_orders").select("*").order("date_created", { ascending: false }),
        supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0),
        supabase
          .from("supplier_contact_persons")
          .select("id, supplier_id, name")
          .order("is_primary", { ascending: false }),
        supabase.from("system_info").select("meta_field, meta_value"),
      ]);
      const supplierMap = new Map((supRes.data || []).map((s: { id: number; name: string; contact: string | null }) => [s.id, { name: s.name, phone: s.contact || "" }]));
      const personById = new Map(
        (personRes.data || []).map((p) => [p.id, { supplier_id: p.supplier_id, name: p.name }])
      );
      const poRows = (poRes.data || []) as Array<{
        id: number;
        po_code: string;
        supplier_id: number | null;
        contact_person_id?: number | null;
        transaction_id: number | null;
        status: string;
        expected_date: string | null;
        notes: string;
        total_amount: number;
        received_date: string | null;
        date_created: string;
      }>;

      const itemMap = new Map<number, POItem[]>();
      if (poRows.length) {
        const { data: itRes } = await supabase
          .from("purchase_order_items")
          .select("*")
          .in(
            "purchase_order_id",
            poRows.map((p) => p.id)
          );
        const { data: prodRes } = await supabase
          .from("product_list")
          .select("id, name")
          .in("id", [...new Set((itRes || []).map((i) => i.product_id))]);
        const prodMap = new Map((prodRes || []).map((p) => [p.id, p.name]));
        (itRes || []).forEach((i) => {
          const list = itemMap.get(i.purchase_order_id) || [];
          list.push({
            id: i.id,
            product_id: i.product_id,
            product_name: prodMap.get(i.product_id) || `#${i.product_id}`,
            qty_ordered: i.qty_ordered,
            qty_received: i.qty_received,
            unit_cost: i.unit_cost,
          });
          itemMap.set(i.purchase_order_id, list);
        });
      }

      // Extract firm info
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

      setPos(
        poRows.map((p) => ({
          ...p,
          supplier_name: p.supplier_id ? (supplierMap.get(p.supplier_id)?.name || "Unknown") : "—",
          supplier_phone: p.supplier_id ? (supplierMap.get(p.supplier_id)?.phone || "") : "",
          person_name:
            p.contact_person_id && personById.get(p.contact_person_id)
              ? personById.get(p.contact_person_id)!.name
              : undefined,
          status: p.status as POStatus,
          items: itemMap.get(p.id) || [],
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPos();
  }, []);

  useEffect(() => {
    try {
      const qs = window.location.search;
      if (qs.includes("create=draft")) {
        const raw = window.sessionStorage.getItem("po_draft");
        if (raw) {
          const parsed = JSON.parse(raw) as DraftItem[];
          if (Array.isArray(parsed) && parsed.length) {
            setInitialDraft(parsed);
            setModalOpen(true);
          }
        }
        window.sessionStorage.removeItem("po_draft");
        const supplierRaw = window.sessionStorage.getItem("po_draft_supplier");
        if (supplierRaw) {
          try {
            setInitialSupplierId(JSON.parse(supplierRaw));
          } catch { /* ignore */ }
          window.sessionStorage.removeItem("po_draft_supplier");
        }
        const sp = new URLSearchParams(qs);
        const supId = sp.get("supplier");
        if (supId) setInitialSupplierId(supId);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const updateStatus = async (po: PO, status: POStatus) => {
    if (!confirm(`Mark PO ${po.po_code} as "${status}"?`)) return;
    setActing(po.id);
    try {
      const payload: Record<string, unknown> = { status, date_updated: new Date().toISOString() };
      if (status === "received") payload.received_date = todayIST();
      const { error } = await supabase.from("purchase_orders").update(payload).eq("id", po.id);
      if (error) throw error;
      await logActivity(
        "PO Status Updated",
        "Inventory",
        po.id,
        `PO: ${po.po_code} | Status → ${status}`
      );
      fetchPos();
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(null);
    }
  };

  const submitReceive = async (
    target: PO,
    payload: { lineQtys: Record<number, number>; lineCosts: Record<number, { unit_cost: number; sell_price: number }>; expenses: number }
  ) => {
    setActing(target.id);
    try {
      const lines = target.items
        .map((i) => {
          const qty = payload.lineQtys[i.product_id] || 0;
          const cost = payload.lineCosts[i.product_id];
          return {
            product_id: i.product_id,
            qty,
            unit_cost: cost?.unit_cost || 0,
            sell_price: cost?.sell_price || 0,
          };
        })
        .filter((l) => l.qty > 0);
      if (lines.length === 0) throw new Error("Enter a quantity for at least one item");

      const { data, error } = await supabase.rpc("receive_po_receipt", {
        p_po_id: target.id,
        p_lines: lines,
        p_expenses: payload.expenses || 0,
      });
      if (error) throw new Error(error.message);
      const totalReceived = (data as Array<{ qty_total_received: number }> | null)?.reduce(
        (s, r) => s + r.qty_total_received,
        0
      );

      await logActivity(
        "PO Received",
        "Inventory",
        target.id,
        `PO: ${target.po_code} | ${lines.length} line(s) received (${totalReceived} units in)`
      );
      setReceiveTarget(null);
      fetchPos();
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActing(null);
    }
  };

  const deletePo = async (po: PO) => {
    if (po.status !== "pending") {
      toast.warning("Only pending POs can be deleted");
      return;
    }
    if (!confirm(`Delete PO ${po.po_code}?`)) return;
    const { error } = await supabase.from("purchase_orders").delete().eq("id", po.id);
    if (!error) {
      await logActivity("PO Deleted", "Inventory", po.id, `PO: ${po.po_code} deleted`);
      fetchPos();
    } else toast.error("Failed: " + error.message);
  };

  const buildWhatsAppMessage = (po: PO) => {
    const itemsList = po.items
      .map((item, idx) => `${idx + 1}. ${item.product_name} — Qty: ${item.qty_ordered}`)
      .join("\n");
    // Strip owner/firm name from address start to avoid repetition
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleanAddress = firmAddress
      .replace(new RegExp(`^\\s*(?:${[ownerName, firmName].filter(Boolean).map(esc).join("|")})\\s*[,\-–.]?\\s*`, "i"), "")
      .trim();
    return [
      `Namaste ${po.supplier_name},`,
      "",
      `Purchase Order: *${po.po_code}*`,
      `Date: ${fmtDate(po.date_created)}`,
      "",
      "Items:",
      itemsList,
      "",
      `Total Items: ${po.items.length}`,
      po.notes ? `Notes: ${po.notes}` : "",
      "",
      "—",
      ownerName,
      cleanAddress,
      firmMobile,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const openWhatsApp = (po: PO) => {
    setWaMessage(buildWhatsAppMessage(po));
    setWaPhone(po.supplier_phone.replace(/[^0-9]/g, ""));
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
      // fallback
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pos.filter((p) => {
      if (statusF !== "all" && p.status !== statusF) return false;
      if (
        q &&
        !p.po_code.toLowerCase().includes(q) &&
        !p.supplier_name.toLowerCase().includes(q) &&
        !(p.person_name || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [pos, search, statusF]);

  const totals = useMemo(
    () => ({
      pending: pos.filter((p) => p.status === "pending").length,
      ordered: pos.filter((p) => p.status === "ordered").length,
      received: pos.reduce((s, p) => s + (p.status === "received" ? p.total_amount : 0), 0),
      all: pos.length,
    }),
    [pos]
  );

  if (loading) {
    return <PageLoader icon={ClipboardList} label="Loading Purchase Orders..." tone="blue" />;
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-600/8 rounded-full blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/inventory"
                className="flex-shrink-0 p-2.5 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-white transition-all"
                title="Back to Inventory"
              >
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
              <Link
                href="/suppliers"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <Truck size={13} /> Suppliers
              </Link>
              <button
                onClick={() => fetchPos(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <Plus size={13} /> New Purchase Order
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              {
                label: "Total POs",
                value: totals.all,
                icon: FileText,
                color: "from-blue-600/20 to-blue-700/5",
                border: "border-blue-500/20",
                text: "text-blue-400",
              },
              {
                label: "Pending",
                value: totals.pending,
                icon: Clock,
                color: "from-amber-600/20 to-amber-700/5",
                border: "border-amber-500/20",
                text: "text-amber-400",
              },
              {
                label: "Ordered",
                value: totals.ordered,
                icon: Truck,
                color: "from-sky-600/20 to-sky-700/5",
                border: "border-sky-500/20",
                text: "text-sky-400",
              },
              {
                label: "Received Val",
                value: `₹${(totals.received / 1000).toFixed(1)}K`,
                icon: Wallet,
                color: "from-emerald-600/20 to-emerald-700/5",
                border: "border-emerald-500/20",
                text: "text-emerald-400",
              },
            ].map(({ label, value, icon: Icon, color, border, text }) => (
              <div
                key={label}
                className={`relative bg-gradient-to-br ${color} border ${border} rounded-2xl px-4 py-3.5 overflow-hidden hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-xl font-black ${text}`}>{value}</div>
                    <div className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">
                      {label}
                    </div>
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
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600"
              size={15}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO code or supplier..."
              className="w-full pl-10 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-600 rounded-xl text-sm focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            {(
              ["all", "pending", "ordered", "partially_received", "received", "cancelled"] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setStatusF(f)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  statusF === f
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-[#161b27] text-slate-600 border-[#21293d] hover:border-emerald-500/30 hover:text-slate-400"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "partially_received"
                    ? "Partial"
                    : f[0].toUpperCase() + f.slice(1)}
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
            {filtered.map((po) => {
              const meta = STATUS_META[po.status];
              const remaining = po.items.reduce((s, i) => s + (i.qty_ordered - i.qty_received), 0);
              return (
                <div
                  key={po.id}
                  className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden hover:border-[#2b3750] transition-colors"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#21293d] bg-[#111520]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <FileText size={16} className="text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/inventory/purchase-orders/${po.id}`}
                            className="font-black text-white text-sm hover:text-emerald-300 transition-colors"
                          >
                            {po.po_code}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${meta.cls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {po.supplier_id != null ? (
                            <Link
                              href={`/suppliers/${po.supplier_id}`}
                              className="text-slate-500 hover:text-blue-400 transition-colors"
                            >
                              {po.supplier_name}
                            </Link>
                          ) : (
                            po.supplier_name
                          )}{" "}
                          · {fmtDate(po.date_created)}
                          {po.person_name && <> · <b className="text-slate-400 font-bold">{po.person_name}</b></>}
                        </div>
                        {po.transaction_id != null && (
                          <Link
                            href={`/jobs/${po.transaction_id}/view`}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-600/10 border border-indigo-500/30 text-[10px] font-bold text-indigo-300 hover:bg-indigo-600/25 transition-colors"
                          >
                            <ClipboardList size={10} /> Job #{po.transaction_id} se
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/inventory/purchase-orders/${po.id}`}
                        title="View PO"
                        className="p-2 bg-[#21293d] hover:bg-blue-600/30 border border-[#21293d] hover:border-blue-500/40 rounded-lg text-slate-500 hover:text-blue-400 transition-all"
                      >
                        <Eye size={13} />
                      </Link>
                      <button
                        title="Print / Download PDF"
                        onClick={() => window.open(`/api/print-purchase-order?po_id=${po.id}`, "_blank")}
                        className="p-2 bg-[#21293d] hover:bg-emerald-600/30 border border-[#21293d] hover:border-emerald-500/40 rounded-lg text-slate-500 hover:text-emerald-400 transition-all"
                      >
                        <Printer size={13} />
                      </button>
                      {po.supplier_phone && (
                        <button
                          title="Send WhatsApp to Supplier"
                          onClick={() => openWhatsApp(po)}
                          className="p-2 bg-[#21293d] hover:bg-green-600/30 border border-[#21293d] hover:border-green-500/40 rounded-lg text-slate-500 hover:text-green-400 transition-all"
                        >
                          <MessageCircle size={13} />
                        </button>
                      )}
                      {(po.status === "pending" || po.status === "cancelled") && (
                        <button
                          onClick={() => setEditTarget(po)}
                          title="Edit PO"
                          className="p-2 bg-[#21293d] hover:bg-amber-600/30 border border-[#21293d] hover:border-amber-500/40 rounded-lg text-slate-500 hover:text-amber-400 transition-all"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <span className="text-xs text-slate-500 font-bold mr-2">
                        {po.items.length} item{po.items.length === 1 ? "" : "s"}
                      </span>
                      {(po.status === "ordered" || po.status === "partially_received") &&
                        remaining > 0 && (
                          <button
                            onClick={() => setReceiveTarget(po)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                          >
                            <ArrowRight size={12} />
                            {po.status === "partially_received"
                              ? `Receive ${remaining} more`
                              : `Receive (${remaining})`}
                          </button>
                        )}
                      {po.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateStatus(po, "ordered")}
                            disabled={acting === po.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                          >
                            <Truck size={12} /> Mark Ordered
                          </button>
                          <button
                            onClick={() => updateStatus(po, "cancelled")}
                            disabled={acting === po.id}
                            className="px-3 py-1.5 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {po.status === "pending" && (
                        <button
                          onClick={() => deletePo(po)}
                          disabled={acting === po.id}
                          className="p-2 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body: items */}
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {po.items.map((item) => {
                        return (
                          <div
                            key={item.id}
                            className="bg-[#111520] border border-[#21293d] rounded-xl p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                href={`/inventory/${item.product_id}`}
                                className="text-xs font-bold text-slate-300 hover:text-emerald-300 transition-colors truncate"
                              >
                                {item.product_name}
                              </Link>
                            </div>
                            <div className="flex items-center justify-between mt-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                                  Ordered
                                </span>
                                <span className="text-sm font-black text-slate-200">
                                  {item.qty_ordered}
                                </span>
                              </div>
                              {item.qty_received > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                                    Recv
                                  </span>
                                  <span className="text-sm font-black text-emerald-400">
                                    {item.qty_received}
                                  </span>
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

      {/* ── CREATE / EDIT PO MODAL ── */}
      {(modalOpen || editTarget) && (
        <CreatePOModal
          editing={editTarget}
          initialDraft={initialDraft}
          initialSupplierId={initialSupplierId}
          onClose={() => {
            setModalOpen(false);
            setEditTarget(null);
            setInitialDraft(null);
            setInitialSupplierId("");
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditTarget(null);
            setInitialDraft(null);
            setInitialSupplierId("");
            fetchPos();
          }}
        />
      )}

      {/* ── RECEIVE MODAL ── */}
      {receiveTarget && (
        <ReceiveStockModal
          target={receiveTarget}
          busy={acting === receiveTarget.id}
          onClose={() => setReceiveTarget(null)}
          onSubmit={(payload) => submitReceive(receiveTarget, payload)}
        />
      )}

      {/* ── WHATSAPP MODAL ── */}
      {waModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setWaModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 max-h-[85vh] flex flex-col">
            <div className="h-0.5 w-full bg-gradient-to-r from-green-500 to-emerald-600" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-green-500/10 border-green-500/25">
                  <MessageCircle size={16} className="text-green-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white leading-none">WhatsApp Message</h3>
                  <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                    Edit, copy or send directly
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={14}
                className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-green-500/60 text-sm font-mono resize-none leading-relaxed"
              />
            </div>

            <div className="px-5 py-4 border-t border-[#21293d] flex items-center gap-3">
              <div className="flex-1 text-[10px] text-slate-600">
                {waMessage.length} characters
              </div>
              <button
                onClick={() => setWaModalOpen(false)}
                className="px-4 py-2.5 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                onClick={copyWhatsApp}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 border ${
                  waCopied
                    ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-400"
                    : "bg-[#21293d] hover:bg-blue-600/30 border-[#21293d] hover:border-blue-500/40 text-slate-400 hover:text-blue-400"
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
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function CreatePOModal({
  onClose,
  onSaved,
  initialDraft,
  initialSupplierId,
  editing,
}: {
  onClose: () => void;
  onSaved: () => void;
  initialDraft?: DraftItem[] | null;
  initialSupplierId?: string;
  editing?: PO | null;
}) {
  const [supplierId, setSupplierId] = useState<string>(
    editing?.supplier_id ? String(editing.supplier_id) : initialSupplierId || ""
  );
  const [products, setProducts] = useState<Array<{ id: number; name: string }>>([]);
  const [lines, setLines] = useState<DraftItem[]>(() =>
    editing && editing.items.length
      ? editing.items.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name || "",
          qty: l.qty_ordered > 0 ? l.qty_ordered : 1,
        }))
      : initialDraft && initialDraft.length
        ? initialDraft.map((l) => ({
            product_id: l.product_id,
            product_name: l.product_name || "",
            qty: l.qty > 0 ? l.qty : 1,
          }))
        : [{ product_id: 0, product_name: "", qty: 1 }]
  );
  const [expectedDate, setExpectedDate] = useState(editing?.expected_date || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [contactPerson, setContactPerson] = useState(
    editing?.contact_person_id != null ? String(editing.contact_person_id) : ""
  );
  const [persons, setPersons] = useState<Array<{ id: number; name: string; is_primary: boolean }>>(
    []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P1 bridge: "required parts → PO" conversion se partIds + source job aate hain.
  // CreatePOModal mount hone par ek baar utha kar clear kar lete hain.
  const [partsMeta] = useState<{ partIds: number[]; transactionId?: number | null } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem("po_parts_meta");
      window.sessionStorage.removeItem("po_parts_meta");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { partIds?: number[]; transactionId?: number | null };
      if (!parsed.partIds?.length) return null;
      return { partIds: parsed.partIds, transactionId: parsed.transactionId };
    } catch {
      return null;
    }
  });

  const today = todayIST();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("product_list")
      .select("id, name")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name")
      .then(({ data }) => setProducts((data || []).map((p) => ({ id: p.id, name: p.name }))));
  }, []);

  // Supplier badalne par uske contact persons load karo.
  // Edit mode mein pehli baar (mount par) contactPerson prefill preserve karo.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) isFirstRun.current = false;
    else setContactPerson("");

    if (!supplierId) {
      setPersons([]);
      return;
    }
    supabase
      .from("supplier_contact_persons")
      .select("id, name, is_primary")
      .eq("supplier_id", Number(supplierId))
      .order("is_primary", { ascending: false })
      .then(({ data }) =>
        setPersons(
          ((data || []) as Array<{ id: number; name: string; is_primary: boolean }>).map((p) => ({
            id: p.id,
            name: p.name,
            is_primary: p.is_primary,
          }))
        )
      );
  }, [supplierId]);

  const setLine = (idx: number, patch: Partial<DraftItem>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const total = 0; // Price TBD — entered during receive

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = lines.filter((l) => l.product_id > 0 && l.qty > 0);
    if (valid.length === 0) {
      setError("Add at least one product");
      return;
    }

    setSaving(true);
    try {
      const headerPayload: Record<string, unknown> = {
        supplier_id: supplierId ? Number(supplierId) : null,
        contact_person_id: contactPerson ? Number(contactPerson) : null,
        expected_date: expectedDate || null,
        notes: notes.trim(),
        total_amount: total,
      };

      if (editing) {
        const { error: upErr } = await supabase
          .from("purchase_orders")
          .update(headerPayload)
          .eq("id", editing.id);
        if (upErr) throw upErr;

        const { error: delItemsErr } = await supabase
          .from("purchase_order_items")
          .delete()
          .eq("purchase_order_id", editing.id);
        if (delItemsErr) throw delItemsErr;

        const { error: itErr } = await supabase.from("purchase_order_items").insert(
          valid.map((l) => ({
            purchase_order_id: editing.id,
            product_id: l.product_id,
            qty_ordered: l.qty,
            qty_received: 0,
            unit_cost: 0,
          }))
        );
        if (itErr) throw itErr;

        await logActivity(
          "PO Updated",
          "Inventory",
          editing.id,
          `PO: ${editing.po_code} | ${valid.length} item(s)`
        );
        onSaved();
        return;
      }

      const poCode = "PO-" + Date.now().toString().slice(-6);
      const createPayload: Record<string, unknown> = {
        ...headerPayload,
        po_code: poCode,
        status: "pending",
      };
      if (partsMeta?.transactionId) createPayload.transaction_id = partsMeta.transactionId;
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert([createPayload])
        .select()
        .single();
      if (poErr) throw poErr;

      const { error: itErr } = await supabase.from("purchase_order_items").insert(
        valid.map((l) => ({
          purchase_order_id: po.id,
          product_id: l.product_id,
          qty_ordered: l.qty,
          qty_received: 0,
          unit_cost: 0,
        }))
      );
      if (itErr) throw itErr;

      // P1 bridge: converted required parts ko banaye gaye PO se link karo
      // (PO place matlab supplier order — parts ab "Ordered" status).
      if (partsMeta?.partIds?.length) {
        const { error: linkErr } = await supabase
          .from("job_required_parts")
          .update({ purchase_order_id: po.id, status: 1 })
          .in("id", partsMeta.partIds);
        if (linkErr) throw linkErr;
      }

      await logActivity(
        "PO Created",
        "Inventory",
        po.id,
        `PO: ${poCode} | ${valid.length} item(s)`
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const addLine = () =>
    setLines((ls) => [...ls, { product_id: 0, product_name: "", qty: 1 }]);
  const removeLine = (idx: number) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls));

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
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
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                editing
                  ? "bg-amber-500/10 border-amber-500/25"
                  : "bg-emerald-500/10 border-emerald-500/25"
              }`}
            >
              {editing ? (
                <Pencil size={16} className="text-amber-400" />
              ) : (
                <Plus size={16} className="text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-none">
                {editing ? `Edit ${editing.po_code}` : "New Purchase Order"}
              </h3>
              <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                {editing ? "Update supplier, dates & line items" : "Reorder stock from supplier"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all"
          >
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
                <SupplierPicker
                  value={supplierId || null}
                  onSelect={(v) => setSupplierId(v || "")}
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
                  min={editing ? undefined : today}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Contact person (optional) */}
            {supplierId && persons.length > 0 && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                  Contact Person (Optional)
                </label>
                <select
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm [color-scheme:dark]"
                >
                  <option value="">-- Koi bhi person --</option>
                  {persons.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_primary ? " (Primary)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Line items */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                Products to Reorder
              </label>
              <div className="space-y-2.5">
                {lines.map((l, idx) => (
                  <div
                    key={idx}
                    className="relative bg-[#111520] border border-[#21293d] rounded-xl p-3 space-y-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="absolute top-3 right-3 z-10 p-2 bg-[#21293d] hover:bg-red-600/30 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-500 hover:text-red-400 transition-all"
                    >
                      <X size={13} />
                    </button>
                    <div className="pr-11">
                      <SearchableSelect
                        value={l.product_id || null}
                        options={products.map((p) => ({ id: p.id, label: p.name }))}
                        onSelect={(v) => {
                          const found = products.find((p) => String(p.id) === v);
                          setLine(idx, {
                            product_id: found ? found.id : 0,
                            product_name: found ? found.name : "",
                          });
                        }}
                        placeholder="-- Select Product --"
                        searchPlaceholder="Search product..."
                        emptyText="No product found"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) =>
                            setLine(idx, { qty: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-full px-3 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-emerald-500/60 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addLine}
                className="mt-2.5 w-full py-2.5 rounded-xl border border-dashed border-[#21293d] hover:border-emerald-500/40 hover:bg-emerald-500/5 text-slate-500 hover:text-emerald-400 text-xs font-bold transition-all"
              >
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
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Urgent restock, shelf placement..."
                className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[#21293d] flex items-center gap-3">
            <div className="flex-1">
              <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest block">
                Price
              </span>
              <span className="text-sm font-bold text-slate-500">
                As per supplier invoice
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> {editing ? "Save Changes" : "Create PO"}
                </>
              )}
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

// ──────────────────────────────────────────────────────────────────────────────
function ReceiveStockModal({
  target,
  busy,
  onClose,
  onSubmit,
}: {
  target: PO;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { lineQtys: Record<number, number>; lineCosts: Record<number, { unit_cost: number; sell_price: number }>; expenses: number }) => void;
}) {
  const [qtys, setQtys] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    target.items.forEach((i) => {
      init[i.product_id] = Math.max(0, i.qty_ordered - i.qty_received);
    });
    return init;
  });
  const [costs, setCosts] = useState<Record<number, { unit_cost: number; sell_price: number }>>({});
  const [expenses, setExpenses] = useState(0);

  const totalReceiving = target.items.reduce((s, i) => s + (qtys[i.product_id] || 0), 0);
  const totalQty = target.items.reduce((s, i) => s + i.qty_ordered, 0);
  const allFull = target.items.every(
    (i) => (qtys[i.product_id] || 0) >= i.qty_ordered - i.qty_received
  );

  const getCost = (pid: number) => costs[pid]?.unit_cost || 0;
  const getSell = (pid: number) => costs[pid]?.sell_price || 0;
  const getExpensePerUnit = totalReceiving > 0 ? expenses / totalReceiving : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col">
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-500/10 border-emerald-500/25">
              <Truck size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-none">
                Receive Stock — {target.po_code}
              </h3>
              <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                Enter qty, purchase price &amp; sell price per item
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#111520] hover:bg-white/5 text-slate-500 hover:text-slate-300 border border-[#21293d] transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          {/* PO Expenses */}
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-300">Total PO Expenses</div>
                <div className="text-[10px] text-slate-600">Freight, handling, packing etc. (distributed per unit)</div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 text-sm font-bold">₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={expenses || ""}
                  onChange={(e) => setExpenses(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-28 px-3 py-2 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-lg outline-none focus:border-emerald-500/60 text-sm text-right"
                />
              </div>
            </div>
          </div>

          {/* Per-item receive */}
          {target.items.map((item) => {
            const outstanding = Math.max(0, item.qty_ordered - item.qty_received);
            if (outstanding <= 0) return null;
            const qty = qtys[item.product_id] || 0;
            const uc = getCost(item.product_id);
            const sp = getSell(item.product_id);
            const costWithExpense = uc + getExpensePerUnit;
            return (
              <div
                key={item.id}
                className="bg-[#111520] border border-[#21293d] rounded-xl p-3 space-y-2.5"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-300 truncate">
                      {item.product_name}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      Ordered {item.qty_ordered} · Recv {item.qty_received} ·{" "}
                      <span className="text-emerald-400 font-bold">Open {outstanding}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 font-bold">Qty:</span>
                    <input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={qty}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(outstanding, Number(e.target.value) || 0));
                        setQtys((q) => ({ ...q, [item.product_id]: v }));
                      }}
                      className="w-20 px-3 py-2 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-lg outline-none focus:border-emerald-500/60 text-sm text-center"
                    />
                  </div>
                </div>
                {/* Price fields */}
                {qty > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1">
                        Purchase Price (₹ / unit)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={uc || ""}
                        onChange={(e) =>
                          setCosts((c) => ({
                            ...c,
                            [item.product_id]: {
                              ...c[item.product_id],
                              unit_cost: Math.max(0, Number(e.target.value) || 0),
                            },
                          }))
                        }
                        placeholder="Supplier price"
                        className="w-full px-3 py-2 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-lg outline-none focus:border-emerald-500/60 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-600 mb-1">
                        Sell Price (₹ / unit)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={sp || ""}
                        onChange={(e) =>
                          setCosts((c) => ({
                            ...c,
                            [item.product_id]: {
                              ...c[item.product_id],
                              sell_price: Math.max(0, Number(e.target.value) || 0),
                            },
                          }))
                        }
                        placeholder="Our selling price"
                        className="w-full px-3 py-2 bg-[#161b27] border border-[#21293d] text-slate-200 rounded-lg outline-none focus:border-emerald-500/60 text-sm"
                      />
                    </div>
                    {/* Calculated cost price */}
                    {uc > 0 && (
                      <div className="col-span-2 flex items-center gap-2 text-[10px] text-slate-500 border-t border-[#21293d] pt-2">
                        <span>Cost Price = ₹{uc.toFixed(2)}</span>
                        {getExpensePerUnit > 0 && (
                          <> + ₹{getExpensePerUnit.toFixed(2)} expense = <span className="text-emerald-400 font-bold">₹{costWithExpense.toFixed(2)}</span></>
                        )}
                        {sp > 0 && costWithExpense > 0 && (
                          <span className="ml-auto text-amber-400 font-bold">
                            Margin: {(((sp - costWithExpense) / costWithExpense) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {target.items.every((i) => i.qty_ordered - i.qty_received <= 0) && (
            <p className="text-slate-600 text-sm font-bold text-center py-6">
              Nothing left to receive on this PO.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[#21293d] flex items-center gap-3">
          <div className="flex-1">
            <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest block">
              Receiving
            </span>
            <span className="text-xl font-black text-emerald-400">{totalReceiving} units</span>
            {expenses > 0 && totalReceiving > 0 && (
              <span className="block text-[10px] text-slate-600 font-bold mt-0.5">
                + ₹{expenses.toLocaleString("en-IN")} expenses (₹{getExpensePerUnit.toFixed(2)}/unit)
              </span>
            )}
            <span className="block text-[10px] text-slate-700 font-bold mt-0.5">
              {allFull && totalReceiving > 0 ? "Will mark PO as Received" : "PO stays Partially Received"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-sm transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || totalReceiving <= 0}
            onClick={() =>
              onSubmit({ lineQtys: qtys, lineCosts: costs, expenses })
            }
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {busy ? "Receiving..." : "Receive"}
          </button>
        </div>
      </div>
    </div>
  );
}
