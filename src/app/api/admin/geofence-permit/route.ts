// ─── Outside-Work Permit admin API (service-role, admin-only) ─────────────
// docs/plans/staff_geofence_viewonly_plan.md §5.4–5.5.
// Staff khud ko permit nahi de sakta: RLS me authenticated ke liye
// INSERT/DELETE policy NAHI — sirf ye route (requireAdmin + service_role).
// Expiry DB-time: POST me minutes → expires_at = now() + minutes (server).
import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";
import { parseBody, parseData } from "@/lib/validation";
import {
  geofencePermitCreateSchema,
  geofencePermitDeleteQuerySchema,
} from "@/lib/validation/schemas/geofencePermit";

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
  if (!admin)
    return NextResponse.json({ error: "Sirf Admin permit de sakta hai" }, { status: 403 });
  const parsed = await parseBody(geofencePermitCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { user_id, mechanic_id, minutes, reason } = parsed.data;

  if (!PRESETS.includes(minutes) && minutes % 5 !== 0) {
    return NextResponse.json({ error: "Duration 5-min multiple me do" }, { status: 400 });
  }
  const expires = new Date(Date.now() + minutes * 60000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("staff_geofence_permit")
    .insert({
      user_id,
      mechanic_id: mechanic_id ?? null,
      reason: reason ?? "",
      granted_by: admin.user.id,
      expires_at: expires,
    })
    .select("id, expires_at")
    .single();
  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        {
          error:
            "Permit table abhi DB me nahi — migration chalao (20260926_staff_geofence_permit.sql)",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logActivity(
    "Granted Outside-Work Permit",
    "Staff",
    user_id,
    `${minutes} min — ${(reason ?? "").slice(0, 120)}`
  );
  return NextResponse.json({ ok: true, permit: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "Sirf Admin revoke kar sakta hai" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const parsed = parseData(geofencePermitDeleteQuerySchema, {
    id: searchParams.get("id") ?? undefined,
  });
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  const { error } = await supabaseAdmin.from("staff_geofence_permit").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity("Revoked Outside-Work Permit", "Staff", String(id), "admin revoke");
  return NextResponse.json({ ok: true });
}
