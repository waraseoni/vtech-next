import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Neutral read layer for `/clients/[id]/ledger-print` ka DEFAULT (unfiltered)
 * view. Filters (from/to/status) wala path abhi page par client-side hi hai —
 * server layout ko searchParams nahi milte, isliye seed sirf bina filter wale
 * ledger ke liye banta hai.
 */

export type LedgerRowSeed = {
  date: string;
  desc: string;
  ref: string;
  statusKey: string | number | null;
  remark: string;
  debit: number;
  credit: number;
  discount: number;
  effectiveCr: number;
  balance: number;
  deliveredDate?: string;
  isBroughtFwd: boolean;
};

export type LedgerFirmInfo = { name: string; address: string; contact: string; email: string };

export type LedgerClientInfo = {
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  address: string;
  email: string;
  opening_balance: number;
};

export type LedgerTotals = {
  repairs: number;
  sales: number;
  loans: number;
  payments: number;
  discount: number;
};

export type ClientLedgerSeed = {
  client: LedgerClientInfo | null;
  firmInfo: LedgerFirmInfo;
  rows: LedgerRowSeed[];
  totals: LedgerTotals;
};

const DEFAULT_FIRM: LedgerFirmInfo = {
  name: "V-Technologies",
  address: "Jabalpur, MP",
  contact: "",
  email: "",
};

export async function fetchClientLedgerSeed(
  supabase: SupabaseClient,
  clientId: number
): Promise<ClientLedgerSeed> {
  const [{ data: cd }, { data: sys }] = await Promise.all([
    supabase
      .from("client_list")
      .select("firstname, middlename, lastname, contact, address, email, opening_balance")
      .eq("id", clientId)
      .eq("delete_flag", 0)
      .single(),
    supabase
      .from("system_info")
      .select("meta_field, meta_value")
      .in("meta_field", ["name", "address", "contact", "email"]),
  ]);

  const firmInfo: LedgerFirmInfo = { ...DEFAULT_FIRM };
  if (sys) {
    const m: Record<string, string> = {};
    sys.forEach((r: { meta_field: string; meta_value: string }) => {
      m[r.meta_field] = r.meta_value;
    });
    firmInfo.name = m.name || DEFAULT_FIRM.name;
    firmInfo.address = m.address || DEFAULT_FIRM.address;
    firmInfo.contact = m.contact || "";
    firmInfo.email = m.email || "";
  }

  const [{ data: allJobs }, { data: allSales }, { data: allLoans }, { data: allPays }] =
    await Promise.all([
      supabase.from("transaction_list").select("amount").eq("client_name", String(clientId)),
      supabase.from("direct_sales").select("total_amount").eq("client_id", clientId),
      supabase.from("client_loans").select("total_payable").eq("client_id", clientId),
      supabase.from("client_payments").select("amount, discount").eq("client_id", clientId),
    ]);

  const totalRepairs = (allJobs || []).reduce(
    (s: number, r: { amount: number }) => s + (r.amount || 0),
    0
  );
  const totalSales = (allSales || []).reduce(
    (s: number, r: { total_amount: number }) => s + (r.total_amount || 0),
    0
  );
  const totalLoans = (allLoans || []).reduce(
    (s: number, r: { total_payable: number }) => s + (r.total_payable || 0),
    0
  );
  const totalPaid = (allPays || []).reduce(
    (s: number, p: { amount: number }) => s + (p.amount || 0),
    0
  );
  const totalDisc = (allPays || []).reduce(
    (s: number, p: { discount: number }) => s + (p.discount || 0),
    0
  );
  const totalSettled = totalPaid + totalDisc;

  // Default view: koi filter nahi — saare repairs/sales/loans/payments.
  const [{ data: jobs }, { data: sales }, { data: loans }, { data: pays }] = await Promise.all([
    supabase
      .from("transaction_list")
      .select("id, job_id, item, amount, status, remark, date_created, date_completed")
      .eq("client_name", String(clientId)),
    supabase
      .from("direct_sales")
      .select("id, sale_code, total_amount, remarks, date_created")
      .eq("client_id", clientId),
    supabase
      .from("client_loans")
      .select("id, total_payable, remarks, loan_date")
      .eq("client_id", clientId),
    supabase
      .from("client_payments")
      .select("id, amount, discount, net_amount, payment_date, payment_mode, bill_no, remarks")
      .eq("client_id", clientId)
      .is("loan_id", null),
  ]);

  const rows: LedgerRowSeed[] = [];

  (jobs || []).forEach((j: Record<string, unknown>) =>
    rows.push({
      date: String(j.date_created ?? ""),
      desc: `Job: ${(j.item as string) || "—"}`,
      ref: (j.job_id as string) || `JOB-${j.id}`,
      statusKey: (j.status as number) ?? null,
      remark: (j.remark as string) || "",
      debit: (j.amount as number) || 0,
      credit: 0,
      discount: 0,
      effectiveCr: 0,
      balance: 0,
      deliveredDate: j.status === 5 ? (j.date_completed as string) : undefined,
      isBroughtFwd: false,
    })
  );

  (sales || []).forEach((s: Record<string, unknown>) =>
    rows.push({
      date: String(s.date_created ?? ""),
      desc: "Direct Sale",
      ref: String(s.sale_code ?? ""),
      statusKey: "direct_sale",
      remark: (s.remarks as string) || "",
      debit: (s.total_amount as number) || 0,
      credit: 0,
      discount: 0,
      effectiveCr: 0,
      balance: 0,
      isBroughtFwd: false,
    })
  );

  (loans || []).forEach((l: Record<string, unknown>) =>
    rows.push({
      date: String(l.loan_date ?? ""),
      desc: "Loan Disbursement",
      ref: `LN-${String(l.id).padStart(5, "0")}`,
      statusKey: "loan",
      remark: (l.remarks as string) || "",
      debit: (l.total_payable as number) || 0,
      credit: 0,
      discount: 0,
      effectiveCr: 0,
      balance: 0,
      isBroughtFwd: false,
    })
  );

  (pays || []).forEach((p: Record<string, unknown>) => {
    const disc = (p.discount as number) || 0;
    const amt = (p.amount as number) || 0;
    rows.push({
      date: String(p.payment_date ?? ""),
      desc: "Payment Received",
      ref: p.bill_no ? `BILL-${p.bill_no}` : `PAY-${p.id}`,
      statusKey: "payment",
      remark: (p.remarks as string) || (p.payment_mode as string) || "",
      debit: 0,
      credit: amt,
      discount: disc,
      effectiveCr: amt + disc,
      balance: 0,
      isBroughtFwd: false,
    });
  });

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = (cd?.opening_balance as number) || 0;
  rows.forEach((r) => {
    running += r.debit - r.effectiveCr;
    r.balance = running;
  });

  return {
    client: (cd as LedgerClientInfo) || null,
    firmInfo,
    rows,
    totals: {
      repairs: totalRepairs,
      sales: totalSales,
      loans: totalLoans,
      payments: totalSettled,
      discount: totalDisc,
    },
  };
}
