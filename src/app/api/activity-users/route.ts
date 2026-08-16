import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Resolves activity log user_id → display name.
// Two naming systems coexist in activity_logs.user_id:
//   - Legacy PHP/MariaDB data (module 'Transactions') → user_id = id in `users` table
//   - New Next.js system data (module 'Jobs', 'Clients', etc.) → user_id = 0 (Admin) or mechanic_list.id
// The `users` table is RLS-blocked for anon, so we resolve with the service-role key here.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids") || "";
    const ids = [...new Set(idsParam.split(",").map(s => s.trim()).filter(s => /^\d+$/.test(s)).map(Number))];
    if (ids.length === 0) return NextResponse.json({ users: {}, mechanics: {} });

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const users: Record<string, string> = {};
    const { data: uRows } = await admin
      .from("users")
      .select("id, firstname, lastname")
      .in("id", ids);
    (uRows || []).forEach(u => {
      users[String(u.id)] = [u.firstname, u.lastname].filter(Boolean).join(" ") || `User ${u.id}`;
    });

    const mechanics: Record<string, string> = {};
    const { data: mRows } = await admin
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .in("id", ids);
    (mRows || []).forEach(m => {
      mechanics[String(m.id)] = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ") || `User ${m.id}`;
    });

    return NextResponse.json({ users, mechanics });
  } catch (err) {
    console.error("activity-users error:", err);
    return NextResponse.json({ users: {}, mechanics: {} }, { status: 500 });
  }
}
