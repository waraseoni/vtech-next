"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { todayIST, startOfMonthIST, endOfMonthIST, parseISTDate, formatIST } from "@/lib/dateUtils";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

type Expense = {
  id: number;
  category: string;
  amount: number;
  remarks: string | null;
  date_created: string;
};

type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  designation: string | null;
  status: number;
  delete_flag: number;
};

type AdvancePayment = {
  id: number;
  mechanic_id: number;
  amount: number;
  date_paid: string;
  reason: string | null;
};

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

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl";
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]";
const label = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnPrimary = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;
const btnDanger = `${btn} bg-red-600 hover:bg-red-500 text-white`;

function monthRangeFrom(base: string, diff = 0) {
  const date = parseISTDate(base);
  const d = new Date(date.getFullYear(), date.getMonth() + diff, 1);
  return { from: startOfMonthIST(d), to: endOfMonthIST(d) };
}

function lastSevenDaysRange(base: string) {
  const end = parseISTDate(base);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  return {
    from: formatIST(start),
    to: formatIST(end),
  };
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
  return `Rs.${Number(value || 0).toFixed(2)}`;
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
  return [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ").trim();
}

function ExpensesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const urlTab = searchParams.get("tab") === "shop" ? "shop" : "staff";
  const urlSearch = searchParams.get("q") || "";
  const urlFrom = searchParams.get("from") || startOfMonthIST();
  const urlTo = searchParams.get("to") || todayIST();

  const [tab, setTab] = useState<TabId>(urlTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  const [search, setSearch] = useState(urlSearch);
  const [fromDate, setFromDate] = useState(urlFrom);
  const [toDate, setToDate] = useState(urlTo);

  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [staffPayments, setStaffPayments] = useState<AdvancePayment[]>([]);
  const [shopExpenses, setShopExpenses] = useState<Expense[]>([]);

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
          .select("id, firstname, middlename, lastname, designation, status, delete_flag")
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
    loadData();
  }, [loadData]);

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
    return shopExpenses.filter((expense) => {
      const dateKey = String(expense.date_created).slice(0, 10);
      if (fromDate && dateKey < fromDate) return false;
      if (toDate && dateKey > toDate) return false;
      if (!term) return true;
      const hay = [expense.category, expense.remarks || "", expense.date_created].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [shopExpenses, search, fromDate, toDate]);

  const staffTotal = useMemo(
    () => filteredStaffPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredStaffPayments]
  );
  const expenseTotal = useMemo(
    () => filteredShopExpenses.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredShopExpenses]
  );

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
        const { error } = await supabase.from("advance_payments").update(payload).eq("id", staffForm.id);
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
        const { error } = await supabase.from("expense_list").update(payload).eq("id", expenseForm.id);
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

  return (
    <AdminPage
      title="Pay Outs"
      subtitle="Do tabs: staff ko diye advance/payment aur alag shop expenses."
    >
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl ${
            toast.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border-red-500/30 bg-red-500/15 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          <button className={tab === "staff" ? btnPrimary : btnGhost} onClick={() => setTab("staff")}>
            <UserRound size={13} className="inline-block mr-1" />
            Staff Payment
          </button>
          <button className={tab === "shop" ? btnPrimary : btnGhost} onClick={() => setTab("shop")}>
            <Wallet size={13} className="inline-block mr-1" />
            Shop Expenses
          </button>
        </div>

        <div className={`${card} p-4`}>
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-end">
            <div>
              <label className={label}>Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${input} pl-9`}
                  placeholder={tab === "staff" ? "Staff name ya note search karo" : "Category ya remarks search karo"}
                />
              </div>
            </div>
            <div>
              <label className={label}>From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={input} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary} onClick={tab === "staff" ? openCreateStaff : openCreateExpense}>
                <Plus size={13} className="inline-block mr-1" />
                Add
              </button>
              <button className={btnGhost} onClick={resetFilters}>
                <RotateCcw size={13} className="inline-block mr-1" />
                Current Month
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btnGhost} onClick={applyToday}>Today</button>
            <button className={btnGhost} onClick={applyCurrentMonth}>This Month</button>
            <button className={btnGhost} onClick={applyLastSevenDays}>Last 7 Days</button>
            <button className={btnGhost} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={13} className="inline-block mr-1" />
              Last Month
            </button>
            <button className={btnGhost} onClick={() => shiftMonth(1)}>
              Next Month
              <ChevronRight size={13} className="inline-block ml-1" />
            </button>
            <span className="inline-flex items-center rounded-xl border border-[#21293d] bg-[#111520] px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
              {fmtDate(fromDate)} to {fmtDate(toDate)}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title={tab === "staff" ? "Staff Entries" : "Expense Entries"}
            value={String(tab === "staff" ? filteredStaffPayments.length : filteredShopExpenses.length)}
            tone="blue"
          />
          <SummaryCard
            title={tab === "staff" ? "Staff Total Payout" : "Shop Expense Total"}
            value={money(tab === "staff" ? staffTotal : expenseTotal)}
            tone="red"
          />
          <SummaryCard
            title="Selected Range"
            value={`${fromDate} to ${toDate}`}
            tone="slate"
          />
        </div>

        {err && <div className={`${card} p-4 text-sm text-red-400`}>{err}</div>}

        <div className={card}>
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <Loader2 className="animate-spin text-blue-400" size={26} />
            </div>
          ) : tab === "staff" ? (
            filteredStaffPayments.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Koi staff payment record nahi mila.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Staff</th>
                      <th className="px-4 py-3 text-left">Note</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2234]">
                    {filteredStaffPayments.map((payment) => {
                      const mechanic = mechanicById.get(payment.mechanic_id);
                      return (
                        <tr key={payment.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 text-slate-300">{fmtDate(payment.date_paid)}</td>
                          <td className="px-4 py-3">
                            <div className="font-black text-slate-100">{mechanicName(mechanic)}</div>
                            <div className="mt-1 text-xs text-slate-600">{mechanic?.designation || "Staff"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{payment.reason || "-"}</td>
                          <td className="px-4 py-3 text-right font-black text-amber-300">{money(payment.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button className={btnGhost} onClick={() => openEditStaff(payment)}>
                                <Pencil size={13} className="inline-block mr-1" />
                                Edit
                              </button>
                              <button className={btnDanger} onClick={() => deleteStaffPayment(payment.id)}>
                                <Trash2 size={13} className="inline-block mr-1" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#111520]">
                      <td
                        className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-600"
                        colSpan={3}
                      >
                        Total Staff Payout
                      </td>
                      <td className="px-4 py-3 text-right font-black text-amber-300">{money(staffTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          ) : filteredShopExpenses.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">Koi shop expense record nahi mila.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-[#111520] text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {filteredShopExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-slate-300">{fmtDateTime(expense.date_created)}</td>
                      <td className="px-4 py-3 font-black text-slate-100">{expense.category}</td>
                      <td className="px-4 py-3 text-slate-500">{expense.remarks || "-"}</td>
                      <td className="px-4 py-3 text-right font-black text-red-300">{money(expense.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button className={btnGhost} onClick={() => openEditExpense(expense)}>
                            <Pencil size={13} className="inline-block mr-1" />
                            Edit
                          </button>
                          <button className={btnDanger} onClick={() => deleteExpense(expense.id)}>
                            <Trash2 size={13} className="inline-block mr-1" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#111520]">
                    <td
                      className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-600"
                      colSpan={3}
                    >
                      Total Shop Expense
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-300">{money(expenseTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#21293d] bg-[#161b27] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#21293d] px-5 py-4">
              <div>
                <h3 className="text-base font-black text-white">
                  {staffForm.id ? "Edit Staff Payment" : "Add Staff Payment"}
                </h3>
                <p className="text-xs text-slate-600">Staff ko diye advance ya salary payment yahin save honge.</p>
              </div>
              <button
                onClick={closeModals}
                className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={saveStaffPayment} className="space-y-4 px-5 py-5">
              <Field title="Staff">
                <select
                  value={staffForm.mechanic_id}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, mechanic_id: e.target.value }))}
                  className={input}
                >
                  <option value="">Select staff...</option>
                  {mechanics.map((mechanic) => (
                    <option key={mechanic.id} value={String(mechanic.id)}>
                      {mechanicName(mechanic)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="Amount">
                  <input
                    type="number"
                    step="0.01"
                    value={staffForm.amount}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className={input}
                    placeholder="0.00"
                  />
                </Field>
                <Field title="Payment Date">
                  <input
                    type="date"
                    value={staffForm.date_paid}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, date_paid: e.target.value }))}
                    className={input}
                  />
                </Field>
              </div>
              <Field title="Reason / Note">
                <textarea
                  value={staffForm.reason}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  className={`${input} resize-none`}
                  placeholder="Salary for month, advance, note..."
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-[#21293d] pt-4">
                <button type="button" onClick={closeModals} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? (
                    <Loader2 size={13} className="inline-block mr-1 animate-spin" />
                  ) : (
                    <Save size={13} className="inline-block mr-1" />
                  )}
                  {staffForm.id ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[#21293d] bg-[#161b27] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#21293d] px-5 py-4">
              <div>
                <h3 className="text-base font-black text-white">
                  {expenseForm.id ? "Edit Shop Expense" : "Add Shop Expense"}
                </h3>
                <p className="text-xs text-slate-600">Anya shop kharch yahan category ke saath maintain honge.</p>
              </div>
              <button
                onClick={closeModals}
                className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={saveExpense} className="space-y-4 px-5 py-5">
              <Field title="Category">
                <input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))}
                  className={input}
                  placeholder="Rent, travel, office, material..."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field title="Amount">
                  <input
                    type="number"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className={input}
                    placeholder="0.00"
                  />
                </Field>
                <Field title="Date">
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                    className={input}
                  />
                </Field>
              </div>
              <Field title="Remarks">
                <textarea
                  value={expenseForm.remarks}
                  onChange={(e) => setExpenseForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  rows={4}
                  className={`${input} resize-none`}
                  placeholder="Optional note"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-[#21293d] pt-4">
                <button type="button" onClick={closeModals} className={btnGhost}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? (
                    <Loader2 size={13} className="inline-block mr-1 animate-spin" />
                  ) : (
                    <Save size={13} className="inline-block mr-1" />
                  )}
                  {expenseForm.id ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ExpensesPageInner />
    </Suspense>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "red" | "slate";
}) {
  const tones = {
    blue: "text-blue-400 border-blue-500/20 bg-blue-500/8",
    red: "text-red-400 border-red-500/20 bg-red-500/8",
    slate: "text-slate-300 border-slate-500/20 bg-slate-500/8",
  };

  return (
    <div className={`${card} p-4`}>
      <div
        className={`inline-flex rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tones[tone]}`}
      >
        {title}
      </div>
      <p className="mt-3 text-lg font-black text-white">{value}</p>
    </div>
  );
}



