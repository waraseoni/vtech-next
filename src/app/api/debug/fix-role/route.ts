import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-auth";

/**
 * POST /api/debug/fix-role
 *
 * Auto-fix: agar logged-in user ki profile missing hai ya role 'staff' hai
 * (Supabase trigger ki wajah se), to use 'admin' banata hai — sirf tab jab
 * profiles mein koi OTHER admin exist nahi karta (fresh install case).
 *
 * Ye endpoint LICENSE GATE se bhi call hota hai — taaki admin ko manually
 * Supabase jana na pade.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminSupabase();

    // Check: koi aur admin hai?
    const { data: otherAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .neq("id", user.id)
      .limit(1);

    // Current user ki profile check
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    let action = "none";

    if (!profile) {
      // Profile exist nahi karti — banao with role='admin'
      const { error } = await adminClient
        .from("profiles")
        .insert({ id: user.id, full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin", role: "admin" });
      if (error) {
        return NextResponse.json({ error: "Profile create nahi hua: " + error.message }, { status: 500 });
      }
      action = "created_as_admin";
    } else if (profile.role !== "admin" && (!otherAdmins || otherAdmins.length === 0)) {
      // Koi aur admin nahi hai — isko admin banao
      const { error } = await adminClient
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", user.id);
      if (error) {
        return NextResponse.json({ error: "Role update nahi hua: " + error.message }, { status: 500 });
      }
      action = "promoted_to_admin";
    } else if (profile.role === "admin") {
      action = "already_admin";
    } else {
      return NextResponse.json({
        error: "Dusre admin pehle se hain. Aapka role 'staff' hai — admin se baat karein.",
        role: profile.role,
      }, { status: 403 });
    }

    // Fresh profile data bhejo
    const { data: updated } = await adminClient
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      action,
      role: updated?.role,
      fullName: updated?.full_name,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
