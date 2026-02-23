"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  Settings,
  Wrench,
  Search,
  Loader2,
  Trash2,
  Phone,
  ShieldCheck,
  X,
  Filter,
  Printer,
  FileSpreadsheet,
  History,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

// ---------- Types ----------
interface Transaction {
  id: number;
  job_id: string;
  code: string | null;
  client_name: number;
  item: string;
  fault: string;
  uniq_id: string | null;
  amount: number;
  status: number;
  date_created: string;
  date_updated: string;
  date_completed: string | null;
  del_status: number;
  client_firstname?: string;
  client_middlename?: string;
  client_lastname?: string;
  client_contact?: string;
  client_opening_balance?: number;
  total_billed?: number;
  total_paid?: number;
  total_sale?: number;
}

// ---------- Status Helpers ----------
const statusMap: Record<number, string> = {
  0: "Pending",
  1: "On-Progress",
  2: "Done",
  3: "Paid",
  4: "Cancelled",
  5: "Delivered",
};

const statusColors: Record<number, string> = {
  0: "bg-gray-100 text-gray-800 border-gray-300",
  1: "bg-blue-100 text-blue-800 border-blue-300",
  2: "bg-green-100 text-green-800 border-green-300",
  3: "bg-emerald-100 text-emerald-800 border-emerald-300",
  4: "bg-red-100 text-red-800 border-red-300",
  5: "bg-purple-100 text-purple-800 border-purple-300",
};

const getStatusText = (status: number) => statusMap[status] || "Unknown";
const getStatusClass = (status: number) =>
  `px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[status] || "bg-gray-100 text-gray-600 border-gray-300"}`;

// ---------- Main Component ----------
function JobsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlDateFrom = searchParams.get("date_from") || "";
  const urlDateTo = searchParams.get("date_to") || "";
  const urlHideDelivered = searchParams.get("hide_delivered") === "1";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [localSearch, setLocalSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(urlDateFrom);
  const [dateTo, setDateTo] = useState(urlDateTo);
  const [hideDelivered, setHideDelivered] = useState(urlHideDelivered);
  const [statusFilter, setStatusFilter] = useState<number | "">("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Mobile detection
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mediaQuery);
    mediaQuery.addEventListener("change", handler);

    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role || "staff");
      }
    };
    fetchUserRole();

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdownId !== null) {
        const target = e.target as HTMLElement;
        if (!target.closest('.dropdown-btn') && !target.closest('.dropdown-menu')) {
          setOpenDropdownId(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Fetch transactions (optimized)
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("transaction_list")
        .select("*")
        .eq("del_status", 0)
        .order("date_created", { ascending: false });

      if (dateFrom) query = query.gte("date_created", `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte("date_created", `${dateTo}T23:59:59`);

      const { data: txns, error: txnError } = await query;
      if (txnError) throw txnError;
      if (!txns.length) {
        setTransactions([]);
        return;
      }

      const clientIds = [...new Set(txns.map((t) => Number(t.client_name)))];
      const { data: clients, error: clientError } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, opening_balance")
        .in("id", clientIds);
      if (clientError) throw clientError;

      const [billedResult, paidResult, salesResult] = await Promise.all([
        supabase.from("transaction_list").select("client_name, amount").eq("status", 5).in("client_name", clientIds),
        supabase.from("client_payments").select("client_id, amount, discount").in("client_id", clientIds),
        supabase.from("direct_sales").select("client_id, total_amount").in("client_id", clientIds),
      ]);

      const billedMap = new Map<number, number>();
      billedResult.data?.forEach((item) => {
        const cid = Number(item.client_name);
        billedMap.set(cid, (billedMap.get(cid) || 0) + (item.amount || 0));
      });

      const paidMap = new Map<number, number>();
      paidResult.data?.forEach((item) => {
        const cid = item.client_id;
        paidMap.set(cid, (paidMap.get(cid) || 0) + (item.amount || 0) + (item.discount || 0));
      });

      const salesMap = new Map<number, number>();
      salesResult.data?.forEach((item) => {
        const cid = item.client_id;
        salesMap.set(cid, (salesMap.get(cid) || 0) + (item.total_amount || 0));
      });

      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const enhancedTxns = txns.map((txn) => {
        const clientId = Number(txn.client_name);
        const client = clientMap.get(clientId) || {};
        return {
          ...txn,
          client_firstname: client.firstname,
          client_middlename: client.middlename,
          client_lastname: client.lastname,
          client_contact: client.contact,
          client_opening_balance: client.opening_balance || 0,
          total_billed: billedMap.get(clientId) || 0,
          total_paid: paidMap.get(clientId) || 0,
          total_sale: salesMap.get(clientId) || 0,
        };
      });

      setTransactions(enhancedTxns);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getClientName = (txn: Transaction) => {
    const parts = [
      txn.client_firstname || "",
      txn.client_middlename || "",
      txn.client_lastname || "",
    ].filter(Boolean);
    return parts.join(" ").trim() || "Unknown Client";
  };

  const getClientBalance = (txn: Transaction) => {
    const opening = txn.client_opening_balance || 0;
    const billed = txn.total_billed || 0;
    const sale = txn.total_sale || 0;
    const paid = txn.total_paid || 0;
    return opening + billed + sale - paid;
  };

  const filteredTransactions = useMemo(() => {
    const searchTerm = (debouncedSearch || "").toLowerCase().trim();
    return transactions.filter((txn) => {
      if (hideDelivered && txn.status === 5) return false;
      if (statusFilter !== "" && txn.status !== statusFilter) return false;
      if (searchTerm) {
        const clientName = getClientName(txn).toLowerCase();
        const jobId = txn.job_id?.toLowerCase() || "";
        const code = txn.code?.toLowerCase() || "";
        const item = txn.item?.toLowerCase() || "";
        const fault = txn.fault?.toLowerCase() || "";
        const locate = txn.uniq_id?.toLowerCase() || "";
        const statusText = getStatusText(txn.status).toLowerCase();
        return (
          clientName.includes(searchTerm) ||
          jobId.includes(searchTerm) ||
          code.includes(searchTerm) ||
          item.includes(searchTerm) ||
          fault.includes(searchTerm) ||
          locate.includes(searchTerm) ||
          statusText.includes(searchTerm)
        );
      }
      return true;
    });
  }, [transactions, debouncedSearch, hideDelivered, statusFilter]);

  const paginatedTransactions = useMemo(() => {
    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, pageIndex, pageSize]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [filteredTransactions.length, pageSize]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (userRole !== "admin") {
        alert("Permission Denied: Sirf Admin hi delete kar sakta hai!");
        return;
      }
      if (confirm("Kya aap pakka is job ko delete karna chahte hain?")) {
        const { error } = await supabase
          .from("transaction_list")
          .update({ del_status: 1 })
          .eq("id", id);
        if (!error) {
          setTransactions((prev) => prev.filter((t) => t.id !== id));
        } else {
          alert("Delete failed: " + error.message);
        }
      }
    },
    [userRole]
  );

  const sendWA = (txn: Transaction) => {
    const phone = txn.client_contact?.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      alert("Valid mobile number nahi mila!");
      return;
    }
    const clientName = getClientName(txn);
    const amount = txn.amount || 0;
    const formattedAmount = amount.toLocaleString("en-IN");
    const businessName = "Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875";

    let msg = "";
    switch (txn.status) {
      case 0:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${txn.item}* repair ke liye register ho gaya hai. 📝\n\n📋 *Details:*\nJob ID: #${txn.job_id}\nCode: #${txn.code}\nStatus: *Received/Pending*\n\nHum jald hi aapke device ko check karke update denge. Dhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 1:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapke *${txn.item}* (Job ID: #${txn.job_id}) (Code: #${txn.code}) par kaam shuru kar diya gaya hai. 🛠️\n\nStatus: *In-Progress/Repairing*\n\nHamare technician isse jald se jald theek karne ki koshish kar rahe hain. ✨\n\n${businessName}`;
        break;
      case 2:
        msg = `Namaste ${clientName} ji 🙏!\n\nKhushkhabri! Aapka *${txn.item}* repair complete ho gaya hai. ✅\n\n📋 *Details:*\nJob ID: #${txn.job_id}\nCode: #${txn.code}\nBill Amount: *₹${formattedAmount}*\n\nAap workshop par aakar apna device collect kar sakte hain. 🛍️\n\nDhanyavaad! ❤️\n\n${businessName}`;
        break;
      case 3:
      case 5:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka *${txn.item}* (Job ID: #${txn.job_id}) (Code: #${txn.code}) deliver kar diya gaya hai. 🏁\n\nTotal Paid: *₹${formattedAmount}*\n\nV-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n${businessName}`;
        break;
      case 4:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${txn.job_id} (Code: #${txn.code}) (*${txn.item}*) cancel kar diya gaya hai. ❌\n\nKripya adhik jankari ke liye workshop par sampark karein. 🙏\n\n${businessName}`;
        break;
      default:
        msg = `Namaste ${clientName} ji 🙏!\n\nAapka Job ID: #${txn.job_id} (${txn.item}) ka status update kar diya gaya hai. Dhanyavaad! ❤️`;
    }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const printReport = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    window.open(`/api/print-transactions?${params.toString()}`, "_blank");
  };

  const exportExcel = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append("date_from", dateFrom);
    if (dateTo) params.append("date_to", dateTo);
    window.location.href = `/api/export-transactions?${params.toString()}`;
  };

  const shiftDay = (direction: number) => {
    const base = dateFrom ? new Date(dateFrom) : new Date();
    base.setDate(base.getDate() + direction);
    const newDate = base.toISOString().split("T")[0];
    setDateFrom(newDate);
    setDateTo(newDate);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date_from", newDate);
    params.set("date_to", newDate);
    router.push(`?${params.toString()}`);
  };

  const applyMobileFilter = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (hideDelivered) params.set("hide_delivered", "1");
    router.push(`?${params.toString()}`);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setHideDelivered(false);
    setStatusFilter("");
    setLocalSearch("");
    router.push("/jobs");
    setShowFilterModal(false);
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={50} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.3em] text-sm">
          V-TECH: Loading Transactions...
        </p>
      </div>
    );
  }

  // ========== DESKTOP VIEW with Dropdown Actions ==========
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 p-5 font-sans">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow">
                <Wrench className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Transaction History</h1>
                <p className="text-xs text-gray-500">{userRole === "admin" ? "👑 Admin" : "👤 Staff"} • {filteredTransactions.length} records</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/jobs/new" className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Plus size={16} /> New</Link>
              <Link href="/jobs/old" className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><History size={16} /> Old</Link>
              <Link href="/jobs/bulk" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Layers size={16} /> Bulk</Link>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
              </div>
              <button onClick={() => router.push(`?date_from=${dateFrom}&date_to=${dateTo}`)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Filter size={14} /> Filter</button>
              <button onClick={resetFilters} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-1.5 rounded-lg text-sm font-medium">Reset</button>
              <button onClick={() => shiftDay(-1)} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><ChevronLeft size={14} /> Prev</button>
              <button onClick={() => shiftDay(1)} className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">Next <ChevronRight size={14} /></button>
              <button onClick={printReport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><Printer size={14} /> Print</button>
              <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><FileSpreadsheet size={14} /> Excel</button>
              <label className="flex items-center gap-2 ml-auto bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-300 cursor-pointer">
                <input type="checkbox" checked={hideDelivered} onChange={(e) => setHideDelivered(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm font-medium">Hide Delivered</span>
              </label>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by job ID, client, device, fault, code, status..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          {/* Table with Dropdown Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
  <col className="w-[5%]" />
  <col className="w-[9%]" />
  <col className="w-[9%]" />
  <col className="w-[18%]" />
  <col className="w-[10%]" />
  <col className="w-[10%]" />
  <col className="w-[5%]" />
  <col className="w-[7%]" />
  <col className="w-[9%]" />
  <col className="w-[8%]" />
</colgroup>
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Job/Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Client</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Item</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Fault</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 text-xs uppercase">Loc</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 text-xs uppercase">Amount</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase">Status</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedTransactions.map((txn, index) => {
                  const clientName = getClientName(txn);
                  const balance = getClientBalance(txn);
                  const balanceDisplay =
                    balance > 0 ? (
                      <span className="inline-block bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-200">Due ₹{balance.toFixed(0)}</span>
                    ) : balance < 0 ? (
                      <span className="inline-block bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-green-200">Adv ₹{Math.abs(balance).toFixed(0)}</span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200">Bal 0</span>
                    );

                  return (
                    <tr key={txn.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 text-xs">{pageIndex * pageSize + index + 1}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {new Date(txn.date_created).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-blue-600 text-xs">#{txn.job_id}</div>
                        {txn.code && <div className="text-gray-400 text-[10px] truncate">{txn.code}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800 text-xs truncate max-w-[140px]" title={clientName}>{clientName}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {balanceDisplay}
                          {txn.client_contact && (
                            <a href={`https://wa.me/91${txn.client_contact.replace(/\D/g, "")}`} target="_blank" className="text-green-600" title={txn.client_contact}>
                              <Phone size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs truncate max-w-[120px]" title={txn.item}>{txn.item}</td>
                      <td className="px-3 py-2 text-red-600 text-xs truncate max-w-[120px]" title={txn.fault}>{txn.fault}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{txn.uniq_id || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-sm">₹{txn.amount?.toFixed(0)}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center">
                          <span className={getStatusClass(txn.status)}>{getStatusText(txn.status)}</span>
                          {txn.status === 5 && txn.date_completed && (
                            <span className="text-[9px] text-gray-400 mt-0.5">
                              {new Date(txn.date_completed).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 relative">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === txn.id ? null : txn.id)}
                          className="dropdown-btn bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1 mx-auto"
                        >
                          Action <ChevronDown size={14} />
                        </button>
                        {openDropdownId === txn.id && (
                          <div className="dropdown-menu absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                            <Link
                              href={`/jobs/${txn.id}`}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Eye size={14} /> View
                            </Link>
                            <button
                              onClick={() => { sendWA(txn); setOpenDropdownId(null); }}
                              className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm"
                            >
                              <Phone size={14} /> WhatsApp
                            </button>
                            <a
                              href={`/api/print-bill?job_id=${txn.job_id}`}
                              target="_blank"
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Printer size={14} /> Print Bill
                            </a>
                            <Link
                              href={`/jobs/edit/${txn.id}`}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Settings size={14} /> Edit
                            </Link>
                            <Link
                              href={`/jobs/old-edit/${txn.id}`}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <History size={14} /> Old Edit
                            </Link>
                            {userRole === "admin" && (
                              <>
                                <hr className="my-1" />
                                <button
                                  onClick={() => { handleDelete(txn.id); setOpenDropdownId(null); }}
                                  className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">No transactions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm">
              <span>Show</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }} className="border border-gray-300 rounded px-2 py-1 text-sm">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={filteredTransactions.length}>All</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button onClick={() => setPageIndex(p => Math.max(p-1,0))} disabled={pageIndex===0} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40">Previous</button>
              <span>Page {pageIndex+1} of {totalPages || 1}</span>
              <button onClick={() => setPageIndex(p => Math.min(p+1, totalPages-1))} disabled={pageIndex>=totalPages-1} className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== MOBILE VIEW (unchanged, grid of icons) ==========
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-700 to-purple-700 text-white p-3 shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-full"><Wrench size={20} /></div>
          <h1 className="text-base font-bold">Transactions</h1>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Search..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="w-full pl-8 pr-10 py-2 bg-white rounded-lg text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <button onClick={() => setShowFilterModal(true)} className="absolute right-1 top-1/2 -translate-y-1/2 bg-blue-600 p-1.5 rounded-full text-white"><Filter size={16} /></button>
        </div>
        <label className="flex items-center gap-1.5 mt-2 text-xs"><input type="checkbox" checked={hideDelivered} onChange={(e) => setHideDelivered(e.target.checked)} className="w-4 h-4 accent-white" /> Hide Delivered</label>
      </div>

      {debouncedSearch && (
        <div className="mx-3 my-2 bg-white p-2 rounded-lg shadow-sm flex justify-between items-center border border-gray-200 text-xs">
          <span>Found <strong className="text-blue-600">{filteredTransactions.length}</strong> results</span>
          <button onClick={() => setLocalSearch("")} className="text-gray-400"><X size={16} /></button>
        </div>
      )}

      <div className="p-3 space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white p-6 rounded-xl text-center border border-gray-200"><AlertCircle className="mx-auto text-gray-300 mb-2" size={40} /><p className="text-gray-500 text-sm">No transactions</p><p className="text-xs text-gray-400 mt-1">Adjust filters</p></div>
        ) : (
          filteredTransactions.map((txn) => {
            const clientName = getClientName(txn);
            const balance = getClientBalance(txn);
            const balanceDisplay = balance > 0 ? <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border border-red-200">Due {balance.toFixed(0)}</span> :
                                   balance < 0 ? <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border border-green-200">Adv {Math.abs(balance).toFixed(0)}</span> :
                                   <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border border-gray-200">Bal 0</span>;
            return (
              <div key={txn.id} className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden border border-gray-200 ${
                txn.status===0 ? "border-l-gray-400" : txn.status===1 ? "border-l-blue-400" : txn.status===2 ? "border-l-green-400" : txn.status===3 ? "border-l-emerald-400" : txn.status===4 ? "border-l-red-400" : "border-l-purple-400"
              }`}>
                <div className="flex justify-between items-start p-3 bg-gray-50">
                  <div><Link href={`/jobs/${txn.id}`} className="font-bold text-sm">#{txn.job_id}</Link><div className="flex gap-1 text-[10px] text-gray-500 mt-0.5"><span className="bg-gray-200 px-1.5 py-0.5 rounded">{txn.code||"No Code"}</span><span>{new Date(txn.date_created).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit"})}</span></div></div>
                  <span className={getStatusClass(txn.status)}>{getStatusText(txn.status)}</span>
                </div>
                <div className="px-3 py-2 border-t border-gray-100">
                  <Link href={`/clients/${txn.client_name}`} className="font-medium text-sm">{clientName}</Link>
                  <div className="flex items-center gap-2 mt-1">{balanceDisplay}{txn.client_contact && <a href={`https://wa.me/91${txn.client_contact.replace(/\D/g,"")}`} target="_blank" className="text-green-600"><Phone size={12} /></a>}</div>
                </div>
                <div className="px-3 py-2 border-t border-gray-100 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Item:</span><span className="font-medium">{txn.item}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Fault:</span><span className="text-red-600">{txn.fault}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Loc:</span><span>{txn.uniq_id||"—"}</span></div>
                  <div className="flex justify-between text-sm font-bold text-emerald-700"><span>Amt:</span><span>₹{txn.amount?.toFixed(0)}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-1 p-3 bg-gray-50 border-t border-gray-200">
                  <Link href={`/jobs/${txn.id}`} className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-blue-200 text-blue-600 text-[9px]"><Eye size={14} /><span>View</span></Link>
                  <button onClick={() => sendWA(txn)} className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-green-200 text-green-600 text-[9px]"><Phone size={14} /><span>WA</span></button>
                  <a href={`/api/print-bill?job_id=${txn.job_id}`} target="_blank" className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-orange-200 text-orange-600 text-[9px]"><Printer size={14} /><span>Print</span></a>
                  <Link href={`/jobs/old-edit/${txn.id}`} className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-cyan-200 text-cyan-600 text-[9px]"><History size={14} /><span>Old</span></Link>
                  <Link href={`/jobs/edit/${txn.id}`} className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-indigo-200 text-indigo-600 text-[9px]"><Settings size={14} /><span>Edit</span></Link>
                  {userRole==="admin" && <button onClick={()=>handleDelete(txn.id)} className="flex flex-col items-center p-1.5 bg-white rounded-lg border border-red-200 text-red-600 text-[9px]"><Trash2 size={14} /><span>Del</span></button>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-4 right-4 z-20">
        <button onClick={()=>setFabOpen(!fabOpen)} className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white"><Plus size={24} className={fabOpen?"rotate-45":""} /></button>
        {fabOpen && (
          <div className="absolute bottom-14 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-36 text-sm">
            <Link href="/jobs/new" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"><Plus size={14} className="text-blue-600" /> New</Link>
            <Link href="/jobs/old" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"><History size={14} className="text-amber-600" /> Old</Link>
            <Link href="/jobs/bulk" className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"><Layers size={14} className="text-emerald-600" /> Bulk</Link>
            <hr />
            <button onClick={printReport} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 w-full text-left"><Printer size={14} className="text-green-600" /> Print</button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 w-full text-left"><FileSpreadsheet size={14} className="text-emerald-600" /> Excel</button>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-4">
            <div className="flex justify-between items-center mb-3"><h3 className="font-bold">Filter</h3><button onClick={()=>setShowFilterModal(false)}><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium mb-1">From Date</label><input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">To Date</label><input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Status</label><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value?parseInt(e.target.value):"")} className="w-full border border-gray-300 rounded-lg p-2 text-sm"><option value="">All</option>{Object.entries(statusMap).map(([v,l])=> <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="flex gap-2 pt-2"><button onClick={resetFilters} className="flex-1 bg-gray-200 p-2 rounded-lg text-sm">Reset</button><button onClick={applyMobileFilter} className="flex-1 bg-blue-600 text-white p-2 rounded-lg text-sm">Apply</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4"><Loader2 className="animate-spin text-blue-600" size={48} /><p className="text-gray-500 text-sm">Loading...</p></div>}>
      <JobsListContent />
    </Suspense>
  );
}