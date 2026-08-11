"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { todayIST } from "@/lib/dateUtils";
import Link from "next/link";
import Image from "next/image";
import {
  Users, UserPlus, User, Search, Phone, Mail,
  Eye, Edit3, Trash2, Loader2, ShieldCheck,
  MessageCircle, TrendingUp, AlertTriangle, CheckCircle,
  RotateCcw, IndianRupee, Printer, FileSpreadsheet, FileText, X,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, SlidersHorizontal,
  CheckSquare, Square, Send,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type Client = {
  id: number; name: string; contact: string; email: string;
  address: string; date_created: string; opening_balance: number;
  repair_billed: number; direct_sales_billed: number;
  total_loan_given: number; total_paid: number; balance: number;
  last_txn_date: string | null; image_path?: string; login_allowed: boolean;
};
type DbRow = ReturnType<typeof JSON.parse>;
type Queryable = {
  eq: (column: string, value: unknown) => Queryable;
  range: (from: number, to: number) => PromiseLike<{ data: DbRow[] | null; error: unknown }>;
};
type SortField = "name" | "balance" | "date_created" | "total_paid";
type SortDir   = "asc" | "desc";
type TabFilter = "all" | "due" | "high" | "clear" | "followup";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr   = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const daysSince = (d: string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : 999;

function getBalanceMeta(balance: number, lastTxnDate: string | null) {
  if (balance > 50_000) return {
    rowCls: "border-l-[3px] border-red-500 bg-red-500/5",
    badge:  "bg-red-500/20 text-red-400 border-red-500/30",
    dot: "bg-red-500", label: "Very High", waType: "reminder",
  };
  if (balance > 20_000) return {
    rowCls: "border-l-[3px] border-orange-400 bg-orange-400/5",
    badge:  "bg-orange-400/20 text-orange-300 border-orange-400/30",
    dot: "bg-orange-400", label: "High", waType: "reminder",
  };
  if (balance > 0) return {
    rowCls: "border-l-[3px] border-yellow-400 bg-yellow-400/5",
    badge:  "bg-yellow-400/20 text-yellow-300 border-yellow-400/30",
    dot: "bg-yellow-400", label: "Pending", waType: "reminder",
  };
  if (daysSince(lastTxnDate) > 30) return {
    rowCls: "",
    badge:  "bg-teal-400/20 text-teal-300 border-teal-400/30",
    dot: "bg-teal-400", label: "Follow-up", waType: "followup",
  };
  return {
    rowCls: "",
    badge:  "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    dot: "bg-emerald-400", label: "Clear", waType: "welcome",
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

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string | number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2035] border border-[#2e3a55] rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-black text-blue-400">{inr(payload[0].value)}</p>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
export default function ClientsPage() {
  const [clients,    setClients]   = useState<Client[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [userRole,   setUserRole]  = useState<string>("staff");
  const [isMobile,   setIsMobile]  = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [minBal,     setMinBal]     = useState("");
  const [maxBal,     setMaxBal]     = useState("");
  const [tabFilter,  setTabFilter]  = useState<TabFilter>("all");
  const [sortField,  setSortField]  = useState<SortField>("balance");
  const [sortDir,    setSortDir]    = useState<SortDir>("desc");
  const [showFilter, setShowFilter] = useState(false);

  const [waModal,   setWaModal]   = useState(false);
  const [waClient,  setWaClient]  = useState<Client | null>(null);
  const [waMsgType, setWaMsgType] = useState<"welcome"|"reminder"|"followup"|"offer"|"custom">("welcome");
  const [waText,    setWaText]    = useState("");

  // Bulk WhatsApp
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [bulkWaModal, setBulkWaModal] = useState(false);
  const [bulkWaMsgType, setBulkWaMsgType] = useState<"welcome"|"reminder"|"followup"|"offer"|"custom">("custom");
  const [bulkWaText, setBulkWaText] = useState("");

  const [pageSize,    setPageSize]    = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, minBal, maxBal, tabFilter, sortField, sortDir]);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cls } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance, image_path, login_allowed")
        .eq("delete_flag", 0);
      if (!cls?.length) { setClients([]); return; }
      const ids = cls.map((c) => c.id);
      const inBatches = (arr: (number | string)[], size = 400) => {
        const out: (number | string)[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const fetchByClient = async (table: string, select: string, field: string, ids: (number | string)[], extra: (q: Queryable) => Queryable = (q) => q) => {
        const list: DbRow[] = [];
        for (const batch of inBatches(ids)) {
          let page = 0;
          while (true) {
            let q: Queryable = supabase.from(table).select(select).in(field, batch);
            q = extra(q);
            const { data } = await q.range(page * 1000, (page + 1) * 1000 - 1);
            if (data) list.push(...data);
            if (!data || data.length < 1000) break;
            page++;
          }
        }
        return list;
      };

      const [repairs, dirSales, payments, loans, lastTxns] = await Promise.all([
        fetchByClient("transaction_list", "client_name, amount", "client_name", ids.map(String), q => q.eq("status", 5)),
        fetchByClient("direct_sales", "client_id, total_amount", "client_id", ids),
        fetchByClient("client_payments", "client_id, amount, discount", "client_id", ids),
        fetchByClient("client_loans", "client_id, total_payable", "client_id", ids),
        fetchByClient("transaction_list", "client_name, date_created", "client_name", ids.map(String)),
      ]);
      const repMap:  Record<number,number> = {};
      repairs?.forEach((r) => { const cid=parseInt(r.client_name??"",10); if(!isNaN(cid)) repMap[cid]=(repMap[cid]||0)+toNum(r.amount); });
      const dirMap:  Record<number,number> = {};
      dirSales?.forEach((d) => { if(d.client_id) dirMap[d.client_id]=(dirMap[d.client_id]||0)+toNum(d.total_amount); });
      const payMap:  Record<number,number> = {};
      payments?.forEach((p) => { payMap[p.client_id]=(payMap[p.client_id]||0)+toNum(p.amount)+toNum(p.discount); });
      const loanMap: Record<number,number> = {};
      loans?.forEach((l) => { if(l.client_id) loanMap[l.client_id]=(loanMap[l.client_id]||0)+toNum(l.total_payable); });
      const lastTxnMap: Record<number,string> = {};
      lastTxns?.forEach((t) => {
        const cid=parseInt(t.client_name??"",10);
        if(!isNaN(cid)&&t.date_created&&(!lastTxnMap[cid]||t.date_created>lastTxnMap[cid]))
          lastTxnMap[cid]=t.date_created;
      });
      const built: Client[] = cls.map((c) => {
        const ob=toNum(c.opening_balance),rep=repMap[c.id]??0,dir=dirMap[c.id]??0,loan=loanMap[c.id]??0,paid=payMap[c.id]??0;
        return { id:c.id, name:[c.firstname,c.middlename,c.lastname].filter(Boolean).join(" ").trim(),
          contact:c.contact||"", email:c.email||"", address:c.address||"", date_created:c.date_created||"",
          opening_balance:ob, repair_billed:rep, direct_sales_billed:dir, total_loan_given:loan,
          total_paid:paid, balance:ob+rep+dir+loan-paid, last_txn_date:lastTxnMap[c.id]||null,
          image_path:c.image_path || undefined, login_allowed:!!c.login_allowed };
      });
      built.sort((a,b) => b.balance-a.balance);
      setClients(built);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: number, name: string) => {
    if (userRole !== "admin") { alert("Permission Denied: Sirf Admin hi delete kar sakta hai!"); return; }
    if (!confirm(`"${name}" ko delete karna chahte hain?`)) return;
    const { error } = await supabase.from("client_list").update({ delete_flag: 1 }).eq("id", id);
    if (!error) setClients((p) => p.filter((c) => c.id !== id));
    else alert("Delete nahi ho paya!");
  };

  // Portal access toggle (admin only). Client ko email OTP se login dene ke liye
  // uske email ka client_list me hona bhi zaroori hai.
  const handleToggleLogin = async (c: Client) => {
    if (userRole !== "admin") { alert("Permission Denied: Sirf Admin hi portal access de sakta hai!"); return; }
    if (!c.email) { alert("Portal access ke liye client ka email hona zaroori hai — pehle Edit Client se email set karein."); return; }
    const next = !c.login_allowed;
    const { error } = await supabase.from("client_list").update({ login_allowed: next }).eq("id", c.id);
    if (error) { alert("Update nahi hua: " + error.message); return; }
    setClients((p) => p.map((x) => x.id === c.id ? { ...x, login_allowed: next } : x));
  };

  const toggleSort = (field: SortField) => {
    if (sortField===field) setSortDir((d)=>d==="asc"?"desc":"asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const openWaModal = (client: Client) => {
    const at = client.balance>0?"reminder":daysSince(client.last_txn_date)>30?"followup":"welcome";
    setWaClient(client); setWaMsgType(at as typeof waMsgType); setWaText(buildAutoMsg(client)); setWaModal(true);
  };
  const handleWaTypeChange = (type: typeof waMsgType) => {
    if (!waClient) return; setWaMsgType(type);
    setWaText(type==="welcome"?WA.welcome(waClient.name):type==="reminder"?WA.reminder(waClient.name,waClient.balance):type==="followup"?WA.followup(waClient.name):type==="offer"?WA.offer(waClient.name):waText);
  };
  const sendWhatsApp = () => {
    if (!waClient?.contact) { alert("Phone number nahi hai!"); return; }
    window.open(`https://wa.me/91${waClient.contact.replace(/\D/g,"")}?text=${encodeURIComponent(waText)}`,"_blank");
    setWaModal(false);
  };

  // Bulk WhatsApp
  const toggleSelectClient = (id: number) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedClients.size === filteredSortedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredSortedClients.map(c => c.id)));
    }
  };
  const openBulkWaModal = () => {
    if (selectedClients.size === 0) { alert("Select clients pehle!"); return; }
    setBulkWaText("");
    setBulkWaMsgType("custom");
    setBulkWaModal(true);
  };
  const handleBulkWaTypeChange = (type: typeof bulkWaMsgType) => {
    setBulkWaMsgType(type);
    const selected = clients.filter(c => selectedClients.has(c.id));
    if (type === "custom") { setBulkWaText(""); return; }
    if (type === "reminder") {
      const totalBal = selected.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
      setBulkWaText(`नमस्ते सर/मैडम! 🙏\n\nआपका बकाया बैलेंस ₹${totalBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })} है।\n\nकृपया शीघ्र भुगतान करने का कष्ट करें।\n\n📞 ${FIRM.phone}\n\nधन्यवाद,\n${FIRM.owner}`);
    } else if (type === "welcome") {
      setBulkWaText(`नमस्ते! 🙏\n\n${FIRM.name} में आपका स्वागत है! 🛠️\n\n🔧 SMPS / Power Supply Repair\n🔧 Stage Light Repair\n🔧 DMX Controller Repair\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`);
    } else if (type === "followup") {
      setBulkWaText(`नमस्ते! 🙏\n\n${FIRM.name} से आपकी याद आई! 🤗\n\n🎁 पुराने ग्राहकों के लिए विशेष ऑफर: 15% छूट!\n\n📞 ${FIRM.phone}\n📍 ${FIRM.address}\n\nधन्यवाद,\n${FIRM.owner}`);
    } else if (type === "offer") {
      setBulkWaText(`नमस्ते! 🎉\n\n${FIRM.name} की तरफ से विशेष ऑफर!\n\n🔥 20% OFF — इस महीने तक!\n\n📞 ${FIRM.phone}\nधन्यवाद,\n${FIRM.owner}`);
    }
  };
  const sendBulkWhatsApp = () => {
    if (!bulkWaText.trim()) { alert("Message likho pehle!"); return; }
    const selected = clients.filter(c => selectedClients.has(c.id));
    selected.forEach(c => {
      if (c.contact) {
        window.open(`https://wa.me/91${c.contact.replace(/\D/g,"")}?text=${encodeURIComponent(bulkWaText)}`,"_blank");
      }
    });
    setBulkWaModal(false);
    setSelectedClients(new Set());
  };

  const printReport = () => {
    const params = new URLSearchParams({
      tab: tabFilter,
      minBal: minBal || "",
      maxBal: maxBal || "",
      sortField,
      sortDir,
    });
    window.open(`/api/print-clients?${params.toString()}`, "_blank");
  };
  const exportPDF = () => {
    alert("PDF Export: Use Print → Save as PDF option in the print dialog.\n\nअगर PDF में save करना है तो Print पर click करके printer dialog में 'Save as PDF' select करें।");
    printReport();
  };
  const exportExcel = () => {
    const rows=[["#","Name","Contact","Email","Address","Opening","Repairs","Direct","Loans","Paid","Balance"],...filteredSortedClients.map((c,i)=>[i+1,c.name,c.contact,c.email,c.address,c.opening_balance,c.repair_billed,c.direct_sales_billed,c.total_loan_given,c.total_paid,c.balance])];
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([`<table>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>`],{type:"application/vnd.ms-excel"}));
    a.download=`clients_${todayIST()}.xls`; a.click();
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredSortedClients = useMemo(() => {
    const s=searchTerm.toLowerCase().trim(),lo=minBal!==""?parseFloat(minBal):-Infinity,hi=maxBal!==""?parseFloat(maxBal):Infinity;
    const list=clients.filter((c) => {
      const ms=!s||c.name.toLowerCase().includes(s)||c.contact.includes(s)||c.email.toLowerCase().includes(s)||c.address.toLowerCase().includes(s);
      const mb=c.balance>=lo&&c.balance<=hi;
      const mt=tabFilter==="all"?true:tabFilter==="due"?c.balance>0:tabFilter==="high"?c.balance>20_000:tabFilter==="clear"?c.balance<=0&&daysSince(c.last_txn_date)<=30:c.balance<=0&&daysSince(c.last_txn_date)>30;
      return ms&&mb&&mt;
    });
    list.sort((a,b)=>{
      let cmp=0;
      if(sortField==="name") cmp=a.name.localeCompare(b.name);
      else if(sortField==="balance") cmp=a.balance-b.balance;
      else if(sortField==="date_created") cmp=(a.date_created||"").localeCompare(b.date_created||"");
      else if(sortField==="total_paid") cmp=a.total_paid-b.total_paid;
      return sortDir==="asc"?cmp:-cmp;
    });
    return list;
  }, [clients,searchTerm,minBal,maxBal,tabFilter,sortField,sortDir]);

  const totalOutstanding=useMemo(()=>clients.reduce((s,c)=>s+c.balance,0),[clients]);
  const totalCleared    =useMemo(()=>clients.filter(c=>c.balance<=0).length,[clients]);
  const clientsWithDue  =useMemo(()=>clients.filter(c=>c.balance>0).length,[clients]);
  const highRiskCount   =useMemo(()=>clients.filter(c=>c.balance>20_000).length,[clients]);
  const followupCount   =useMemo(()=>clients.filter(c=>c.balance<=0&&daysSince(c.last_txn_date)>30).length,[clients]);

  const chartData=useMemo(()=>[...clients].filter(c=>c.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,8).map(c=>({name:c.name.split(" ")[0],balance:c.balance,full:c.name})),[clients]);
  const CHART_COLORS=["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#06b6d4","#3b82f6"];

  const totalPages=pageSize===0?1:Math.ceil(filteredSortedClients.length/pageSize);
  const paginatedClients=useMemo(()=>{
    if(pageSize===0) return filteredSortedClients;
    return filteredSortedClients.slice((currentPage-1)*pageSize,currentPage*pageSize);
  },[filteredSortedClients,pageSize,currentPage]);

  const SortIcon=({field}:{field:SortField})=>{
    if(sortField!==field) return <ArrowUpDown size={11} className="text-slate-600 ml-1"/>;
    return sortDir==="asc"?<ArrowUp size={11} className="text-blue-400 ml-1"/>:<ArrowDown size={11} className="text-blue-400 ml-1"/>;
  };

  const TABS=[
    {id:"all"      as TabFilter,label:"All",       count:clients.length, ac:"text-blue-400 border-blue-500 bg-blue-500/10"},
    {id:"due"      as TabFilter,label:"Due",        count:clientsWithDue, ac:"text-red-400 border-red-500 bg-red-500/10"},
    {id:"high"     as TabFilter,label:"High Risk",  count:highRiskCount,  ac:"text-orange-400 border-orange-500 bg-orange-500/10"},
    {id:"clear"    as TabFilter,label:"Clear",      count:totalCleared,   ac:"text-emerald-400 border-emerald-500 bg-emerald-500/10"},
    {id:"followup" as TabFilter,label:"Follow-up",  count:followupCount,  ac:"text-teal-400 border-teal-500 bg-teal-500/10"},
  ];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d1117]">
      <Loader2 className="animate-spin text-blue-500" size={40}/>
      <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-xs">Loading Customers…</p>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 font-sans">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ━━━━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{backgroundColor: 'var(--app-panel)', borderColor: 'var(--app-border)'}} className="flex flex-col md:flex-row md:items-center justify-between gap-4
          rounded-2xl px-6 py-5 border">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 flex-shrink-0">
              <Users className="text-white" size={22}/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 style={{color: 'var(--app-text)'}} className="text-xl font-black tracking-tight leading-none">Customer Registry</h1>
                {userRole==="admin"&&<ShieldCheck className="text-emerald-400" size={16}/>}
              </div>
              <p className="text-blue-400 text-[11px] font-bold uppercase tracking-[0.15em] mt-1">
                {userRole==="admin"?"Admin Mode":"Staff View"} · {clients.length} Clients
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedClients.size > 0 && (
              <button onClick={openBulkWaModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-lg shadow-green-500/20">
                <MessageCircle size={13}/> Bulk WA ({selectedClients.size})
              </button>
            )}
            <button onClick={printReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-300 rounded-xl font-bold text-xs transition cursor-pointer">
              <Printer size={13}/> Print
            </button>
            <button onClick={exportPDF}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-red-900/30 text-red-400 rounded-xl font-bold text-xs transition cursor-pointer">
              <FileText size={13}/> PDF
            </button>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1e2637] border border-[#2a3550] hover:bg-emerald-900/30 text-emerald-400 rounded-xl font-bold text-xs transition cursor-pointer">
              <FileSpreadsheet size={13}/> Excel
            </button>
            <Link href="/clients/new"
              className="dark:bg-blue-600 bg-blue-500 hover:bg-blue-700 !text-white px-5 py-2 rounded-xl font-extrabold flex items-center gap-1.5 transition-all active:scale-95 no-underline text-xs shadow-lg dark:shadow-blue-600/20 shadow-blue-500/20">
              <UserPlus size={14} strokeWidth={2.5}/> Add Client
            </Link>
          </div>
        </div>

        {/* ━━━━━━ STAT CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Clients"  value={clients.length}        icon={<Users size={19}/>}          color="blue"    />
          <StatCard label="With Due"       value={clientsWithDue}        icon={<IndianRupee size={19}/>}    color="amber"   />
          <StatCard label="High Risk"      value={highRiskCount}         icon={<AlertTriangle size={19}/>}  color="red"     />
          <StatCard label="Cleared"        value={totalCleared}          icon={<CheckCircle size={19}/>}    color="emerald" />
          <StatCard label="Outstanding"    value={inr(totalOutstanding)} icon={<TrendingUp size={19}/>}     color="indigo"  isAmount/>
        </div>

        {/* ━━━━━━ BAR CHART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {chartData.length>0&&(
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">Top Due Clients</h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Highest balance first</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" minHeight={150} height="100%">
                <BarChart data={chartData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={(v)=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fill:"#475569"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<BarTooltip/>} cursor={{fill:"#ffffff06"}}/>
                  <Bar dataKey="balance" radius={[6,6,0,0]}>
                    {chartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ━━━━━━ FILTER BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 space-y-3">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab)=>(
              <button key={tab.id} onClick={()=>setTabFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wide border transition cursor-pointer ${
                  tabFilter===tab.id?tab.ac:"border-[#21293d] text-slate-600 hover:bg-[#1e2637] hover:text-slate-400"
                }`}>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${tabFilter===tab.id?"bg-white/10":"bg-[#1e2637] text-slate-600"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          {/* Search row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
              <input placeholder="Search name, mobile, email…" value={searchTerm}
                onChange={(e)=>setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl outline-none focus:border-blue-500 transition text-sm text-slate-200 placeholder:text-slate-700 font-medium"/>
            </div>
            <button onClick={()=>setShowFilter(!showFilter)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${showFilter?"bg-blue-600 border-blue-600 text-white":"bg-[#0d1117] border-[#21293d] text-slate-500 hover:bg-[#1e2637]"}`}>
              <SlidersHorizontal size={13}/> Filters
            </button>
            {(searchTerm||minBal||maxBal||tabFilter!=="all")&&(
              <button onClick={()=>{setSearchTerm("");setMinBal("");setMaxBal("");setTabFilter("all");}}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs border border-[#21293d] text-slate-600 hover:bg-[#1e2637] transition cursor-pointer">
                <RotateCcw size={11}/> Reset
              </button>
            )}
            {filteredSortedClients.length!==clients.length&&(
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-extrabold px-3 py-1.5 rounded-lg">
                {filteredSortedClients.length} results
              </span>
            )}
          </div>
          {/* Extended filters */}
          {showFilter&&(
            <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[#21293d]">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Balance:</span>
              <input type="number" placeholder="Min ₹" value={minBal} onChange={(e)=>setMinBal(e.target.value)}
                className="w-24 px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold outline-none focus:border-blue-500 text-slate-300"/>
              <span className="text-slate-700">—</span>
              <input type="number" placeholder="Max ₹" value={maxBal} onChange={(e)=>setMaxBal(e.target.value)}
                className="w-24 px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold outline-none focus:border-blue-500 text-slate-300"/>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-2">Sort:</span>
              {(["balance","name","total_paid","date_created"] as SortField[]).map(f=>(
                <button key={f} onClick={()=>toggleSort(f)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${sortField===f?"bg-blue-600 border-blue-600 text-white":"border-[#21293d] text-slate-500 hover:bg-[#1e2637]"}`}>
                  {f==="balance"?"Balance":f==="name"?"Name":f==="total_paid"?"Paid":"Date"}
                  {sortField===f&&(sortDir==="asc"?<ArrowUp size={9}/>:<ArrowDown size={9}/>)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ━━━━━━ CONTENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {filteredSortedClients.length===0?(
          <div className="text-center py-20 bg-[#161b27] rounded-2xl border border-dashed border-[#21293d]">
            <Search className="mx-auto mb-3 text-slate-700" size={36}/>
            <p className="text-slate-600 font-bold text-sm uppercase tracking-wider">No clients found</p>
          </div>

        ):isMobile?(
          /* ─── MOBILE CARDS ─────────────────────────────────────────── */
          <div className="space-y-3">
            {paginatedClients.map((client)=>{
              const meta=getBalanceMeta(client.balance,client.last_txn_date);
              return(
                <div key={client.id} className={`bg-[#161b27] rounded-2xl border border-[#21293d] overflow-hidden ${meta.rowCls}`}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {client.image_path ? (
                          <Image src={client.image_path} alt={client.name}
                            width={56} height={56} unoptimized
                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-[#1e2637] border border-[#2a3550] flex items-center justify-center flex-shrink-0">
                            <User size={20} className="text-slate-500" />
                          </div>
                        )}
                        <div>
                          <Link href={`/clients/${client.id}/view`}
                            className="font-black text-slate-100 text-base no-underline hover:text-blue-400 transition leading-tight block">
                            {client.name}
                          </Link>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-slate-600 text-[10px] font-bold">#{client.id}</span>
                            {client.contact&&<span className="text-slate-400 text-[10px] font-bold flex items-center gap-0.5"><Phone size={9}/>{client.contact}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold px-2 py-1 rounded border ${meta.badge} flex-shrink-0`}>{meta.label}</span>
                    </div>
                    {client.address&&<p className="text-slate-500 text-xs">{client.address}</p>}
                    <div className="flex justify-between items-center bg-[#0d1117] rounded-xl px-4 py-3 border border-[#21293d]">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Balance</span>
                      <span className={`text-lg font-black ${client.balance>0?"text-red-400":"text-emerald-400"}`}>
                        {client.balance<0?"−":""}{inr(client.balance)}
                      </span>
                    </div>
                    {userRole==="admin"&&(
                      <button onClick={()=>handleToggleLogin(client)}
                        className={`w-full flex items-center justify-between bg-[#0d1117] rounded-xl px-4 py-3 border cursor-pointer transition ${client.login_allowed?"border-emerald-500/30":"border-[#21293d]"}`}>
                        <span className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <ShieldCheck size={13} className={client.login_allowed?"text-emerald-400":"text-slate-600"}/>
                          Portal Access
                        </span>
                        <span className="flex items-center gap-2">
                          {!client.email&&<span className="text-[9px] font-bold text-amber-400/80">No email</span>}
                          <span className={`relative w-11 h-6 rounded-full transition-colors ${client.login_allowed?"bg-emerald-500":"bg-[#21293d]"}`}>
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${client.login_allowed?"left-[22px]":"left-0.5"}`}/>
                          </span>
                        </span>
                      </button>
                    )}
                    {client.balance>0&&(
                      <div className="h-1.5 bg-[#1e2637] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                          style={{width:`${Math.min(100,(client.balance/100_000)*100)}%`}}/>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Link href={`/clients/${client.id}/view`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#1e2637] border border-[#2a3550] rounded-xl text-slate-300 text-xs font-bold no-underline hover:bg-[#253048] transition">
                        <Eye size={13}/> View
                      </Link>
                      <Link href={`/clients/${client.id}/edit`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600/15 border border-blue-500/25 rounded-xl text-blue-400 text-xs font-bold no-underline hover:bg-blue-600 hover:text-white transition">
                        <Edit3 size={13}/> Edit
                      </Link>
                      {client.contact&&(
                        <button onClick={()=>openWaModal(client)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl text-[#4ade80] text-xs font-bold hover:bg-[#25D366] hover:text-white transition cursor-pointer">
                          <MessageCircle size={13}/> WA
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {pageSize!==0&&totalPages>1&&(
              <div className="flex items-center justify-between bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold border border-[#21293d] text-slate-400 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">‹ Prev</button>
                  <span className="text-xs font-bold text-slate-400 px-1">{currentPage} / {totalPages}</span>
                  <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
                    className="px-3 py-2 rounded-xl text-xs font-extrabold border border-[#21293d] text-slate-400 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">Next ›</button>
                </div>
                <div className="flex gap-1.5">
                  {[10,25,50,0].map(n=>(
                    <button key={n} onClick={()=>{setPageSize(n);setCurrentPage(1);}}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${pageSize===n?"bg-blue-600 border-blue-600 text-white":"border-[#21293d] text-slate-600 hover:bg-[#1e2637]"}`}>
                      {n===0?"All":n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        ):(
          /* ─── DESKTOP TABLE ─────────────────────────────────────────── */
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl">

            {/* Page-size bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#111520] border-b border-[#21293d] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Show</span>
                {[10,25,50,100,0].map((n)=>(
                  <button key={n} onClick={()=>{setPageSize(n);setCurrentPage(1);}}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold border transition cursor-pointer ${pageSize===n?"bg-blue-600 border-blue-600 text-white":"border-[#21293d] text-slate-600 hover:bg-[#1e2637] hover:text-slate-300"}`}>
                    {n===0?"All":n}
                  </button>
                ))}
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">entries</span>
              </div>
              <span className="text-[11px] font-bold text-slate-600">
                {pageSize===0?`All ${filteredSortedClients.length}`:`${Math.min((currentPage-1)*pageSize+1,filteredSortedClients.length)}–${Math.min(currentPage*pageSize,filteredSortedClients.length)} of ${filteredSortedClients.length}`}
              </span>
            </div>

            {/* Table */}
            <table className="w-full border-collapse" style={{tableLayout:"fixed"}}>
              <colgroup>
                <col style={{width:"36px"}}/>
                <col style={{width:"40px"}}/>
                <col style={{width:""}}/>
                <col style={{width:"200px"}}/>
                <col style={{width:"120px"}}/>
                <col style={{width:"100px"}}/>
                <col style={{width:"120px"}}/>
              </colgroup>
              <thead>
                <tr className="bg-[#111520] border-b border-[#21293d]">
                  <th className="px-2 py-3.5 text-left">
                    <button onClick={toggleSelectAll} className="cursor-pointer text-blue-400 hover:text-blue-300 transition" title="Select All">
                      {selectedClients.size === paginatedClients.length && paginatedClients.length > 0
                        ? <CheckSquare size={14} className="text-blue-400" />
                        : <Square size={14} className="text-slate-600" />}
                    </button>
                  </th>
                  <th className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">#</th>
                  <th onClick={()=>toggleSort("name")}
                    className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest cursor-pointer hover:text-blue-400 transition select-none">
                    <div className="flex items-center">Client <SortIcon field="name"/></div>
                  </th>
                  <th className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Address</th>
                  <th onClick={()=>toggleSort("balance")}
                    className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest cursor-pointer hover:text-blue-400 transition select-none">
                    <div className="flex items-center">Balance <SortIcon field="balance"/></div>
                  </th>
                  <th className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Last Txn</th>
                  <th className="px-3 py-3.5 text-left text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client,i)=>{
                  const meta=getBalanceMeta(client.balance,client.last_txn_date);
                  const rowNum=pageSize===0?i+1:(currentPage-1)*pageSize+i+1;
                  const isSelected=selectedClients.has(client.id);
                  return(
                    <tr key={client.id}
                      className={`border-b border-[#1a2030] hover:bg-white/[0.02] transition-colors ${meta.rowCls} ${isSelected?"bg-blue-500/5":""}`}>

                      {/* Checkbox */}
                      <td className="px-2 py-3.5 align-middle">
                        <button onClick={()=>toggleSelectClient(client.id)} className="cursor-pointer hover:opacity-80 transition">
                          {isSelected
                            ? <CheckSquare size={14} className="text-blue-400" />
                            : <Square size={14} className="text-slate-600" />}
                        </button>
                      </td>

                      {/* # */}
                      <td className="px-3 py-3.5 text-slate-700 text-xs font-bold align-middle">{rowNum}</td>

                      {/* Client — Name · ID · Mobile · WA */}
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          {client.image_path ? (
                            <Image src={client.image_path} alt={client.name}
                              width={48} height={48} unoptimized
                              className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#21293d]"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${meta.dot}`}/>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link href={`/clients/${client.id}/view`}
                              className="font-extrabold text-slate-100 hover:text-blue-400 no-underline transition text-[13px] block truncate leading-snug">
                              {client.name}
                            </Link>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-slate-600 text-[10px] font-bold">#{client.id}</span>
                              {client.contact&&(
                                <span className="text-slate-400 text-[10px] font-bold flex items-center gap-0.5">
                                  <Phone size={9} className="text-blue-500 flex-shrink-0"/>{client.contact}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${meta.badge}`}>{meta.label}</span>
                              {client.contact&&(
                                <button onClick={()=>openWaModal(client)}
                                  className="flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded bg-[#25D366]/10 border border-[#25D366]/20 text-[#4ade80] hover:bg-[#25D366] hover:text-white transition cursor-pointer whitespace-nowrap">
                                  <MessageCircle size={8}/>
                                  {client.balance>0?"Reminder":meta.label==="Follow-up"?"Follow-up":"Welcome"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Address + email */}
                      <td className="px-3 py-3.5 align-middle">
                        <p className="text-slate-400 text-[12px] font-medium truncate leading-snug" title={client.address||""}>
                          {client.address||<span className="text-slate-700">—</span>}
                        </p>
                        {client.email&&(
                          <p className="text-slate-700 text-[10px] mt-0.5 truncate flex items-center gap-1" title={client.email}>
                            <Mail size={9} className="flex-shrink-0"/>{client.email}
                          </p>
                        )}
                      </td>

                      {/* Balance + bar */}
                      <td className="px-3 py-3.5 align-middle">
                        <div className={`text-[15px] font-black leading-none ${client.balance>0?"text-red-400":"text-emerald-400"}`}>
                          {client.balance<0?"−":""}{inr(client.balance)}
                        </div>
                        {client.balance>0?(
                          <div className="mt-2 h-1.5 bg-[#1e2637] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                              style={{width:`${Math.min(100,(client.balance/100_000)*100)}%`}}/>
                          </div>
                        ):(
                          <span className="text-[9px] text-emerald-600 font-bold mt-1 block">Cleared ✓</span>
                        )}
                      </td>

                      {/* Last Txn */}
                      <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                        {client.last_txn_date?(
                          <>
                            <div className="text-slate-300 text-xs font-bold">
                              {new Date(client.last_txn_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"2-digit"})}
                            </div>
                            <div className={`text-[10px] font-bold mt-0.5 ${daysSince(client.last_txn_date)>30?"text-teal-400":"text-slate-700"}`}>
                              {daysSince(client.last_txn_date)}d ago
                            </div>
                          </>
                        ):<span className="text-slate-700 text-sm">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3.5 align-middle">
                        <ActionDropdown
                          clientId={client.id} clientName={client.name}
                          userRole={userRole} onDelete={()=>handleDelete(client.id,client.name)}
                          onWhatsApp={()=>openWaModal(client)} hasContact={!!client.contact}
                          loginAllowed={client.login_allowed}
                          onToggleLogin={()=>handleToggleLogin(client)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#111520] border-t border-[#21293d]">
                  <td colSpan={3} className="px-3 py-3 text-right text-[10px] font-extrabold text-slate-600 uppercase tracking-wide">This page due:</td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-sm font-black text-red-400">
                      {inr(paginatedClients.reduce((s,c)=>s+(c.balance>0?c.balance:0),0))}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-[10px] font-extrabold text-slate-600 uppercase tracking-wide">Total:</td>
                  <td className="px-3 py-3">
                    <span className="text-sm font-black text-red-400">{inr(totalOutstanding)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Pagination */}
            {pageSize!==0&&totalPages>1&&(
              <div className="flex items-center justify-between px-5 py-3 bg-[#111520] border-t border-[#21293d] flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={()=>setCurrentPage(1)} disabled={currentPage===1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold border border-[#21293d] text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">«</button>
                  <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1}
                    className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-[#21293d] text-slate-500 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">‹ Prev</button>
                  {(()=>{
                    const pages:(number|"...")[]=[];
                    if(totalPages<=7){for(let i=1;i<=totalPages;i++) pages.push(i);}
                    else{pages.push(1);if(currentPage>3) pages.push("...");for(let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++) pages.push(i);if(currentPage<totalPages-2) pages.push("...");pages.push(totalPages);}
                    return pages.map((p,idx)=>p==="..."
                      ?<span key={`e${idx}`} className="px-1.5 text-slate-700 text-xs">…</span>
                      :<button key={p} onClick={()=>setCurrentPage(p as number)}
                          className={`w-8 h-8 rounded-lg text-xs font-extrabold border transition cursor-pointer ${currentPage===p?"bg-blue-600 border-blue-600 text-white":"border-[#21293d] text-slate-500 hover:bg-[#1e2637]"}`}>
                          {p}
                        </button>
                    );
                  })()}
                  <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-[#21293d] text-slate-500 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">Next ›</button>
                  <button onClick={()=>setCurrentPage(totalPages)} disabled={currentPage===totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold border border-[#21293d] text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-[#1e2637]">»</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-600">Go to:</span>
                  <input type="number" min={1} max={totalPages} defaultValue={currentPage} key={currentPage}
                    onKeyDown={(e)=>{if(e.key==="Enter"){const v=parseInt((e.target as HTMLInputElement).value);if(v>=1&&v<=totalPages) setCurrentPage(v);}}}
                    className="w-12 px-2 py-1.5 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs font-bold text-center text-slate-300 outline-none focus:border-blue-500"/>
                  <span className="text-[10px] font-bold text-slate-600">of {totalPages}</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ━━━━━━ WHATSAPP MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {waModal&&waClient&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-[#128C7E]">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-white" size={18}/>
                <span className="text-white font-black text-sm">WhatsApp Message</span>
              </div>
              <button onClick={()=>setWaModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer">
                <X size={15}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-[#0d1117] p-3.5 rounded-xl border border-[#21293d]">
                <div>
                  <p className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest">Client</p>
                  <p className="font-extrabold text-white text-sm mt-0.5">{waClient.name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest">Balance</p>
                  <p className={`font-extrabold text-sm mt-0.5 ${waClient.balance>0?"text-red-400":"text-emerald-400"}`}>{inr(waClient.balance)}</p>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest block mb-1.5">Message Type</label>
                <select value={waMsgType} onChange={(e)=>handleWaTypeChange(e.target.value as typeof waMsgType)}
                  className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-green-500 transition">
                  <option value="welcome">Welcome Message</option>
                  <option value="reminder">Balance Reminder</option>
                  <option value="followup">Follow-up Message</option>
                  <option value="offer">Special Offer</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest block mb-1.5">Message</label>
                <textarea value={waText} onChange={(e)=>setWaText(e.target.value)} rows={7}
                  className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-green-500 transition resize-none"/>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>navigator.clipboard.writeText(waText)}
                  className="flex-1 py-2.5 border border-[#21293d] rounded-xl font-extrabold text-xs text-slate-400 hover:bg-[#1e2637] transition cursor-pointer">
                  Copy
                </button>
                <button onClick={sendWhatsApp}
                  className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95">
                  <MessageCircle size={14}/> Open WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━ BULK WHATSAPP MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {bulkWaModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-[#25D366]">
              <div className="flex items-center gap-2">
                <Send className="text-white" size={18}/>
                <span className="text-white font-black text-sm">Bulk WhatsApp — {selectedClients.size} Clients</span>
              </div>
              <button onClick={()=>setBulkWaModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition cursor-pointer">
                <X size={15}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-3.5">
                <p className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest mb-1">Selected Clients</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {Array.from(selectedClients).map(id => {
                    const c = clients.find(x => x.id === id);
                    return c ? (
                      <span key={id} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[10px] font-bold">
                        {c.name} {c.contact && `(${c.contact})`}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest block mb-1.5">Message Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(["reminder","welcome","followup","offer","custom"] as const).map(type => (
                    <button key={type} onClick={() => handleBulkWaTypeChange(type)}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        bulkWaMsgType === type
                          ? type === "reminder" ? "bg-red-600 border-red-600 text-white"
                          : type === "welcome" ? "bg-blue-600 border-blue-600 text-white"
                          : type === "followup" ? "bg-teal-600 border-teal-600 text-white"
                          : type === "offer" ? "bg-purple-600 border-purple-600 text-white"
                          : "bg-slate-600 border-slate-600 text-white"
                          : "bg-[#0d1117] border-[#21293d] text-slate-400 hover:bg-[#1e2637]"
                      }`}>
                      {type === "reminder" ? "🔔 Reminder" 
                       : type === "welcome" ? "👋 Welcome"
                       : type === "followup" ? "📞 Follow-up"
                       : type === "offer" ? "🎉 Offer"
                       : "✏️ Custom"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest block mb-1.5">Message</label>
                <textarea value={bulkWaText} onChange={(e) => setBulkWaText(e.target.value)} rows={6}
                  placeholder="Type your message or select a template above..."
                  className="w-full bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-green-500 transition resize-none"/>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(bulkWaText)}
                  className="flex-1 py-2.5 border border-[#21293d] rounded-xl font-extrabold text-xs text-slate-400 hover:bg-[#1e2637] transition cursor-pointer">
                  Copy
                </button>
                <button onClick={sendBulkWhatsApp}
                  className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95">
                  <Send size={14}/> Send to All ({selectedClients.size})
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center">
                ⚠️ WhatsApp windows will open for each client. Allow popups if asked.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ActionDropdown ───────────────────────────────────────────────────────────
// Opens upward if near bottom of viewport to prevent clipping
function ActionDropdown({clientId,userRole,onDelete,onWhatsApp,hasContact,loginAllowed,onToggleLogin}:{
  clientId:number;clientName:string;userRole:string;
  onDelete:()=>void;onWhatsApp:()=>void;hasContact:boolean;
  loginAllowed?:boolean;onToggleLogin?:()=>void;
}) {
  const [open,setOpen]=useState(false);
  const [openUp,setOpenUp]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const btnRef=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const handleToggle=()=>{
    if(!open&&btnRef.current){
      // Detect if dropdown would overflow viewport bottom
      const rect=btnRef.current.getBoundingClientRect();
      const menuHeight=200; // approximate dropdown height
      const spaceBelow=window.innerHeight-rect.bottom;
      setOpenUp(spaceBelow<menuHeight);
    }
    setOpen(v=>!v);
  };

  const items=[
    {icon:<Eye size={12}/>,         label:"View Details", href:`/clients/${clientId}/view`,    color:"text-slate-300"},
    {icon:<Edit3 size={12}/>,       label:"Edit Client",  href:`/clients/${clientId}/edit`,    color:"text-blue-400"},
    {icon:<IndianRupee size={12}/>, label:"Add Payment",  href:`/clients/${clientId}/add-payment`, color:"text-emerald-400"},
    ...(hasContact?[{icon:<MessageCircle size={12}/>,label:"WhatsApp",href:null,color:"text-[#4ade80]",action:onWhatsApp}]:[]),
    ...(userRole==="admin"?[{icon:<ShieldCheck size={12}/>,label:loginAllowed?"Portal Access ON":"Portal Access OFF",href:null,color:loginAllowed?"text-emerald-400":"text-slate-400",action:onToggleLogin}]:[]),
    ...(userRole==="admin"?[{icon:<Trash2 size={12}/>,label:"Delete",href:null,color:"text-red-400",action:onDelete}]:[]),
  ];

  return(
    <div ref={ref} className="relative inline-block">
      <button ref={btnRef} onClick={handleToggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer select-none ${
          open?"bg-blue-600 border-blue-600 text-white":"bg-[#1e2637] border-[#2a3550] text-slate-300 hover:bg-[#253048]"
        }`}>
        Actions <ChevronDown size={10} className={`transition-transform duration-200 ${open?"rotate-180":""}`}/>
      </button>
      {open&&(
        <div
          className="absolute right-0 z-[999] w-44 bg-[#161b27] border border-[#21293d] rounded-xl shadow-2xl overflow-hidden"
          style={openUp ? {bottom:"calc(100% + 4px)"} : {top:"calc(100% + 4px)"}}>
          {items.map((item,idx)=>
            item.href?(
              <Link key={idx} href={item.href} onClick={()=>setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold ${item.color} hover:bg-[#1e2637] no-underline transition border-b border-[#1a2030] last:border-0`}>
                {item.icon}{item.label}
              </Link>
            ):(
              <button key={idx} onClick={()=>{setOpen(false);item.action?.();}}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-semibold ${item.color} hover:bg-[#1e2637] transition border-b border-[#1a2030] last:border-0 cursor-pointer`}>
                {item.icon}{item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
const DCLR: Record<string,{bg:string;border:string;icon:string}> = {
  blue:   {bg:"bg-blue-500/10",    border:"border-blue-500/20",   icon:"text-blue-400"},
  amber:  {bg:"bg-amber-500/10",   border:"border-amber-500/20",  icon:"text-amber-400"},
  red:    {bg:"bg-red-500/10",     border:"border-red-500/20",    icon:"text-red-400"},
  emerald:{bg:"bg-emerald-500/10", border:"border-emerald-500/20",icon:"text-emerald-400"},
  indigo: {bg:"bg-indigo-500/10",  border:"border-indigo-500/20", icon:"text-indigo-400"},
};
function StatCard({label,value,icon,color,isAmount=false}:{
  label:string;value:string|number;icon:React.ReactNode;color:string;isAmount?:boolean;
}) {
  const c=DCLR[color]??DCLR.blue;
  return(
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-3.5 hover:-translate-y-0.5 transition-transform duration-200 overflow-hidden">
      <div className={`p-2.5 rounded-xl ${c.bg} border ${c.border} flex-shrink-0`}>
        <div className={c.icon}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-600 leading-none mb-1.5 truncate">{label}</p>
        <div className={`${isAmount?"text-base":"text-2xl"} font-black text-white tracking-tight leading-none truncate`}>
          {value}
        </div>
      </div>
    </div>
  );
}