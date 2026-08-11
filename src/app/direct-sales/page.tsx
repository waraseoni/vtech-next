"use client";
import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Plus, Search, Eye, Edit3, Trash2, Filter, X,
  ChevronLeft, ChevronRight, Printer, FileSpreadsheet,
  User, ShoppingBag, IndianRupee, TrendingUp,
  Banknote, Smartphone, BarChart3,
  CalendarDays, Send, Clock,
} from "lucide-react";
import { todayIST, startOfMonthIST, endOfMonthIST, formatIST, parseISTDate } from "@/lib/dateUtils";
import { logActivity } from "@/lib/activity";
import { substituteTemplate, firmVars } from "@/lib/whatsapp";
import { DEFAULT_TEMPLATES } from "@/lib/whatsappTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DirectSale {
  id: number;
  sale_code: string;
  client_name: string | null;
  client_contact?: string | null;
  staff_name: string;
  total_amount: number;
  payment_mode: string;
  remarks?: string | null;
  last_editor_name?: string | null;
  date_created: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────
const PAYMENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Cash: { icon: Banknote, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  UPI:  { icon: Smartphone, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
};

const getPayConfig = (mode: string) =>
  PAYMENT_CONFIG[mode] || { icon: Banknote, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/25" };

const fmtDate     = (d: string) => formatIST(d, { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d: string) => formatIST(d, { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });

// ─── Payment Badge ────────────────────────────────────────────────────────────
const PayBadge = ({ mode }: { mode: string }) => {
  const { icon: Icon, color, bg, border } = getPayConfig(mode);
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${bg} ${border} ${color} text-[10px] font-bold`}>
      <Icon size={10} /> {mode}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
function DirectSalesPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [sales,         setSales]         = useState<DirectSale[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [isMobile,      setIsMobile]      = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [mobileSearch,  setMobileSearch]  = useState("");
  const [mobilePayFilter, setMobilePayFilter] = useState("all");

  const [dateFrom,      setDateFrom]      = useState(searchParams.get("from") || startOfMonthIST());
  const [dateTo,        setDateTo]        = useState(searchParams.get("to")   || todayIST());
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get("payment_mode") || "all");
  const [stats,         setStats]         = useState({ totalSales: 0, totalAmount: 0, avgAmount: 0, cashTotal: 0, upiTotal: 0 });
  const [sysInfo,       setSysInfo]       = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_info").select("meta_field, meta_value");
      if (data) {
        const info: Record<string, string> = {};
        data.forEach(r => { info[r.meta_field] = r.meta_value; });
        setSysInfo(info);
      }
    })();
  }, []);

  const waHref = (s: DirectSale) => {
    const msg = substituteTemplate(sysInfo.whatsapp_sale || DEFAULT_TEMPLATES.whatsapp_sale, {
      client_name: s.client_name || "Customer",
      sale_code: s.sale_code,
      total_amount: "₹" + (s.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      ...firmVars(sysInfo),
    });
    return `https://wa.me/91${(s.client_contact || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  };

  // Payment breakdown for mini chart
  const payBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach(s => { map[s.payment_mode] = (map[s.payment_mode] || 0) + s.total_amount; });
    return map;
  }, [sales]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h  = (e: MediaQueryList | MediaQueryListEvent) => setIsMobile(e.matches);
    h(mq); mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("direct_sales").select("*")
        .gte("date_created", `${dateFrom}T00:00:00+05:30`)
        .lte("date_created", `${dateTo}T23:59:59+05:30`)
        .order("date_created", { ascending: false });
      if (paymentFilter !== "all") query = query.eq("payment_mode", paymentFilter);

      const { data: salesData, error } = await query;
      if (error) throw error;
      if (!salesData?.length) {
        setSales([]); setStats({ totalSales: 0, totalAmount: 0, avgAmount: 0, cashTotal: 0, upiTotal: 0 });
        setLoading(false); return;
      }

      const clientIds  = [...new Set(salesData.map(s => s.client_id).filter(Boolean))];
      const mechIds    = [...new Set(salesData.map(s => s.mechanic_id).filter(Boolean))];
      const editorIds  = [...new Set(salesData.map(s => s.last_edited_by).filter(id => id != null && id !== 0))];

      const [clientsRes, mechsRes, editorsRes] = await Promise.all([
        clientIds.length  ? supabase.from("client_list").select("id, firstname, middlename, lastname, contact, image_path").in("id", clientIds) : Promise.resolve({ data: [] }),
        mechIds.length    ? supabase.from("mechanic_list").select("id, firstname, lastname").in("id", mechIds)   : Promise.resolve({ data: [] }),
        editorIds.length  ? supabase.from("mechanic_list").select("id, firstname, lastname").in("id", editorIds) : Promise.resolve({ data: [] }),
      ]);

      const cMap = new Map((clientsRes.data || []).map((c) => [c.id, {
        name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
        contact: c.contact, image_path: c.image_path,
      }]));
      const mMap = new Map((mechsRes.data   || []).map((m) => [m.id, `${m.firstname} ${m.lastname}`]));
      const eMap = new Map((editorsRes.data || []).map((e) => [e.id, `${e.firstname} ${e.lastname}`]));

      const formatted: DirectSale[] = salesData.map(s => {
        const c = cMap.get(s.client_id);
        return {
          ...s,
          client_name:      c?.name    || null,
          client_contact:   c?.contact || null,
          client_image:     c?.image_path || null,
          staff_name:       mMap.get(s.mechanic_id) || "Admin",
          last_editor_name: s.last_edited_by === 0 ? "Admin" : eMap.get(s.last_edited_by) || null,
        };
      });

      setSales(formatted);
      const totalSales  = formatted.length;
      const totalAmount = formatted.reduce((s, r) => s + (r.total_amount || 0), 0);
      const cashTotal   = formatted.filter(r => r.payment_mode === "Cash").reduce((s, r) => s + r.total_amount, 0);
      const upiTotal    = formatted.filter(r => r.payment_mode === "UPI").reduce((s, r)  => s + r.total_amount, 0);
      setStats({ totalSales, totalAmount, avgAmount: totalSales ? totalAmount / totalSales : 0, cashTotal, upiTotal });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, paymentFilter]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // ── Filtered (mobile) ─────────────────────────────────────────────────────
  const filteredSales = useMemo(() => {
    if (!isMobile) return sales;
    return sales.filter(s => {
      const q = mobileSearch.toLowerCase();
      const matchSearch = !q || s.sale_code.toLowerCase().includes(q) ||
        (s.client_name?.toLowerCase() || "").includes(q) ||
        s.total_amount.toString().includes(q);
      const matchPay = mobilePayFilter === "all" || s.payment_mode === mobilePayFilter;
      return matchSearch && matchPay;
    });
  }, [sales, mobileSearch, mobilePayFilter, isMobile]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const updateUrl = (from: string, to: string, payment: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", from); p.set("to", to);
    if (payment !== "all") p.set("payment_mode", payment);
    else p.delete("payment_mode");
    router.push(`/direct-sales?${p.toString()}`);
    setDateFrom(from); setDateTo(to); setPaymentFilter(payment);
  };

  const shiftMonth = (dir: -1 | 1) => {
    const cur = parseISTDate(dateFrom);
    cur.setMonth(cur.getMonth() + dir);
    updateUrl(startOfMonthIST(cur), endOfMonthIST(cur), paymentFilter);
  };

  const goCurrentMonth = () => updateUrl(
    startOfMonthIST(),
    endOfMonthIST(),
    "all"
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm("Is direct sale ko permanently delete karna chahte hain?")) return;
    const saleToDelete = sales.find(s => s.id === id);
    const { error } = await supabase.from("direct_sales").delete().eq("id", id);
    if (!error) {
      await logActivity('Deleted Direct Sale', 'Sales', id, `Deleted Sale #${saleToDelete?.sale_code}`);
      fetchSales();
    } else alert("Delete failed: " + error.message);
  };

  const exportCSV = () => {
    const rows = [
      ["Sale Code", "Date", "Client", "Staff", "Amount", "Payment Mode"],
      ...filteredSales.map(s => [
        s.sale_code, fmtDate(s.date_created), s.client_name || "Walk-in",
        s.staff_name, s.total_amount.toFixed(2), s.payment_mode,
      ]),
    ];
    const csv  = rows.map(r => r.join(",")).join("\n");
    const url  = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a    = Object.assign(document.createElement("a"), { href: url, download: `sales_${todayIST().replace(/-/g, "")}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const params = new URLSearchParams({
      from: dateFrom,
      to: dateTo,
      payment_mode: paymentFilter,
    });
    window.open(`/api/print-direct-sales?${params.toString()}`, "_blank");
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
        <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Loading Sales...</p>
      </div>
    );
  }

  const monthLabel = formatIST(dateFrom, { month: "long", year: "numeric" });

  // ══════════════════════════════════════════════════════════════════════════
  // ── MOBILE VIEW ──────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#0d1117] pb-24">

        {/* Mobile Header */}
        <div className="bg-[#0d1117] border-b border-[#21293d] px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-center">
                <ShoppingBag size={16} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white leading-none">Direct Sales</h1>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">{monthLabel}</p>
              </div>
            </div>
            <Link href="/direct-sales/new"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all">
              <Plus size={14} /> New Sale
            </Link>
          </div>

          {/* Mini stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Sales",   value: stats.totalSales,                    color: "text-blue-400"    },
              { label: "Revenue", value: `₹${(stats.totalAmount/1000).toFixed(1)}K`, color: "text-emerald-400" },
              { label: "Avg",     value: `₹${stats.avgAmount.toFixed(0)}`,    color: "text-purple-400"  },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 text-center">
                <div className={`text-base font-black ${color}`}>{value}</div>
                <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">{label}</div>
              </div>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => shiftMonth(-1)}
              className="w-8 h-8 bg-[#161b27] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all">
              <ChevronLeft size={14} />
            </button>
            <button onClick={goCurrentMonth}
              className="flex-1 h-8 bg-[#161b27] border border-[#21293d] rounded-lg text-[11px] font-extrabold text-slate-400 hover:text-white transition-all">
              {monthLabel}
            </button>
            <button onClick={() => shiftMonth(1)}
              className="w-8 h-8 bg-[#161b27] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input type="text" placeholder="Search sales, clients..." value={mobileSearch}
              onChange={e => setMobileSearch(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-[#161b27] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl text-sm outline-none focus:border-blue-500/50 transition-all" />
            <button onClick={() => setShowFilterModal(true)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#111520] border border-[#21293d] p-1 rounded-lg text-slate-500">
              <Filter size={13} />
            </button>
          </div>

          {/* Payment filter chips */}
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-0.5">
            {(["all", "Cash", "Card", "UPI", "Bank Transfer"] as const).map(f => {
              const active = mobilePayFilter === f;
              const cfg    = f !== "all" ? getPayConfig(f) : null;
              return (
                <button key={f} onClick={() => setMobilePayFilter(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap border transition-all ${
                    active
                      ? f === "all" ? "bg-blue-600 text-white border-blue-600"
                        : `${cfg!.bg} ${cfg!.color} ${cfg!.border}`
                      : "bg-[#161b27] text-slate-600 border-[#21293d]"
                  }`}>
                  {f === "all" ? "All" : f}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="px-3 pt-3 space-y-2.5">
          {filteredSales.map(s => {
            return (
              <div key={s.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
                <div className={`h-0.5 w-full ${
                  s.payment_mode === "Cash" ? "bg-emerald-500" :
                  s.payment_mode === "UPI"  ? "bg-cyan-500"    :
                  s.payment_mode === "Card" ? "bg-blue-500"    : "bg-amber-500"
                }`} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <Link href={`/direct-sales/${s.id}/view`}
                        className="text-blue-400 hover:text-blue-300 font-extrabold text-sm transition-colors">
                        {s.sale_code}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-600 font-bold">
                          {fmtDate(s.date_created)}
                        </span>
                        <span className="text-[10px] text-slate-700">· {s.staff_name}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">₹{s.total_amount.toLocaleString("en-IN")}</div>
                      <PayBadge mode={s.payment_mode} />
                    </div>
                  </div>

                  {/* Client */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={11} className="text-slate-500" />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {s.client_name || "Walk-in Customer"}
                      </span>
                    </div>
                    {s.client_contact && (
                      <a href={waHref(s)} target="_blank"
                        className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                        <Send size={10} /> WA
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#21293d]">
                    <Link href={`/direct-sales/${s.id}/view`}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#111520] border border-[#21293d] hover:border-blue-500/30 text-slate-400 hover:text-blue-400 rounded-xl text-[11px] font-extrabold transition-all">
                      <Eye size={12} /> View
                    </Link>
                    <Link href={`/direct-sales/${s.id}/edit`}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#111520] border border-[#21293d] hover:border-amber-500/30 text-slate-400 hover:text-amber-400 rounded-xl text-[11px] font-extrabold transition-all">
                      <Edit3 size={12} /> Edit
                    </Link>
                    <button onClick={() => handleDelete(s.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#111520] border border-[#21293d] hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl text-[11px] font-extrabold transition-all">
                      <Trash2 size={12} /> Del
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSales.length === 0 && (
            <div className="py-20 text-center bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl">
              <ShoppingBag size={32} className="mx-auto text-slate-800 mb-3" />
              <p className="text-slate-600 font-bold text-sm">No sales found</p>
            </div>
          )}
        </div>

        {/* Mobile filter modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-0"
            onClick={() => setShowFilterModal(false)}>
            <div className="bg-[#161b27] border-t border-[#21293d] rounded-t-3xl w-full p-5 pb-8"
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-[#21293d] rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Filter Sales</h3>
                <button onClick={() => setShowFilterModal(false)}
                  className="w-7 h-7 bg-[#111520] border border-[#21293d] rounded-lg flex items-center justify-center text-slate-500">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-4">
                {[{ label: "From Date", val: dateFrom, set: setDateFrom }, { label: "To Date", val: dateTo, set: setDateTo }].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">{label}</label>
                    <input type="date" value={val} onChange={e => set(e.target.value)}
                      className="w-full bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 [color-scheme:dark]" />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">Payment Mode</label>
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
                    className="w-full bg-[#111520] border border-[#21293d] text-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none [color-scheme:dark]">
                    {["all", "Cash", "Card", "UPI", "Bank Transfer"].map(m => (
                      <option key={m} value={m}>{m === "all" ? "All Modes" : m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => { setDateFrom(startOfMonthIST()); setDateTo(endOfMonthIST()); setPaymentFilter("all"); }}
                    className="flex-1 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl text-sm font-extrabold">
                    Reset
                  </button>
                  <button onClick={() => { updateUrl(dateFrom, dateTo, paymentFilter); setShowFilterModal(false); }}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── DESKTOP VIEW ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-16">

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden bg-[#0d1117] border-b border-[#21293d]">
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute -top-16 left-1/4 w-80 h-80 bg-emerald-600/6 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/25 flex-shrink-0">
                <ShoppingBag size={26} className="text-white" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#0d1117]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Direct Sales</h1>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.2em] mt-0.5">
                  {monthLabel} · {stats.totalSales} transactions
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={printReport}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl text-xs font-bold transition-all">
                <Printer size={13} /> Print
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#161b27] hover:bg-[#1e2740] border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl text-xs font-bold transition-all">
                <FileSpreadsheet size={13} /> Export
              </button>
              <Link href="/direct-sales/new"
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
                <Plus size={16} /> New Sale
              </Link>
            </div>
          </div>

          {/* ── STAT CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
            {[
              { label: "Total Sales",    value: stats.totalSales,                              icon: BarChart3,    color: "text-blue-400",    grad: "from-blue-600/15 to-blue-700/5",    border: "border-blue-500/20"    },
              { label: "Total Revenue",  value: `₹${stats.totalAmount.toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-400", grad: "from-emerald-600/15 to-emerald-700/5", border: "border-emerald-500/20" },
              { label: "Avg Sale",       value: `₹${stats.avgAmount.toFixed(0)}`,              icon: TrendingUp,   color: "text-purple-400",  grad: "from-purple-600/15 to-purple-700/5", border: "border-purple-500/20"  },
              { label: "Cash Sales",     value: `₹${stats.cashTotal.toLocaleString("en-IN")}`, icon: Banknote,     color: "text-teal-400",    grad: "from-teal-600/15 to-teal-700/5",    border: "border-teal-500/20"    },
              { label: "UPI Sales",      value: `₹${stats.upiTotal.toLocaleString("en-IN")}`,  icon: Smartphone,   color: "text-cyan-400",    grad: "from-cyan-600/15 to-cyan-700/5",    border: "border-cyan-500/20"    },
            ].map(({ label, value, icon: Icon, color, grad, border }) => (
              <div key={label}
                className={`bg-gradient-to-br ${grad} border ${border} rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:scale-[1.02] transition-transform`}>
                <Icon size={18} className={`${color} flex-shrink-0`} />
                <div className="min-w-0">
                  <div className={`text-lg font-black ${color} truncate`}>{value}</div>
                  <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-4 space-y-4">

        {/* ── FILTER BAR ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Date range */}
            {[
              { label: "From", val: dateFrom, set: setDateFrom },
              { label: "To",   val: dateTo,   set: setDateTo   },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">
                  <span className="flex items-center gap-1"><CalendarDays size={9} /> {label}</span>
                </label>
                <input type="date" value={val} onChange={e => set(e.target.value)}
                  className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]" />
              </div>
            ))}

            {/* Payment mode */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-1.5">
                Payment
              </label>
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
                className="bg-[#111520] border border-[#21293d] text-slate-300 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-blue-500/50 [color-scheme:dark]">
                {["all", "Cash", "Card", "UPI", "Bank Transfer"].map(m => (
                  <option key={m} value={m}>{m === "all" ? "All Modes" : m}</option>
                ))}
              </select>
            </div>

            {/* Apply */}
            <button onClick={() => updateUrl(dateFrom, dateTo, paymentFilter)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-500/20 transition-all">
              Apply
            </button>

            {/* Month nav */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => shiftMonth(-1)}
                className="w-9 h-9 bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-slate-300 rounded-xl flex items-center justify-center transition-all">
                <ChevronLeft size={15} />
              </button>
              <button onClick={goCurrentMonth}
                className="px-3 h-9 bg-[#111520] border border-[#21293d] hover:border-blue-500/30 text-slate-500 hover:text-slate-300 rounded-xl text-xs font-bold transition-all">
                This Month
              </button>
              <button onClick={() => shiftMonth(1)}
                className="w-9 h-9 bg-[#111520] border border-[#21293d] hover:border-slate-600 text-slate-500 hover:text-slate-300 rounded-xl flex items-center justify-center transition-all">
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="flex-1" />

            {/* Payment breakdown pills */}
            <div className="flex items-center gap-1.5">
              {Object.entries(payBreakdown).map(([mode, amt]) => {
                const cfg = getPayConfig(mode);
                const Icon = cfg.icon;
                return (
                  <span key={mode} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    <Icon size={9} /> {mode}: ₹{amt.toLocaleString("en-IN")}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111520] border-b border-[#21293d]">
                {["#", "Date & Code", "Client", "Staff", "Amount", "Payment", "Actions"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 ${
                    i === 4 ? "text-right" : i === 6 ? "text-center" : "text-left"
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#21293d]">
              {sales.map((s, idx) => (
                <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors">

                  {/* # */}
                  <td className="px-4 py-3.5 text-slate-700 text-xs">{idx + 1}</td>

                  {/* Date & Code */}
                  <td className="px-4 py-3.5">
                    <Link href={`/direct-sales/${s.id}/view`}
                        className="text-blue-400 hover:text-blue-300 font-extrabold text-sm transition-colors leading-none">
                      {s.sale_code}
                    </Link>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={9} className="text-slate-700" />
                      <span className="text-[10px] text-slate-600 font-medium">{fmtDateTime(s.date_created)}</span>
                    </div>
                    {s.last_editor_name && (
                      <div className="text-[9px] text-slate-700 mt-0.5">Edited: {s.last_editor_name}</div>
                    )}
                  </td>

                  {/* Client */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-700/30 border border-[#21293d] rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-slate-200 font-semibold text-xs truncate max-w-[140px]" title={s.client_name || "Walk-in"}>
                          {s.client_name || <span className="text-slate-600 italic">Walk-in</span>}
                        </div>
                        {s.client_contact && (
                          <a href={waHref(s)} target="_blank"
                            className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors mt-0.5">
                            <Send size={8} /> {s.client_contact}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Staff */}
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-500 font-medium">{s.staff_name}</span>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-lg font-black text-white">
                      ₹{s.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    {s.remarks && (
                      <div className="text-[10px] text-slate-600 truncate max-w-[100px] ml-auto mt-0.5" title={s.remarks}>
                        {s.remarks}
                      </div>
                    )}
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3.5">
                    <PayBadge mode={s.payment_mode} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1.5">
                      <Link href={`/direct-sales/${s.id}/view`}
                        className="p-1.5 bg-[#21293d] hover:bg-blue-600/30 border border-[#21293d] hover:border-blue-500/40 rounded-lg text-slate-600 hover:text-blue-400 transition-all" title="View">
                        <Eye size={13} />
                      </Link>
                      <Link href={`/direct-sales/${s.id}/edit`}
                        className="p-1.5 bg-[#21293d] hover:bg-amber-600/20 border border-[#21293d] hover:border-amber-500/40 rounded-lg text-slate-600 hover:text-amber-400 transition-all" title="Edit">
                        <Edit3 size={13} />
                      </Link>
                      <button onClick={() => handleDelete(s.id)}
                        className="p-1.5 bg-[#21293d] hover:bg-red-600/20 border border-[#21293d] hover:border-red-500/40 rounded-lg text-slate-600 hover:text-red-400 transition-all" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <ShoppingBag size={36} className="mx-auto text-slate-800 mb-3" />
                    <p className="text-slate-600 font-bold text-sm">No sales in this period</p>
                    <p className="text-slate-700 text-xs mt-1">Try changing the date range or filters</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer totals */}
            {sales.length > 0 && (
              <tfoot>
                <tr className="bg-[#111520] border-t border-[#21293d]">
                  <td colSpan={4} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    {sales.length} sales · {formatIST(dateFrom, { day: "2-digit", month: "short" })} → {formatIST(dateTo, { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400 text-base">
                    ₹{stats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="px-4 py-3 text-xs text-slate-600 font-bold">
                    Avg: ₹{stats.avgAmount.toFixed(0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      </div>
    </div>
  );
}

export default function DirectSalesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <DirectSalesPageInner />
    </Suspense>
  );
}