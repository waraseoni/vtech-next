import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchClientContactsWith, type ClientContact } from "@/lib/clientContactsQuery";

/**
 * Neutral read layer for Clients ke action/form pages (payment, loan, EMI,
 * edit). Server RSC layout seed aur browser fallback dono yahi functions
 * call karte hain — query filters/order pehle jaisa exact hai.
 */

export type PaymentJobOption = {
  id: number;
  job_id: string;
  code?: string;
  item: string;
  amount: number;
  status: number;
};

export type PaymentSaleOption = { id: number; sale_code: string; total_amount: number };

export type ClientBalanceSeed = {
  name: string;
  balance: number;
};

export type ClientPaymentSeed = ClientBalanceSeed & {
  jobs: PaymentJobOption[];
  directSales: PaymentSaleOption[];
};

export type ActionLoanRow = {
  id: number;
  principal_amount: number;
  total_payable: number;
  emi_amount: number;
  loan_date: string;
  remarks?: string;
  status: number;
};

export type ActiveLoanOption = ActionLoanRow & { paid: number; balance: number };

export type ClientEmiSeed = {
  name: string;
  loans: ActiveLoanOption[];
};

export type EditClientRow = {
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  contact: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number | null;
};

export type ClientEditSeed = {
  client: EditClientRow;
  contacts: ClientContact[];
};

const fullName = (c: {
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
}) => [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");

/** Canonical PHP balance formula (view_client.php / client_api.php). */
export function computeClientBalance(input: {
  openingBalance: number;
  repairBilled: number;
  directBilled: number;
  totalPaid: number;
  loanGiven: number;
  loanRepaid: number;
}): number {
  return (
    input.openingBalance +
    input.repairBilled +
    input.directBilled -
    input.totalPaid +
    input.loanGiven -
    input.loanRepaid
  );
}

/** Active loans me paid/balance compute karo; sirf bachi hui amount wale rakho. */
export function buildActiveLoans(
  loans: ActionLoanRow[],
  paymentRows: { loan_id: number | null; amount: number; discount: number | null }[]
): ActiveLoanOption[] {
  const paidMap = new Map<number, number>();
  paymentRows.forEach((p) => {
    if (p.loan_id == null) return;
    const key = Number(p.loan_id);
    paidMap.set(key, (paidMap.get(key) || 0) + (p.amount + (p.discount || 0)));
  });

  const active: ActiveLoanOption[] = [];
  loans.forEach((loan) => {
    const paid = paidMap.get(Number(loan.id)) || 0;
    const balance = loan.total_payable - paid;
    if (balance > 0) active.push({ ...loan, paid, balance });
  });
  return active;
}

type ClientHead = {
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  opening_balance: number | null;
};

async function fetchBalanceParts(supabase: SupabaseClient, clientId: number) {
  const [{ data: cd }, { data: txns }, { data: sales }, { data: pays }, { data: loans }] =
    await Promise.all([
      supabase
        .from("client_list")
        .select("firstname, middlename, lastname, opening_balance")
        .eq("id", clientId)
        .eq("delete_flag", 0)
        .single(),
      supabase
        .from("transaction_list")
        .select("amount")
        .eq("client_name", String(clientId))
        .eq("status", 5),
      supabase.from("direct_sales").select("total_amount").eq("client_id", clientId),
      supabase
        .from("client_payments")
        .select("amount, discount, loan_id")
        .eq("client_id", clientId),
      supabase
        .from("client_loans")
        .select("id, total_payable")
        .eq("client_id", clientId)
        .eq("status", 1),
    ]);

  const head = (cd || {}) as ClientHead;
  const activeLoanIds = new Set((loans || []).map((l: { id: number }) => l.id));
  let loanRepaid = 0;
  let totalPaid = 0;
  (pays || []).forEach((p: { amount: number; discount?: number; loan_id?: number }) => {
    const credit = p.amount + (p.discount || 0);
    if (!p.loan_id) totalPaid += credit;
    else if (activeLoanIds.has(p.loan_id)) loanRepaid += credit;
  });

  const balance = computeClientBalance({
    openingBalance: head.opening_balance || 0,
    repairBilled: (txns || []).reduce((s: number, j: { amount: number }) => s + (j.amount || 0), 0),
    directBilled: (sales || []).reduce(
      (s: number, d: { total_amount: number }) => s + (d.total_amount || 0),
      0
    ),
    totalPaid,
    loanGiven: (loans || []).reduce(
      (s: number, l: { total_payable: number }) => s + (l.total_payable || 0),
      0
    ),
    loanRepaid,
  });

  return { name: fullName(head), balance };
}

/** Give-loan page: client ka naam + live balance. */
export async function fetchClientBalanceSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientBalanceSeed> {
  return fetchBalanceParts(supabase, clientId);
}

/** Add-payment page: balance ke saath bill reference options. */
export async function fetchClientPaymentSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientPaymentSeed> {
  const [head, { data: jobsData }, { data: salesData }] = await Promise.all([
    fetchBalanceParts(supabase, clientId),
    supabase
      .from("transaction_list")
      .select("id, job_id, code, item, amount, status")
      .eq("client_name", String(clientId))
      .not("status", "in", "(4,5)")
      .order("date_created", { ascending: false }),
    supabase
      .from("direct_sales")
      .select("id, sale_code, total_amount")
      .eq("client_id", clientId)
      .order("date_created", { ascending: false }),
  ]);

  return {
    ...head,
    jobs: (jobsData || []) as PaymentJobOption[],
    directSales: (salesData || []) as PaymentSaleOption[],
  };
}

/** Collect-EMI page: active loans (remaining balance > 0), ek hi payments query. */
export async function fetchClientEmiSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientEmiSeed> {
  const [{ data: cd }, { data: loansData }] = await Promise.all([
    supabase
      .from("client_list")
      .select("firstname, middlename, lastname")
      .eq("id", clientId)
      .eq("delete_flag", 0)
      .single(),
    supabase
      .from("client_loans")
      .select("id, principal_amount, total_payable, emi_amount, loan_date, remarks, status")
      .eq("client_id", clientId)
      .eq("status", 1)
      .order("loan_date", { ascending: false }),
  ]);

  const loans = (loansData || []) as ActionLoanRow[];
  const loanIds = loans.map((l) => l.id);
  let pays: { loan_id: number | null; amount: number; discount: number | null }[] = [];
  if (loanIds.length > 0) {
    const { data } = await supabase
      .from("client_payments")
      .select("loan_id, amount, discount")
      .in("loan_id", loanIds);
    pays = (data || []) as typeof pays;
  }

  return {
    name: fullName((cd || {}) as Partial<ClientHead>),
    loans: buildActiveLoans(loans, pays),
  };
}

/** Edit page: client row + contacts editor rows. */
export async function fetchClientEditSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientEditSeed> {
  const [{ data, error }, contacts] = await Promise.all([
    supabase
      .from("client_list")
      .select("firstname, middlename, lastname, contact, email, address, opening_balance")
      .eq("id", clientId)
      .eq("delete_flag", 0)
      .single(),
    fetchClientContactsWith(supabase, clientId).catch(() => []),
  ]);

  if (error || !data) throw error || new Error("Client not found");
  return { client: data as EditClientRow, contacts };
}
