"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  Users, UserPlus, Search, Phone, MapPin, Mail,
  Eye, Edit3, Trash2, Loader2, ShieldCheck,
  MessageCircle, TrendingUp, AlertTriangle, CheckCircle,
  RotateCcw, IndianRupee, Printer, FileSpreadsheet, X,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronUp, ChevronDown,
  Zap, Filter, SlidersHorizontal, Star, Clock, Wallet,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type Client = {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  date_created: string;
  opening_balance: number;
  repair_billed: number;
  direct_sales_billed: number;
  total_loan_given: number;
  total_paid: number;
  balance: number;
  last_txn_date: string | null;
};

type SortField = "name" | "balance" | "date_created" | "total_paid";
type SortDir   = "asc" | "desc";
type TabFilter = "all" | "due" | "high" | "clear" | "followup";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr   = (v: number) =>
  "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : 999;

function getBalanceMeta(balance: number, lastTxnDate: string | null) {
  if (balance > 50_000) return {
    rowCls : "bg-red-50 border-l-[3px] border-red-500",
    badge  : "bg-red-100 text-red-700 border-red-200",
    dot    : "bg-red-500",
    label  : "Very High",
    waType : "reminder",
  };
  if (balance > 20_000) return {
    rowCls : "bg-orange-50 border-l-[3px] border-orange-400",
    badge  : "bg-orange-100 text-orange-700 border-orange-200",
    dot    : "bg-orange-400",
    label  : "High",
    waType : "reminder",
  };
  if (balance > 0) return {
    rowCls : "border-l-[3px] border-yellow-300",
    badge  : "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot    : "bg-yellow-400",
    label  : "Pending",
    waType : "reminder",
  };
  if (daysSince(lastTxnDate) > 30) return {
    rowCls : "",
    badge  : "bg-teal-50 text-teal-700 border-teal-200",
    dot    : "bg-teal-400",
    label  : "Follow-up",
    waType : "followup",
  };
  return {
    rowCls : "",
    badge  : "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot    : "bg-emerald-400",
    label  : "Clear",
    waType : "welcome",
  };
}

// ─── WhatsApp Templates ───────────────────────────────────────────────────────
const FIRM = { name: "V-Technologies", phone: "9179105875", address: "Jabalpur, MP", owner: "Vikram Jain" };

const WA = {
  welcome:  (n: string) =>
    `नमस्ते ${n} जी! 🙏\n\n${FIRM.name} में आपका स्वागत है! 🛠️✨\n\n🔧 SMPS / Power Supply Repair\n🔧 Stage Light Repair\n🔧 DMX Controller Repair\n\n🎯 जेनुइन पार्ट्स • एक्सपर्ट टेक्नीशियन • किफायती मूल्य\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`,
  reminder: (n: string, bal: number) =>
    `नमस्ते ${n} जी! 🙏\n\nआपका बकाया बैलेंस *${inr(bal)}* है।\n\nकृपया शीघ्र भुगतान करने का कष्ट करें।\n\n🔸 Payment Methods:\n• Cash (Shop पर)\n• UPI / Google Pay\n• Bank Transfer\n\n📞 ${FIRM.phone}\n\nधन्यवाद,\n${FIRM.owner}`,
  followup: (n: string) =>
    `नमस्ते ${n} जी! 🙏\n\n${FIRM.name} से आपकी याद आई! 🤗\n\n🎁 पुराने ग्राहकों के लिए विशेष ऑफर: 15% छूट!\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`,
  offer:    (n: string) =>
    `नमस्ते ${n} जी! 🎉\n\n${FIRM.name} की तरफ से विशेष ऑफर!\n\n🔥 20% OFF — इस महीने तक!\n\n📞 ${FIRM.phone}\nधन्यवाद,\n${FIRM.owner}`,
};

function buildAutoMsg(c: Client): string {
  if (c.balance > 0) return WA.reminder(c.name, c.balance);
  return daysSince(c.last_txn_date) > 30 ? WA.followup(c.name) : WA.welcome(c.name);
}

// ─── Custom Tooltip for BarChart ──────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-black text-blue-600">{inr(payload[0].value)}</p>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function ClientsPage() {
  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [userRole,  setUserRole]  = useState<string>("staff");
  const [isMobile,  setIsMobile]  = useState(false);

  // ── Filters & Sort ─────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [minBal,     setMinBal]     = useState("");
  const [maxBal,     setMaxBal]     = useState("");
  const [tabFilter,  setTabFilter]  = useState<TabFilter>("all");
  const [sortField,  setSortField]  = useState<SortField>("balance");
  const [sortDir,    setSortDir]    = useState<SortDir>("desc");
  const [showFilter, setShowFilter] = useState(false);

  // ── WhatsApp modal ─────────────────────────────────────────────────────────
  const [waModal,   setWaModal]   = useState(false);
  const [waClient,  setWaClient]  = useState<Client | null>(null);
  const [waMsgType, setWaMsgType] = useState<"welcome"|"reminder"|"followup"|"offer"|"custom">("welcome");
  const [waText,    setWaText]    = useState("");

  // ── Client detail drawer ───────────────────────────────────────────────────
  const [drawerClient, setDrawerClient] = useState<Client | null>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // PHP balance formula:
  //   balance = opening_balance + repair_billed + direct_sales + active_loans - payments_paid
  // KEY: transaction_list.client_name stores client ID as string → parseInt() before lookup
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cls } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance")
        .eq("delete_flag", 0);
      if (!cls?.length) { setClients([]); return; }

      const ids = cls.map((c) => c.id);

      const [
        { data: repairs },
        { data: dirSales },
        { data: payments },
        { data: loans },
        { data: lastTxns },
      ] = await Promise.all([
        supabase.from("transaction_list").select("client_name, amount").eq("status", 5),
        supabase.from("direct_sales").select("client_id, total_amount").in("client_id", ids),
        supabase.from("client_payments").select("client_id, amount, discount").in("client_id", ids),
        supabase.from("client_loans").select("client_id, total_payable").eq("status", 1).in("client_id", ids),
        supabase.from("transaction_list").select("client_name, date_created"),
      ]);

      // Aggregate maps
      const repMap:  Record<number, number> = {};
      repairs?.forEach((r) => {
        const cid = parseInt(r.client_name ?? "", 10);
        if (!isNaN(cid)) repMap[cid] = (repMap[cid] || 0) + toNum(r.amount);
      });

      const dirMap: Record<number, number> = {};
      dirSales?.forEach((d) => {
        if (d.client_id) dirMap[d.client_id] = (dirMap[d.client_id] || 0) + toNum(d.total_amount);
      });

      const payMap: Record<number, number> = {};
      payments?.forEach((p) => {
        payMap[p.client_id] = (payMap[p.client_id] || 0) + toNum(p.amount) + toNum(p.discount);
      });

      const loanMap: Record<number, number> = {};
      loans?.forEach((l) => {
        if (l.client_id) loanMap[l.client_id] = (loanMap[l.client_id] || 0) + toNum(l.total_payable);
      });

      const lastTxnMap: Record<number, string> = {};
      lastTxns?.forEach((t) => {
        const cid = parseInt(t.client_name ?? "", 10);
        if (!isNaN(cid) && t.date_created) {
          if (!lastTxnMap[cid] || t.date_created > lastTxnMap[cid])
            lastTxnMap[cid] = t.date_created;
        }
      });

      const built: Client[] = cls.map((c) => {
        const ob   = toNum(c.opening_balance);
        const rep  = repMap[c.id]  ?? 0;
        const dir  = dirMap[c.id]  ?? 0;
        const loan = loanMap[c.id] ?? 0;
        const paid = payMap[c.id]  ?? 0;
        return {
          id: c.id,
          name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
          contact: c.contact || "", email: c.email || "",
          address: c.address || "", date_created: c.date_created || "",
          opening_balance: ob, repair_billed: rep,
          direct_sales_billed: dir, total_loan_given: loan,
          total_paid: paid, balance: ob + rep + dir + loan - paid,
          last_txn_date: lastTxnMap[c.id] || null,
        };
      });

      built.sort((a, b) => b.balance - a.balance);
      setClients(built);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Permission Denied: Sirf Admin hi delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna chahte hain?`)) return;
    const { error } = await supabase.from("client_list").update({ delete_flag: 1 }).eq("id", id);
    if (!error) setClients((p) => p.filter((c) => c.id !== id));
    else alert("Delete nahi ho paya!");
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const [pageSize,    setPageSize]    = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 when filters/search change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, minBal, maxBal, tabFilter, sortField, sortDir]);

  // ── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const openWaModal = (client: Client) => {
    const autoType = client.balance > 0 ? "reminder" : daysSince(client.last_txn_date) > 30 ? "followup" : "welcome";
    setWaClient(client); setWaMsgType(autoType as any); setWaText(buildAutoMsg(client)); setWaModal(true);
  };
  const handleWaTypeChange = (type: typeof waMsgType) => {
    if (!waClient) return; setWaMsgType(type);
    setWaText(
      type === "welcome"  ? WA.welcome(waClient.name)
      : type === "reminder" ? WA.reminder(waClient.name, waClient.balance)
      : type === "followup" ? WA.followup(waClient.name)
      : type === "offer"    ? WA.offer(waClient.name)
      : waText
    );
  };
  const sendWhatsApp = () => {
    if (!waClient?.contact) { alert("Phone number nahi hai!"); return; }
    window.open(`https://wa.me/91${waClient.contact.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`, "_blank");
    setWaModal(false);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const printReport = () => {
    const w = window.open("", "_blank")!;
    w.document.write(`<html><head><title>Client List</title>
    <style>body{font-family:Arial;margin:20px}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:8px}th{background:#f2f2f2}
    .red{color:red;font-weight:bold}.green{color:green;font-weight:bold}</style></head><body>
    <h2>Client List — ${new Date().toLocaleDateString("en-IN")}</h2>
    <table><thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Email</th><th>Address</th><th>Balance</th></tr></thead>
    <tbody>${filteredSortedClients.map((c, i) => `<tr>
      <td>${i+1}</td><td>${c.name}</td><td>${c.contact}</td>
      <td>${c.email}</td><td>${c.address}</td>
      <td class="${c.balance > 0 ? "red" : "green"}">${inr(c.balance)}</td>
    </tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="5"><b>Total Outstanding:</b></td><td class="red"><b>${inr(totalOutstanding)}</b></td></tr></tfoot>
    </table></body></html>`);
    w.document.close(); w.print();
  };

  const exportExcel = () => {
    const rows = [
      ["#","Name","Contact","Email","Address","Opening","Repairs","Direct","Loans","Paid","Balance"],
      ...filteredSortedClients.map((c,i) => [
        i+1, c.name, c.contact, c.email, c.address,
        c.opening_balance, c.repair_billed, c.direct_sales_billed,
        c.total_loan_given, c.total_paid, c.balance,
      ]),
    ];
    const html = `<table>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    a.download = `clients_${new Date().toISOString().slice(0,10)}.xls`;
    a.click();
  };

  // ── Filtered + Sorted list ─────────────────────────────────────────────────
  const filteredSortedClients = useMemo(() => {
    const s  = searchTerm.toLowerCase().trim();
    const lo = minBal !== "" ? parseFloat(minBal) : -Infinity;
    const hi = maxBal !== "" ? parseFloat(maxBal) :  Infinity;

    let list = clients.filter((c) => {
      const matchSearch =
        !s || c.name.toLowerCase().includes(s) || c.contact.includes(s) ||
        c.email.toLowerCase().includes(s) || c.address.toLowerCase().includes(s);
      const matchBal = c.balance >= lo && c.balance <= hi;
      const matchTab =
        tabFilter === "all"     ? true
        : tabFilter === "due"   ? c.balance > 0
        : tabFilter === "high"  ? c.balance > 20_000
        : tabFilter === "clear" ? c.balance <= 0 && daysSince(c.last_txn_date) <= 30
        : /* followup */          c.balance <= 0 && daysSince(c.last_txn_date) > 30;
      return matchSearch && matchBal && matchTab;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")         cmp = a.name.localeCompare(b.name);
      else if (sortField === "balance") cmp = a.balance - b.balance;
      else if (sortField === "date_created") cmp = (a.date_created || "").localeCompare(b.date_created || "");
      else if (sortField === "total_paid")   cmp = a.total_paid - b.total_paid;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, searchTerm, minBal, maxBal, tabFilter, sortField, sortDir]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalOutstanding = useMemo(() => clients.reduce((s,c) => s + (c.balance > 0 ? c.balance : 0), 0), [clients]);
  const totalCleared     = useMemo(() => clients.filter(c => c.balance <= 0).length,  [clients]);
  const clientsWithDue   = useMemo(() => clients.filter(c => c.balance > 0).length,    [clients]);
  const highRiskCount    = useMemo(() => clients.filter(c => c.balance > 20_000).length, [clients]);
  const followupCount    = useMemo(() => clients.filter(c => c.balance <= 0 && daysSince(c.last_txn_date) > 30).length, [clients]);

  // ── Bar chart data (top 8 by balance) ─────────────────────────────────────
  const chartData = useMemo(() =>
    [...clients].filter(c => c.balance > 0)
      .sort((a,b) => b.balance - a.balance)
      .slice(0, 8)
      .map(c => ({ name: c.name.split(" ")[0], balance: c.balance, full: c.name })),
    [clients]
  );

  const CHART_COLORS = ["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#06b6d4","#3b82f6"];

  // ── Paginated slice ────────────────────────────────────────────────────────
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredSortedClients.length / pageSize);
  const paginatedClients = useMemo(() => {
    if (pageSize === 0) return filteredSortedClients; // "All"
    const start = (currentPage - 1) * pageSize;
    return filteredSortedClients.slice(start, start + pageSize);
  }, [filteredSortedClients, pageSize, currentPage]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-300" />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="text-blue-500" />
      : <ArrowDown size={12} className="text-blue-500" />;
  };

  // ──────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">Loading Customers…</p>
    </div>
  );

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const tabs: { id: TabFilter; label: string; count: number; color: string }[] = [
    { id: "all",     label: "All",       count: clients.length,  color: "blue"    },
    { id: "due",     label: "Due",       count: clientsWithDue,  color: "red"     },
    { id: "high",    label: "High Risk", count: highRiskCount,   color: "orange"  },
    { id: "clear",   label: "Clear",     count: totalCleared,    color: "emerald" },
    { id: "followup",label: "Follow-up", count: followupCount,   color: "teal"    },
  ];

  const tabColorMap: Record<string, string> = {
    blue:    "border-blue-600 text-blue-600 bg-blue-50",
    red:     "border-red-500 text-red-600 bg-red-50",
    orange:  "border-orange-500 text-orange-600 bg-orange-50",
    emerald: "border-emerald-500 text-emerald-600 bg-emerald-50",
    teal:    "border-teal-500 text-teal-600 bg-teal-50",
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ━━━━━━ HEADER — same as dashboard ━━━━━━ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Users className="text-white" size={32} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                  Customer Registry
                </h1>
                {userRole === "admin" && <ShieldCheck className="text-emerald-500" size={22} />}
              </div>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                {userRole === "admin" ? "Admin Mode" : "Staff View"} &nbsp;|&nbsp; {clients.length} Clients Registered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={printReport}
              className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-700 rounded-[1.5rem] font-bold text-sm transition cursor-pointer">
              <Printer size={16} /> Print
            </button>
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-gray-300 hover:bg-emerald-50 text-emerald-700 rounded-[1.5rem] font-bold text-sm transition cursor-pointer">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <Link href="/clients/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-[2rem] font-extrabold flex items-center gap-2 transition-all active:scale-95 no-underline uppercase tracking-tight shadow-md shadow-blue-500/20 text-sm">
              <UserPlus size={18} strokeWidth={2.5} /> Add Client
            </Link>
          </div>
        </div>

        {/* ━━━━━━ STAT CARDS — same style as dashboard StatCard ━━━━━━ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Total Clients"    value={clients.length}           icon={<Users size={22}/>}          color="blue"    />
          <StatCard label="With Due Balance" value={clientsWithDue}           icon={<IndianRupee size={22}/>}    color="amber"   />
          <StatCard label="High Risk"        value={highRiskCount}            icon={<AlertTriangle size={22}/>}  color="red"     />
          <StatCard label="Cleared Clients"  value={totalCleared}             icon={<CheckCircle size={22}/>}    color="emerald" />
          <StatCard label="Total Outstanding" value={inr(totalOutstanding)}   icon={<TrendingUp size={22}/>}     color="indigo"  isAmount />
        </div>

        {/* ━━━━━━ TOP DUE CLIENTS — BAR CHART ━━━━━━ */}
        {chartData.length > 0 && (
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                Top Due Clients
              </h3>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                Highest balance first
              </span>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: "#f9fafb" }} />
                  <Bar dataKey="balance" radius={[8,8,0,0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ━━━━━━ TAB FILTER + SEARCH ━━━━━━ */}
        <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab.id}
                onClick={() => setTabFilter(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold uppercase tracking-wide border-2 transition cursor-pointer ${
                  tabFilter === tab.id
                    ? tabColorMap[tab.color]
                    : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
                }`}>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  tabFilter === tab.id ? "bg-white/60" : "bg-gray-100"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Search + Filter toggle */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search name, mobile, email, address…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] outline-none focus:border-blue-500 transition text-sm font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-normal"
              />
            </div>
            <button onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-2 px-5 py-3 rounded-[1.5rem] font-bold text-sm border-2 transition cursor-pointer ${showFilter ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              <SlidersHorizontal size={15} /> Filters {showFilter ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            </button>
            {(searchTerm || minBal || maxBal || tabFilter !== "all") && (
              <button onClick={() => { setSearchTerm(""); setMinBal(""); setMaxBal(""); setTabFilter("all"); }}
                className="flex items-center gap-1.5 px-4 py-3 rounded-[1.5rem] font-bold text-xs border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition cursor-pointer">
                <RotateCcw size={13}/> Reset
              </button>
            )}
            {filteredSortedClients.length !== clients.length && (
              <span className="bg-blue-50 border-2 border-blue-100 text-blue-600 text-xs font-extrabold px-3 py-1.5 rounded-full">
                {filteredSortedClients.length} results
              </span>
            )}
          </div>

          {/* Expanded filters */}
          {showFilter && (
            <div className="flex flex-wrap gap-3 items-end pt-2 border-t-2 border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Balance Range:</label>
                <input type="number" placeholder="Min ₹" value={minBal}
                  onChange={(e) => setMinBal(e.target.value)}
                  className="w-28 px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
                <span className="text-gray-400 font-bold">—</span>
                <input type="number" placeholder="Max ₹" value={maxBal}
                  onChange={(e) => setMaxBal(e.target.value)}
                  className="w-28 px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sort by:</label>
                {(["balance","name","total_paid","date_created"] as SortField[]).map(f => (
                  <button key={f} onClick={() => toggleSort(f)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border-2 transition cursor-pointer ${
                      sortField === f ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600"
                    }`}>
                    {f === "balance" ? "Balance" : f === "name" ? "Name" : f === "total_paid" ? "Paid" : "Date"}
                    {sortField === f && (sortDir === "asc" ? <ArrowUp size={10}/> : <ArrowDown size={10}/>)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ━━━━━━ CONTENT ━━━━━━ */}
        {filteredSortedClients.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-300">
            <Search className="mx-auto mb-3 text-gray-300" size={44} />
            <p className="text-gray-400 font-bold text-sm uppercase tracking-wider">No clients found</p>
          </div>
        ) : isMobile ? (
          /* ─── MOBILE CARDS ──────────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="grid gap-4">
              {paginatedClients.map((client) => {
              const meta = getBalanceMeta(client.balance, client.last_txn_date);
              return (
                <div key={client.id}
                  className={`bg-white rounded-[2rem] border-2 border-gray-300 shadow-md overflow-hidden ${meta.rowCls}`}>
                  {/* Card header */}
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/clients/${client.id}/view`}
                          className="font-black text-gray-900 text-base uppercase tracking-tight no-underline hover:text-blue-600 transition leading-tight">
                          {client.name}
                        </Link>
                        <p className="text-gray-400 text-[10px] font-semibold mt-0.5">ID: {client.id}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="bg-gray-50 p-3.5 rounded-2xl border-2 border-gray-200 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                        <Phone size={13} className="text-blue-500" /> {client.contact || "—"}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                        <Mail size={13} className="text-red-400" />
                        <span className="truncate">{client.email || "No email"}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm font-bold text-gray-600">
                        <MapPin size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="leading-snug">{client.address || "—"}</span>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="bg-gray-50 p-3.5 rounded-2xl border-2 border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Net Balance (incl. Loans)</span>
                        <span className={`text-lg font-black ${client.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {client.balance < 0 ? "−" : ""}{inr(client.balance)}
                        </span>
                      </div>
                      {/* Mini breakdown */}
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] text-gray-500 font-bold">
                        <span>Opening: ₹{client.opening_balance.toLocaleString("en-IN")}</span>
                        <span>Repairs: ₹{client.repair_billed.toLocaleString("en-IN")}</span>
                        <span>Direct: ₹{client.direct_sales_billed.toLocaleString("en-IN")}</span>
                        <span>Loans: ₹{client.total_loan_given.toLocaleString("en-IN")}</span>
                        <span className="text-emerald-600 col-span-2">Paid: −₹{client.total_paid.toLocaleString("en-IN")}</span>
                      </div>
                      {/* Mini progress bar */}
                      {client.balance > 0 && (
                        <div className="mt-2.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (client.balance / 100_000) * 100)}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Last transaction */}
                    {client.last_txn_date && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                        <Clock size={11} />
                        Last visit: {new Date(client.last_txn_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {daysSince(client.last_txn_date) > 30 && (
                          <span className="text-teal-500">({daysSince(client.last_txn_date)}d ago)</span>
                        )}
                      </div>
                    )}

                    {/* WhatsApp */}
                    {client.contact && (
                      <button onClick={() => openWaModal(client)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-extrabold text-sm text-white bg-[#25D366] hover:bg-[#1DA851] transition cursor-pointer active:scale-95">
                        <MessageCircle size={16} />
                        {client.balance > 0 ? "Balance Reminder" : meta.label === "Follow-up" ? "Follow-up" : "Welcome"} — WhatsApp
                      </button>
                    )}

                    {/* Actions */}
                    <div className={`grid gap-2 ${userRole === "admin" ? "grid-cols-3" : "grid-cols-2"}`}>
                      <Link href={`/clients/${client.id}/view`}
                        className="flex flex-col items-center gap-1 p-3 bg-white border-2 border-gray-300 rounded-2xl no-underline text-gray-600 hover:bg-gray-100 transition text-[9px] font-extrabold uppercase tracking-wider active:scale-95">
                        <Eye size={18} /> View
                      </Link>
                      <Link href={`/clients/${client.id}/edit`}
                        className="flex flex-col items-center gap-1 p-3 bg-blue-50 border-2 border-blue-200 rounded-2xl no-underline text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition text-[9px] font-extrabold uppercase tracking-wider active:scale-95">
                        <Edit3 size={18} /> Edit
                      </Link>
                      {userRole === "admin" && (
                        <button onClick={() => handleDelete(client.id, client.name)}
                          className="flex flex-col items-center gap-1 p-3 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition text-[9px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95">
                          <Trash2 size={18} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Mobile pagination */}
          {pageSize !== 0 && totalPages > 1 && (
            <div key="mob-pag" className="flex items-center justify-between bg-white rounded-[2rem] border-2 border-gray-300 shadow-md p-4 flex-wrap gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 cursor-pointer">
                  ‹ Prev
                </button>
                <span className="text-xs font-extrabold text-gray-600 px-2">
                  {currentPage} / {totalPages}
                </span>
                <button onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
                  className="px-3 py-2 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 cursor-pointer">
                  Next ›
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[10,25,50,0].map(n=>(
                  <button key={n} onClick={()=>{setPageSize(n);setCurrentPage(1);}}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold border-2 cursor-pointer transition ${pageSize===n?"bg-blue-600 border-blue-600 text-white":"bg-white border-gray-200 text-gray-600"}`}>
                    {n===0?"All":n}
                  </button>
                ))}
              </div>
            </div>
          )
          }
          </div>
        ) : (
          /* ─── DESKTOP TABLE ─────────────────────────────────────────────── */
          <div className="bg-white rounded-[2.5rem] border-2 border-gray-300 shadow-md overflow-hidden">

            {/* ── Page-size + info bar ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-gray-100 bg-gray-50/60 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Show</span>
                {[10, 25, 50, 100, 0].map((n) => (
                  <button key={n}
                    onClick={() => { setPageSize(n); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer ${
                      pageSize === n
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                    }`}>
                    {n === 0 ? "All" : n}
                  </button>
                ))}
                <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">entries</span>
              </div>
              <div className="text-[11px] font-bold text-gray-400">
                {pageSize === 0
                  ? `Showing all ${filteredSortedClients.length} entries`
                  : `Showing ${Math.min((currentPage-1)*pageSize+1, filteredSortedClients.length)}–${Math.min(currentPage*pageSize, filteredSortedClients.length)} of ${filteredSortedClients.length}`
                }
              </div>
            </div>

            {/* ─── 6-column table: # | Client+ID+Mobile+WA | Address | Balance | Last Txn | Actions▼ ─── */}
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  {([
                    { key:"#",        field:null,           w:"w-[4%]"  },
                    { key:"Client",   field:"name",         w:"w-[30%]" },
                    { key:"Address",  field:null,           w:"w-[22%]" },
                    { key:"Balance",  field:"balance",      w:"w-[18%]" },
                    { key:"Last Txn", field:"date_created", w:"w-[12%]" },
                    { key:"Actions",  field:null,           w:"w-[14%]" },
                  ] as {key:string;field:string|null;w:string}[]).map(({ key, field, w }) => (
                    <th key={key}
                      onClick={() => field && toggleSort(field as SortField)}
                      className={`${w} px-3 py-3 text-left text-[10px] font-extrabold text-gray-500 uppercase tracking-wider ${field ? "cursor-pointer hover:text-blue-600 transition select-none" : ""}`}>
                      <div className="flex items-center gap-1">
                        {key}
                        {field && <SortIcon field={field as SortField} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginatedClients.map((client, i) => {
                  const meta   = getBalanceMeta(client.balance, client.last_txn_date);
                  const rowNum = pageSize === 0 ? i + 1 : (currentPage - 1) * pageSize + i + 1;
                  return (
                    <tr key={client.id}
                      className={`hover:bg-blue-50/30 transition-colors ${meta.rowCls}`}>

                      {/* ── # ── */}
                      <td className="px-3 py-3 text-xs text-gray-400 font-bold">{rowNum}</td>

                      {/* ── Client: Name · ID · Mobile · WA button ── */}
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className={`w-2 h-2 flex-shrink-0 rounded-full mt-1 ${meta.dot}`} />
                          <div className="min-w-0 w-full">
                            {/* Name */}
                            <Link href={`/clients/${client.id}/view`}
                              className="font-extrabold text-blue-600 hover:text-blue-800 no-underline tracking-tight transition block truncate text-sm leading-tight">
                              {client.name}
                            </Link>
                            {/* ID + Mobile on one line */}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-gray-400 font-bold">#{client.id}</span>
                              {client.contact && (
                                <span className="text-[10px] font-bold text-gray-600 flex items-center gap-0.5">
                                  <Phone size={9} className="text-blue-400" />{client.contact}
                                </span>
                              )}
                            </div>
                            {/* Status badge + WA button on one line */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${meta.badge}`}>
                                {meta.label}
                              </span>
                              {client.contact && (
                                <button onClick={() => openWaModal(client)}
                                  className="flex items-center gap-0.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full text-white bg-[#25D366] hover:bg-[#1DA851] transition cursor-pointer whitespace-nowrap">
                                  <MessageCircle size={9} />
                                  {client.balance > 0 ? "Reminder" : meta.label === "Follow-up" ? "Follow-up" : "Welcome"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ── Address ── */}
                      <td className="px-3 py-3 text-xs text-gray-500 font-bold">
                        <span className="block truncate" title={client.address}>{client.address || "—"}</span>
                        {client.email && (
                          <span className="block truncate text-[10px] text-gray-400 mt-0.5" title={client.email}>
                            <Mail size={9} className="inline mr-0.5 text-red-300" />{client.email}
                          </span>
                        )}
                      </td>

                      {/* ── Net Balance + progress bar ── */}
                      <td className="px-3 py-3">
                        <div className={`font-black text-sm ${client.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {client.balance < 0 ? "−" : ""}{inr(client.balance)}
                        </div>
                        {client.balance > 0 ? (
                          <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden w-full">
                            <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all"
                              style={{ width:`${Math.min(100,(client.balance/100_000)*100)}%` }} />
                          </div>
                        ) : (
                          <span className="text-[9px] text-emerald-500 font-bold">Cleared ✓</span>
                        )}
                      </td>

                      {/* ── Last transaction ── */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {client.last_txn_date ? (
                          <>
                            <div className="text-xs font-bold text-gray-700">
                              {new Date(client.last_txn_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"})}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 ${daysSince(client.last_txn_date)>30?"text-teal-500":"text-gray-400"}`}>
                              {daysSince(client.last_txn_date)}d ago
                            </div>
                          </>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* ── Actions — dropdown menu ── */}
                      <td className="px-3 py-3">
                        <ActionDropdown
                          clientId={client.id}
                          clientName={client.name}
                          userRole={userRole}
                          onDelete={() => handleDelete(client.id, client.name)}
                          onWhatsApp={() => openWaModal(client)}
                          hasContact={!!client.contact}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* ── Footer ── */}
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-right text-[11px] font-extrabold text-gray-500 uppercase tracking-wide">
                    This page:
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm font-black text-red-500">
                      {inr(paginatedClients.reduce((s,c)=>s+(c.balance>0?c.balance:0),0))}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-[11px] font-extrabold text-gray-500 uppercase tracking-wide">
                    All clients:
                  </td>
                  <td colSpan={2} className="px-3 py-3">
                    <span className="text-sm font-black text-red-600">{inr(totalOutstanding)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* ── Pagination controls ── */}
            {pageSize !== 0 && totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t-2 border-gray-100 bg-gray-50/60 flex-wrap gap-3">
                {/* Prev / page numbers / Next */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer">
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p-1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer">
                    ‹ Prev
                  </button>

                  {/* Page number buttons — show max 7 */}
                  {(() => {
                    const pages: (number|"...")[] = [];
                    if (totalPages <= 7) {
                      for (let i=1;i<=totalPages;i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push("...");
                      for (let i=Math.max(2,currentPage-1); i<=Math.min(totalPages-1,currentPage+1); i++) pages.push(i);
                      if (currentPage < totalPages-2) pages.push("...");
                      pages.push(totalPages);
                    }
                    return pages.map((p, idx) =>
                      p === "..." ? (
                        <span key={`e${idx}`} className="px-2 text-gray-400 text-xs font-bold">…</span>
                      ) : (
                        <button key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={`w-8 h-8 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer ${
                            currentPage === p
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300"
                          }`}>
                          {p}
                        </button>
                      )
                    );
                  })()}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer">
                    Next ›
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-2 border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition cursor-pointer">
                    »
                  </button>
                </div>

                {/* Jump to page */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400">Go to page:</span>
                  <input
                    type="number" min={1} max={totalPages}
                    defaultValue={currentPage}
                    key={currentPage}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt((e.target as HTMLInputElement).value);
                        if (v >= 1 && v <= totalPages) setCurrentPage(v);
                      }
                    }}
                    className="w-14 px-2 py-1.5 border-2 border-gray-200 rounded-xl text-xs font-bold text-center outline-none focus:border-blue-400 transition"
                  />
                  <span className="text-[11px] font-bold text-gray-400">of {totalPages}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ━━━━━━ WHATSAPP MODAL ━━━━━━ */}
      {waModal && waClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#25D366]">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-white" size={22} />
                <span className="text-white font-black text-base">WhatsApp Message</span>
              </div>
              <button onClick={() => setWaModal(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-xl transition cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border-2 border-gray-200">
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Client</p>
                  <p className="font-extrabold text-gray-900 text-sm mt-0.5">{waClient.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Balance</p>
                  <p className={`font-extrabold text-sm mt-0.5 ${waClient.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {inr(waClient.balance)}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1.5">Message Type</label>
                <select value={waMsgType} onChange={(e) => handleWaTypeChange(e.target.value as typeof waMsgType)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-green-400 transition">
                  <option value="welcome">Welcome Message</option>
                  <option value="reminder">Balance Reminder</option>
                  <option value="followup">Follow-up Message</option>
                  <option value="offer">Special Offer</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1.5">Message</label>
                <textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={8}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-green-400 transition resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { navigator.clipboard.writeText(waText); }}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-2xl font-extrabold text-sm text-gray-700 hover:bg-gray-50 transition cursor-pointer">
                  Copy
                </button>
                <button onClick={sendWhatsApp}
                  className="flex-1 py-3 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer active:scale-95">
                  <MessageCircle size={16} /> Open WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ActionDropdown — compact 3-dot menu ─────────────────────────────────────
function ActionDropdown({ clientId, clientName, userRole, onDelete, onWhatsApp, hasContact }: {
  clientId: number; clientName: string; userRole: string;
  onDelete: () => void; onWhatsApp: () => void; hasContact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
    { icon: <Eye size={13} />,        label: "View Details",  href: `/clients/${clientId}/view`,  color: "text-gray-700" },
    { icon: <Edit3 size={13} />,      label: "Edit Client",   href: `/clients/${clientId}/edit`,  color: "text-blue-600" },
    { icon: <IndianRupee size={13} />,label: "Add Payment",   href: `/clients/${clientId}/payment`, color: "text-emerald-600" },
    ...(hasContact ? [{ icon: <MessageCircle size={13} />, label: "WhatsApp", href: null, color: "text-[#25D366]", action: onWhatsApp }] : []),
    ...(userRole === "admin" ? [{ icon: <Trash2 size={13} />, label: "Delete", href: null, color: "text-red-500", action: onDelete }] : []),
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer select-none ${
          open ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
        }`}>
        Actions
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-44 bg-white rounded-2xl border-2 border-gray-200 shadow-xl overflow-hidden"
          style={{ top: "100%" }}>
          {items.map((item, idx) =>
            item.href ? (
              <Link key={idx} href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold ${item.color} hover:bg-gray-50 no-underline transition border-b border-gray-100 last:border-0`}>
                {item.icon}{item.label}
              </Link>
            ) : (
              <button key={idx}
                onClick={() => { setOpen(false); item.action?.(); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold ${item.color} hover:bg-gray-50 transition border-b border-gray-100 last:border-0 cursor-pointer`}>
                {item.icon}{item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── StatCard — same as dashboard ────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; border: string; icon: string; val: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-600",   val: "text-gray-900" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-200",  icon: "text-amber-600",  val: "text-gray-900" },
  red:    { bg: "bg-red-50",    border: "border-red-200",    icon: "text-red-600",    val: "text-gray-900" },
  emerald:{ bg: "bg-emerald-50",border: "border-emerald-200",icon: "text-emerald-600",val: "text-gray-900" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-200", icon: "text-indigo-600", val: "text-gray-900" },
};

function StatCard({ label, value, icon, color, isAmount = false }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; isAmount?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className="bg-white p-5 rounded-[2rem] border-2 border-gray-300 shadow-md flex items-center gap-4 transition-transform hover:-translate-y-1 duration-300">
      <div className={`p-3.5 rounded-2xl ${c.bg} border-2 ${c.border} shadow-inner`}>
        <div className={c.icon}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 leading-none mb-1 truncate">{label}</p>
        <div className={`${isAmount ? "text-xl" : "text-3xl"} font-extrabold italic ${c.val} tracking-tight leading-tight`}>
          {value}
        </div>
      </div>
    </div>
  );
}