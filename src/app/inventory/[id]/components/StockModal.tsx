"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  X,
  Save,
  MapPin,
  Calendar,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowDownToLine,
  Edit3,
  Package,
} from "lucide-react";
import { logActivity } from "@/lib/activity";
import { todayIST, toISTDatePart } from "@/lib/dateUtils";
import SearchableSelect from "@/components/SearchableSelect";

interface StockModalProps {
  productId: number;
  stock?: {
    id: number;
    quantity: number;
    stock_date: string;
    supplier_id?: number | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
  productName?: string;
  productLocationLabel?: string | null;
}

interface Supplier {
  id: number;
  name: string;
}

export default function StockModal({
  productId,
  stock,
  onClose,
  onSaved,
  productName,
  productLocationLabel,
}: StockModalProps) {
  const isEdit = !!stock;

  const [quantity, setQuantity] = useState(stock?.quantity || 1);
  const [supplierId, setSupplierId] = useState<string>(
    stock?.supplier_id ? String(stock.supplier_id) : ""
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockDate, setStockDate] = useState(stock?.stock_date || todayIST());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const today = todayIST();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name")
      .then(({ data }) => setSuppliers((data || []) as Supplier[]));
  }, []);

  const adjustQty = (delta: number) => {
    setQuantity((q) => Math.max(1, q + delta));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (quantity <= 0) {
      setError("Quantity must be at least 1");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from("inventory_list")
          .update({
            quantity,
            stock_date: stockDate,
            supplier_id: supplierId ? Number(supplierId) : null,
          })
          .eq("id", stock!.id);
        if (err) throw err;
        await logActivity(
          "Updated Stock Entry",
          "Inventory",
          productId,
          `Product: ${productName || "Product"} | Updated to ${quantity} units | Stock ID: ${stock!.id}`
        );
      } else {
        const { error: err } = await supabase.from("inventory_list").insert([
          {
            product_id: productId,
            quantity,
            stock_date: stockDate,
            supplier_id: supplierId ? Number(supplierId) : null,
          },
        ]);
        if (err) throw err;
        await logActivity(
          "Added New Stock",
          "Inventory",
          productId,
          `Product: ${productName || "Product"} | Added ${quantity} units`
        );
      }
      setSuccess(true);
      setTimeout(() => onSaved(), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

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
        className="relative w-full sm:max-w-md bg-[#161b27] border border-[#21293d] sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl shadow-black/50 flex flex-col max-h-[90vh]"
        style={{ animation: "slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {success && (
          <div className="absolute inset-0 z-10 bg-[#161b27] flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <p className="text-white font-extrabold text-lg">
              {isEdit ? "Updated!" : "Stock Added!"}
            </p>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
              {quantity} unit{quantity !== 1 ? "s" : ""} {isEdit ? "updated" : "added"}
            </p>
          </div>
        )}

        <div
          className={`h-0.5 w-full ${isEdit ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`}
        />

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#21293d]">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${isEdit ? "bg-amber-500/10 border-amber-500/25" : "bg-blue-500/10 border-blue-500/25"}`}
            >
              {isEdit ? (
                <Edit3 size={16} className="text-amber-400" />
              ) : (
                <ArrowDownToLine size={16} className="text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-none">
                {isEdit ? "Edit Stock Entry" : "Add New Stock"}
              </h3>
              <p className="text-[10px] text-slate-600 font-bold mt-0.5 uppercase tracking-wider">
                {isEdit ? `Editing entry #${stock!.id}` : `Product ID: #${productId}`}
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

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="px-5 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs font-bold">{error}</p>
              </div>
            )}

            {/* Location display */}
            {productLocationLabel && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <MapPin size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{productLocationLabel}</span>
                <span className="text-[9px] text-slate-600 ml-auto">Product Location</span>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjustQty(-1)}
                  className="w-11 h-11 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-red-500/40 hover:text-red-400 text-slate-500 rounded-xl transition-all active:scale-95"
                >
                  <Minus size={16} />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    required
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full text-center text-3xl font-black text-white bg-[#111520] border border-[#21293d] rounded-xl py-3 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => adjustQty(1)}
                  className="w-11 h-11 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-blue-500/40 hover:text-blue-400 text-slate-500 rounded-xl transition-all active:scale-95"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="flex gap-2 mt-2.5">
                {[1, 5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${quantity === n ? "bg-blue-600 text-white border-blue-600" : "bg-[#111520] text-slate-600 border-[#21293d] hover:border-blue-500/30 hover:text-slate-400"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Supplier */}
            {suppliers.length > 0 && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                  <span className="flex items-center gap-1.5">
                    <Package size={10} className="text-slate-700" /> Supplier (Optional)
                  </span>
                </label>
                <SearchableSelect
                  value={supplierId || null}
                  options={suppliers.map((s) => ({ id: s.id, label: s.name }))}
                  onSelect={(v) => setSupplierId(v)}
                  placeholder="-- Select Supplier --"
                  clearLabel="-- Select Supplier --"
                />
              </div>
            )}

            {/* Stock Date */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2.5">
                <span className="flex items-center gap-1.5">
                  <Calendar size={10} className="text-slate-700" /> Stock Date{" "}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="date"
                required
                value={stockDate}
                max={today}
                onChange={(e) => setStockDate(e.target.value)}
                className="w-full px-4 py-3 bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all text-sm [color-scheme:dark]"
              />
              <div className="flex gap-2 mt-2">
                {[
                  { label: "Today", val: today },
                  { label: "Yesterday", val: toISTDatePart(new Date(Date.now() - 86400000)) },
                ].map(({ label, val }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStockDate(val)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${stockDate === val ? "bg-blue-600 text-white border-blue-600" : "bg-[#111520] text-slate-600 border-[#21293d] hover:border-blue-500/30 hover:text-slate-400"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-1 flex gap-2.5 flex-shrink-0">
            <button
              type="submit"
              disabled={saving || success}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg ${isEdit ? "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"}`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={16} /> Saved!
                </>
              ) : (
                <>
                  <Save size={16} /> {isEdit ? "Update Entry" : "Add Stock"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
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
