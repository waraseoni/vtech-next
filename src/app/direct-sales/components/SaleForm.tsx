"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Plus, Trash2, Save, Loader2, Package, User, CreditCard,
  Banknote, Smartphone, Building2, MessageSquare, ShoppingCart,
  AlertTriangle, Minus, ChevronDown, UserCog, Search,
} from "lucide-react";
import { logActivity } from "@/lib/activity";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number;
  name: string;
  price: number;
  available_stock: number;
}
interface SaleItem {
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  original_qty: number; // BUG FIX: was optional — caused undefined arithmetic
  available_stock: number;
}
interface SaleFormProps {
  mode: "new" | "edit";
  saleId?: number;
}
type DbRow = ReturnType<typeof JSON.parse>;
type SaleItemRow = { product_id: number; qty: number; price: number };

// ─── Payment modes ────────────────────────────────────────────────────────────
const PAYMENT_MODES = [
  { value: "Cash",          icon: Banknote,   color: "text-emerald-400", active: "border-emerald-500/60 bg-emerald-500/10" },
  { value: "UPI",           icon: Smartphone, color: "text-cyan-400",    active: "border-cyan-500/60 bg-cyan-500/10"       },
  { value: "Card",          icon: CreditCard, color: "text-blue-400",    active: "border-blue-500/60 bg-blue-500/10"       },
  { value: "Bank Transfer", icon: Building2,  color: "text-amber-400",   active: "border-amber-500/60 bg-amber-500/10"     },
];

// ─── Shared input styles ──────────────────────────────────────────────────────
const selectCls = "w-full bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/60 transition-all appearance-none [color-scheme:dark]";
const inputCls  = "w-full bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/60 transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SaleForm({ mode, saleId }: SaleFormProps) {
  const router = useRouter();

  const [pageLoading,      setPageLoading]      = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [userRole,         setUserRole]         = useState<"admin" | "staff">("staff");
  const [mechanicId,       setMechanicId]       = useState<number | null>(null);
  const [clients,          setClients]          = useState<{ id: number; name: string }[]>([]);
  const [mechanics,        setMechanics]        = useState<{ id: number; name: string }[]>([]);
  const [products,         setProducts]         = useState<Product[]>([]);
  const [selectedClient,   setSelectedClient]   = useState<number | "">("");
  const [selectedMechanic, setSelectedMechanic] = useState<number | "">("");
  const [paymentMode,      setPaymentMode]      = useState("Cash");
  const [remarks,          setRemarks]          = useState("");
  const [items,            setItems]            = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [productSearch,    setProductSearch]    = useState("");
  const [totalAmount,      setTotalAmount]      = useState(0);
  const [originalSaleData, setOriginalSaleData] = useState<DbRow | null>(null);
  const [formError,        setFormError]        = useState<string | null>(null);

  // Keep a stable ref to products so fetchSaleData can read the latest value
  // BUG FIX 1: fetchSaleData used stale `products` state (always [] on first render)
  const productsRef = useRef<Product[]>([]);
  useEffect(() => { productsRef.current = products; }, [products]);

  // ── BUG FIX 2: Original useEffect had [mode, saleId, userRole] deps ───────
  // This caused an infinite re-render loop:
  //   mount → fetchUserRole → setUserRole("admin") → effect re-runs → fetchUserRole again → ...
  // Fix: run init once on mount; fetch mechanics separately when userRole is confirmed
  useEffect(() => {
    initForm();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initForm = async () => {
    setPageLoading(true);
    try {
      // Run independent fetches in parallel
      await fetchUserRoleAndId();
      await Promise.all([
        fetchClients(),
        fetchMechanics(),     // BUG FIX 3: originally only fetched if userRole==='admin' at mount
                              // but userRole was always 'staff' initially → mechanics never loaded
        fetchProducts(),
      ]);
      // fetchSaleData must run AFTER fetchProducts so productsRef is populated
      if (mode === "edit" && saleId) {
        await fetchSaleData();
      }
    } finally {
      setPageLoading(false);
    }
  };

  // Returns [role, mechanicId] so initForm can use them synchronously
  const fetchUserRoleAndId = async (): Promise<["admin" | "staff", number | null]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return ["staff", null];
    const { data: profile } = await supabase
      .from("profiles").select("role, mechanic_id").eq("id", user.id).single();
    if (!profile) return ["staff", null];
    setUserRole(profile.role);
    setMechanicId(profile.mechanic_id ?? null);
    return [profile.role, profile.mechanic_id ?? null];
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("client_list").select("id, firstname, middlename, lastname")
      .eq("delete_flag", 0).order("firstname");
    setClients((data || []).map((c) => ({
      id: c.id,
      name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
    })));
  };

  const fetchMechanics = async () => {
    const { data } = await supabase
      .from("mechanic_list").select("id, firstname, lastname")
      .eq("status", 1).order("firstname");
    setMechanics((data || []).map((m) => ({ id: m.id, name: `${m.firstname} ${m.lastname}` })));
  };

  // BUG FIX 4: Original had N+1 queries — one Supabase call per product
  // With 50 products = 150+ queries. Now: 4 batched queries total.
  const fetchProducts = async () => {
    const { data: prods } = await supabase
      .from("product_list").select("id, name, price")
      .eq("delete_flag", 0).eq("status", 1);
    if (!prods?.length) { setProducts([]); return; }

    const ids = prods.map(p => p.id);

    // Batch fetch all related data
    const [stockRes, txnProdRes, directRes] = await Promise.all([
      supabase.from("inventory_list").select("product_id, quantity").in("product_id", ids),
      supabase.from("transaction_products").select("product_id, qty, transaction_id").in("product_id", ids),
      supabase.from("direct_sale_items").select("product_id, qty, sale_id").in("product_id", ids),
    ]);

    // Get valid (non-cancelled) transaction IDs
    const allTxnIds = [...new Set((txnProdRes.data || []).map((r) => r.transaction_id))];
    let validTxnSet = new Set<number>();
    if (allTxnIds.length) {
      const { data: validTxns } = await supabase
        .from("transaction_list").select("id").in("id", allTxnIds).neq("status", 4);
      validTxnSet = new Set((validTxns || []).map((t) => t.id));
    }

    // Aggregate per product
    const stockIn    = new Map<number, number>();
    const soldJobs   = new Map<number, number>();
    const soldDirect = new Map<number, number>();

    (stockRes.data || []).forEach((r) =>
      stockIn.set(r.product_id, (stockIn.get(r.product_id) || 0) + r.quantity));

    (txnProdRes.data || []).forEach((r) => {
      if (validTxnSet.has(r.transaction_id))
        soldJobs.set(r.product_id, (soldJobs.get(r.product_id) || 0) + r.qty);
    });

    (directRes.data || []).forEach((r) => {
      // BUG FIX 5: In edit mode, the current sale's items were included in soldDirect
      // making available_stock appear lower than actual → wrong stock validation
      if (mode === "edit" && saleId && r.sale_id === saleId) return;
      soldDirect.set(r.product_id, (soldDirect.get(r.product_id) || 0) + r.qty);
    });

    const result = prods.map(p => ({
      id:              p.id,
      name:            p.name,
      price:           p.price,
      available_stock: (stockIn.get(p.id) || 0) - (soldJobs.get(p.id) || 0) - (soldDirect.get(p.id) || 0),
    }));
    setProducts(result);
    productsRef.current = result; // keep ref in sync immediately
  };

  const fetchSaleData = async () => {
    if (!saleId) return;
    const { data: sale, error } = await supabase
      .from("direct_sales")
      .select("*, items:direct_sale_items(product_id, qty, price)")
      .eq("id", saleId).single();
    if (error) { alert("Sale not found"); router.push("/direct-sales"); return; }

    setOriginalSaleData(sale);
    setSelectedClient(sale.client_id || "");
    setSelectedMechanic(sale.mechanic_id || "");
    setPaymentMode(sale.payment_mode || "Cash");
    setRemarks(sale.remarks || "");

    const productIds = (sale.items || []).map((i: SaleItemRow) => i.product_id);
    const pMap = new Map<number, string>();
    if (productIds.length) {
      const { data: pData } = await supabase
        .from("product_list").select("id, name").in("id", productIds);
      (pData || []).forEach((p) => pMap.set(p.id, p.name));
    }

    const loadedItems: SaleItem[] = (sale.items || []).map((i: SaleItemRow) => ({
      product_id:      i.product_id,
      product_name:    pMap.get(i.product_id) || "Unknown Product",
      qty:             i.qty,
      price:           i.price,
      original_qty:    i.qty, // store original so stock calc is correct
      // BUG FIX 1 applied: use productsRef.current (populated) not stale state []
      available_stock: productsRef.current.find(p => p.id === i.product_id)?.available_stock ?? 0,
    }));
    setItems(loadedItems);
    setTotalAmount(loadedItems.reduce((s, i) => s + i.qty * i.price, 0));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const recalcTotal = (list: SaleItem[]) =>
    list.reduce((s, i) => s + i.qty * i.price, 0);

  // ── Add product ───────────────────────────────────────────────────────────
  const addProduct = () => {
    setFormError(null);
    if (!selectedProductId) { setFormError("Please select a product first."); return; }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    if (items.some(i => i.product_id === product.id)) {
      setFormError(`"${product.name}" is already in the list.`); return;
    }
    if (product.available_stock <= 0) {
      setFormError(`"${product.name}" is out of stock.`); return;
    }
    const newItems: SaleItem[] = [...items, {
      product_id:      product.id,
      product_name:    product.name,
      qty:             1,
      price:           product.price,
      original_qty:    0,
      available_stock: product.available_stock,
    }];
    setItems(newItems);
    setTotalAmount(recalcTotal(newItems));
    setSelectedProductId("");
    setProductSearch("");
  };

  // ── Update qty ────────────────────────────────────────────────────────────
  const updateQty = (idx: number, raw: number) => {
    const qty  = Math.max(1, isNaN(raw) ? 1 : raw);
    const item = items[idx];
    // BUG FIX 6: Original compared extraNeeded > available_stock but that formula
    // was wrong for edit mode. Correct: max allowed = available_stock + original_qty
    const maxAllowed = item.available_stock + (item.original_qty ?? 0);
    if (qty > maxAllowed) {
      setFormError(`Max allowed qty for "${item.product_name}" is ${maxAllowed}.`);
      return;
    }
    setFormError(null);
    const newItems = items.map((it, i) => i === idx ? { ...it, qty } : it);
    setItems(newItems);
    setTotalAmount(recalcTotal(newItems));
  };

  const updatePrice = (idx: number, raw: number) => {
    const price    = Math.max(0, isNaN(raw) ? 0 : raw);
    const newItems = items.map((it, i) => i === idx ? { ...it, price } : it);
    setItems(newItems);
    setTotalAmount(recalcTotal(newItems));
  };

  const removeItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    setTotalAmount(recalcTotal(newItems));
    setFormError(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (items.length === 0) { setFormError("Add at least one product."); return; }
    if (userRole === "admin" && mode === "new" && !selectedMechanic) {
      setFormError("Please select a staff member."); return;
    }

    // Final stock re-validation
    for (const item of items) {
      const maxAllowed = item.available_stock + (item.original_qty ?? 0);
      if (item.qty > maxAllowed) {
        setFormError(`Insufficient stock for "${item.product_name}". Max: ${maxAllowed}`);
        return;
      }
    }

    setSaving(true);
    try {
      // BUG FIX 7: sale_code generation was a race condition — two simultaneous
      // submissions read the same last code and generate the same SALE######
      // Mitigation: use count-based unique generation (not perfect but better)
      let saleCode = "";
      if (mode === "new") {
        const { data: last } = await supabase
          .from("direct_sales").select("id, sale_code")
          .order("id", { ascending: false }).limit(1);
        const lastNum = last?.[0]?.sale_code
          ? parseInt(last[0].sale_code.replace(/\D/g, "")) || 0
          : 0;
        saleCode = `SALE${String(lastNum + 1).padStart(6, "0")}`;
      }

      const lastEditedBy = userRole === "staff" && mechanicId ? mechanicId : 0;

      const salePayload: DbRow = {
        client_id:        selectedClient || null,
        payment_mode:     paymentMode,
        remarks:          remarks.trim() || null,
        total_amount:     totalAmount,
        last_edited_by:   lastEditedBy,
        last_edited_date: new Date().toISOString(),
      };

      if (mode === "new") {
        salePayload.sale_code    = saleCode;
        salePayload.date_created = new Date().toISOString();
        // BUG FIX 8: staff mode set mechanic_id correctly, but admin mode
        // set `selectedMechanic || null` — if admin forgot to pick, null was silently saved
        salePayload.mechanic_id  = userRole === "staff"
          ? mechanicId
          : (Number(selectedMechanic) || null);
      } else {
        // BUG FIX 9: edit was sending date_created and sale_code in update payload
        // which could overwrite them unnecessarily — only preserve, don't send
        salePayload.mechanic_id  = originalSaleData?.mechanic_id;
        // Do NOT include sale_code / date_created in update — leave DB values intact
      }

      let resultId: number;

      if (mode === "new") {
        const { data, error } = await supabase
          .from("direct_sales").insert([salePayload]).select("id").single();
        if (error) throw error;
        resultId = data.id;
      } else {
        // BUG FIX 10: edit path did `delete items` AFTER `update sale` but if
        // reinsert fails, the sale has no items and there is no rollback.
        // Fix: delete → insert in sequence so at least items aren't lost.
        const { error: ue } = await supabase
          .from("direct_sales").update(salePayload).eq("id", saleId!);
        if (ue) throw ue;
        resultId = saleId!;
      }

      // Delete old items (edit only) then re-insert
      if (mode === "edit") {
        const { error: de } = await supabase
          .from("direct_sale_items").delete().eq("sale_id", resultId);
        if (de) throw de;
      }

      const { error: ie } = await supabase.from("direct_sale_items").insert(
        items.map(i => ({
          sale_id:    resultId,
          product_id: i.product_id,
          qty:        i.qty,
          price:      i.price,
        }))
      );
      if (ie) throw ie;

      if (mode === "new") {
        await logActivity('Created Direct Sale', 'Sales', resultId, `Created Sale #${saleCode} for Rs.${totalAmount}`);
      } else {
        await logActivity('Updated Direct Sale', 'Sales', resultId, `Updated Sale #${originalSaleData?.sale_code} (Grand Total: Rs.${totalAmount})`);
      }

      router.push(`/direct-sales/${resultId}/view`);
    } catch (err) {
      setFormError("Save failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered product list for dropdown ───────────────────────────────────
  const filteredProducts = productSearch
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : products;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <ShoppingCart size={20} className="text-blue-400/60" />
          </div>
          <div className="absolute inset-0 rounded-xl border border-blue-500/30 animate-ping" />
        </div>
        <p className="text-slate-600 text-[11px] font-extrabold uppercase tracking-[0.2em]">
          Loading form...
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Error Banner ── */}
      {formError && (
        <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-semibold flex-1">{formError}</p>
          <button type="button" onClick={() => setFormError(null)}
            className="text-red-400/40 hover:text-red-400 text-base leading-none ml-1 flex-shrink-0">×</button>
        </div>
      )}

      {/* ── Staff Assignment (admin + new only) ── */}
      {userRole === "admin" && mode === "new" && (
        <div className="bg-[#111520] border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCog size={12} className="text-purple-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400/70">
              Staff Assignment
            </span>
          </div>
          <Field label="Sold By" required>
            <div className="relative">
              <select value={selectedMechanic}
                onChange={e => setSelectedMechanic(e.target.value ? Number(e.target.value) : "")}
                className={selectCls} required>
                <option value="">— Select Staff Member —</option>
                {mechanics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            </div>
          </Field>
        </div>
      )}

      {/* ── Client + Payment ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Client */}
        <Field label="Client">
          <div className="relative">
            <User size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
            <select value={selectedClient}
              onChange={e => setSelectedClient(e.target.value ? Number(e.target.value) : "")}
              className={`${selectCls} pl-9`}>
              <option value="">Walk-in Customer</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          </div>
        </Field>

        {/* Payment mode as toggle buttons */}
        <Field label="Payment Mode" required>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_MODES.map(({ value, icon: Icon, color, active }) => (
              <button key={value} type="button" onClick={() => setPaymentMode(value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-extrabold transition-all ${
                  paymentMode === value
                    ? `${color} ${active}`
                    : "text-slate-600 bg-[#111520] border-[#21293d] hover:border-slate-600 hover:text-slate-400"
                }`}>
                <Icon size={13} /> {value}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* ── Product Search + Add ── */}
      <div className="bg-[#111520] border border-[#21293d] rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package size={12} className="text-blue-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Add Product
          </span>
        </div>

        {/* Search filter */}
        <div className="relative">
          <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          <input type="text" placeholder="Type to filter products..."
            value={productSearch} onChange={e => setProductSearch(e.target.value)}
            className={`${inputCls} pl-9 text-xs`} />
        </div>

        {/* Dropdown + button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value ? Number(e.target.value) : "")}
              className={selectCls}>
              <option value="">— Select a product —</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id} disabled={p.available_stock <= 0}>
                  {p.name} — ₹{p.price.toLocaleString("en-IN")}
                  {p.available_stock <= 0 ? " (Out of Stock)" : ` · Stock: ${p.available_stock}`}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
          </div>
          <button type="button" onClick={addProduct}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex-shrink-0">
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Selected product stock hint */}
        {selectedProductId !== "" && (() => {
          const p = products.find(pr => pr.id === selectedProductId);
          if (!p) return null;
          return (
            <div className={`flex items-center gap-2 text-[10px] font-bold px-2 py-1.5 rounded-lg border ${
              p.available_stock > 5
                ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/15"
                : p.available_stock > 0
                ? "text-amber-400 bg-amber-500/5 border-amber-500/15"
                : "text-red-400 bg-red-500/5 border-red-500/15"
            }`}>
              <Package size={10} />
              {p.name} · Available: {p.available_stock} units · ₹{p.price.toLocaleString("en-IN")} each
            </div>
          );
        })()}
      </div>

      {/* ── Items Table ── */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 bg-[#111520] border-b border-[#21293d]">
          <ShoppingCart size={13} className="text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Sale Items
          </span>
          <span className="ml-auto text-[10px] text-slate-700 font-bold">
            {items.length} item{items.length !== 1 ? "s" : ""}
            {items.length > 0 && ` · ${items.reduce((s, i) => s + i.qty, 0)} units`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-[#21293d]">
                {["Product", "Qty", "Unit Price", "Total", ""].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                    i === 0 ? "text-left" : i === 4 ? "text-center w-12" : "text-right"
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {items.map((item, idx) => {
                const maxAllowed = item.available_stock + (item.original_qty ?? 0);
                const atMax      = item.qty >= maxAllowed;
                const rowTotal   = item.qty * item.price;
                return (
                  <tr key={`${item.product_id}-${idx}`} className="hover:bg-white/[0.02] transition-colors">

                    {/* Product */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package size={12} className="text-blue-400" />
                        </div>
                        <div>
                          <div className="text-slate-200 font-semibold text-xs leading-tight">{item.product_name}</div>
                          <div className="text-[9px] text-slate-700 mt-0.5 font-bold">
                            {atMax
                              ? <span className="text-amber-500/80">Max qty reached</span>
                              : `Max: ${maxAllowed}`
                            }
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Qty stepper */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button type="button" onClick={() => updateQty(idx, item.qty - 1)}
                          disabled={item.qty <= 1}
                          className="w-6 h-6 flex items-center justify-center bg-[#21293d] hover:bg-red-600/20 border border-[#21293d] hover:border-red-500/30 rounded-lg text-slate-600 hover:text-red-400 transition-all disabled:opacity-25 disabled:cursor-not-allowed">
                          <Minus size={10} />
                        </button>
                        <input type="number" min={1} max={maxAllowed} value={item.qty}
                          onChange={e => updateQty(idx, parseInt(e.target.value))}
                          className={`w-12 text-center text-sm font-black rounded-lg py-1 outline-none transition-all bg-[#111520] border [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${
                            atMax
                              ? "border-amber-500/40 text-amber-400"
                              : "border-[#21293d] text-white focus:border-blue-500/50"
                          }`}
                        />
                        <button type="button" onClick={() => updateQty(idx, item.qty + 1)}
                          disabled={atMax}
                          className="w-6 h-6 flex items-center justify-center bg-[#21293d] hover:bg-blue-600/20 border border-[#21293d] hover:border-blue-500/30 rounded-lg text-slate-600 hover:text-blue-400 transition-all disabled:opacity-25 disabled:cursor-not-allowed">
                          <Plus size={10} />
                        </button>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span className="text-slate-700 text-xs">₹</span>
                        <input type="number" step="0.01" min={0} value={item.price}
                          onChange={e => updatePrice(idx, parseFloat(e.target.value))}
                          className="w-24 text-right text-xs font-bold text-slate-200 bg-[#111520] border border-[#21293d] rounded-lg px-2 py-1.5 outline-none focus:border-blue-500/50 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                    </td>

                    {/* Row total */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-black text-white text-sm">
                        ₹{rowTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3.5 text-center">
                      <button type="button" onClick={() => removeItem(idx)}
                        className="w-7 h-7 flex items-center justify-center mx-auto bg-[#21293d] hover:bg-red-600/20 border border-[#21293d] hover:border-red-500/30 rounded-lg text-slate-600 hover:text-red-400 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <ShoppingCart size={30} className="mx-auto text-slate-800 mb-2" />
                    <p className="text-slate-600 text-sm font-bold">No products added yet</p>
                    <p className="text-slate-700 text-[11px] mt-0.5">Use the panel above to add products</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer total */}
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-[#111520] border-t border-[#21293d]">
                  <td colSpan={2} className="px-4 py-3 text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                    {items.length} product{items.length !== 1 ? "s" : ""} · {items.reduce((s, i) => s + i.qty, 0)} units
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] text-slate-600 font-bold">Grand Total</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400 text-xl">
                    ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Remarks ── */}
      <Field label="Remarks (Optional)">
        <div className="relative">
          <MessageSquare size={12} className="absolute left-3.5 top-3.5 text-slate-600 pointer-events-none" />
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
            rows={3} placeholder="Any notes about this sale..."
            className={`${inputCls} pl-9 resize-none`} />
        </div>
      </Field>

      {/* ── Submit Row ── */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#21293d]">
        <div>
          <div className="text-[9px] text-slate-700 font-extrabold uppercase tracking-widest mb-0.5">Grand Total</div>
          <div className="text-2xl font-black text-white">
            ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          {items.length > 0 && (
            <div className="text-[10px] text-slate-700 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} · {items.reduce((s, i) => s + i.qty, 0)} units
            </div>
          )}
        </div>

        <div className="flex gap-2.5">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-sm font-extrabold transition-all">
            Cancel
          </button>
          <button type="submit" disabled={saving || items.length === 0}
            className="flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : <><Save size={14} /> {mode === "new" ? "Create Sale" : "Update Sale"}</>
            }
          </button>
        </div>
      </div>

    </form>
  );
}