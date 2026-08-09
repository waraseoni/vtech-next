import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Client ke apne repairs (sirf uske client_id ke)
export async function GET(request: NextRequest) {
  const client = await requireClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cid = client.profile.client_id;
  const statusFilter = request.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("transaction_list")
    .select("id, job_id, code, item, fault, remark, status, amount, date_created, date_completed")
    .eq("client_name", String(cid))
    .eq("del_status", 0)
    .order("id", { ascending: false });

  if (statusFilter && /^[0-9]$/.test(statusFilter)) {
    query = query.eq("status", parseInt(statusFilter, 10));
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ jobs: data || [] });
}
