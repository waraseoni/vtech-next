"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-utils";
import SupplierFormModal, { SupplierRow, ContactPerson, ContactPhone } from "@/components/SupplierFormModal";
import Lightbox from "@/components/Lightbox";
import {
  listSupplierPayments,
  addSupplierPayment,
  addExpenseFromPayment,
  syncExpenseForPayment,
  updateSupplierPayment,
  removeSupplierPayment,
  SupplierPayment,
  PAYMENT_MODES,
  PaymentMode,
} from "@/lib/supplierPayments";
import {
  ArrowLeft,
  Edit3,
  Phone,
  Mail,
  MapPin,
  Truck,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageCircle,
  Star,
  ShoppingCart,
  ImageIcon,
  Wallet,
  Landmark,
  FileSignature,
  Plus,
  Loader2,
  X,
  Pencil,
  Trash2,
  Link2,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import SearchableSelect, { SearchableOption } from "@/components/SearchableSelect";
import { fetchStockByProducts } from "@/lib/inventoryStock";
import { alertThreshold } from "@/lib/inventory";

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

const waLink = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, "")}`;
const telLink = (phone: string) => `tel:+91${phone.replace(/\D/g, "")}`;

function PaymentSummary({ amount, baseDue }: { amount: number; baseDue: number }) {
  const remaining = baseDue - amount;
  return (
    <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">
        Payment Summary
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Amount</span>
        <span className="text-white font-bold">{fmtCurrency(amount)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Outstanding</span>
        <span className={`font-bold ${baseDue > 0 ? "text-red-400" : "text-emerald-400"}`}>
          {fmtCurrency(baseDue)}
        </span>
      </div>
      {baseDue > 0 && (
        <div className="flex justify-between text-sm border-t border-[#21293d] pt-2">
          {remaining > 0 ? (
            <>
              <span className="text-slate-400 font-black">Remaining After</span>
              <span className="text-red-400 font-black">{fmtCurrency(remaining)}</span>
            </>
          ) : remaining === 0 ? (
            <>
              <span className="text-slate-400 font-black">After Payment</span>
              <span className="text-emerald-400 font-black">
                Cleared {fmtCurrency(0)}
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-400 font-black">Overpaid (Advance)</span>
              <span className="text-amber-400 font-black">
                {fmtCurrency(Math.abs(remaining))}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type PurchaseOrder = {
  id: number;
  po_code: string;
  supplier_id: number;
  contact_person_id?: number | null;
  total_amount: number;
  status: "pending" | "ordered" | "partially_received" | "received" | "cancelled";
  date_created: string;
  received_date: string | null;
  notes: string | null;
  delete_flag: number;
};

type POItem = {
  id: number;
  purchase_order_id: number;
  product_id: number;
  qty_ordered: number;
  qty_received: number;
  unit_cost: number;
  delete_flag: number;
  product_list?: { id: number; name: string } | null;
};

type POStatus = "pending" | "ordered" | "partially_received" | "received" | "cancelled";

type RecItem = {
  id: number;
  name: string;
  price: number;
  alert_qty: number;
  current_stock: number;
  on_po: number;
  need_to_order: number;
};

type LinkedProduct = {
  id: number;
  name: string;
  price: number | null;
};

const PO_STATUS_META: Record<POStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  ordered: { label: "Ordered", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  partially_received: {
    label: "Partially Received",
    cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  received: { label: "Received", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function SupplierDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [persons, setPersons] = useState<ContactPerson[]>([]);
  const [personNameMap, setPersonNameMap] = useState<Record<number, string>>({});
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [poItemsMap, setPoItemsMap] = useState<Record<number, POItem[]>>({});
  const [expandedPO, setExpandedPO] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [zoomSrc, setZoomSrc] = useState("");

  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState<SupplierPayment | null>(null);
  const [payTargetReadOnly, setPayTargetReadOnly] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payPerson, setPayPerson] = useState("");
  const [savingPay, setSavingPay] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [makeExpense, setMakeExpense] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const router = useRouter();
  const [recItems, setRecItems] = useState<RecItem[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [linkLoading, setLinkLoading] = useState(true);
  const [linkBusy, setLinkBusy] = useState(false);
  const [productOptions, setProductOptions] = useState<SearchableOption[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: sup }, { data: personRows }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", id).eq("delete_flag", 0).single(),
      supabase
        .from("supplier_contact_persons")
        .select("id, name, role, notes, is_primary")
        .eq("supplier_id", id)
        .order("is_primary", { ascending: false }),
    ]);

    setSupplier(sup as SupplierRow | null);

    const rawPersons = (personRows || []) as Array<{
      id: number;
      name: string;
      role: string | null;
      notes: string | null;
      is_primary: boolean;
    }>;

    let phoneRows: Array<ContactPhone & { person_id: number }> = [];
    if (rawPersons.length > 0) {
      const { data } = await supabase
        .from("supplier_contact_phones")
        .select("id, person_id, label, phone, is_primary")
        .in(
          "person_id",
          rawPersons.map((p) => p.id)
        );
      phoneRows = (data || []) as Array<ContactPhone & { person_id: number }>;
    }

    const phoneMap: Record<number, ContactPhone[]> = {};
    for (const ph of phoneRows) {
      if (!phoneMap[ph.person_id]) phoneMap[ph.person_id] = [];
      phoneMap[ph.person_id].push(ph);
    }
    for (const pid of Object.keys(phoneMap))
      phoneMap[Number(pid)].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    let personList: ContactPerson[];
    if (rawPersons.length === 0 && sup?.contact) {
      personList = [
        {
          id: undefined,
          name: "",
          role: "",
          notes: "",
          is_primary: true,
          phones: [{ label: "Mobile", phone: sup.contact, is_primary: true }],
        },
      ];
    } else {
      personList = rawPersons.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role || "",
        notes: p.notes || "",
        is_primary: p.is_primary,
        phones: phoneMap[p.id] || [],
      }));
    }
    setPersons(personList);
    setPersonNameMap(
      Object.fromEntries(
        personList.filter((p) => p.id != null && p.name.trim()).map((p) => [p.id as number, p.name])
      )
    );

    const { data: pos } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("supplier_id", id)
      .order("date_created", { ascending: false });

    const poList = (pos || []) as PurchaseOrder[];
    setPurchaseOrders(poList);

    if (poList.length > 0) {
      const poIds = poList.map((p) => p.id);
      const { data: items } = await supabase
        .from("purchase_order_items")
        .select("*, product_list(id, name)")
        .in("purchase_order_id", poIds);

      const map: Record<number, POItem[]> = {};
      for (const item of (items || []) as POItem[]) {
        if (!map[item.purchase_order_id]) map[item.purchase_order_id] = [];
        map[item.purchase_order_id].push(item);
      }
      setPoItemsMap(map);
    } else {
      setPoItemsMap({});
    }

    const [payRows] = await Promise.all([listSupplierPayments(id)]);
    setPayments(payRows);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchRecommended = useCallback(async () => {
    if (!id || isNaN(id)) {
      setRecLoading(false);
      return;
    }
    try {
      const { data: links } = await supabase
        .from("spare_supplier")
        .select("spare_id")
        .eq("supplier_id", id);
      const ids = [...new Set((links || []).map((l) => l.spare_id as number))]
        .filter((x): x is number => !!x);
      if (ids.length === 0) {
        setRecItems([]);
        setRecLoading(false);
        return;
      }
      const { data: prods } = await supabase
        .from("product_list")
        .select("id, name, price, alert_quantity")
        .in("id", ids)
        .eq("delete_flag", 0)
        .eq("status", 1);
      const stockMap = await fetchStockByProducts(ids);
      const { data: poRows } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", id)
        .in("status", ["pending", "ordered", "partially_received"]);
      const openPoIds = (poRows || []).map((p) => p.id);
      const onPoByProduct: Record<number, number> = {};
      if (openPoIds.length > 0) {
        const { data: itemRows } = await supabase
          .from("purchase_order_items")
          .select("product_id, qty_ordered, qty_received")
          .in("purchase_order_id", openPoIds)
          .in("product_id", ids);
        for (const it of (itemRows || []) as Array<{
          product_id: number;
          qty_ordered: number;
          qty_received: number;
        }>) {
          const open = Math.max(
            0,
            (Number(it.qty_ordered) || 0) - (Number(it.qty_received) || 0)
          );
          if (open > 0) onPoByProduct[it.product_id] = (onPoByProduct[it.product_id] || 0) + open;
        }
      }
      const items = ((prods || []) as Array<{
        id: number;
        name: string;
        price: number | null;
        alert_quantity: number | null;
      }>)
        .map((p) => {
          const current = stockMap.get(p.id)?.available ?? 0;
          const threshold = alertThreshold(p.alert_quantity);
          const onPo = onPoByProduct[p.id] || 0;
          return {
            id: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            alert_qty: threshold,
            current_stock: current,
            on_po: onPo,
            need_to_order: Math.max(0, threshold - current - onPo),
          } satisfies RecItem;
        })
        .filter((i) => i.need_to_order > 0)
        .sort((a, b) => b.need_to_order - a.need_to_order);
      setRecItems(items);
    } catch (e) {
      console.error("fetchRecommended:", e);
      setRecItems([]);
    } finally {
      setRecLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecommended();
  }, [fetchRecommended]);

  const fetchLinkedProducts = useCallback(async () => {
    if (!id || isNaN(id)) {
      setLinkLoading(false);
      return;
    }
    try {
      const { data: links } = await supabase
        .from("spare_supplier")
        .select("spare_id")
        .eq("supplier_id", id);
      const linkedIds = new Set(
        (links || []).map((l) => l.spare_id as number).filter((x): x is number => !!x)
      );
      const { data: prods } = await supabase
        .from("product_list")
        .select("id, name, price")
        .eq("delete_flag", 0)
        .eq("status", 1)
        .order("name");
      const all = (prods || []) as Array<{
        id: number;
        name: string;
        price: number | null;
      }>;
      setLinkedProducts(all.filter((p) => linkedIds.has(p.id)));
      setProductOptions(
        all
          .filter((p) => !linkedIds.has(p.id))
          .map((p) => ({
            id: p.id,
            label: p.name,
            sub: p.price != null ? fmtCurrency(Number(p.price)) : undefined,
          }))
      );
    } catch (e) {
      console.error("fetchLinkedProducts:", e);
      setLinkedProducts([]);
    } finally {
      setLinkLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLinkedProducts();
  }, [fetchLinkedProducts]);

  const handleAddProductLink = async (productId: string) => {
    if (!productId) return;
    setLinkBusy(true);
    try {
      const { error } = await supabase
        .from("spare_supplier")
        .insert({ spare_id: Number(productId), supplier_id: id });
      if (error) throw new Error(error.message);
      await fetchLinkedProducts();
      await fetchRecommended();
    } catch (e) {
      alert("Link add fail: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLinkBusy(false);
      setShowLinkPicker(false);
    }
  };

  const handleRemoveProductLink = async (productId: number) => {
    if (!confirm("Is product ko is supplier se unlink karein?")) return;
    setLinkBusy(true);
    try {
      const { error } = await supabase
        .from("spare_supplier")
        .delete()
        .eq("spare_id", productId)
        .eq("supplier_id", id);
      if (error) throw new Error(error.message);
      await fetchLinkedProducts();
      await fetchRecommended();
    } catch (e) {
      alert("Unlink fail: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLinkBusy(false);
    }
  };

  const createPOFromRec = () => {
    if (recItems.length === 0) return;
    const draft = recItems.map((i) => ({
      product_id: i.id,
      product_name: i.name,
      qty: i.need_to_order,
      unit_cost: i.price,
    }));
    window.sessionStorage.setItem("po_draft", JSON.stringify(draft));
    window.sessionStorage.setItem("po_draft_supplier", JSON.stringify(id));
    router.push(`/inventory/purchase-orders?create=draft&supplier=${id}`);
  };

  const totalPOs = purchaseOrders.length;
  const totalAmount = purchaseOrders.reduce((s, p) => s + (p.total_amount || 0), 0);
  const receivedValue = purchaseOrders
    .filter((p) => p.status === "received")
    .reduce((s, p) => s + (p.total_amount || 0), 0);
  const pendingValue = purchaseOrders
    .filter(
      (p) => p.status === "pending" || p.status === "ordered" || p.status === "partially_received"
    )
    .reduce((s, p) => s + (p.total_amount || 0), 0);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = Math.round((totalAmount - totalPaid) * 100) / 100;

  const openPayModal = () => {
    setPayAmount("");
    setPayMode("cash");
    setPayRef("");
    setPayNotes("");
    setPayDate("");
    setPayPerson("");
    setPayErr("");
    setMakeExpense(false);
    setShowPayModal(true);
  };

  const confirmPay = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayErr("Amount sahi daalo!");
      return;
    }
    setSavingPay(true);
    try {
      const inserted = await addSupplierPayment({
        supplier_id: id,
        amount: amt,
        payment_mode: payMode,
        reference: payRef,
        notes: payNotes,
        payment_date: payDate || undefined,
        contact_person_id: payPerson ? Number(payPerson) : undefined,
      });
      if (makeExpense && inserted) {
        const expRes = await addExpenseFromPayment({
          paymentId: inserted.id,
          supplierId: id,
          supplierName: supplier?.name ?? "supplier",
          amount: amt,
          reference: payRef,
          paymentDate: payDate,
        });
        if (!expRes.created && expRes.error) {
          alert("Payment save ho gaya, par expense entry nahi bani:\n" + expRes.error);
        }
      }
      setShowPayModal(false);
      const fresh = await listSupplierPayments(id);
      setPayments(fresh);
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "Payment save nahi hua!");
    } finally {
      setSavingPay(false);
    }
  };

  const deletePayment = async (p: SupplierPayment): Promise<boolean> => {
    const { count } = await supabase
      .from("expense_list")
      .select("id", { count: "exact", head: true })
      .eq("supplier_payment_id", p.id);
    const hasExpense = (count ?? 0) > 0;
    const msg = hasExpense
      ? `Payment ₹${p.amount} (${p.payment_mode}) delete karein?\n\nNOTE: Is payment ki expense entry Expenses me judi hui hai. Payment delete karne se expense entry DELETE nahi hogi (ledger integrity). Kya delete karein?`
      : `Payment ₹${p.amount} (${p.payment_mode}) delete karein?`;
    if (!confirm(msg)) return false;
    try {
      await removeSupplierPayment(p.id, id);
      const fresh = await listSupplierPayments(id);
      setPayments(fresh);
      return true;
    } catch (e) {
      alert("Delete fail: " + (e instanceof Error ? e.message : String(e)));
      return false;
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

  const photoSrc = safeImageSrc(supplier.photo_url);

  return (
    <AdminPage title={supplier.name} subtitle="Supplier Details">
      <div className="space-y-4">
        {/* Back + Edit */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link
            href="/suppliers"
            className="text-sm text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Suppliers
          </Link>
          <button
            onClick={() => setShowModal(true)}
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
            {photoSrc && (
              <div className="sm:col-span-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <ImageIcon size={14} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
                    Visiting Card
                  </p>
                  <button
                    type="button"
                    onClick={() => setZoomSrc(photoSrc)}
                    title="Visiting card bada karke dekho"
                    className="block rounded-xl border border-transparent p-0.5 hover:border-blue-500/50 transition-all cursor-zoom-in"
                  >
                    <Image
                      src={photoSrc}
                      alt="Visiting card"
                      width={200}
                      height={120}
                      priority
                      className="h-36 sm:h-44 w-auto max-w-full rounded-xl object-contain border border-[#21293d] bg-black/30"
                    />
                  </button>
                </div>
              </div>
            )}
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
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Phone size={14} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
                  Contact Persons
                </p>
                {persons.length === 0 ? (
                  <p className="text-sm font-bold text-slate-200">—</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {persons.map((p, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        {(p.name.trim() !== "" || p.role.trim() !== "") && (
                          <div className="flex items-center gap-1.5">
                            {p.is_primary && (
                              <Star
                                size={10}
                                className="text-amber-400 flex-shrink-0"
                                fill="currentColor"
                              />
                            )}
                            <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
                              {p.name || "Person"}
                            </span>
                            {p.role && (
                              <span className="text-[10px] text-slate-500">· {p.role}</span>
                            )}
                          </div>
                        )}
                        {p.phones.length === 0 ? (
                          <p className="text-sm font-bold text-slate-200">—</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {p.phones.map((c, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-slate-300 text-sm"
                              >
                                {c.is_primary && (
                                  <Star
                                    size={10}
                                    className="text-amber-400 flex-shrink-0"
                                    fill="currentColor"
                                  />
                                )}
                                <span className="text-[10px] font-black uppercase text-slate-500">
                                  {c.label}
                                </span>
                                {c.phone.replace(/\D/g, "").length >= 10 ? (
                                  <>
                                    <a
                                      href={telLink(c.phone)}
                                      title={`Call: ${c.phone}`}
                                      className="font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline"
                                    >
                                      {c.phone}
                                    </a>
                                    <a
                                      href={waLink(c.phone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`WhatsApp: ${c.phone}`}
                                      className="text-emerald-400 hover:text-emerald-300 hover:scale-110 transition-transform inline-flex"
                                    >
                                      <MessageCircle size={13} />
                                    </a>
                                  </>
                                ) : (
                                  <span className="font-mono font-bold">{c.phone}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                {supplier.email ? (
                  <a
                    href={`mailto:${supplier.email}`}
                    title={`Email: ${supplier.email}`}
                    className="text-sm font-bold text-slate-200 hover:text-blue-400 hover:underline transition-colors"
                  >
                    {supplier.email}
                  </a>
                ) : (
                  <p className="text-sm font-bold text-slate-200">—</p>
                )}
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
            {supplier.gstin && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <FileSignature size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    GSTIN
                  </p>
                  <p className="text-sm font-bold text-slate-200 font-mono">{supplier.gstin}</p>
                </div>
              </div>
            )}
            {(supplier.city || supplier.state) && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <MapPin size={14} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    City / State
                  </p>
                  <p className="text-sm font-bold text-slate-200">
                    {[supplier.city, supplier.state].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
            )}
            {supplier.bank_name && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Landmark size={14} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Bank Account
                  </p>
                  <p className="text-sm font-bold text-slate-200">
                    {supplier.bank_name}
                    {supplier.bank_account && ` · ${supplier.bank_account}`}
                    {supplier.bank_ifsc && (
                      <span className="text-slate-400 font-mono"> · {supplier.bank_ifsc}</span>
                    )}
                  </p>
                </div>
              </div>
            )}
            {(supplier.credit_limit != null || supplier.payment_terms) && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Wallet size={14} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Business Terms
                  </p>
                  <p className="text-sm font-bold text-slate-200">
                    {supplier.credit_limit != null && (
                      <>Credit limit: {fmtCurrency(Number(supplier.credit_limit))}</>
                    )}
                    {supplier.credit_limit != null && supplier.payment_terms && " · "}
                    {supplier.payment_terms && <>{supplier.payment_terms}</>}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Total Paid
            </p>
            <p className="text-lg font-black text-emerald-400">{fmtCurrency(totalPaid)}</p>
          </div>
          <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
              Outstanding
            </p>
            <p
              className={`text-lg font-black ${
                outstanding > 0
                  ? "text-amber-400"
                  : outstanding < 0
                    ? "text-red-400"
                    : "text-slate-200"
              }`}
            >
              {fmtCurrency(outstanding)}
            </p>
          </div>
        </div>

        {/* Recommended Orders */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ShoppingCart size={14} className="text-amber-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Recommended Orders
              </h3>
            </div>
            <span className="text-[10px] text-slate-600">
              Low stock linked products from this supplier
            </span>
          </div>

          {recLoading ? (
            <div className="px-5 py-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
              <Loader2 size={14} className="animate-spin" /> Loading stock...
            </div>
          ) : recItems.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-600 text-sm">
              Koi low-stock product nahi (ya is supplier se koi product link nahi).
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111520]">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-center px-4 py-3">In Stock</th>
                      <th className="text-center px-4 py-3">On Order</th>
                      <th className="text-center px-4 py-3">Min Stock</th>
                      <th className="text-center px-4 py-3">To Order</th>
                      <th className="text-right px-4 py-3">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {recItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/inventory/${item.id}`}
                            className="text-slate-200 font-semibold hover:text-blue-400 transition-colors"
                          >
                            {item.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold">
                            {item.current_stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400 font-semibold">
                          {item.on_po}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400">
                          {item.alert_qty}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                            +{item.need_to_order}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {fmtCurrency(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3.5 border-t border-[#21293d] flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={createPOFromRec}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 rounded-xl text-xs font-black transition-all"
                >
                  <Plus size={13} /> Create PO from Suggestions
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Linked Products */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-blue-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Linked Products
              </h3>
            </div>
            <span className="text-[10px] text-slate-600">
              {linkedProducts.length} product{linkedProducts.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="p-5">
            {linkLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading products...
              </div>
            ) : (
              <>
                {linkedProducts.length === 0 && (
                  <div className="pb-4 text-center text-slate-600 text-sm">
                    Koi product link nahi. Recommended Orders ke liye products link karo.
                  </div>
                )}

                {linkedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {linkedProducts.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-2 bg-[#1a2234] border border-[#21293d] rounded-xl px-3 py-1.5 text-xs text-slate-300"
                      >
                        <Link
                          href={`/inventory/${p.id}`}
                          className="font-semibold hover:text-blue-400 transition-colors"
                        >
                          {p.name}
                        </Link>
                        {p.price != null && (
                          <span className="text-slate-500">· {fmtCurrency(Number(p.price))}</span>
                        )}
                        <button
                          onClick={() => handleRemoveProductLink(p.id)}
                          disabled={linkBusy}
                          className="p-0.5 rounded-md text-slate-500 hover:text-red-400 transition disabled:opacity-40"
                          title="Unlink"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {showLinkPicker ? (
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="min-w-[220px] flex-1">
                      <SearchableSelect
                        value={null}
                        options={productOptions}
                        onSelect={handleAddProductLink}
                        placeholder="Product select karo…"
                        searchPlaceholder="Product search karo…"
                        emptyText="Koi aur product nahi bacha"
                      />
                    </div>
                    <button
                      onClick={() => setShowLinkPicker(false)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition py-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLinkPicker(true)}
                    disabled={linkBusy || productOptions.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 rounded-xl text-xs font-black transition-all disabled:opacity-40"
                  >
                    <Plus size={13} /> Add Product
                  </button>
                )}
                {!showLinkPicker && productOptions.length === 0 && linkedProducts.length > 0 && (
                  <p className="mt-3 text-[10px] text-slate-600">
                    Sab active products is supplier se linked hain.
                  </p>
                )}
              </>
            )}
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
            <>
              {!isMobile && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#111520]">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <th className="text-left px-4 py-3"></th>
                        <th className="text-left px-4 py-3">PO Code</th>
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Contact Person</th>
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
                        const statusInfo = PO_STATUS_META[po.status] || PO_STATUS_META.pending;

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
                                  href={`/inventory/purchase-orders/${po.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-mono text-emerald-400 font-bold hover:underline"
                                >
                                  {po.po_code}
                                </Link>
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 text-xs">
                                {fmtDate(po.date_created)}
                              </td>
                              <td className="px-4 py-3.5">
                                {po.contact_person_id &&
                                personNameMap[po.contact_person_id] ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-300 font-bold">
                                    {personNameMap[po.contact_person_id]}
                                  </span>
                                ) : (
                                  <span className="text-slate-700 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center text-slate-400">
                                {items.length}
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-200">
                                {fmtCurrency(po.total_amount || 0)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.cls}`}
                                >
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slate-400 text-xs">
                                {fmtDate(po.received_date)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <Link
                                  href={`/inventory/purchase-orders/${po.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition inline-flex"
                                >
                                  <Eye size={13} />
                                </Link>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="px-4 py-4 bg-[#0d1117]/50">
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
                                              {item.qty_ordered}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-400">
                                              {fmtCurrency(item.unit_cost || 0)}
                                            </td>
                                            <td className="px-3 py-2 text-center text-slate-400">
                                              {item.qty_received ?? 0}
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

              {isMobile && (
                <div className="divide-y divide-[#1a2234]">
                  {purchaseOrders.map((po) => {
                    const items = poItemsMap[po.id] || [];
                    const isExpanded = expandedPO === po.id;
                    const statusInfo = PO_STATUS_META[po.status] || PO_STATUS_META.pending;
                    return (
                      <div key={po.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                          className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 transition-colors active:bg-white/[0.02]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />
                              ) : (
                                <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
                              )}
                              <Link
                                href={`/inventory/purchase-orders/${po.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-mono text-emerald-400 font-bold text-sm hover:underline"
                              >
                                {po.po_code}
                              </Link>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              {fmtDate(po.date_created)}
                              {po.received_date && <> · Received {fmtDate(po.received_date)}</>}
                              {po.contact_person_id && personNameMap[po.contact_person_id] && (
                                <> · via {personNameMap[po.contact_person_id]}</>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                              <span className="font-bold text-slate-200">
                                {fmtCurrency(po.total_amount || 0)}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`flex-shrink-0 inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${statusInfo.cls}`}
                          >
                            {statusInfo.label}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 bg-[#0d1117]/40">
                            {po.notes && (
                              <div className="mb-3 px-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs text-slate-400">
                                <span className="font-bold text-slate-500">Notes:</span> {po.notes}
                              </div>
                            )}
                            {items.length === 0 ? (
                              <p className="text-xs text-slate-600 text-center py-2">
                                No items found for this PO.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="px-3 py-2.5 bg-[#161b27] border border-[#21293d] rounded-xl"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <Link
                                        href={`/inventory/${item.product_id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-xs font-bold text-blue-400 hover:underline min-w-0 truncate"
                                      >
                                        {item.product_list?.name || `Product #${item.product_id}`}
                                      </Link>
                                      <span className="text-xs font-black text-slate-200 flex-shrink-0">
                                        {fmtCurrency(item.unit_cost || 0)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                      <span>
                                        Ordered: <b className="text-slate-200">{item.qty_ordered}</b>
                                      </span>
                                      <span>
                                        Received:{" "}
                                        <b className="text-slate-200">{item.qty_received ?? 0}</b>
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Payments / Dues */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Landmark size={15} className="text-emerald-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Payments & Outstanding
              </h3>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  outstanding > 0
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : outstanding < 0
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                Due: {fmtCurrency(outstanding)}
              </span>
            </div>
            <button
              onClick={openPayModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={13} /> Add Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-600 text-sm">
              Abhi tak koi payment record nahi hai. Sabse pehla payment add karein.
            </div>
          ) : (
            <>
              {!isMobile && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#111520]">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-right px-4 py-3">Amount</th>
                        <th className="text-center px-4 py-3">Mode</th>
                        <th className="text-left px-4 py-3">Reference</th>
                        <th className="text-left px-4 py-3">Notes</th>
                        <th className="text-left px-4 py-3">Contact Person</th>
                        <th className="text-center px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a2234]">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {fmtDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">
                            − {fmtCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-300 border border-[#21293d]">
                              {PAYMENT_MODES.find((m) => m.value === p.payment_mode)?.label ||
                                p.payment_mode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{p.reference || "—"}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px] truncate">
                            {p.notes || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {p.contact_person_id && personNameMap[p.contact_person_id] ? (
                              <span className="text-xs font-bold text-slate-300">
                                {personNameMap[p.contact_person_id]}
                              </span>
                            ) : (
                              <span className="text-slate-700 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setPayTarget(p);
                                  setPayTargetReadOnly(true);
                                }}
                                title="View"
                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setPayTarget(p);
                                  setPayTargetReadOnly(false);
                                }}
                                title="Edit"
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => deletePayment(p)}
                                title="Delete"
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isMobile && (
                <div className="divide-y divide-[#1a2234]">
                  {payments.map((p) => (
                    <div key={p.id} className="px-4 py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200">
                          {fmtDate(p.payment_date)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-slate-300 border border-[#21293d]">
                            {PAYMENT_MODES.find((m) => m.value === p.payment_mode)?.label ||
                              p.payment_mode}
                          </span>
                          {p.reference && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {p.reference}
                            </span>
                          )}
                        </div>
                        {p.notes && (
                          <div className="text-[11px] text-slate-500 mt-1 truncate">{p.notes}</div>
                        )}
                        {p.contact_person_id && personNameMap[p.contact_person_id] && (
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wide">
                            via {personNameMap[p.contact_person_id]}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="text-sm font-black text-emerald-400">
                          − {fmtCurrency(p.amount)}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setPayTarget(p);
                              setPayTargetReadOnly(true);
                            }}
                            title="View"
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => {
                              setPayTarget(p);
                              setPayTargetReadOnly(false);
                            }}
                            title="Edit"
                            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deletePayment(p)}
                            title="Delete"
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111520] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-emerald-400" />
                <h3 className="text-sm font-black text-slate-200">Add Payment</h3>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {payErr && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                  {payErr}
                </div>
              )}
              {/* Balance context card */}
              <div
                className={`rounded-xl border p-3 flex items-center gap-3 ${
                  outstanding > 0
                    ? "bg-red-500/8 border-red-500/20"
                    : "bg-emerald-500/8 border-emerald-500/20"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    outstanding > 0
                      ? "bg-red-500/15 text-red-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  <Wallet size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {outstanding > 0 ? "Outstanding (Due)" : "No Due / Cleared"}
                  </p>
                  <p
                    className={`text-lg font-black mt-0.5 ${
                      outstanding > 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {fmtCurrency(outstanding)}
                  </p>
                </div>
                {outstanding > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(outstanding.toFixed(2))}
                    className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all whitespace-nowrap flex-shrink-0"
                  >
                    Full Amount
                  </button>
                )}
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="e.g. 2500.00"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                  Payment Mode
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPayMode(m.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        payMode === m.value
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-[#0d1117] text-slate-500 border-[#21293d] hover:text-slate-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                    Reference
                  </label>
                  <input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="UPI ref / cheque no"
                    className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                  Contact Person <span className="text-slate-700">(optional)</span>
                </label>
                <select
                  value={payPerson}
                  onChange={(e) => setPayPerson(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-emerald-500 [color-scheme:dark]"
                >
                  <option value="">— Firm / koi bhi —</option>
                  {persons
                    .filter((p) => p.id != null && p.name.trim())
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.is_primary ? " (Primary)" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                  Notes
                </label>
                <input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Kuch bhi memo (optional)"
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
              {/* Expense ledger toggle */}
              <div
                className="flex items-start gap-2.5 rounded-xl border border-[#21293d] bg-[#0d1117] px-3 py-2.5 cursor-pointer select-none"
                onClick={() => setMakeExpense(!makeExpense)}
              >
                <input
                  type="checkbox"
                  checked={makeExpense}
                  onChange={(e) => setMakeExpense(e.target.checked)}
                  className="mt-0.5 accent-emerald-500 cursor-pointer"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 leading-snug">
                    Expense entry bhi banao
                  </p>
                  <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                    Expenses ledger me &quot;Spare Parts Purchase&quot; ke roop me yah payment dikhegi.
                  </p>
                </div>
              </div>
              {/* Summary strip */}
              {payAmount && parseFloat(payAmount) > 0 && (
                <PaymentSummary amount={parseFloat(payAmount) || 0} baseDue={outstanding} />
              )}
              <button
                onClick={confirmPay}
                disabled={savingPay}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all"
              >
                {savingPay ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {payTarget && (
        <SupplierPaymentModal
          payment={payTarget}
          readOnly={payTargetReadOnly}
          outstanding={outstanding}
          persons={persons}
          supplierName={supplier?.name ?? ""}
          onClose={() => setPayTarget(null)}
          onSaved={() => {
            setPayTarget(null);
            fetchData();
          }}
          onSwitchToEdit={() => setPayTargetReadOnly(false)}
          onDelete={async (p) => {
            const ok = await deletePayment(p);
            if (ok && p.id === payTarget.id) setPayTarget(null);
          }}
        />
      )}

      <SupplierFormModal
        open={showModal}
        editing={supplier}
        onClose={() => setShowModal(false)}
        onSaved={fetchData}
      />

      {zoomSrc && <Lightbox src={zoomSrc} alt="Visiting card" onClose={() => setZoomSrc("")} />}
    </AdminPage>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function SupplierPaymentModal({
  payment,
  readOnly,
  outstanding,
  persons,
  supplierName,
  onClose,
  onSaved,
  onSwitchToEdit,
  onDelete,
}: {
  payment: SupplierPayment;
  readOnly: boolean;
  outstanding: number;
  persons: ContactPerson[];
  supplierName: string;
  onClose: () => void;
  onSaved: () => void;
  onSwitchToEdit: () => void;
  onDelete: (p: SupplierPayment) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [mode, setMode] = useState<PaymentMode>(payment.payment_mode || "cash");
  const [date, setDate] = useState((payment.payment_date || "").slice(0, 10));
  const [ref, setRef] = useState(payment.reference || "");
  const [person, setPerson] = useState(
    payment.contact_person_id != null ? String(payment.contact_person_id) : ""
  );
  const [notes, setNotes] = useState(payment.notes || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [expenseStatus, setExpenseStatus] = useState<"loading" | "none" | "exists" | "creating" | "created">("loading");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!payment.id) { setExpenseStatus("none"); return; }
      const { count } = await supabase
        .from("expense_list")
        .select("id", { count: "exact", head: true })
        .eq("supplier_payment_id", payment.id);
      if (!cancel) setExpenseStatus(count && count > 0 ? "exists" : "none");
    })();
    return () => { cancel = true; };
  }, [payment.id]);

  const handleExpense = async () => {
    if (expenseStatus === "creating" || expenseStatus === "created" || expenseStatus === "exists") return;
    setExpenseStatus("creating");
    const res = await addExpenseFromPayment({
      paymentId: payment.id,
      supplierId: payment.supplier_id,
      supplierName: supplierName || "supplier",
      amount: payment.amount,
      reference: payment.reference,
      paymentDate: payment.payment_date?.slice(0, 10),
    });
    setExpenseStatus(res.created ? "created" : "none");
    if (!res.created && res.error) alert(res.error);
  };

  const amt = parseFloat(amount) || 0;
  const baseDue = outstanding + (payment.amount || 0);
  const personName = persons.find((p) => p.id === payment.contact_person_id)?.name || "—";

  const inputCls = readOnly
    ? "w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-600 outline-none"
    : "w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-emerald-500";

  const handleSave = async () => {
    if (!amt || amt <= 0) {
      setErr("Amount sahi daalo!");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await updateSupplierPayment(payment.id, payment.supplier_id, {
        amount: amt,
        payment_mode: mode,
        reference: ref,
        notes,
        payment_date: date,
        contact_person_id: person ? Number(person) : null,
      });
      const sync = await syncExpenseForPayment({
        paymentId: payment.id,
        amount: amt,
        supplierName: supplierName || "supplier",
        reference: ref,
        paymentDate: date,
      });
      if (sync.error) {
        alert("Payment save ho gaya, par expense sync nahi hua:\n" + sync.error);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[201] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111520] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[#21293d] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-emerald-400" />
            <h3 className="text-sm font-black text-slate-200">
              {readOnly ? "Payment Details" : `Edit Payment #${payment.id}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {err && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
              {err}
            </div>
          )}

          {readOnly ? (
            <div className="flex items-start gap-3 rounded-xl border border-[#21293d] bg-[#0d1117] p-3.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Wallet size={15} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Paid Amount
                </p>
                <p className="text-xl font-black text-emerald-400 mt-0.5">
                  {fmtCurrency(payment.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Mode
                </p>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-300 border border-[#21293d]">
                  {PAYMENT_MODES.find((m) => m.value === payment.payment_mode)?.label ||
                    payment.payment_mode}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>
          )}

          {readOnly ? (
            <PaymentSummary amount={payment.amount} baseDue={baseDue} />
          ) : (
            amt > 0 && <PaymentSummary amount={amt} baseDue={baseDue} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                Date
              </label>
              <input
                type="date"
                value={date}
                disabled={readOnly}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
                Reference
              </label>
              <input
                value={ref}
                disabled={readOnly}
                onChange={(e) => setRef(e.target.value)}
                placeholder="UPI ref / cheque no"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
              Payment Mode
            </label>
            {readOnly ? (
              <p className="text-sm font-bold text-slate-300">
                {PAYMENT_MODES.find((m) => m.value === payment.payment_mode)?.label ||
                  payment.payment_mode}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      mode === m.value
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-[#0d1117] text-slate-500 border-[#21293d] hover:text-slate-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
              Contact Person <span className="text-slate-700">(optional)</span>
            </label>
            {readOnly ? (
              <p className="text-sm font-bold text-slate-300">{personName}</p>
            ) : (
              <select
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-emerald-500 [color-scheme:dark]"
              >
                <option value="">— Firm / koi bhi —</option>
                {persons
                  .filter((p) => p.id != null && p.name.trim())
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_primary ? " (Primary)" : ""}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1 block">
              Notes
            </label>
            <input
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kuch bhi memo (optional)"
              className={inputCls}
            />
          </div>

          {/* Add to Expenses */}
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
              expenseStatus === "exists" || expenseStatus === "created"
                ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                : "border-[#21293d] bg-[#0d1117]"
            }`}
          >
            <input
              type="checkbox"
              checked={
                expenseStatus === "exists" ||
                expenseStatus === "created" ||
                expenseStatus === "creating"
              }
              disabled={
                expenseStatus === "loading" ||
                expenseStatus === "creating" ||
                expenseStatus === "exists" ||
                expenseStatus === "created"
              }
              onChange={(e) => {
                if (e.target.checked) void handleExpense();
              }}
              className="mt-0.5 accent-emerald-500 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 leading-snug">
                Expenses me add karein
              </p>
              {expenseStatus === "loading" ? (
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5 flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" /> Checking...
                </p>
              ) : expenseStatus === "exists" ? (
                <p className="text-[10px] text-emerald-400 leading-snug mt-0.5">
                  Yeh payment pehle se Expenses me jud chuki hai.
                </p>
              ) : expenseStatus === "created" ? (
                <p className="text-[10px] text-emerald-400 leading-snug mt-0.5">
                  Expense entry ban gayi — /expenses me dikhegi.
                </p>
              ) : expenseStatus === "creating" ? (
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5 flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" /> Adding...
                </p>
              ) : (
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                  Expenses me add karne ke liye select karo.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer — hamesha visible, Save/Edit hamesha screen ke andar */}
        <div className="px-5 py-3.5 border-t border-[#21293d] bg-[#111520] flex-shrink-0">
          {readOnly ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onSwitchToEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-all"
              >
                <Pencil size={14} /> Edit Payment
              </button>
              <button
                onClick={() => onDelete(payment)}
                className="p-2.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 rounded-xl transition-all"
                title="Delete payment"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
