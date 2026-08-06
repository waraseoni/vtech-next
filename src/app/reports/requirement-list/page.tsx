"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Loader2, ArrowLeft, Printer, PackageX, AlertTriangle, RefreshCw, Phone } from "lucide-react";
import Link from "next/link";
import { todayIST } from "@/lib/dateUtils";

type ReqItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  hsn: string;
  alert_quantity: number;
  current_stock: number;
  need_to_order: number;
  suppliers: { id: number; name: string; contact: string }[];
};

function RequirementListContent() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReqItem[]>([]);
  const [search, setSearch] = useState("");
  const [firmName, setFirmName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (sys || []).forEach(r => { info[r.meta_field] = r.meta_value; });
      setFirmName(info.name || "V-Technologies");

      const { data: pl } = await supabase
        .from("product_list")
        .select("id, name, description, price, hsn, alert_quantity")
        .eq("delete_flag", 0)
        .eq("status", 1)
        .gt("alert_quantity", 0);
      if (!pl || pl.length === 0) { setItems([]); return; }

      const ids = pl.map(p => p.id);

      const [stockRes, jobItemsRes, saleItemsRes, linkRes, suppRes] = await Promise.all([
        supabase.from("inventory_list").select("product_id, quantity").in("product_id", ids),
        supabase.from("transaction_products").select("product_id, qty, transaction_id").in("product_id", ids),
        supabase.from("direct_sale_items").select("product_id, qty").in("product_id", ids),
        supabase.from("spare_supplier").select("spare_id, supplier_id").in("spare_id", ids),
        supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0).eq("status", 1),
      ]);

      const txnIds = [...new Set((jobItemsRes.data || []).map(i => i.transaction_id))];
      let validTxnSet = new Set<number>();
      if (txnIds.length > 0) {
        const { data: txns } = await supabase
          .from("transaction_list").select("id").in("id", txnIds).neq("status", 4);
        validTxnSet = new Set((txns || []).map(t => t.id));
      }

      const stockMap = new Map<number, number>();
      (stockRes.data || []).forEach(r => stockMap.set(r.product_id, (stockMap.get(r.product_id) || 0) + (r.quantity || 0)));

      const soldJobMap = new Map<number, number>();
      (jobItemsRes.data || []).forEach(r => {
        if (validTxnSet.has(r.transaction_id)) soldJobMap.set(r.product_id, (soldJobMap.get(r.product_id) || 0) + (r.qty || 0));
      });

      const soldSaleMap = new Map<number, number>();
      (saleItemsRes.data || []).forEach(r => soldSaleMap.set(r.product_id, (soldSaleMap.get(r.product_id) || 0) + (r.qty || 0)));

      const supplierMap = new Map<number, { id: number; name: string; contact: string }[]>();
      const suppById = new Map<number, { id: number; name: string; contact: string }>();
      (suppRes.data || []).forEach(s => suppById.set(s.id, s));
      (linkRes.data || []).forEach(l => {
        const s = suppById.get(l.supplier_id);
        if (!s) return;
        const arr = supplierMap.get(l.spare_id) || [];
        arr.push(s);
        supplierMap.set(l.spare_id, arr);
      });

      const built: ReqItem[] = pl.map(p => {
        const sold = (soldJobMap.get(p.id) || 0) + (soldSaleMap.get(p.id) || 0);
        const current_stock = (stockMap.get(p.id) || 0) - sold;
        return {
          id: p.id,
          name: p.name,
          description: p.description || "",
          price: p.price || 0,
          hsn: p.hsn || "",
          alert_quantity: p.alert_quantity || 0,
          current_stock,
          need_to_order: Math.max(0, (p.alert_quantity || 0) - current_stock),
          suppliers: supplierMap.get(p.id) || [],
        };
      });

      setItems(built.filter(i => i.current_stock < i.alert_quantity));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(i =>
      !q || i.name.toLowerCase().includes(q) || i.hsn.toLowerCase().includes(q) ||
      i.suppliers.some(s => s.name.toLowerCase().includes(q))
    ).sort((a, b) => b.need_to_order - a.need_to_order);
  }, [items, search]);

  const totalItems = filtered.length;
  const outOfStock = filtered.filter(i => i.current_stock <= 0).length;
  const totalNeed = filtered.reduce((s, i) => s + i.need_to_order, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Print header (only visible when printing) */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <div className="text-2xl font-black">{firmName}</div>
            <div className="text-sm">Spare Parts Requirement List</div>
          </div>
          <div className="text-right text-sm">
            Generated: {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(todayIST()))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 shadow-2xl relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-center gap-5">
            <Link href="/reports" className="w-12 h-12 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-2xl text-slate-500 hover:text-white hover:bg-amber-600/10 hover:border-amber-500/40 transition-all group">
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-700 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-amber-500/10">
              <PackageX size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Requirement List</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Low Stock Spares</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="flex items-center gap-2 px-5 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-600/20">
              <Printer size={14} /> Print List
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-600 to-orange-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Items To Order</div>
          <div className="text-3xl font-black mt-1">{totalItems}</div>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Out Of Stock</div>
          <div className="text-3xl font-black mt-1">{outOfStock}</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-600 to-cyan-900 rounded-2xl p-5 text-white shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Need To Order</div>
          <div className="text-3xl font-black mt-1">{totalNeed}</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 no-print">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
          <input type="text" placeholder="Search by name, HSN or supplier..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-[#0d1117] border border-[#21293d] rounded-2xl text-sm text-slate-200 outline-none focus:border-amber-500 transition-all" />
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-48">
          <Loader2 size={48} className="animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] py-24 text-center">
          <PackageX size={48} className="mx-auto text-emerald-500 mb-4" />
          <p className="text-slate-400 font-bold">Koi low-stock spare nahi mila. Sab stock theek hai! 🎉</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(item => {
            const pct = item.alert_quantity > 0 ? Math.min(100, Math.max(0, (item.current_stock / item.alert_quantity) * 100)) : 0;
            const isOut = item.current_stock <= 0;
            return (
              <div key={item.id} className="bg-[#161b27] border border-[#21293d] rounded-[2rem] p-5 shadow-2xl hover:border-amber-500/30 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-white text-base truncate">{item.name}</h3>
                    <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                      {item.hsn ? `HSN ${item.hsn}` : "No HSN"}{item.description ? ` · ${item.description.slice(0, 40)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${isOut ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-orange-500/15 text-orange-300 border-orange-500/30"}`}>
                    {isOut ? <span className="flex items-center gap-1"><AlertTriangle size={11} /> Out</span> : "Low Stock"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-3">
                    <div className={`text-xl font-black ${isOut ? "text-red-400" : "text-amber-400"}`}>{item.current_stock}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">Current</div>
                  </div>
                  <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-3">
                    <div className="text-xl font-black text-white">{item.alert_quantity}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">Min Req</div>
                  </div>
                  <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-3">
                    <div className="text-xl font-black text-emerald-400">+{item.need_to_order}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-0.5">To Order</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1.5">
                    <span>Stock level</span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-[#0d1117] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isOut ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#21293d]">
                  {item.suppliers.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.suppliers.map(s => (
                        <a key={s.id}
                          href={s.contact ? `tel:${s.contact.replace(/\D/g, "")}` : "#"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500 hover:text-white transition-all no-print">
                          <Phone size={11} /> {s.name}{s.contact ? ` · ${s.contact}` : ""}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-600 italic">No supplier linked — <Link href="/products" className="text-amber-500 no-print">link in Products</Link></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default function RequirementListReport() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-48"><Loader2 size={48} className="animate-spin text-amber-500" /></div>}>
      <RequirementListContent />
    </Suspense>
  );
}
