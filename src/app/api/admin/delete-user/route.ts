import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { userId, requesterId } = await req.json();
    if (!userId || !requesterId) {
      return NextResponse.json({ error: "userId aur requesterId required hain" }, { status: 400 });
    }

    // Verify requester is admin
    const { data: rp } = await supabaseAdmin
      .from("profiles").select("role").eq("id", requesterId).single();
    if (rp?.role !== "admin") {
      return NextResponse.json({ error: "Sirf Admin delete kar sakta hai" }, { status: 403 });
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