import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAll } from "@/lib/fetch-all";
import { todayIST, parseISTDate } from "@/lib/dateUtils";
import { buildDueMaps, balanceFromMaps } from "@/lib/client-due";

/**
 * `/reports/due-reminders` ka neutral server seed — client ke fetchData ka
 * read-only mirror (same queries, same formulas, same fallbacks).
 * Caller cookie+RLS client pass karta hai; yahan koi write nahi hoti.
 */

export type DueStatusKey = "overdue" | "today" | "upcoming" | "future" | "no_date";

export type DueReminderRow = {
  id: number;
  name: string;
  image: string | null;
  contact: string;
  opening_balance: number;
  payment_due_date: string | null;
  payment_due_remarks: string | null;
  total_repairs: number;
  total_direct_sales: number;
  total_loans: number;
  total_payments: number;
  last_reminder: string | null;
  reminder_count: number;
  balance: number;
  status_key: DueStatusKey;
};

export type DueRemindersSeed = {
  /** Default URL filter values — client inhi par seedReady decide karta hai. */
  status: string;
  from: string;
  to: string;
  firmInfo: Record<string, string>;
  rows: DueReminderRow[];
};

type ClientRow = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  contact: string | null;
  opening_balance: number | string | null;
  payment_due_date: string | null;
  payment_due_remarks: string | null;
  image_path: string | null;
};
type RepairRow = { client_name: number | string | null; amount: number | string | null };
type SaleRow = { client_id: number | null; total_amount: number | string | null };
type LoanRow = { id: number; client_id: number | null; total_payable: number | string | null };
type PaymentRow = {
  client_id: number | null;
  amount: number | string | null;
  discount: number | string | null;
  loan_id: number | null;
};
type ReminderRow = { client_id: number | null; reminder_date: string | null };

export async function fetchDueRemindersSeed(
  supabase: SupabaseClient,
  { status = "all", from = "", to = "" }: { status?: string; from?: string; to?: string } = {}
): Promise<DueRemindersSeed> {
  // Firm info (WhatsApp reminder template client side resolve hota hai)
  const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
  const firmInfo: Record<string, string> = {};
  (sys || []).forEach((r) => {
    firmInfo[r.meta_field] = r.meta_value;
  });

  // All clients
  const { data: clients, error } = await supabase
    .from("client_list")
    .select(
      "id, firstname, middlename, lastname, contact, opening_balance, payment_due_date, payment_due_remarks, image_path"
    )
    .eq("delete_flag", 0);
  if (error) throw error;

  const clientRows = (clients || []) as ClientRow[];
  if (clientRows.length === 0) {
    return { status, from, to, firmInfo, rows: [] };
  }

  // Aggregates (batch, paginated to bypass the 1000-row PostgREST cap)
  const [repairs, sales, loans, payments, reminders] = await Promise.all([
    pageAll<RepairRow>(
      supabase.from("transaction_list").select("client_name, amount").eq("status", 5)
    ),
    pageAll<SaleRow>(supabase.from("direct_sales").select("client_id, total_amount")),
    pageAll<LoanRow>(
      supabase.from("client_loans").select("id, client_id, total_payable").eq("status", 1)
    ),
    pageAll<PaymentRow>(
      supabase.from("client_payments").select("client_id, amount, discount, loan_id")
    ),
    pageAll<ReminderRow>(supabase.from("payment_reminders").select("client_id, reminder_date")),
  ]);

  const m = buildDueMaps({
    repairs: repairs.data,
    directSales: sales.data,
    payments: payments.data,
    loans: loans.data,
  });

  const lastRemMap = new Map<number, string>();
  const countMap = new Map<number, number>();
  (reminders.data || []).forEach((r) => {
    const id = Number(r.client_id);
    if (!id) return;
    countMap.set(id, (countMap.get(id) || 0) + 1);
    const d = r.reminder_date;
    if (d && (!lastRemMap.has(id) || d > lastRemMap.get(id)!)) lastRemMap.set(id, d);
  });

  const today = parseISTDate(todayIST());
  const todayMs = today.getTime();

  const built: DueReminderRow[] = clientRows.map((c) => {
    const balance = balanceFromMaps(m, c.id, Number(c.opening_balance) || 0);

    let status_key: DueStatusKey = "no_date";
    if (c.payment_due_date) {
      const dueMs = parseISTDate(c.payment_due_date).getTime();
      const diff = Math.round((dueMs - todayMs) / 86400000);
      status_key = diff < 0 ? "overdue" : diff === 0 ? "today" : diff <= 7 ? "upcoming" : "future";
    }

    return {
      id: c.id,
      name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
      image: c.image_path || null,
      contact: c.contact || "",
      opening_balance: Number(c.opening_balance) || 0,
      payment_due_date: c.payment_due_date || null,
      payment_due_remarks: c.payment_due_remarks || null,
      total_repairs: m.repairBilled[c.id] || 0,
      total_direct_sales: m.directSalesBilled[c.id] || 0,
      total_loans: m.activeLoanGiven[c.id] || 0,
      total_payments: (m.servicePaid[c.id] || 0) + (m.loanRepaid[c.id] || 0),
      last_reminder: lastRemMap.get(c.id) || null,
      reminder_count: countMap.get(c.id) || 0,
      balance,
      status_key,
    };
  });

  return { status, from, to, firmInfo, rows: built.filter((r) => r.balance > 0.01) };
}
