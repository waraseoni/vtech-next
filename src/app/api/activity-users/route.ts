import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";

// Resolves activity log user_id → display name.
// Three naming systems coexist:
//   - Legacy PHP/MariaDB data (module 'Transactions') → user_id = id in `users` table
//   - New Next.js system data (module 'Jobs', 'Clients', etc.) → user_id = 0 (Admin) or mechanic_list.id
//   - transaction_list.user_id → may be profiles.id (Supabase auth UUID)
// The `users` table is RLS-blocked for anon, so we resolve with the service-role key here.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids") || "";
    const ids = [
      ...new Set(
        idsParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^\d+$/.test(s))
          .map(Number)
      ),
    ];
    if (ids.length === 0) return NextResponse.json({ users: {}, mechanics: {} });

    const admin = getAdminSupabase();

    const users: Record<string, string> = {};
    const { data: uRows } = await admin
      .from("users")
      .select("id, firstname, lastname")
      .in("id", ids);
    (uRows || []).forEach((u) => {
      users[String(u.id)] = [u.firstname, u.lastname].filter(Boolean).join(" ") || `User ${u.id}`;
    });

    const mechanics: Record<string, string> = {};
    const { data: mRows } = await admin
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .in("id", ids);
    (mRows || []).forEach((m) => {
      mechanics[String(m.id)] =
        [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ") || `User ${m.id}`;
    });

    // profiles table — transaction_list.user_id references profiles.mechanic_id
    const unresolved = ids.filter((id) => !users[String(id)] && !mechanics[String(id)]);
    if (unresolved.length > 0) {
      const { data: pRows } = await admin
        .from("profiles")
        .select("full_name, mechanic_id")
        .in("mechanic_id", unresolved);
      (pRows || []).forEach((p) => {
        if (p.full_name && p.mechanic_id) {
          users[String(p.mechanic_id)] = p.full_name;
        }
      });
    }

    return NextResponse.json({ users, mechanics });
  } catch (err) {
    logger.error("activity-users error:", err);
    return NextResponse.json({ users: {}, mechanics: {} }, { status: 500 });
  }
}
