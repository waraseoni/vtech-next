"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  Package,
  Users,
  TrendingUp,
  IndianRupee,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  MessageCircle,
  X,
  Filter,
  CheckCircle2,
  Receipt,
  CheckSquare,
  Search,
  Calendar,
  Truck,
  Wrench,
  Clock,
} from "lucide-react";
import { todayIST, formatIST } from "@/lib/dateUtils";
import SearchableSelect from "@/components/SearchableSelect";
import { safeImageSrc } from "@/lib/image-utils";
import { resolveTemplate, substituteTemplate, firmVars } from "@/lib/whatsapp";

type Transaction = {
  id: number;
  job_id: string;
  date_completed: string;
  item: string;
  amount: number;
  client_id: number;
  client_name: string;
  client_contact: string;
  client_image: string | null;
  mechanic_name: string;
  mechanic_image: string | null;
  opening_balance: number;
};

type ClientTotals = {
  billed: number;
  paid: number;
  sales: number;
};

type Props = {
  fromDate?: string;
  toDate?: string;
  clientId?: string;
};

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const inrShort = (n: number) =>
  "₹" + Math.round(n || 0).toLocaleString("en-IN");

const clientInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const ClientAvatar = ({
  image,
  name,
  cls = "w-8 h-8 text-xs",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) => {
  const src = safeImageSrc(image);
  return src ? (
    <Image
      src={src}
      alt={name}
      width={32}
      height={32}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-violet-500/20 shadow-sm`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-violet-600/30 to-purple-600/30 border border-violet-500/30 rounded-full flex items-center justify-center font-bold text-violet-400 flex-shrink-0 shadow-inner`}
    >
      {clientInitials(name)}
    </div>
  );
};

const mechInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || name.charAt(0);

const MechAvatar = ({
  image,
  name,
  cls = "w-6 h-6 text-[9px]",
}: {
  image?: string | null;
  name: string;
  cls?: string;
}) => {
  const src = safeImageSrc(image);
  return src ? (
    <Image
      src={src}
      alt={name}
      width={24}
      height={24}
      className={`${cls} rounded-full object-cover flex-shrink-0 border border-white/10 ring-1 ring-blue-500/20 shadow-sm`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className={`${cls} bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0 shadow-inner`}
    >
      {mechInitials(name)}
    </div>
  );
};

export default function DeliveredReportClient({ fromDate, toDate, clientId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clientsList, setClientsList] = useState<{ id: number; name: string }[]>([]);
  const [from, setFrom] = useState(fromDate || todayIST());
  const [to, setTo] = useState(toDate || todayIST());
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || "all");
  const [clientTotals, setClientTotals] = useState<Record<number, ClientTotals>>({});
  const [showDetailModal, setShowDetailModal] = useState<Transaction | null>(null);
  const [firmInfo, setFirmInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    setFrom(fromDate || todayIST());
    setTo(toDate || todayIST());
    setSelectedClientId(clientId || "all");
  }, [fromDate, toDate, clientId]);

  const stats = useMemo(() => {
    const count = transactions.length;
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const unique = new Set(transactions.map((t) => t.client_id)).size;
    const avg = count > 0 ? total / count : 0;
    const openings: Record<number, number> = {};
    transactions.forEach((t) => { openings[t.client_id] = t.opening_balance; });
    const totalBalance = Object.entries(clientTotals).reduce((s, [idStr, ct]) => {
      const id = Number(idStr);
      return s + (openings[id] || 0) + ct.billed + ct.sales - ct.paid;
    }, 0);
    return { count, total, unique, avg, totalBalance };
  }, [transactions, clientTotals]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname")
        .order("firstname");
      if (data) {
        setClientsList(
          data.map((c) => ({
            id: c.id,
            name: `${c.firstname} ${c.middlename || ""} ${c.lastname || ""}`
              .replace(/\s+/g, " ")
              .trim(),
          }))
        );
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
      const info: Record<string, string> = {};
      (sys || []).forEach((r) => { info[r.meta_field] = r.meta_value; });
      setFirmInfo(info);
    })();
  }, []);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const startDate = `${from}T00:00:00+05:30`;
        const endDate = `${to}T23:59:59+05:30`;
        let query = supabase
          .from("transaction_list")
          .select("id, job_id, date_completed, item, amount, client_name, mechanic_id")
          .eq("status", 5)
          .eq("del_status", 0)
          .gte("date_completed", startDate)
          .lte("date_completed", endDate)
          .order("date_completed", { ascending: false });
        if (selectedClientId !== "all") {
          query = query.eq("client_name", parseInt(selectedClientId));
        }
        const { data: txData } = await query;
        if (!txData || txData.length === 0) {
          setTransactions([]);
          setClientTotals({});
          setLoading(false);
          setRefreshing(false);
          return;
        }
        const clientIds = [...new Set(txData.map((t) => t.client_name).filter((id) => id != null))];
        const mechIds = [...new Set(txData.map((t) => t.mechanic_id).filter(Boolean))];
        const [
          { data: clientsData },
          { data: billedData },
          { data: paymentsData },
          { data: salesData },
          { data: mechData },
        ] = await Promise.all([
          clientIds.length > 0
            ? supabase.from("client_list").select("id, firstname, middlename, lastname, contact, opening_balance, image_path").in("id", clientIds)
            : Promise.resolve({ data: [] }),
          clientIds.length > 0
            ? supabase.from("transaction_list").select("client_name, amount").neq("del_status", 1).in("client_name", clientIds)
            : Promise.resolve({ data: [] }),
          clientIds.length > 0
            ? supabase.from("client_payments").select("client_id, amount, discount").in("client_id", clientIds).or("loan_id.is.null,loan_id.eq.0")
            : Promise.resolve({ data: [] }),
          clientIds.length > 0
            ? supabase.from("direct_sales").select("client_id, total_amount").in("client_id", clientIds)
            : Promise.resolve({ data: [] }),
          mechIds.length > 0
            ? supabase.from("mechanic_list").select("id, firstname, lastname, image_path").in("id", mechIds)
            : Promise.resolve({ data: [] }),
        ]);
        const clientMap: Record<number, { name: string; contact: string; opening_balance: number; image_path: string | null }> = {};
        (clientsData || []).forEach((c) => {
          clientMap[c.id] = {
            name: `${c.firstname} ${c.middlename || ""} ${c.lastname || ""}`.replace(/\s+/g, " ").trim(),
            contact: c.contact || "",
            opening_balance: c.opening_balance || 0,
            image_path: c.image_path || null,
          };
        });
        const mechMap: Record<number, { name: string; image_path: string | null }> = {};
        (mechData || []).forEach((m) => {
          mechMap[m.id] = {
            name: `${m.firstname} ${m.lastname}`.trim(),
            image_path: m.image_path || null,
          };
        });
        const billedMap: Record<number, number> = {};
        (billedData || []).forEach((b) => { billedMap[b.client_name] = (billedMap[b.client_name] || 0) + (b.amount || 0); });
        const paidMap: Record<number, number> = {};
        (paymentsData || []).forEach((p) => { paidMap[p.client_id] = (paidMap[p.client_id] || 0) + (p.amount || 0) + (p.discount || 0); });
        const salesMap: Record<number, number> = {};
        (salesData || []).forEach((s) => { salesMap[s.client_id] = (salesMap[s.client_id] || 0) + (s.total_amount || 0); });
        const totals: Record<number, ClientTotals> = {};
        clientIds.forEach((id) => {
          totals[id] = { billed: billedMap[id] || 0, paid: paidMap[id] || 0, sales: salesMap[id] || 0 };
        });
        setClientTotals(totals);
        setTransactions(
          txData.map((t) => {
            const client = clientMap[t.client_name] || { name: "Unknown", contact: "", opening_balance: 0, image_path: null };
            const mech = t.mechanic_id ? mechMap[t.mechanic_id] : null;
            return {
              id: t.id, job_id: t.job_id, date_completed: t.date_completed, item: t.item,
              amount: t.amount || 0, client_id: t.client_name, client_name: client.name,
              client_contact: client.contact, client_image: client.image_path,
              mechanic_name: mech?.name || "Not Assigned", mechanic_image: mech?.image_path || null,
              opening_balance: client.opening_balance,
            };
          })
        );
      } catch (err) { console.error("Error:", err); }
      finally { setLoading(false); setRefreshing(false); }
    },
    [from, to, selectedClientId]
  );

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from_date", from);
    if (to) params.set("to_date", to);
    if (selectedClientId !== "all") params.set("client_id", selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  const goToDay = (direction: "prev" | "next") => {
    const [year, month, day] = from.split("-").map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + (direction === "prev" ? -1 : 1));
    const newFrom = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0"),
    ].join("-");
    setFrom(newFrom);
    setTo(newFrom);
    const params = new URLSearchParams();
    params.set("from_date", newFrom);
    params.set("to_date", newFrom);
    if (selectedClientId !== "all") params.set("client_id", selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  const resetFilter = () => {
    const today = todayIST();
    setSelectedClientId("all");
    setFrom(today);
    setTo(today);
    router.push("/reports/delivered");
  };

  const sendWA = (job: Transaction) => {
    const phone = job.client_contact.replace(/\D/g, "");
    if (phone.length < 10) { alert("Valid mobile number nahi mila!"); return; }
    const tpl = resolveTemplate(firmInfo, "whatsapp_status_delivered");
    const msg = substituteTemplate(tpl, {
      client_name: job.client_name,
      item: job.item,
      job_id: job.job_id,
      amount: job.amount.toLocaleString("en-IN"),
      ...firmVars(firmInfo),
    });
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const getBalanceInfo = (clientId: number, opening: number) => {
    const totals = clientTotals[clientId];
    if (!totals) return null;
    const balance = opening + totals.billed + totals.sales - totals.paid;
    if (balance > 0) return { type: "due", label: "Due", value: balance, color: "red" };
    else if (balance < 0) return { type: "adv", label: "Advance", value: Math.abs(balance), color: "emerald" };
    return { type: "clear", label: "Clear", value: 0, color: "slate" };
  };

  const selectedClientName =
    selectedClientId === "all"
      ? "All Clients"
      : clientsList.find((c) => c.id === parseInt(selectedClientId))?.name || "";

  const dateRangeLabel =
    from === to
      ? formatIST(from, { day: "2-digit", month: "short", year: "numeric" })
      : `${formatIST(from, { day: "2-digit", month: "short" })} - ${formatIST(to, { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-3.5 w-full max-w-[1550px] mx-auto pb-12 px-2 sm:px-3 lg:px-4">
      {/* Top Header Card */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-600/20 border border-white/10 flex-shrink-0">
            <Truck size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                Delivered Report
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {dateRangeLabel}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              {selectedClientName} &bull; {stats.count} delivered items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Link
            href="/reports/daily-done"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-[11px] font-bold text-slate-300 hover:text-white transition-all shadow-sm active:scale-95 no-underline flex-shrink-0"
          >
            <CheckSquare size={12} /> Done
          </Link>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-1.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-blue-400" : ""} />
          </button>
          <button
            onClick={() => window.open(`/api/print-delivered?from=${from}&to=${to}&client_id=${selectedClientId}`, "_blank")}
            className="p-1.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-slate-400 hover:text-white transition-all flex-shrink-0"
            title="Print"
          >
            <Printer size={13} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Delivered</span>
            <Package size={13} className="text-emerald-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">{stats.count}</p>
          <p className="text-[9px] text-slate-500">Total items</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Total Value</span>
            <IndianRupee size={13} className="text-emerald-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-400 tracking-tight">{inrShort(stats.total)}</p>
          <p className="text-[9px] text-slate-500">Billed amount</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Clients</span>
            <Users size={13} className="text-blue-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">{stats.unique}</p>
          <p className="text-[9px] text-slate-500">Unique clients</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Avg Bill</span>
            <TrendingUp size={13} className="text-amber-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-amber-300 tracking-tight">
            {stats.count > 0 ? inrShort(stats.avg) : "₹0"}
          </p>
          <p className="text-[9px] text-slate-500">Per delivery</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-2.5 sm:p-3 shadow-sm">
        <form onSubmit={handleFilter} className="space-y-2.5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            {/* Date Range */}
            <div className="flex items-center justify-between sm:justify-start gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
              <button type="button" onClick={() => goToDay("prev")} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                <ChevronLeft size={15} />
              </button>
              <div className="flex items-center gap-1 px-1">
                <Calendar size={12} className="text-blue-400 flex-shrink-0" />
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-[11px] font-bold text-white outline-none cursor-pointer [color-scheme:dark]" />
                <span className="text-slate-600 text-[10px] mx-0.5">to</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-[11px] font-bold text-white outline-none cursor-pointer [color-scheme:dark]" />
              </div>
              <button type="button" onClick={() => goToDay("next")} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Client Search */}
            <div className="flex-1 min-w-[180px]">
              <SearchableSelect
                value={selectedClientId === "all" ? null : selectedClientId}
                options={clientsList.map((c) => ({ id: c.id, label: c.name }))}
                onSelect={(v) => setSelectedClientId(v || "all")}
                placeholder="All Clients"
                clearLabel="All Clients"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button type="submit" className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all shadow-sm active:scale-95">
                <Filter size={12} /> Apply
              </button>
              <button type="button" onClick={resetFilter} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm active:scale-95">
                <RefreshCw size={11} /> Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-lg w-full">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider select-none">
                <th className="py-2.5 px-3 text-center w-10">#</th>
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Balance</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]/50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-3 px-3"><div className="h-3 bg-slate-800/60 rounded-full w-full"></div></td>
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-3 text-center">
                    <div className="max-w-xs mx-auto text-center space-y-1.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                        <Package size={15} />
                      </div>
                      <p className="text-white font-bold text-xs">No delivered items found</p>
                      <p className="text-slate-500 text-[10px]">Try changing the date range or client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => {
                  const balanceInfo = getBalanceInfo(tx.client_id, tx.opening_balance);
                  return (
                    <tr key={tx.id} className="hover:bg-blue-500/[0.02] transition-colors group">
                      <td className="py-2 px-3 text-center text-slate-500 font-bold text-[10px]">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <Link href={`/jobs/${tx.id}/view`} className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                          #{tx.job_id}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-slate-400">
                        {formatIST(tx.date_completed, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ClientAvatar image={tx.client_image} name={tx.client_name} cls="w-5 h-5 text-[9px]" />
                          <div className="min-w-0">
                            <Link href={`/clients/${tx.client_id}/view`} className="text-white font-bold hover:text-blue-400 transition-colors block truncate max-w-[120px] text-[11px]">
                              {tx.client_name}
                            </Link>
                            <p className="text-[9px] text-slate-500">{tx.client_contact || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[11px] text-slate-300 truncate max-w-[140px] block">{tx.item}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-black text-emerald-400 text-xs">{inr(tx.amount)}</td>
                      <td className="py-2 px-3 text-center">
                        {balanceInfo && (
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[9px] font-bold ${
                            balanceInfo.color === "red" ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : balanceInfo.color === "emerald" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-800/60 text-slate-400 border border-slate-700/50"
                          }`}>
                            {balanceInfo.type === "clear" && <CheckCircle2 size={9} />}
                            {balanceInfo.label}: {inr(balanceInfo.value)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setShowDetailModal(tx)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all" title="View Details">
                            <Eye size={11} />
                          </button>
                          <a href={`/pdf/bill_template.php?job_id=${tx.job_id}`} target="_blank" className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-all" title="Print Bill">
                            <Receipt size={11} />
                          </a>
                          <button onClick={() => sendWA(tx)} className="p-1 text-slate-400 hover:text-green-400 hover:bg-green-500/10 rounded-md transition-all" title="WhatsApp">
                            <MessageCircle size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && transactions.length > 0 && (
              <tfoot>
                <tr className="bg-[#0d1117] border-t border-[#21293d] font-bold text-xs">
                  <td colSpan={5} className="py-2 px-3 text-right uppercase tracking-wider text-slate-400 text-[10px]">
                    Total ({stats.count} items):
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-400 font-black">{inr(stats.total)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 animate-pulse space-y-3">
              <div className="h-5 bg-slate-800/60 rounded-full w-1/2"></div>
              <div className="h-14 bg-slate-800/40 rounded-xl w-full"></div>
            </div>
          ))
        ) : transactions.length === 0 ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 text-center space-y-2">
            <Package size={20} className="text-slate-500 mx-auto" />
            <p className="text-white font-bold text-xs">No delivered items found</p>
            <p className="text-slate-500 text-[11px]">Try changing the date range or client.</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const balanceInfo = getBalanceInfo(tx.client_id, tx.opening_balance);
            return (
              <div key={tx.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-md space-y-3 hover:border-slate-600 transition-all">
                {/* Top Row */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <ClientAvatar image={tx.client_image} name={tx.client_name} cls="w-10 h-10 text-xs" />
                    <div className="min-w-0">
                      <Link href={`/clients/${tx.client_id}/view`} className="text-white font-black text-sm hover:text-blue-400 transition-colors truncate block">
                        {tx.client_name}
                      </Link>
                      <p className="text-[10px] text-slate-400 font-medium truncate">{tx.client_contact || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    <Link href={`/jobs/${tx.id}/view`} className="inline-block text-blue-400 font-black text-[11px] hover:text-blue-300">
                      #{tx.job_id}
                    </Link>
                    <span className="inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Delivered
                    </span>
                    <p className="text-[9px] font-bold text-slate-500 flex items-center gap-1 justify-end">
                      <Clock size={9} />
                      {formatIST(tx.date_completed, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </p>
                  </div>
                </div>

                {/* Inner Box - 4 Corners */}
                <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21293d]/80">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Mechanic</span>
                      <div className="flex items-center gap-1.5">
                        <MechAvatar image={tx.mechanic_image} name={tx.mechanic_name} cls="w-5 h-5 text-[8px]" />
                        <p className="font-bold text-blue-400 text-[11px] truncate max-w-[80px]">{tx.mechanic_name}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Item</span>
                      <p className="font-bold text-slate-300 text-[11px] truncate">{tx.item}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Balance</span>
                      {balanceInfo ? (
                        <p className={`font-black text-[11px] ${
                          balanceInfo.color === "red" ? "text-red-400"
                            : balanceInfo.color === "emerald" ? "text-emerald-400"
                            : "text-slate-400"
                        }`}>
                          {balanceInfo.label}: {inr(balanceInfo.value)}
                        </p>
                      ) : (
                        <p className="font-bold text-slate-500 text-[11px]">—</p>
                      )}
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Amount</span>
                      <p className="font-black text-emerald-400 text-xs">{inr(tx.amount)}</p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Link href={`/jobs/${tx.id}/view`} className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95">
                    <Eye size={13} /> View
                  </Link>
                  <a href={`/pdf/bill_template.php?job_id=${tx.job_id}`} target="_blank" className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-[#0d1117] hover:bg-[#1a2133] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95">
                    <Receipt size={12} /> Bill
                  </a>
                  <button onClick={() => sendWA(tx)} className="flex-1 inline-flex items-center justify-center gap-1 py-2 bg-green-600/10 hover:bg-green-600/20 border border-green-500/20 rounded-xl text-xs font-bold text-green-400 transition-all active:scale-95">
                    <MessageCircle size={12} /> WA
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setShowDetailModal(null)}
        >
          <div className="bg-[#161b27] border border-[#21293d] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="px-4 py-3.5 bg-[#0d1117] border-b border-[#21293d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">Job #{showDetailModal.job_id}</h3>
                  <p className="text-[10px] text-slate-500">Delivery Details</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Client</p>
                  <p className="text-[11px] font-bold text-white mt-0.5 truncate">{showDetailModal.client_name}</p>
                </div>
                <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Contact</p>
                  <p className="text-[11px] font-bold text-white mt-0.5 truncate">{showDetailModal.client_contact || "—"}</p>
                </div>
                <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Date</p>
                  <p className="text-[11px] font-bold text-white mt-0.5">
                    {formatIST(showDetailModal.date_completed, { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Amount</p>
                  <p className="text-[11px] font-black text-emerald-400 mt-0.5">{inr(showDetailModal.amount)}</p>
                </div>
              </div>
              <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Item Details</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{showDetailModal.item}</p>
              </div>
              {(() => {
                const balanceInfo = getBalanceInfo(showDetailModal.client_id, showDetailModal.opening_balance);
                return balanceInfo && (
                  <div className="bg-[#0d1117] p-2.5 rounded-xl border border-[#21293d]/80">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Client Balance</p>
                    <p className={`text-[11px] font-black mt-0.5 ${
                      balanceInfo.color === "red" ? "text-red-400"
                        : balanceInfo.color === "emerald" ? "text-emerald-400"
                        : "text-slate-400"
                    }`}>
                      {balanceInfo.label}: {inr(balanceInfo.value)}
                    </p>
                  </div>
                );
              })()}
              <div className="flex gap-2 pt-1">
                <Link href={`/jobs/${showDetailModal.id}/view`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm">
                  <Eye size={13} /> View Job
                </Link>
                <button onClick={() => sendWA(showDetailModal)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm">
                  <MessageCircle size={13} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
