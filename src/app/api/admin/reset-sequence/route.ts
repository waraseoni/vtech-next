import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { requireAdmin } from "@/lib/api-auth";
import { isResetSequenceTable } from "@/lib/resetSequence";

/**
 * D1 (K10) — browser anon key se `reset_sequence` RPC ab call nahi hoti.
 * Admin-only route service-role client se RPC chalata hai; table name allowlist
 * se validate hota hai (arbitrary sequence reset se bachne ke liye).
 */
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ status: "failed", msg: "Admin only" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { table_name?: unknown };
  if (!isResetSequenceTable(body.table_name)) {
    return NextResponse.json(
      { status: "failed", msg: "Invalid table_name (not in allowlist)" },
      { status: 400 }
    );
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.rpc("reset_sequence", { table_name: body.table_name });
  if (error) {
    return NextResponse.json({ status: "failed", msg: error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "success",
    table: body.table_name,
    result: data ?? null,
  });
}
