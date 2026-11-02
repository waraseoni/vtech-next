import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchClientContactsWith } from "@/lib/clientContactsQuery";
import type { ClientContact } from "@/lib/clientContactsQuery";

// ─── Types ───────────────────────────────────────────────────────────────────
// BUG FIX 14: Client type me image_path optional rakha gaya (photo delete par
// undefined set hota hai).
export type Client = {
  id: number;
  firstname: string;
  middlename?: string;
  lastname: string;
  contact: string;
  email?: string;
  address?: string;
  opening_balance: number;
  payment_due_date?: string | null;
  payment_due_remarks?: string | null;
  image_path?: string;
  date_created: string;
  fullName: string;
};

export type PaymentReminder = {
  id: number;
  client_id: number;
  amount_due: number;
  channel: string;
  status: string;
  remarks: string;
  reminder_date: string;
};

export type Job = {
  id: number;
  job_id?: string;
  code?: string;
  item: string;
  fault?: string;
  remark?: string;
  uniq_id?: string;
  location_id?: number | null;
  status: number;
  amount?: number;
  date_created: string;
  date_completed?: string;
  client_contact?: string;
  client_name?: string;
  date_updated?: string;
};

export type DirectSale = {
  id: number;
  sale_code: string;
  payment_mode: string;
  remarks?: string;
  total_amount: number;
  date_created: string;
};

export type Payment = {
  id: number;
  payment_date: string;
  amount: number;
  discount: number;
  net_amount?: number;
  payment_mode: string;
  payment_type?: string;
  remarks?: string;
  job_id?: string | null;
  bill_no?: string | null;
  loan_id?: number | null;
};

export type Loan = {
  id: number;
  client_id: number;
  principal_amount: number;
  interest_rate: number;
  loan_period: number;
  total_payable: number;
  emi_amount: number;
  remarks?: string;
  loan_date: string;
  status: number;
  paid?: number;
  balance?: number;
};

// ─── Snapshot ────────────────────────────────────────────────────────────────
export type ClientDetail = {
  client: Client;
  contacts: ClientContact[];
  reminders: PaymentReminder[];
  jobs: Job[];
  directSales: DirectSale[];
  payments: Payment[];
  loans: Loan[];
  loanGiven: number;
  loanRepaid: number;
  monthlyEMI: number;
};

export type LoanPaymentRow = {
  loan_id: number | null;
  amount: number;
  discount: number | null;
};

/**
 * Locked loans ki paid amount ek map me group karta hai (N+1 fix) aur PHP
 * `view_client.php` ke totals nikalta hai: sirf ACTIVE (status=1) loans
 * balance me count hote hain, aur EMI remaining se capped hai.
 */
export function buildLoanAggregates(loans: Loan[], paymentRows: LoanPaymentRow[]) {
  const paymentMap = new Map<number, number>();
  paymentRows.forEach((r) => {
    if (r.loan_id == null) return;
    const key = Number(r.loan_id);
    paymentMap.set(key, (paymentMap.get(key) || 0) + (r.amount + (r.discount || 0)));
  });

  const withPaid: Loan[] = loans.map((loan) => {
    const paid = paymentMap.get(Number(loan.id)) || 0;
    return { ...loan, paid, balance: loan.total_payable - paid };
  });

  const activeLoans = withPaid.filter((l) => l.status === 1);
  const loanGiven = activeLoans.reduce((s, l) => s + (l.total_payable || 0), 0);
  const loanRepaid = activeLoans.reduce((s, l) => s + (l.paid || 0), 0);
  const monthlyEMI = activeLoans.reduce((s, l) => {
    const remaining = l.total_payable - (l.paid || 0);
    return s + (remaining > 0 ? Math.min(l.emi_amount || 0, remaining) : 0);
  }, 0);

  return { loans: withPaid, loanGiven, loanRepaid, monthlyEMI };
}

export async function fetchClientDetailData(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientDetail> {
  // Sabhi data queries PARALLEL chalayi jaati hain (sequential await page ko
  // slow karta hai). Loans ke per-loan payments ki N+1 queries bhi ek hi
  // query me badal di gayi hain.
  const [
    { data: cd, error: ce },
    { data: remd },
    { data: jd },
    { data: sd },
    { data: pd },
    { data: ld },
    { data: lpAll },
    ccRows,
  ] = await Promise.all([
    supabase
      .from("client_list")
      .select(
        "id, firstname, middlename, lastname, contact, email, address, opening_balance, payment_due_date, payment_due_remarks, image_path, date_created"
      )
      .eq("id", clientId)
      .eq("delete_flag", 0)
      .single(),
    supabase
      .from("payment_reminders")
      .select("id, client_id, amount_due, channel, status, remarks, reminder_date")
      .eq("client_id", clientId)
      .order("reminder_date", { ascending: false }),
    supabase
      .from("transaction_list")
      .select(
        "id, job_id, code, item, fault, remark, uniq_id, status, amount, date_created, date_completed"
      )
      .eq("client_name", String(clientId))
      .order("job_id", { ascending: false }),
    supabase
      .from("direct_sales")
      .select("id, sale_code, payment_mode, remarks, total_amount, date_created")
      .eq("client_id", clientId)
      .order("date_created", { ascending: false }),
    supabase
      .from("client_payments")
      .select(
        "id, payment_date, amount, discount, payment_mode, payment_type, remarks, job_id, bill_no, loan_id"
      )
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false }),
    supabase.from("client_loans").select("*").eq("client_id", clientId).order("loan_date", {
      ascending: false,
    }),
    supabase
      .from("client_payments")
      .select("loan_id, amount, discount")
      .eq("client_id", clientId)
      .not("loan_id", "is", null),
    fetchClientContactsWith(supabase, clientId).catch(() => []),
  ]);

  if (ce || !cd) throw ce || new Error("Client not found");
  const fullName = [cd.firstname, cd.middlename, cd.lastname].filter(Boolean).join(" ").trim();

  const { loans, loanGiven, loanRepaid, monthlyEMI } = buildLoanAggregates(
    (ld || []) as Loan[],
    (lpAll || []) as LoanPaymentRow[]
  );

  return {
    client: { ...cd, fullName },
    contacts: ccRows || [],
    reminders: remd || [],
    jobs: jd || [],
    directSales: sd || [],
    payments: pd || [],
    loans,
    loanGiven,
    loanRepaid,
    monthlyEMI,
  };
}
