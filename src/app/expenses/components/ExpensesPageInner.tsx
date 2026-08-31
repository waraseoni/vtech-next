"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Expense, Mechanic, AdvancePayment } from "@/lib/server-expenses";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { todayIST, startOfMonthIST, endOfMonthIST, parseISTDate, formatIST } from "@/lib/dateUtils";
import { safeImageSrc } from "@/lib/image-utils";
import SearchableSelect from "@/components/SearchableSelect";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  Wallet,
  IndianRupee,
  Receipt,
  X,
  Calendar,
  FileText,
} from "lucide-react";

type ExpenseForm = {
  id: number | null;
  category: string;
  amount: string;
  remarks: string;
  date: string;
};

type StaffPaymentForm = {
  id: number | null;
  mechanic_id: string;
  amount: string;
  date_paid: string;
  reason: string;
};

type Toast = {
  type: "success" | "error";
  msg: string;
};

type TabId = "staff" | "shop";

function monthRangeFrom(base: string, diff = 0) {
  const date = parseISTDate(base);
  const d = new Date(date.getFullYear(), date.getMonth() + diff, 1);
  return { from: startOfMonthIST(d), to: endOfMonthIST(d) };
}

function lastSevenDaysRange(base: string) {
  const end = parseISTDate(base);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  return { from: formatIST(start), to: formatIST(end) };
}

const emptyExpenseForm = (): ExpenseForm => ({
  id: null,
  category: "",
  amount: "",
  remarks: "",
  date: todayIST(),
});

const emptyStaffForm = (): StaffPaymentForm => ({
  id: null,
  mechanic_id: "",
  amount: "",
  date_paid: todayIST(),
  reason: "",
});

function money(value: number) {
  return "₹" + (Number(value || 0)).toLocaleString("en-IN", { minimumFractionDigits: 0 });
}

function moneyFull(value: number) {
  return "₹" + (Number(value || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseISTDate(value));
}

function mechanicName(mechanic?: Mechanic | null) {
  if (!mechanic) return "-";
  return [mechanic.firstname, mechanic.middlename, mechanic.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();
}

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

type ExpensesPageProps = {
  initialMechanics: Mechanic[];
  initialStaffPayments: AdvancePayment[];
  initialShopExpenses: Expense[];
};

export default function ExpensesPageInner({
  initialMechanics,
  initialStaffPayments,
  initialShopExpenses,
}: ExpensesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const urlTab = searchParams.get("tab") === "shop" ? "shop" : "staff";
  const urlSearch = searchParams.get("q") || "";
  const urlFrom = searchParams.get("from") || startOfMonthIST();
  const urlTo = searchParams.get("to") || todayIST();

  const [tab, setTab] = useState<TabId>(urlTab);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const [search, setSearch] = useState(urlSearch);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fromDate, setFromDate] = useState(urlFrom);
  const [toDate, setToDate] = useState(urlTo);

  const [mechanics, setMechanics] = useState<Mechanic[]>(initialMechanics);
  const [staffPayments, setStaffPayments] = useState<AdvancePayment[]>(initialStaffPayments);
  const [shopExpenses, setShopExpenses] = useState<Expense[]>(initialShopExpenses);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState<StaffPaymentForm>(emptyStaffForm());
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(emptyExpenseForm());

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [
        { data: mechanicData, error: mechanicError },
        { data: staffData, error: staffError },
        { data: expenseData, error: expenseError },
      ] = await Promise.all([
        supabase
          .from("mechanic_list")
          .select("id, firstname, middlename, lastname, designation, status, delete_flag, image_path")
          .eq("status", 1)
          .eq("delete_flag", 0)
          .order("firstname", { ascending: true }),
        supabase
          .from("advance_payments")
          .select("id, mechanic_id, amount, date_paid, reason")
          .order("date_paid", { ascending: false })
          .order("id", { ascending: false })
          .limit(500),
        supabase
          .from("expense_list")
          .select("id, category, amount, remarks, date_created")
          .order("date_created", { ascending: false })
          .limit(500),
      ]);

      if (mechanicError) throw mechanicError;
      if (staffError) throw staffError;
      if (expenseError) throw expenseError;

      setMechanics((mechanicData || []) as Mechanic[]);
      setStaffPayments((staffData || []) as AdvancePayment[]);
      setShopExpenses((expenseData || []) as Expense[]);
    } catch (error) {
      console.error("pay outs load error:", error);
      setErr(error instanceof Error ? error.message : "Pay out data load nahi hui.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(currentQuery);
    params.set("tab", tab);
    if (search.trim()) {
      params.set("q", search.trim());
    } else {
      params.delete("q");
    }
    if (fromDate) {
      params.set("from", fromDate);
    } else {
      params.delete("from");
    }
    if (toDate) {
      params.set("to", toDate);
    } else {
      params.delete("to");
    }
    const next = params.toString();
    if (next !== currentQuery) {
      router.replace(next ? `?${next}` : "?", { scroll: false });
    }
  }, [router, currentQuery, tab, search, fromDate, toDate]);

  const mechanicById = useMemo(() => {
    const map = new Map<number, Mechanic>();
    mechanics.forEach((mechanic) => map.set(mechanic.id, mechanic));
    return map;
  }, [mechanics]);

  const filteredStaffPayments = useMemo(() => {
    const term = search.toLowerCase().trim();
    return staffPayments.filter((payment) => {
      if (fromDate && payment.date_paid < fromDate) return false;
      if (toDate && payment.date_paid > toDate) return false;
      if (!term) return true;
      const mechanic = mechanicById.get(payment.mechanic_id);
      const hay = [
        mechanicName(mechanic),
        mechanic?.designation || "",
        payment.reason || "",
        payment.date_paid,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [staffPayments, search, fromDate, toDate, mechanicById]);

  const filteredShopExpenses = useMemo(() => {
    const term = search.toLowerCase().trim();
    const catFilter = categoryFilter.trim().toLowerCase();
    return shopExpenses.filter((expense) => {
      const dateKey = String(expense.date_created).slice(0, 10);
      if (fromDate && dateKey < fromDate) return false;
      if (toDate && dateKey > toDate) return false;
      if (catFilter && (expense.category || "").trim().toLowerCase() !== catFilter) return false;
      if (!term) return true;
      const hay = [expense.category, expense.remarks || "", expense.date_created]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [shopExpenses, search, fromDate, toDate, categoryFilter]);

  const staffTotal = useMemo(
    () => filteredStaffPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredStaffPayments]
  );
  const expenseTotal = useMemo(
    () => filteredShopExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredShopExpenses]
  );

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    shopExpenses.forEach((expense) => {
      const cat = (expense.category || "").trim();
      if (!cat) return;
      const key = cat.toLowerCase();
      if (!seen.has(key)) seen.set(key, cat);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [shopExpenses]);

  const applyCurrentMonth = () => {
    const range = monthRangeFrom(todayIST(), 0);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const applyToday = () => {
    const today = todayIST();
    setFromDate(today);
    setToDate(today);
  };

  const applyLastSevenDays = () => {
    const range = lastSevenDaysRange(todayIST());
    setFromDate(range.from);
    setToDate(range.to);
  };

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    applyCurrentMonth();
  };

  const shiftMonth = (diff: number) => {
    const anchor = fromDate || todayIST();
    const range = monthRangeFrom(anchor, diff);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const closeModals = () => {
    if (saving) return;
    setStaffModalOpen(false);
    setExpenseModalOpen(false);
    setStaffForm(emptyStaffForm());
    setExpenseForm(emptyExpenseForm());
  };

  const openCreateStaff = () => {
    setStaffForm(emptyStaffForm());
    setStaffModalOpen(true);
  };

  const openEditStaff = (payment: AdvancePayment) => {
    setStaffForm({
      id: payment.id,
      mechanic_id: String(payment.mechanic_id),
      amount: String(Number(payment.amount || 0)),
      date_paid: payment.date_paid,
      reason: payment.reason || "",
    });
    setStaffModalOpen(true);
  };

  const openCreateExpense = () => {
    setExpenseForm(emptyExpenseForm());
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setExpenseForm({
      id: expense.id,
      category: expense.category,
      amount: String(Number(expense.amount || 0)),
      remarks: expense.remarks || "",
      date: String(expense.date_created).slice(0, 10),
    });
    setExpenseModalOpen(true);
  };

  const saveStaffPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const mechanicId = Number(staffForm.mechanic_id);
    const amount = Number(staffForm.amount);
    if (!mechanicId || !amount || amount <= 0) {
      setToast({ type: "error", msg: "Staff select karo aur valid amount dalo." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        mechanic_id: mechanicId,
        amount,
        date_paid: staffForm.date_paid,
        reason: staffForm.reason.trim() || null,
      };

      if (staffForm.id) {
        const { error } = await supabase
          .from("advance_payments")
          .update(payload)
          .eq("id", staffForm.id);
        if (error) throw error;
        setToast({ type: "success", msg: "Staff payment update ho gaya." });
      } else {
        const { error } = await supabase.from("advance_payments").insert(payload);
        if (error) throw error;
        setToast({ type: "success", msg: "Staff payment save ho gaya." });
      }

      closeModals();
      await loadData();
    } catch (error) {
      console.error("staff payment save error:", error);
      setToast({ type: "error", msg: "Staff payment save nahi hua." });
    } finally {
      setSaving(false);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.category.trim() || !amount || amount <= 0) {
      setToast({ type: "error", msg: "Category aur valid amount required hai." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: expenseForm.category.trim(),
        amount,
        remarks: expenseForm.remarks.trim() || null,
        date_created: `${expenseForm.date}T12:00:00+05:30`,
      };

      if (expenseForm.id) {
        const { error } = await supabase
          .from("expense_list")
          .update(payload)
          .eq("id", expenseForm.id);
        if (error) throw error;
        setToast({ type: "success", msg: "Shop expense update ho gaya." });
      } else {
        const { error } = await supabase.from("expense_list").insert(payload);
        if (error) throw error;
        setToast({ type: "success", msg: "Shop expense save ho gaya." });
      }

      closeModals();
      await loadData();
    } catch (error) {
      console.error("expense save error:", error);
      setToast({ type: "error", msg: "Shop expense save nahi hua." });
    } finally {
      setSaving(false);
    }
  };

  const deleteStaffPayment = async (id: number) => {
    if (!window.confirm("Kya aap ye staff payment delete karna chahte hain?")) return;
    try {
      const { error } = await supabase.from("advance_payments").delete().eq("id", id);
      if (error) throw error;
      setToast({ type: "success", msg: "Staff payment delete ho gaya." });
      await loadData();
    } catch (error) {
      console.error("staff payment delete error:", error);
      setToast({ type: "error", msg: "Staff payment delete nahi hua." });
    }
  };

  const deleteExpense = async (id: number) => {
    if (!window.confirm("Kya aap ye shop expense delete karna chahte hain?")) return;
    try {
      const { error } = await supabase.from("expense_list").delete().eq("id", id);
      if (error) throw error;
      setToast({ type: "success", msg: "Shop expense delete ho gaya." });
      await loadData();
    } catch (error) {
      console.error("expense delete error:", error);
      setToast({ type: "error", msg: "Shop expense delete nahi hua." });
    }
  };

  const dateRangeLabel =
    fromDate === toDate
      ? fmtDate(fromDate)
      : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`;

  const totals = tab === "staff"
    ? { count: filteredStaffPayments.length, amount: staffTotal }
    : { count: filteredShopExpenses.length, amount: expenseTotal };

  return (
    <div className="space-y-3.5 w-full max-w-[1550px] mx-auto pb-12 px-2 sm:px-3 lg:px-4">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/95 border-rose-500/40 text-rose-300"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 text-white/60 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-500/20 border border-white/10 flex-shrink-0">
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight">Pay Outs</h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400">
                {dateRangeLabel}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              {tab === "staff" ? "Staff payments & advances tracking" : "Shop expenses & category management"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex bg-[#0d1117] p-1 rounded-xl border border-[#21293d]">
            <button
              onClick={() => setTab("staff")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                tab === "staff"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserRound size={12} />
              <span className="hidden sm:inline">Staff</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                tab === "staff" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}>
                {filteredStaffPayments.length}
              </span>
            </button>
            <button
              onClick={() => setTab("shop")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                tab === "shop"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Receipt size={12} />
              <span className="hidden sm:inline">Shop</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                tab === "shop" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
              }`}>
                {filteredShopExpenses.length}
              </span>
            </button>
          </div>

          <button
            onClick={() => loadData()}
            disabled={loading}
            title="Refresh Data"
            className="p-1.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-slate-400 hover:text-white transition-all disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">{tab === "staff" ? "Staff Entries" : "Expenses"}</span>
            {tab === "staff" ? <UserRound size={13} className="text-blue-400" /> : <Receipt size={13} className="text-amber-400" />}
          </div>
          <p className="text-base sm:text-lg font-black text-white tracking-tight">{totals.count}</p>
          <p className="text-[9px] text-slate-500">Total records</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">{tab === "staff" ? "Total Payout" : "Total Spent"}</span>
            <IndianRupee size={13} className="text-red-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-red-400 tracking-tight">{money(totals.amount)}</p>
          <p className="text-[9px] text-slate-500">{tab === "staff" ? "Staff paid" : "Shop spent"}</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">From</span>
            <Calendar size={13} className="text-blue-400" />
          </div>
          <p className="text-sm sm:text-base font-black text-white tracking-tight">{fmtDate(fromDate)}</p>
          <p className="text-[9px] text-slate-500">Start date</p>
        </div>
        <div className="bg-[#161b27] border border-[#21293d] rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">To</span>
            <Calendar size={13} className="text-teal-400" />
          </div>
          <p className="text-sm sm:text-base font-black text-white tracking-tight">{fmtDate(toDate)}</p>
          <p className="text-[9px] text-slate-500">End date</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-2.5 sm:p-3 shadow-sm">
        <div className="grid gap-2 sm:gap-2.5 lg:items-end lg:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]"
              placeholder={
                tab === "staff"
                  ? "Staff name ya note search karo"
                  : "Category ya remarks search karo"
              }
            />
          </div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-medium text-white outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={tab === "staff" ? openCreateStaff : openCreateExpense}
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all shadow-sm active:scale-95"
            >
              <Plus size={12} /> Add
            </button>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-3 py-2 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>
        {tab === "shop" && (
          <div className="mt-2">
            <SearchableSelect
              value={categoryFilter || null}
              options={categoryOptions.map((cat) => ({ id: cat, label: cat }))}
              onSelect={(v) => setCategoryFilter(v)}
              placeholder="All categories..."
              searchPlaceholder="Category search karo..."
              emptyText="Koi category nahi mili"
              clearLabel="All Categories"
            />
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[
            { label: "Today", fn: applyToday },
            { label: "This Month", fn: applyCurrentMonth },
            { label: "7 Days", fn: applyLastSevenDays },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={fn}
              className="px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-all active:scale-95"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => shiftMonth(-1)}
            className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <ChevronLeft size={10} /> Prev
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="inline-flex items-center gap-0.5 px-2.5 py-1 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-all active:scale-95"
          >
            Next <ChevronRight size={10} />
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-[#161b27] border border-red-500/30 rounded-2xl p-3 text-sm text-red-400 font-bold">{err}</div>
      )}

      {/* Content Area */}
      {tab === "staff" ? (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-lg w-full">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="animate-spin text-blue-400" size={26} />
              </div>
            ) : filteredStaffPayments.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                Koi staff payment record nahi mila.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider select-none">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Staff</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Note</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]/50">
                    {filteredStaffPayments.map((payment, i) => {
                      const mechanic = mechanicById.get(payment.mechanic_id);
                      return (
                        <tr key={payment.id} className="hover:bg-blue-500/[0.02] transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-[10px]">{i + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <MechAvatar image={mechanic?.image_path} name={mechanicName(mechanic)} cls="w-7 h-7 text-[10px]" />
                              <div className="min-w-0">
                                <div className="font-bold text-white text-[11px] truncate">{mechanicName(mechanic)}</div>
                                <div className="text-[10px] text-slate-500">{mechanic?.designation || "Staff"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-300">{fmtDate(payment.date_paid)}</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-[200px] truncate">{payment.reason || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-400 text-xs">{moneyFull(payment.amount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEditStaff(payment)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all" title="Edit">
                                <Pencil size={11} />
                              </button>
                              <button onClick={() => deleteStaffPayment(payment.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all" title="Delete">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0d1117] border-t border-[#21293d] font-bold text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-400 text-[10px]">
                        Total ({filteredStaffPayments.length} entries):
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-400 font-black">{moneyFull(staffTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
            ) : filteredStaffPayments.length === 0 ? (
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 text-center space-y-2">
                <UserRound size={20} className="text-slate-500 mx-auto" />
                <p className="text-white font-bold text-xs">No staff payments found</p>
                <p className="text-slate-500 text-[11px]">Try adjusting search or date range.</p>
              </div>
            ) : (
              filteredStaffPayments.map((payment) => {
                const mechanic = mechanicById.get(payment.mechanic_id);
                return (
                  <div key={payment.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-md space-y-3 hover:border-slate-600 transition-all">
                    {/* Top Row */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <MechAvatar image={mechanic?.image_path} name={mechanicName(mechanic)} cls="w-9 h-9 text-xs" />
                        <div className="min-w-0">
                          <p className="text-white font-black text-sm truncate">{mechanicName(mechanic)}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{mechanic?.designation || "Staff"}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <span className="inline-block px-2.5 py-1 rounded-lg font-black text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          {moneyFull(payment.amount)}
                        </span>
                        <p className="text-[9px] font-bold text-slate-500 flex items-center gap-1 justify-end">
                          <Clock size={9} /> {fmtDate(payment.date_paid)}
                        </p>
                      </div>
                    </div>

                    {/* Inner Box */}
                    <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21293d]/80">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Note</span>
                          <p className="text-[11px] text-slate-300 truncate">{payment.reason || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => openEditStaff(payment)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteStaffPayment(payment.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-lg w-full">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="animate-spin text-blue-400" size={26} />
              </div>
            ) : filteredShopExpenses.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                Koi shop expense record nahi mila.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-bold uppercase text-slate-400 tracking-wider select-none">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21293d]/50">
                    {filteredShopExpenses.map((expense, i) => (
                      <tr key={expense.id} className="hover:bg-blue-500/[0.02] transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold text-[10px]">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                            <FileText size={9} />
                            {expense.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-300">{fmtDateTime(expense.date_created)}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-[200px] truncate">{expense.remarks || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-black text-red-400 text-xs">{moneyFull(expense.amount)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditExpense(expense)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-all" title="Edit">
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => deleteExpense(expense.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all" title="Delete">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#0d1117] border-t border-[#21293d] font-bold text-xs">
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-400 text-[10px]">
                        Total ({filteredShopExpenses.length} entries):
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-400 font-black">{moneyFull(expenseTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
            ) : filteredShopExpenses.length === 0 ? (
              <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-8 text-center space-y-2">
                <Receipt size={20} className="text-slate-500 mx-auto" />
                <p className="text-white font-bold text-xs">No shop expenses found</p>
                <p className="text-slate-500 text-[11px]">Try adjusting search or date range.</p>
              </div>
            ) : (
              filteredShopExpenses.map((expense) => (
                <div key={expense.id} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-3.5 shadow-md space-y-3 hover:border-slate-600 transition-all">
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                        <FileText size={9} />
                        {expense.category}
                      </span>
                      <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={9} /> {fmtDateTime(expense.date_created)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block px-2.5 py-1 rounded-lg font-black text-xs bg-red-500/10 text-red-400 border border-red-500/30">
                        {moneyFull(expense.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Inner Box */}
                  <div className="bg-[#0d1117] p-3 rounded-xl border border-[#21293d]/80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Remarks</span>
                        <p className="text-[11px] text-slate-300 truncate">{expense.remarks || "—"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => openEditExpense(expense)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteExpense(expense.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Staff Payment Modal */}
      {staffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && closeModals()}
        >
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"> 
            <div className="px-4 py-3.5 bg-[#0d1117] border-b border-[#21293d] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserRound size={15} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">
                    {staffForm.id ? "Edit Staff Payment" : "Add Staff Payment"}
                  </h3>
                  <p className="text-[10px] text-slate-500">Staff ko diye advance ya salary payment</p>
                </div>
              </div>
              <button onClick={closeModals} className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={saveStaffPayment} className="p-4 space-y-4">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Staff</span>
                <SearchableSelect
                  value={staffForm.mechanic_id || null}
                  options={mechanics.map((mechanic) => ({
                    id: mechanic.id,
                    label: mechanicName(mechanic),
                  }))}
                  onSelect={(v) => setStaffForm((prev) => ({ ...prev, mechanic_id: v }))}
                  placeholder="Select staff..."
                  clearLabel="Select staff..."
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={staffForm.amount}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]"
                    placeholder="0.00"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Payment Date</span>
                  <input
                    type="date"
                    value={staffForm.date_paid}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, date_paid: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Reason / Note</span>
                <textarea
                  value={staffForm.reason}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all resize-none placeholder:text-slate-700 [color-scheme:dark]"
                  placeholder="Salary for month, advance, note..."
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModals} className="flex-1 py-2.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {staffForm.id ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shop Expense Modal */}
      {expenseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && closeModals()}
        >
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="px-4 py-3.5 bg-[#0d1117] border-b border-[#21293d] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Receipt size={15} />
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">
                    {expenseForm.id ? "Edit Shop Expense" : "Add Shop Expense"}
                  </h3>
                  <p className="text-[10px] text-slate-500">Shop kharch category ke saath</p>
                </div>
              </div>
              <button onClick={closeModals} className="w-7 h-7 rounded-lg bg-[#161b27] border border-[#21293d] text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={saveExpense} className="p-4 space-y-4">
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Category</span>
                <input
                  list="expense-categories"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]"
                  placeholder="Rent, travel, office, material..."
                />
                <datalist id="expense-categories">
                  {(expenseForm.category.trim() &&
                  !categoryOptions.includes(expenseForm.category.trim())
                    ? [...categoryOptions, expenseForm.category.trim()]
                    : categoryOptions
                  ).map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]"
                    placeholder="0.00"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Date</span>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all [color-scheme:dark]"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Remarks</span>
                <textarea
                  value={expenseForm.remarks}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all resize-none placeholder:text-slate-700 [color-scheme:dark]"
                  placeholder="Optional note"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModals} className="flex-1 py-2.5 bg-[#0d1117] hover:bg-[#1a2236] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 hover:text-white transition-all active:scale-95">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {expenseForm.id ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
