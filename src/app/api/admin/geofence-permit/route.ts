// ─── Outside-Work Permit admin API (service-role, admin-only) ─────────────
// docs/plans/staff_geofence_viewonly_plan.md §5.4–5.5.
// Staff khud ko permit nahi de sakta: RLS me authenticated ke liye
// INSERT/DELETE policy NAHI — sirf ye route (requireAdmin + service_role).
// Expiry DB-time: POST me minutes → expires_at = now() + minutes (server).
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const supabaseAdmin = getAdminSupabase();

const PRESETS = [30, 60, 120, 240, 480, 1440]; // minutes

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sirf Admin dekh sakta hai" }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from("staff_geofence_permit")
    .select("id, user_id, mechanic_id, reason, granted_by, granted_at, expires_at")
    .order("expires_at", { ascending: false })
    .limit(50);
  if (error) {
    // Table abhi apply nahi hui (migration pending) → khali list, hard fail nahi
    if (error.code === "42P01") return NextResponse.json({ permits: [], missing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ permits: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sirf Admin permit de sakta hai" }, { status: 403 });
  const body = (await req.json()) as {
    user_id?: string;
    mechanic_id?: number | null;
    minutes?: number;
    reason?: string;
  };
  if (!body.user_id) return NextResponse.json({ error: "user_id zaroori hai" }, { status: 400 });
  const minutes = Number(body.minutes) || 60;
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 4320) {
    return NextResponse.json({ error: "Duration 5 min – 3 din ke beech ho" }, { status: 400 });
  }
  if (!PRESETS.includes(minutes) && minutes % 5 !== 0) {
    return NextResponse.json({ error: "Duration 5-min multiple me do" }, { status: 400 });
  }
  const expires = new Date(Date.now() + minutes * 60000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("staff_geofence_permit")
    .insert({
      user_id: body.user_id,
      mechanic_id: body.mechanic_id ?? null,
      reason: (body.reason ?? "").slice(0, 200),
      granted_by: admin.user.id,
      expires_at: expires,
    })
    .select("id, expires_at")
    .single();
  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "Permit table abhi DB me nahi — migration chalao (20260926_staff_geofence_permit.sql)" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logActivity(
    "Granted Outside-Work Permit",
    "Staff",
    body.user_id,
    `${minutes} min — ${(body.reason ?? "").slice(0, 120)}`
  );
  return NextResponse.json({ ok: true, permit: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Sirf Admin revoke kar sakta hai" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id zaroori hai" }, { status: 400 });
  const { error } = await supabaseAdmin.from("staff_geofence_permit").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity("Revoked Outside-Work Permit", "Staff", id, "admin revoke");
  return NextResponse.json({ ok: true });
}
