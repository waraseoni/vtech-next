import type { SupabaseClient } from "@supabase/supabase-js";
import { pageAll } from "@/lib/fetch-all";
import { currentMonthIST } from "@/lib/dateUtils";

/**
 * `/reports/loan` (current month) ka neutral server seed — client ke
 * fetchData ka read-only mirror. Caller cookie+RLS client pass karta hai.
 */

export type LoanReportRow = {
  id: number;
  client_name: string;
  principal_amount: number;
  interest_rate: number;
  total_payable: number;
  emi_amount: number;
  received: number;
  pending: number;
  status: number;
  remaining_installments?: number;
};

export type LoanReportSeed = { month: string; rows: LoanReportRow[] };

type LoanDoc = {
  id: number;
  client_id: number | null;
  loan_date: string;
  principal_amount: number | null;
  interest_rate: number | null;
  total_payable: number | null;
  emi_amount: number | null;
  status: number | null;
};
type ClientDoc = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
};
type PaymentDoc = {
  loan_id: number | null;
  amount: number | null;
  discount: number | null;
  payment_date: string;
};

export async function fetchLoanReportSeed(
  supabase: SupabaseClient,
  month = currentMonthIST()
): Promise<LoanReportSeed> {
  const y = parseInt(month.slice(0, 4));
  const m = parseInt(month.slice(5, 7));
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data: loans } = await pageAll<LoanDoc>(
    supabase
      .from("client_loans")
      .select(
        "id, client_id, loan_date, principal_amount, interest_rate, total_payable, emi_amount, status"
      )
      .lte("loan_date", monthEnd)
      .gte("status", 0)
  );

  const { data: clients } = await pageAll<ClientDoc>(
    supabase.from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0)
  );

  const { data: payments } = await pageAll<PaymentDoc>(
    supabase
      .from("client_payments")
      .select("loan_id, amount, discount, payment_date")
      .not("loan_id", "is", null)
      .lte("payment_date", monthEnd)
  );

  const loanRows: LoanReportRow[] = [];
  for (const l of loans || []) {
    const client = (clients || []).find((c) => c.id === l.client_id);
    if (!client) continue;
    const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");
    const loanPmts = payments?.filter((p) => p.loan_id === l.id) || [];
    const received = loanPmts.reduce((s, p) => s + (p.amount || 0) + (p.discount || 0), 0);
    const targetEmi = l.emi_amount || 0;
    const pending = Math.max(0, targetEmi - received);

    loanRows.push({
      id: l.id,
      client_name: name,
      principal_amount: l.principal_amount || 0,
      interest_rate: l.interest_rate || 0,
      total_payable: l.total_payable || 0,
      emi_amount: targetEmi,
      received,
      pending,
      remaining_installments:
        targetEmi > 0
          ? Math.ceil(
              ((l.total_payable || 0) - received > 0 ? (l.total_payable || 0) - received : 0) /
                targetEmi
            )
          : 0,
      status: l.status || 0,
    });
  }

  return { month, rows: loanRows };
}
