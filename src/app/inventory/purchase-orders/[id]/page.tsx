"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminPage from "@/app/components/AdminPage";
import PageLoader from "@/components/PageLoader";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ClipboardList, Truck, User, CalendarDays, StickyNote, PackageX } from "lucide-react";

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

const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const STATUS_META: Record<POStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  ordered: { label: "Ordered", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  partially_received: {
    label: "Partially Received",
    cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  received: { label: "Received", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [po, setPo] = useState<PODetail | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [items, setItems] = useState<Array<POItemRow & { product_name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || isNaN(id)) {
        setLoading(false);
        return;
      }
      const poRes = await supabase
        .from("purchase_orders")
        .select("id, po_code, supplier_id, contact_person_id, status, expected_date, notes, total_amount, received_date, date_created")
        .eq("id", id)
        .maybeSingle();
      const header = (poRes.data || null) as PODetail | null;
      if (cancelled) return;

      let supName: string | null = null;
      let person: string | null = null;
      let itemRows: POItemRow[] = [];
      let prodMap = new Map<number, string>();

      if (header) {
        const decoded = header.status as string;
        header.status = (
          ["pending", "ordered", "partially_received", "received", "cancelled"].includes(decoded)
            ? decoded
            : "pending"
        ) as POStatus;

        const [supRes, pRes, itRes] = await Promise.all([
          header.supplier_id
            ? supabase.from("suppliers").select("name").eq("id", header.supplier_id).maybeSingle()
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
        ]);
        if (cancelled) return;

        supName = (supRes.data as { name: string } | null)?.name || null;
        person = (pRes.data as { name: string } | null)?.name || null;
        itemRows = (itRes.data || []) as POItemRow[];

        if (itemRows.length) {
          const pIds = [...new Set(itemRows.map((i) => i.product_id))];
          const { data: prods } = await supabase
            .from("product_list")
            .select("id, name")
            .in("id", pIds);
          prodMap = new Map((prods || []).map((p) => [p.id, p.name]));
        }
      }
      if (cancelled) return;

      setPo(header);
      setSupplierName(supName);
      setPersonName(person);
      setItems(itemRows.map((i) => ({ ...i, product_name: prodMap.get(i.product_id) || `#${i.product_id}` })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
          <PackageX size={32} className="mx-auto text-slate-600" />
          <p className="text-sm text-slate-500">This purchase order does not exist.</p>
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

  return (
    <AdminPage title={po.po_code} subtitle="Purchase Order">
      <div className="space-y-4">
        {/* Back */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link
            href="/inventory/purchase-orders"
            className="text-sm text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Purchase Orders
          </Link>
          <span
            className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold border ${statusMeta.cls}`}
          >
            {statusMeta.label}
          </span>
        </div>

        {/* Order Details */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center gap-2">
            <ClipboardList size={13} className="text-violet-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Order Details
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Truck size={14} className="text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Supplier</p>
                {po.supplier_id ? (
                  <Link
                    href={`/suppliers/${po.supplier_id}`}
                    className="text-sm font-bold text-slate-200 hover:text-blue-400 transition-colors"
                  >
                    {supplierName || `#${po.supplier_id}`}
                  </Link>
                ) : (
                  <p className="text-sm font-bold text-slate-200">—</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Contact Person
                </p>
                <p className="text-sm font-bold text-slate-200">{personName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={14} className="text-sky-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Expected Date
                </p>
                <p className="text-sm font-bold text-slate-200">{fmtDate(po.expected_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                <CalendarDays size={14} className="text-sky-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Created / Received
                </p>
                <p className="text-sm font-bold text-slate-200">
                  {fmtDate(po.date_created)} · {fmtDate(po.received_date)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <ClipboardList size={14} className="text-amber-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Total Amount
                </p>
                <p className="text-sm font-black text-emerald-400">
                  {fmtCurrency(po.total_amount || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {po.notes && (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <StickyNote size={13} className="text-slate-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Notes</h3>
            </div>
            <p className="text-sm text-slate-400 whitespace-pre-wrap">{po.notes}</p>
          </div>
        )}

        {/* Items */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Items
            </h3>
            <span className="text-[11px] text-slate-500">
              {items.length} line{items.length === 1 ? "" : "s"}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-8">No items found for this PO.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-[#21293d]">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-center px-4 py-3">Ordered</th>
                      <th className="text-center px-4 py-3">Received</th>
                      <th className="text-center px-4 py-3">Outstanding</th>
                      <th className="text-right px-4 py-3">Unit Cost</th>
                      <th className="text-right px-4 py-3">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-slate-300">
                          <Link
                            href={`/inventory/${item.product_id}`}
                            className="text-blue-400 hover:underline"
                          >
                            {item.product_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400">{item.qty_ordered}</td>
                        <td className="px-4 py-3 text-center text-emerald-400 font-bold">
                          {item.qty_received}
                        </td>
                        <td className="px-4 py-3 text-center text-amber-400 font-bold">
                          {Math.max(0, (item.qty_ordered || 0) - (item.qty_received || 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {fmtCurrency(item.unit_cost || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-200 font-bold">
                          {fmtCurrency((item.unit_cost || 0) * (item.qty_ordered || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-[#21293d] flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500">
                  {totalOrdered} ordered · {totalReceived} received · {outstanding} outstanding
                </span>
                <span className="text-sm font-black text-emerald-400">
                  {fmtCurrency(po.total_amount || 0)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
}