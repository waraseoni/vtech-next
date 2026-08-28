"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { PO_STATUS } from "@/lib/status-colors";
import {
  ArrowLeft,
  Edit3,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Truck,
  ChevronDown,
  ChevronRight,
  Eye,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";

const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  address: string | null;
  status: number;
  delete_flag: number;
  date_created: string;
};

type PurchaseOrder = {
  id: number;
  po_code: string;
  supplier_id: number;
  total_amount: number;
  status: number;
  date_created: string;
  received_date: string | null;
  notes: string | null;
  delete_flag: number;
};

type POItem = {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  received_qty: number;
  delete_flag: number;
  product_list?: { id: number; name: string } | null;
};

const STATUS_MAP: Record<number, { label: string; color: string }> = Object.fromEntries(
  Object.entries(PO_STATUS).map(([k, v]) => [Number(k), { label: v.label, color: v.cls }])
);

const defaultForm = { name: "", contact: "", email: "", address: "" };

export default function SupplierDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poItemsMap, setPoItemsMap] = useState<Record<number, POItem[]>>({});
  const [expandedPO, setExpandedPO] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [form, setForm] = useState(defaultForm);

  const fetchData = useCallback(async () => {
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: sup } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .eq("delete_flag", 0)
      .single();

    setSupplier(sup as Supplier | null);

    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("supplier_id", id)
      .eq("delete_flag", 0)
      .order("date_created", { ascending: false });

    const poList = (pos || []) as PurchaseOrder[];
    setPurchaseOrders(poList);

    if (poList.length > 0) {
      const poIds = poList.map((p) => p.id);
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("*, product_list(id, name)")
        .in("purchase_order_id", poIds)
        .eq("delete_flag", 0);

      const map: Record<number, POItem[]> = {};
      for (const item of (items || []) as POItem[]) {
        if (!map[item.purchase_order_id]) map[item.purchase_order_id] = [];
        map[item.purchase_order_id].push(item);
      }
      setPoItemsMap(map);
    } else {
      setPoItemsMap({});
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPOs = purchaseOrders.length;
  const totalAmount = purchaseOrders.reduce((s, p) => s + (p.total_amount || 0), 0);
  const receivedValue = purchaseOrders
    .filter((p) => p.status === 2)
    .reduce((s, p) => s + (p.total_amount || 0), 0);
  const pendingValue = purchaseOrders
    .filter((p) => p.status === 0 || p.status === 1)
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const openEdit = () => {
    if (!supplier) return;
    setForm({
      name: supplier.name,
      contact: supplier.contact || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setFormErr("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormErr("Supplier name is required!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      };
      const { error } = await supabase
        .from("suppliers")
        .update({ ...payload, date_updated: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setShowModal(false);
      fetchData();
    } catch (error) {
      setFormErr(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminPage title="Supplier Details" subtitle="Loading...">
        <PageLoader icon={Truck} label="loading supplier..." tone="emerald" />
      </AdminPage>
    );
  }

  if (!supplier) {
    return (
      <AdminPage title="Supplier Details" subtitle="Not found">
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-12 text-center">
          <p className="text-slate-500 text-sm">Supplier not found.</p>
          <Link
            href="/suppliers"
            className="mt-4 inline-block text-blue-400 text-xs font-bold hover:underline"
          >
            ← Back to Suppliers
          </Link>
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage title={supplier.name} subtitle="Supplier Details">
      <div className="space-y-4">
        {/* Back + Edit */}
        <div className="flex items-center justify-between">
          <Link
            href="/suppliers"
            className="text-sm text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Suppliers
          </Link>
          <button
            onClick={openEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Edit3 size={13} /> Edit Supplier
          </button>
        </div>

        {/* Supplier Info Card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d]">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Supplier Information
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Truck size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Name
                </p>
                <p className="text-sm font-bold text-slate-200">{supplier.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Phone size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Contact
                </p>
                <p className="text-sm font-bold text-slate-200">{supplier.contact || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Mail size={14} className="text-red-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Email
                </p>
                <p className="text-sm font-bold text-slate-200">{supplier.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Address
                </p>
                <p className="text-sm font-bold text-slate-200">{supplier.address || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Total POs
            </p>
            <p className="text-lg font-black text-blue-400">{totalPOs}</p>
          </div>
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Total Amount
            </p>
            <p className="text-lg font-black text-slate-200">{fmtCurrency(totalAmount)}</p>
          </div>
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Received Value
            </p>
            <p className="text-lg font-black text-emerald-400">{fmtCurrency(receivedValue)}</p>
          </div>
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Pending Value
            </p>
            <p className="text-lg font-black text-amber-400">{fmtCurrency(pendingValue)}</p>
          </div>
        </div>

        {/* Purchase Order History */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d]">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Purchase Order History
            </h3>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="px-5 py-12 text-center text-slate-600 text-sm">
              No purchase orders found for this supplier.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#111520]">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <th className="text-left px-4 py-3"></th>
                    <th className="text-left px-4 py-3">PO Code</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-center px-4 py-3">Items</th>
                    <th className="text-right px-4 py-3">Total Amount</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Received Date</th>
                    <th className="text-center px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {purchaseOrders.map((po) => {
                    const items = poItemsMap[po.id] || [];
                    const isExpanded = expandedPO === po.id;
                    const statusInfo = STATUS_MAP[po.status] || STATUS_MAP[0];

                    return (
                      <React.Fragment key={po.id}>
                        <tr
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                        >
                          <td className="px-4 py-3.5 w-8">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-slate-500" />
                            ) : (
                              <ChevronRight size={14} className="text-slate-500" />
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              href="/inventory/purchase-orders"
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-emerald-400 font-bold hover:underline"
                            >
                              {po.po_code}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs">
                            {fmtDate(po.date_created)}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-400">{items.length}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-200">
                            {fmtCurrency(po.total_amount || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs">
                            {fmtDate(po.received_date)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Link
                              href="/inventory/purchase-orders"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition inline-flex"
                            >
                              <Eye size={13} />
                            </Link>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="px-4 py-4 bg-[#0d1117]/50">
                              {po.notes && (
                                <div className="mb-3 px-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs text-slate-400">
                                  <span className="font-bold text-slate-500">Notes:</span>{" "}
                                  {po.notes}
                                </div>
                              )}
                              {items.length === 0 ? (
                                <p className="text-xs text-slate-600 text-center py-2">
                                  No items found for this PO.
                                </p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                      <th className="text-left px-3 py-2">Product Name</th>
                                      <th className="text-center px-3 py-2">Ordered Qty</th>
                                      <th className="text-right px-3 py-2">Unit Price</th>
                                      <th className="text-center px-3 py-2">Received Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#1a2234]">
                                    {items.map((item) => (
                                      <tr key={item.id} className="hover:bg-white/[0.02]">
                                        <td className="px-3 py-2 text-slate-300">
                                          <Link
                                            href={`/inventory/${item.product_id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-blue-400 hover:underline"
                                          >
                                            {item.product_list?.name ||
                                              `Product #${item.product_id}`}
                                          </Link>
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-400">
                                          {item.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-400">
                                          {fmtCurrency(item.unit_price || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-400">
                                          {item.received_qty ?? 0}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Edit3 size={16} className="text-blue-400" /> Edit Supplier
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition"
              >
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
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Supplier Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Raj Electronics, Patel Traders"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Contact Number
                </label>
                <input
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="supplier@example.com"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Address
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Full address..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Update
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
