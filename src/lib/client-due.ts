/**
 * Client DUE (outstanding balance) — SINGLE source of truth for the whole app.
 *
 * Reference: PHP vtech-rsms software
 *   - admin/clients/client_api.php                        (clients list)
 *   - admin/clients/view_client.php                       (client view)
 *   - classes/Master/SalesTrait.php :: get_client_balance (new job page)
 * All three PHP pages use the exact same formula:
 *
 *   due = opening_balance
 *       + SUM(transaction_list.amount)              WHERE status = 5            → Delivered jobs ONLY
 *       + SUM(direct_sales.total_amount)
 *       - SUM(client_payments.amount + discount)    WHERE loan_id IS NULL OR 0  → service payments only
 *       + SUM(client_loans.total_payable)           WHERE status = 1            → ACTIVE loans only
 *       - SUM(payments.amount + discount)           WHERE loan_id IN (active loans)
 */

export const JOB_STATUS_DELIVERED = 5;
export const LOAN_STATUS_ACTIVE = 1;

export type ClientDueBreakdown = {
  openingBalance: number;
  repairBilled: number;
  directSalesBilled: number;
  servicePaid: number;
  activeLoanGiven: number;
  loanRepaid: number;
  /** opening + billed − servicePaid + activeLoans − loanRepaid (>0 due, <0 advance) */
  netBalance: number;
};

export const toNum = (v: unknown): number => {
  const x = Number(v);
  return Number.isNaN(x) ? 0 : x;
};

/** Pure math — combine already-summed parts into the net due. */
export function computeClientDue(p: {
  openingBalance?: unknown;
  repairBilled?: unknown;
  directSalesBilled?: unknown;
  servicePaid?: unknown;
  activeLoanGiven?: unknown;
  loanRepaid?: unknown;
}): ClientDueBreakdown {
  const openingBalance     = toNum(p.openingBalance);
  const repairBilled       = toNum(p.repairBilled);
  const directSalesBilled  = toNum(p.directSalesBilled);
  const servicePaid        = toNum(p.servicePaid);
  const activeLoanGiven    = toNum(p.activeLoanGiven);
  const loanRepaid         = toNum(p.loanRepaid);
  return {
    openingBalance,
    repairBilled,
    directSalesBilled,
    servicePaid,
    activeLoanGiven,
    loanRepaid,
    netBalance:
      openingBalance +
      repairBilled +
      directSalesBilled -
      servicePaid +
      activeLoanGiven -
      loanRepaid,
  };
}

/** Payment is a service payment when it has no loan linked (loan_id null or 0). */
export const isServicePayment = (loanId: unknown): boolean =>
  loanId === null || loanId === undefined || toNum(loanId) === 0;

export const paymentCredit = (p: { amount?: unknown; discount?: unknown }): number =>
  toNum(p.amount) + toNum(p.discount);

/* ------------------------------------------------------------------ */
/* Bulk aggregation — for list pages that fetch rows for MANY clients  */
/* ------------------------------------------------------------------ */

export type DueRowSets = {
  /** transaction_list rows (status = 5 filtered at query time) */
  repairs?: { client_name?: unknown; amount?: unknown }[] | null;
  /** direct_sales rows */
  directSales?: { client_id?: unknown; total_amount?: unknown }[] | null;
  /** ALL client_payments rows (service + loan-linked; we partition here) */
  payments?: { client_id?: unknown; loan_id?: unknown; amount?: unknown; discount?: unknown }[] | null;
  /** ACTIVE client_loans rows only (status = 1 filtered at query time); id required */
  loans?: { id?: unknown; client_id?: unknown; total_payable?: unknown }[] | null;
};

export type ClientDueMaps = {
  repairBilled: Record<number, number>;
  directSalesBilled: Record<number, number>;
  servicePaid: Record<number, number>;
  activeLoanGiven: Record<number, number>;
  loanRepaid: Record<number, number>;
};

const bump = (map: Record<number, number>, id: number, v: number) => {
  map[id] = (map[id] || 0) + v;
};

/**
 * Build per-client maps exactly like the PHP LEFT JOIN subqueries.
 * Loans MUST be pre-filtered to status = 1 (active) by the caller.
 */
export function buildDueMaps(rows: DueRowSets): ClientDueMaps {
  const maps: ClientDueMaps = {
    repairBilled: {},
    directSalesBilled: {},
    servicePaid: {},
    activeLoanGiven: {},
    loanRepaid: {},
  };

  (rows.repairs || []).forEach((r) => {
    const cid = parseInt(String(r.client_name ?? ""), 10);
    if (!Number.isNaN(cid)) bump(maps.repairBilled, cid, toNum(r.amount));
  });

  (rows.directSales || []).forEach((d) => {
    const cid = toNum(d.client_id);
    if (cid) bump(maps.directSalesBilled, cid, toNum(d.total_amount));
  });

  // Active loan ids — repayments against these reduce the balance.
  const activeLoanIds = new Set<number>((rows.loans || []).map((l) => toNum(l.id)).filter(Boolean));

  (rows.payments || []).forEach((p) => {
    const cid = toNum(p.client_id);
    if (!cid) return;
    const credit = paymentCredit(p);
    if (isServicePayment(p.loan_id)) {
      bump(maps.servicePaid, cid, credit);
    } else if (activeLoanIds.has(toNum(p.loan_id))) {
      bump(maps.loanRepaid, cid, credit); // repayment of an ACTIVE loan
    }
    // repayments against closed/inactive loans are ignored (PHP behaviour)
  });

  (rows.loans || []).forEach((l) => {
    const cid = toNum(l.client_id);
    if (cid) bump(maps.activeLoanGiven, cid, toNum(l.total_payable));
  });

  return maps;
}

/** Net balance for a client from the maps returned by buildDueMaps(). */
export function balanceFromMaps(
  maps: ClientDueMaps,
  clientId: number,
  openingBalance?: unknown
): number {
  return computeClientDue({
    openingBalance,
    repairBilled: maps.repairBilled[clientId],
    directSalesBilled: maps.directSalesBilled[clientId],
    servicePaid: maps.servicePaid[clientId],
    activeLoanGiven: maps.activeLoanGiven[clientId],
    loanRepaid: maps.loanRepaid[clientId],
  }).netBalance;
}

/* ------------------------------------------------------------------ */
/* Single-client fetch — for job forms / anywhere one client's due     */
/* ------------------------------------------------------------------ */

// Minimal structural type so both browser (@/lib/supabase) and server
// (service-role createClient) instances work.
/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = { from: (table: string) => any };

/**
 * Fetch + compute a single client's due using the canonical PHP formula.
 * Used by /jobs/new and /jobs/[id]/edit (PHP: SalesTrait::get_client_balance).
 */
export async function fetchClientDue(
  sb: SupabaseLike,
  clientId: number
): Promise<ClientDueBreakdown> {
  const [txnsRes, salesRes, paysRes, loansRes, cdRes] = await Promise.all([
    sb.from("transaction_list").select("amount").eq("client_name", String(clientId)).eq("status", JOB_STATUS_DELIVERED),
    sb.from("direct_sales").select("total_amount").eq("client_id", clientId),
    sb.from("client_payments").select("amount, discount, loan_id").eq("client_id", clientId),
    sb.from("client_loans").select("id, total_payable").eq("client_id", clientId).eq("status", LOAN_STATUS_ACTIVE),
    sb.from("client_list").select("opening_balance").eq("id", clientId).single(),
  ]);

  const activeLoanIds = new Set<number>(
    ((loansRes.data || []) as { id: number }[]).map((l) => toNum(l.id)).filter(Boolean)
  );

  let servicePaid = 0;
  let loanRepaid = 0;
  ((paysRes.data || []) as { amount: number; discount: number; loan_id: number | null }[]).forEach((p) => {
    const credit = paymentCredit(p);
    if (isServicePayment(p.loan_id)) servicePaid += credit;
    else if (activeLoanIds.has(toNum(p.loan_id))) loanRepaid += credit;
  });

  return computeClientDue({
    openingBalance: (cdRes.data as { opening_balance: number } | null)?.opening_balance,
    repairBilled: ((txnsRes.data || []) as { amount: number }[]).reduce((s, r) => s + toNum(r.amount), 0),
    directSalesBilled: ((salesRes.data || []) as { total_amount: number }[]).reduce((s, r) => s + toNum(r.total_amount), 0),
    servicePaid,
    activeLoanGiven: ((loansRes.data || []) as { total_payable: number }[]).reduce((s, l) => s + toNum(l.total_payable), 0),
    loanRepaid,
  });
}

/** Label/type helper matching PHP resp (due / advance / settled with ±0.005 tolerance). */
export function dueLabel(bal: number): { amount: number; label: "Due" | "Advance" | "Settled"; type: "due" | "advance" | "settled" } {
  if (bal > 0.005) return { amount: bal, label: "Due", type: "due" };
  if (bal < -0.005) return { amount: Math.abs(bal), label: "Advance", type: "advance" };
  return { amount: 0, label: "Settled", type: "settled" };
}
