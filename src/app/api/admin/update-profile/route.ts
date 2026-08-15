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
    const { userId, full_name, email, role, mechanic_id } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Sirf Admin user update kar sakta hai" }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof full_name === "string") updates.full_name = full_name;
    if (email === null || typeof email === "string") updates.email = email;
    if (role === "admin" || role === "staff" || role === "developer") {
      // Developer role sirf dev PC (env vars wale deployment) par set ho sakta hai
      const devEnabled = !!process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY && !!process.env.DEV_PORTAL_PASSWORD;
      if (role === "developer" && !devEnabled) {
        return NextResponse.json({ error: "Developer role sirf dev PC par set ho sakta hai" }, { status: 403 });
      }
      updates.role = role;
    }
    if (mechanic_id === null || (typeof mechanic_id === "number" && !Number.isNaN(mechanic_id))) {
      updates.mechanic_id = mechanic_id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Kuch update karne ko nahi mila" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      // Unique violation — mechanic already linked to another user (1:1 rule)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ye mechanic pehle se kisi aur user se linked hai — pehle wala link hatao" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: data });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
