import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type LedgerRow = {
  date: string;
  desc: string;
  ref: string;
  status: string | number | null;
  remark: string;
  debit: number;
  credit: number;
  discount: number;
  effectiveCr: number;
  balance: number;
  isBroughtFwd: boolean;
};

const sum = (arr: { [k: string]: number | null }[] | null, key: string) =>
  (arr || []).reduce((s, r) => s + (Number(r[key]) || 0), 0);

// Client ka apna ledger — sirf uske client_id ke data (service-role, RLS bypass).
// Numeric logic staff ke /clients/[id]/ledger-print jaisa hi hai taaki due match ho.
export async function GET(request: NextRequest) {
  const client = await requireClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = client.profile.client_id;
  const fromDate = request.nextUrl.searchParams.get("from") || "";
  const toDate = request.nextUrl.searchParams.get("to") || "";

  // ── Client + firm info ────────────────────────────────────────────────
  const { data: cd } = await supabaseAdmin
    .from("client_list")
    .select("firstname, middlename, lastname, contact, email, opening_balance")
    .eq("id", cid)
    .eq("delete_flag", 0)
    .maybeSingle();

  const { data: sys } = await supabaseAdmin
    .from("system_info")
    .select("meta_field, meta_value")
    .in("meta_field", ["name", "address", "contact", "email"]);

  const firmMap: Record<string, string> = {};
  (sys || []).forEach(r => { firmMap[r.meta_field] = r.meta_value; });

  // ── IST date filters ──────────────────────────────────────────────────
  const from = fromDate ? `${fromDate}T00:00:00+05:30` : null;
  const to = toDate ? `${toDate}T23:59:59+05:30` : null;

  // ── All-time totals (due hamesha full history se — filter kabhi nahi) ─
  const [
    { data: allJobs },
    { data: allSales },
    { data: allLoans },
    { data: allPays },
  ] = await Promise.all([
    supabaseAdmin.from("transaction_list").select("amount").eq("client_name", String(cid)).eq("del_status", 0),
    supabaseAdmin.from("direct_sales").select("total_amount").eq("client_id", cid),
    supabaseAdmin.from("client_loans").select("total_payable").eq("client_id", cid),
    supabaseAdmin.from("client_payments").select("amount, discount").eq("client_id", cid),
  ]);

  const totalRepairs = sum(allJobs, "amount");
  const totalSales = sum(allSales, "total_amount");
  const totalLoans = sum(allLoans, "total_payable");
  const totalPaid = sum(allPays, "amount");
  const totalDisc = sum(allPays, "discount");
  const totalSettled = totalPaid + totalDisc;
  const openingBal = Number(cd?.opening_balance ?? 0);
  const due = openingBal + totalRepairs + totalSales + totalLoans - totalSettled;

  // ── Brought-forward (filter se pehle ka balance) ──────────────────────
  let broughtFwd = openingBal;
  if (from) {
    const [
      { data: preJ }, { data: preS }, { data: preL }, { data: preP }
    ] = await Promise.all([
      supabaseAdmin.from("transaction_list").select("amount").eq("client_name", String(cid)).eq("del_status", 0).lt("date_created", from),
      supabaseAdmin.from("direct_sales").select("total_amount").eq("client_id", cid).lt("date_created", from),
      supabaseAdmin.from("client_loans").select("total_payable").eq("client_id", cid).lt("loan_date", from),
      supabaseAdmin.from("client_payments").select("amount, discount").eq("client_id", cid).lt("payment_date", from),
    ]);
    broughtFwd = openingBal + sum(preJ, "amount") + sum(preS, "total_amount")
      + sum(preL, "total_payable") - (sum(preP, "amount") + sum(preP, "discount"));
  }

  // ── Ledger rows ───────────────────────────────────────────────────────
  const ledger: LedgerRow[] = [];

  if (from) {
    ledger.push({
      date: fromDate, desc: "Balance Brought Forward", ref: "—",
      status: "brought_fwd", remark: "Previous balance",
      debit: broughtFwd > 0 ? broughtFwd : 0,
      credit: broughtFwd < 0 ? Math.abs(broughtFwd) : 0,
      discount: 0, effectiveCr: broughtFwd < 0 ? Math.abs(broughtFwd) : 0,
      balance: 0, isBroughtFwd: true,
    });
  }

  // Repairs
  {
    let q = supabaseAdmin
      .from("transaction_list")
      .select("id, job_id, item, amount, status, remark, date_created, date_completed")
      .eq("client_name", String(cid))
      .eq("del_status", 0);
    if (from) q = q.gte("date_created", from);
    if (to) q = q.lte("date_created", to);
    const { data: jobs } = await q;
    (jobs || []).forEach(j => ledger.push({
      date: j.date_created, desc: `Job: ${j.item || "—"}`,
      ref: j.job_id || `JOB-${j.id}`, status: j.status,
      remark: j.remark || "", debit: j.amount || 0,
      credit: 0, discount: 0, effectiveCr: 0, balance: 0, isBroughtFwd: false,
    }));
  }

  // Direct sales
  {
    let q = supabaseAdmin.from("direct_sales")
      .select("id, sale_code, total_amount, remarks, date_created")
      .eq("client_id", cid);
    if (from) q = q.gte("date_created", from);
    if (to) q = q.lte("date_created", to);
    const { data: sales } = await q;
    (sales || []).forEach(s => ledger.push({
      date: s.date_created, desc: "Direct Sale", ref: s.sale_code,
      status: "direct_sale", remark: s.remarks || "",
      debit: s.total_amount || 0, credit: 0, discount: 0, effectiveCr: 0,
      balance: 0, isBroughtFwd: false,
    }));
  }

  // Loans
  {
    let q = supabaseAdmin.from("client_loans")
      .select("id, total_payable, remarks, loan_date")
      .eq("client_id", cid);
    if (from) q = q.gte("loan_date", from);
    if (to) q = q.lte("loan_date", to);
    const { data: loans } = await q;
    (loans || []).forEach(l => ledger.push({
      date: l.loan_date, desc: "Loan Disbursement",
      ref: `LN-${String(l.id).padStart(5, "0")}`, status: "loan",
      remark: l.remarks || "", debit: l.total_payable || 0,
      credit: 0, discount: 0, effectiveCr: 0, balance: 0, isBroughtFwd: false,
    }));
  }

  // Payments (loan payments rows me nahi — double count avoid, staff logic)
  {
    let q = supabaseAdmin.from("client_payments")
      .select("id, amount, discount, net_amount, payment_date, payment_mode, bill_no, remarks")
      .eq("client_id", cid).is("loan_id", null);
    if (from) q = q.gte("payment_date", from);
    if (to) q = q.lte("payment_date", to);
    const { data: pays } = await q;
    (pays || []).forEach(p => {
      const disc = Number(p.discount) || 0;
      const amt = Number(p.amount) || 0;
      ledger.push({
        date: p.payment_date, desc: "Payment Received",
        ref: p.bill_no ? `BILL-${p.bill_no}` : `PAY-${p.id}`,
        status: "payment", remark: p.remarks || p.payment_mode || "",
        debit: 0, credit: amt, discount: disc, effectiveCr: amt + disc,
        balance: 0, isBroughtFwd: false,
      });
    });
  }

  // Sort by date (brought forward pehle)
  ledger.sort((a, b) => {
    if (a.isBroughtFwd) return -1;
    if (b.isBroughtFwd) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Running balance
  let running = from ? broughtFwd : openingBal;
  ledger.forEach(r => {
    if (!r.isBroughtFwd) {
      running += r.debit - r.effectiveCr;
      r.balance = running;
    } else {
      r.balance = broughtFwd;
    }
  });

  return NextResponse.json({
    client: {
      id: cid,
      name: [cd?.firstname, cd?.middlename, cd?.lastname].filter(Boolean).join(" ").trim() || `Client #${cid}`,
      contact: cd?.contact ?? "",
      email: cd?.email ?? "",
      opening_balance: openingBal,
    },
    firm: {
      name: firmMap.name || "V-Technologies",
      address: firmMap.address || "Jabalpur, MP",
      contact: firmMap.contact || "",
      email: firmMap.email || "",
    },
    due,
    totals: { repairs: totalRepairs, sales: totalSales, loans: totalLoans, payments: totalSettled, discount: totalDisc },
    rows: ledger,
  });
}
