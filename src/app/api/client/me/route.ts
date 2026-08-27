import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = getAdminSupabase();

// Logged-in client ki apni info
export async function GET() {
  const client = await requireClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = client.profile.client_id;

  const [clientRes, jobsRes, salesRes, loansRes, paysRes] = await Promise.all([
    supabaseAdmin
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact, email, opening_balance")
      .eq("id", cid)
      .maybeSingle(),
    supabaseAdmin.from("transaction_list").select("amount").eq("client_name", String(cid)).eq("del_status", 0).eq("status", 5),
    supabaseAdmin.from("direct_sales").select("total_amount").eq("client_id", cid),
    supabaseAdmin.from("client_loans").select("id, total_payable").eq("client_id", cid).eq("status", 1),
    supabaseAdmin.from("client_payments").select("amount, discount, loan_id").eq("client_id", cid),
  ]);

  const data = clientRes.data;
  if (clientRes.error || !data) {
    return NextResponse.json({ error: "Client nahi mila" }, { status: 404 });
  }

  const sum = (arr: { [k: string]: number | null }[] | null, key: string) =>
    (arr || []).reduce((s, r) => s + (Number(r[key]) || 0), 0);

  // Canonical PHP formula: delivered repairs + direct sales − service payments + active loans − loan repayments
  const activeLoanIds = new Set((loansRes.data || []).map(l => Number(l.id)).filter(Boolean));
  let servicePaid = 0;
  let loanRepaid = 0;
  (paysRes.data || []).forEach(p => {
    const credit = (Number(p.amount) || 0) + (Number(p.discount) || 0);
    if (!p.loan_id || Number(p.loan_id) === 0) servicePaid += credit;
    else if (activeLoanIds.has(Number(p.loan_id))) loanRepaid += credit;
  });

  const opening_balance = Number(data.opening_balance ?? 0);
  const repairs = sum(jobsRes.data, "amount");
  const sales = sum(salesRes.data, "total_amount");
  const loans = sum(loansRes.data, "total_payable");
  const due = opening_balance + repairs + sales - servicePaid + loans - loanRepaid;

  return NextResponse.json({
    client: {
      id: data.id,
      name: [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" ").trim(),
      contact: data.contact ?? "",
      email: data.email ?? "",
      opening_balance,
      due,
    },
  });
}
