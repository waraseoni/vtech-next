"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { numberToWords } from "@/lib/utils";
import { substituteTemplate, firmVars } from "@/lib/whatsapp";
import { DEFAULT_TEMPLATES } from "@/lib/whatsappTemplates";
import {
  ArrowLeft, Edit3, Printer, Phone, User,
  ShoppingBag, MapPin, Calendar, Clock, Hash, UserCog,
  Package, IndianRupee, Banknote, CreditCard, Smartphone,
  Building2, ChevronRight, CheckCircle2, Send, FileText,
  Info, Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  total: number;
}
interface Sale {
  id: number;
  sale_code: string;
  client_id: number | null;
  client_name: string | null;
  client_contact: string | null;
  client_address: string | null;
  mechanic_id: number;
  staff_name: string;
  total_amount: number;
  payment_mode: string;
  remarks: string | null;
  date_created: string;
  last_edited_by: number | null;
  last_edited_date: string | null;
  last_editor_name: string | null;
  items: SaleItem[];
}

// ─── Payment config ───────────────────────────────────────────────────────────
const PAY_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  "Cash":          { icon: Banknote,   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  "Card":          { icon: CreditCard, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25"    },
  "UPI":           { icon: Smartphone, color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/25"    },
  "Bank Transfer": { icon: Building2,  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25"   },
};
const getPayCfg = (m: string) =>
  PAY_CFG[m] || { icon: Banknote, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/25" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtIST = (d: string, time = true) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  });
};

function InfoRow({ label, value, muted = false }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-[#21293d] last:border-0 gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex-shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${muted ? "text-slate-500" : "text-slate-300"}`}>{value}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ViewSalePage() {
  const params = useParams();
  const saleId = Number(params.id);

  const [sale,        setSale]        = useState<Sale | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [sysInfo,     setSysInfo]     = useState<Record<string, string>>({});

  const fetchCompanyInfo = useCallback(async () => {
    const { data } = await supabase.from("system_info").select("meta_field, meta_value");
    if (data) {
      const info: Record<string, string> = {};
      data.forEach(r => { info[r.meta_field] = r.meta_value; });
      setSysInfo(info);
    }
  }, []);

  const fetchSale = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sd, error: se } = await supabase.from("direct_sales").select("*").eq("id", saleId).single();
      if (se) throw se;

      const [clientRes, mechRes, editorRes, itemsRes] = await Promise.all([
        sd.client_id
          ? supabase.from("client_list").select("firstname, middlename, lastname, contact, address").eq("id", sd.client_id).single()
          : Promise.resolve({ data: null }),
        sd.mechanic_id
          ? supabase.from("mechanic_list").select("firstname, lastname").eq("id", sd.mechanic_id).single()
          : Promise.resolve({ data: null }),
        sd.last_edited_by && sd.last_edited_by !== 0
          ? supabase.from("mechanic_list").select("firstname, lastname").eq("id", sd.last_edited_by).single()
          : Promise.resolve({ data: null }),
        supabase.from("direct_sale_items").select("id, product_id, qty, price").eq("sale_id", saleId),
      ]);

      const c = clientRes.data;
      const clientName = c ? [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ") : null;
      const mechName   = mechRes.data ? `${mechRes.data.firstname} ${mechRes.data.lastname}` : "Admin";
      const editorName = sd.last_edited_by === 0 ? "Admin"
        : editorRes.data ? `${editorRes.data.firstname} ${editorRes.data.lastname}` : null;

      const productIds = (itemsRes.data || []).map((i) => i.product_id);
      const pMap = new Map<number, string>();
      if (productIds.length) {
        const { data: prods } = await supabase.from("product_list").select("id, name").in("id", productIds);
        prods?.forEach((p) => pMap.set(p.id, p.name));
      }
      const items: SaleItem[] = (itemsRes.data || []).map((i) => ({
        ...i, product_name: pMap.get(i.product_id) || "Unknown", total: i.qty * i.price,
      }));

      setSale({ ...sd, client_name: clientName, client_contact: c?.contact || null,
        client_address: c?.address || null, staff_name: mechName, last_editor_name: editorName, items });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [saleId]);

  useEffect(() => {
    fetchSale();
    fetchCompanyInfo();
  }, [fetchSale, fetchCompanyInfo]);

  const printInvoice = () => {
    if (!sale) return;
    window.open(`/api/print-direct-sale-invoice?id=${sale.id}`, "_blank");
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ShoppingBag size={28} className="text-emerald-500/60" />
          </div>
          <div className="absolute inset-0 rounded-2xl border border-emerald-500/40 animate-ping" />
        </div>
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Invoice...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center bg-[#161b27] border border-[#21293d] rounded-2xl p-10">
          <ShoppingBag size={40} className="mx-auto text-slate-700 mb-3" />
          <h2 className="text-xl font-black text-white">Sale not found</h2>
          <Link href="/direct-sales" className="text-blue-400 hover:text-blue-300 text-sm mt-3 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Sales
          </Link>
        </div>
      </div>
    );
  }

  const subtotal  = sale.items.reduce((s, i) => s + i.total, 0);
  const PayIcon   = getPayCfg(sale.payment_mode).icon;
  const payCfg    = getPayCfg(sale.payment_mode);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-20 right-20 w-80 h-80 bg-emerald-600/6 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700 mb-4 font-bold uppercase tracking-wider">
            <Link href="/direct-sales" className="hover:text-slate-500 transition-colors">Direct Sales</Link>
            <ChevronRight size={10} />
            <span className="text-slate-500">{sale.sale_code}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left */}
            <div className="flex items-start gap-4">
              <Link href="/direct-sales"
                className="mt-1 p-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] rounded-xl text-slate-500 hover:text-slate-300 transition-all flex-shrink-0">
                <ArrowLeft size={16} />
              </Link>
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25 flex-shrink-0">
                  <FileText size={24} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                      {sale.sale_code}
                    </h1>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${payCfg.bg} ${payCfg.border} ${payCfg.color}`}>
                      <PayIcon size={9} /> {sale.payment_mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
                      <Calendar size={9} /> {fmtIST(sale.date_created, false)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
                      <Clock size={9} /> {fmtIST(sale.date_created).split(",")[1]?.trim()}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
                      <Hash size={9} /> ID: {sale.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link href={`/direct-sales/${sale.id}/edit`}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                <Edit3 size={14} /> Edit
              </Link>
              <button onClick={printInvoice}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                <Printer size={14} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── COMPANY BANNER ── */}
        <div className="relative bg-gradient-to-r from-[#161b27] via-[#1a2235] to-[#161b27] border border-[#21293d] rounded-2xl px-6 py-5 overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-emerald-600/10 to-transparent" />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
            <Sparkles size={48} className="text-emerald-400" />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">{sysInfo.name || "V-Technologies"}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {sysInfo.address && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <MapPin size={9} /> {sysInfo.address}
                  </span>
                )}
                {sysInfo.contact && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Phone size={9} /> {sysInfo.contact}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-extrabold uppercase tracking-wider">Direct Sale Invoice</span>
            </div>
          </div>
        </div>

        {/* ── TWO COLUMN: Client + Invoice Details ── */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Client card */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21293d] bg-[#111520]">
              <User size={12} className="text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Bill To</span>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Name"
                value={
                  sale.client_name
                    ? <span className="text-white font-bold">{sale.client_name}</span>
                    : <span className="text-slate-600 italic">Walk-in Customer</span>
                }
              />
              {sale.client_contact && (
                <InfoRow label="Phone"
                  value={
                    <div className="flex items-center gap-2">
                      <span>{sale.client_contact}</span>
                      <a
                        href={`https://wa.me/91${sale.client_contact.replace(/\D/g, "")}?text=${encodeURIComponent(
                          substituteTemplate(
                            sysInfo.whatsapp_sale || DEFAULT_TEMPLATES.whatsapp_sale,
                            {
                              client_name: sale.client_name || "Customer",
                              sale_code: sale.sale_code,
                              total_amount: "₹" + (sale.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
                              ...firmVars(sysInfo),
                            }
                          )
                        )}`}
                        target="_blank"
                        className="flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 transition-colors text-[10px] font-bold">
                        <Send size={9} /> WA
                      </a>
                    </div>
                  }
                />
              )}
              {sale.client_address && (
                <InfoRow label="Address" value={<span className="text-xs leading-relaxed max-w-[180px] text-right">{sale.client_address}</span>} />
              )}
              {!sale.client_contact && !sale.client_address && !sale.client_name && (
                <div className="py-4 text-center text-slate-700 text-xs">No client details</div>
              )}
            </div>
          </div>

          {/* Invoice details */}
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21293d] bg-[#111520]">
              <FileText size={12} className="text-emerald-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Invoice Details</span>
            </div>
            <div className="px-5 py-1">
              <InfoRow label="Invoice No" value={<span className="text-blue-400 font-extrabold">{sale.sale_code}</span>} />
              <InfoRow label="Date" value={fmtIST(sale.date_created, false)} />
              <InfoRow label="Time" value={fmtIST(sale.date_created).split(",")[1]?.trim() || "—"} />
              <InfoRow label="Staff" value={
                <span className="flex items-center gap-1.5">
                  <UserCog size={10} className="text-slate-600" /> {sale.staff_name}
                </span>
              } />
              <InfoRow label="Payment" value={
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${payCfg.bg} ${payCfg.border} ${payCfg.color}`}>
                  <PayIcon size={8} /> {sale.payment_mode}
                </span>
              } />
              {sale.last_editor_name && (
                <InfoRow label="Last Edit" muted
                  value={<span className="text-[10px]">{sale.last_editor_name} · {fmtIST(sale.last_edited_date!)}</span>} />
              )}
            </div>
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#21293d] bg-[#111520]">
            <Package size={13} className="text-purple-400" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Items ({sale.items.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#21293d]">
                  {["#", "Product", "Qty", "Unit Price", "Total"].map((h, i) => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                      i === 0 ? "text-left w-10" :
                      i === 1 ? "text-left" :
                      i === 2 ? "text-center" : "text-right"
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21293d]">
                {sale.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-slate-700 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package size={12} className="text-purple-400" />
                        </div>
                        <span className="text-slate-200 font-semibold text-sm">{item.product_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-xl font-black text-white">{item.qty}</span>
                      <span className="text-slate-600 text-xs ml-1">pcs</span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-400 text-xs">
                      ₹{item.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-200">
                      ₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {sale.items.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-700">No items found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── BILL SUMMARY ── */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#21293d] bg-[#111520]">
              <IndianRupee size={12} className="text-teal-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Bill Summary</span>
            </div>
            <div className="px-5 py-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Subtotal ({sale.items.length} items)</span>
                <span className="text-slate-400 font-bold">₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {subtotal !== sale.total_amount && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Adjustment</span>
                  <span className={`font-bold ${sale.total_amount > subtotal ? "text-red-400" : "text-emerald-400"}`}>
                    {sale.total_amount > subtotal ? "+" : ""}₹{(sale.total_amount - subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="border-t border-[#21293d] pt-2 flex justify-between items-center">
                <span className="text-sm font-extrabold text-slate-300">Grand Total</span>
                <span className="text-2xl font-black text-white">
                  ₹{sale.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-[#111520] border border-[#21293d] rounded-xl px-3 py-2 mt-1">
                <p className="text-[10px] text-slate-600 leading-relaxed italic">
                  {numberToWords(sale.total_amount)} Rupees Only
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── REMARKS ── */}
        {sale.remarks && (
          <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3.5">
            <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 block mb-0.5">Remarks</span>
              <p className="text-slate-400 text-sm leading-relaxed">{sale.remarks}</p>
            </div>
          </div>
        )}

        {/* ── FOOTER NOTE ── */}
        <div className="flex items-center justify-center gap-2 py-4 border-t border-[#21293d]">
          <CheckCircle2 size={12} className="text-slate-700" />
          <p className="text-[11px] text-slate-700 font-medium">
            Goods sold are not returnable. Thank you for your business! — {sysInfo.name || "V-Technologies"}
          </p>
        </div>

      </div>
    </div>
  );
}
