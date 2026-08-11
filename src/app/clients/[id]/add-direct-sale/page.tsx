"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, ShoppingCart, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, Save,
  Package, IndianRupee,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE HELPER
// ─────────────────────────────────────────────────────────────────────────────
function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-4 py-3 bg-[#111520] border border-[#21293d] rounded-xl text-white font-bold " +
  "text-sm placeholder:text-slate-700 outline-none focus:border-blue-500/60 " +
  "focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]";

const labelCls =
  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2";

const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type SaleItem = {
  description: string;
  quantity:    number;
  price:       number;
};

// ─────────────────────────────────────────────────────────────────────────────
// SALE CODE GENERATOR (with random suffix to reduce collision risk)
// ─────────────────────────────────────────────────────────────────────────────
function generateSaleCode(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `SALE-${ts}-${rnd}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AddDirectSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router         = useRouter();
  const clientId       = parseInt(resolvedParams.id);

  const [loading,     setLoading]     = useState(false);
  const [clientName,  setClientName]  = useState("");
  const [saleCode,    setSaleCode]    = useState(generateSaleCode);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [remarks,     setRemarks]     = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [items, setItems] = useState<SaleItem[]>([
    { description: "", quantity: 1, price: 0 },
  ]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FETCH CLIENT NAME ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchClient = async () => {
      // BUG FIX: table = client_list, columns = firstname + lastname (NOT "clients"/"name")
      const { data } = await supabase
        .from("client_list")
        .select("firstname, middlename, lastname")
        .eq("id", clientId)
        .eq("delete_flag", 0)
        .single();
      if (data) {
        setClientName(
          [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" ")
        );
      }
    };
    fetchClient();
  }, [clientId]);

  // ── ITEM HELPERS ───────────────────────────────────────────────────────
  const addItem = () =>
    setItems(prev => [...prev, { description: "", quantity: 1, price: 0 }]);

  const removeItem = (i: number) => {
    if (items.length > 1) setItems(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateItem = (i: number, field: keyof SaleItem, val: string) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      if (field === "description") return { ...item, description: val };
      if (field === "quantity")    return { ...item, quantity: Math.max(1, parseInt(val) || 1) };
      if (field === "price")       return { ...item, price: parseFloat(val) || 0 };
      return item;
    }));
  };

  const totalAmount = items.reduce((s, it) => s + it.quantity * it.price, 0);

  // ── VALIDATE ITEMS ─────────────────────────────────────────────────────
  function validateItems(): string | null {
    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) return `Item ${i + 1} ka description khali hai!`;
      if (items[i].price <= 0)          return `Item ${i + 1} ka price 0 nahi ho sakta!`;
      if (items[i].quantity < 1)        return `Item ${i + 1} ki quantity 1 se kam nahi ho sakti!`;
    }
    return null;
  }

  // ── SUBMIT ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;  // double-submit guard

    const itemError = validateItems();
    if (itemError) { setToast({ type: "error", msg: itemError }); return; }
    if (totalAmount <= 0) { setToast({ type: "error", msg: "Total amount 0 nahi ho sakta!" }); return; }

    setLoading(true);
    try {
      // BUG FIX: direct_sales table has NO 'items' column — items go in direct_sale_items
      // Step 1: Insert parent sale record (WITHOUT items)
      const { data: sale, error: saleErr } = await supabase
        .from("direct_sales")
        .insert([{
          client_id:        clientId,
          sale_code:        saleCode,
          payment_mode:     paymentMode,
          remarks:          remarks.trim() || null,
          total_amount:     totalAmount,
          // mechanic_id:   null,  // nullable per schema — set if needed
          // last_edited_by, last_edited_by_name etc. — optional
          date_created:     `${todayIST()}T00:00:00+05:30`,
        }])
        .select("id")
        .single();

      if (saleErr) {
        // Retry with new sale_code if duplicate (race condition)
        if (saleErr.code === "23505") {
          setToast({ type: "error", msg: "Sale code conflict — dobara try karo!" });
          setSaleCode(generateSaleCode());
          setLoading(false);
          return;
        }
        throw saleErr;
      }

      // Step 2: Insert line items into direct_sale_items
      const lineItems = items.map(it => ({
        sale_id:    sale.id,
        product_id: null,          // no product linked — free-text description
        qty:        it.quantity,
        price:      it.price,
        // product_name stored via description — if your schema has a name column add it here
      }));

      const { error: itemsErr } = await supabase
        .from("direct_sale_items")
        .insert(lineItems);
      if (itemsErr) throw itemsErr;

      setToast({ type: "success", msg: "Sale save ho gayi! ✅" });
      // BUG FIX: router.replace instead of push+refresh (avoids unmount warning)
      setTimeout(() => router.replace(`/clients/${clientId}/view`), 1000);

    } catch (err) {
      console.error("sale error:", err instanceof Error ? err.message : JSON.stringify(err));
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Sale save karne mein galti!" });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    // BUG FIX: dark theme — was bg-white (light)
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <Link
              href={`/clients/${clientId}/view`}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-slate-500 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/40 flex-shrink-0">
                <ShoppingCart className="text-white" size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-tight text-white leading-none">New Direct Sale</h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1 truncate">
                  {clientName || `Client #${clientId}`}
                </p>
              </div>
            </div>
            {/* Sale Code badge */}
            <div className="hidden sm:block text-right flex-shrink-0">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">Sale Code</p>
              <p className="text-xs font-black text-slate-400 font-mono">{saleCode}</p>
            </div>
          </div>
        </div>

        {/* ── FORM ────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Payment Mode */}
          <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
            <label className={labelCls}>
              <IndianRupee size={13} className="text-purple-400" />
              Payment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              {["Cash", "PhonePe/GPay", "Bank Transfer", "Credit Card"].map(mode => (
                <button
                  key={mode} type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all ${
                    paymentMode === mode
                      ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20"
                      : "bg-[#111520] border-[#21293d] text-slate-500 hover:border-slate-500 hover:text-slate-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
            <div className="flex items-center justify-between mb-4">
              <label className={labelCls}>
                <Package size={13} className="text-purple-400" />
                Items / Products
              </label>
              <button
                type="button" onClick={addItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 border border-purple-500/25 text-purple-400 rounded-xl text-xs font-black hover:bg-purple-500/25 transition-all"
              >
                <Plus size={13} /> Add Item
              </button>
            </div>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_110px_44px] gap-2 px-1 mb-2">
              {["Description", "Qty", "Price (₹)", ""].map(h => (
                <span key={h} className="text-[9px] font-black uppercase tracking-wider text-slate-600">{h}</span>
              ))}
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_110px_44px] gap-2 items-start">
                  <input
                    type="text" placeholder="Item description *"
                    value={item.description}
                    onChange={e => updateItem(i, "description", e.target.value)}
                    className={inputCls} required
                  />
                  <input
                    type="number" placeholder="Qty" min="1"
                    value={item.quantity}
                    onChange={e => updateItem(i, "quantity", e.target.value)}
                    className={`${inputCls} text-center`}
                  />
                  <input
                    type="number" step="0.01" placeholder="0.00" min="0.01"
                    value={item.price || ""}
                    onChange={e => updateItem(i, "price", e.target.value)}
                    className={`${inputCls} text-right`}
                  />
                  <button
                    type="button" onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="w-full sm:w-11 h-11 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Mobile row total */}
                  {item.quantity > 0 && item.price > 0 && (
                    <div className="sm:hidden text-right text-xs text-slate-500 col-span-full -mt-1 pr-1">
                      {item.quantity} × {inr(item.price)} = <span className="text-white font-bold">{inr(item.quantity * item.price)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#21293d]">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Total Amount</span>
              <span className="text-2xl font-black text-emerald-400">{inr(totalAmount)}</span>
            </div>
          </div>

          {/* Remarks */}
          <div className="bg-[#161b27] rounded-2xl border border-[#21293d] p-5">
            <label className={labelCls}>Remarks</label>
            <textarea
              rows={2} value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Koi notes…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="submit" disabled={loading}
              className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20 text-sm uppercase tracking-wide"
            >
              {loading
                ? <><Loader2 size={17} className="animate-spin" />Saving…</>
                : <><Save size={17} strokeWidth={2.5} />Save Sale</>}
            </button>
            <Link
              href={`/clients/${clientId}/view`}
              className="px-6 py-3.5 bg-[#111520] border border-[#21293d] hover:border-slate-500 text-slate-400 hover:text-white rounded-2xl font-bold text-sm transition-all no-underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}