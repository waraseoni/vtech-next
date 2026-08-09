import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
    supabaseAdmin.from("transaction_list").select("amount").eq("client_name", String(cid)).eq("del_status", 0),
    supabaseAdmin.from("direct_sales").select("total_amount").eq("client_id", cid),
    supabaseAdmin.from("client_loans").select("total_payable").eq("client_id", cid),
    supabaseAdmin.from("client_payments").select("amount, discount").eq("client_id", cid),
  ]);

  const data = clientRes.data;
  if (clientRes.error || !data) {
    return NextResponse.json({ error: "Client nahi mila" }, { status: 404 });
  }

  const sum = (arr: { [k: string]: number | null }[] | null, key: string) =>
    (arr || []).reduce((s, r) => s + (Number(r[key]) || 0), 0);

  const opening_balance = Number(data.opening_balance ?? 0);
  const repairs = sum(jobsRes.data, "amount");
  const sales = sum(salesRes.data, "total_amount");
  const loans = sum(loansRes.data, "total_payable");
  const settled = sum(paysRes.data, "amount") + sum(paysRes.data, "discount");
  const due = opening_balance + repairs + sales + loans - settled;

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
