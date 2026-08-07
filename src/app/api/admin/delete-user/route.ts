import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required hai" }, { status: 400 });
    }

    // Verify requester is admin via session cookie
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Sirf Admin delete kar sakta hai" }, { status: 403 });
    }

    // ── Last-admin protection ─────────────────────────────────────────────
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if (targetProfile?.role === "admin") {
      const { count } = await supabaseAdmin
        .from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: "Last admin ko delete nahi kar sakte" }, { status: 400 });
      }
    }

    // Delete from auth (profiles row bhi cascade delete hogi agar FK set hai)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Manually delete profile agar cascade nahi hai
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}