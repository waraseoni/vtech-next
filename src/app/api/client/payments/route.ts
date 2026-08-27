import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = getAdminSupabase();

// Client ke apne payments (sirf uske client_id ke)
export async function GET() {
  const client = await requireClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("client_payments")
    .select("id, amount, discount, payment_date, payment_mode, remarks, job_id, loan_id")
    .eq("client_id", client.profile.client_id)
    .order("payment_date", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payments: data || [] });
}
