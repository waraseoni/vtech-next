import { NextRequest, NextResponse } from "next/server";
import { requireStaffWithRole } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

// Passkey device management — plan §5.2 / §9 Phase 2
//   GET    → apne devices (admin: ?user_id= dekar kisi ka bhi)
//   PATCH  → rename { id, device_name } (apna; admin koi bhi)
//   DELETE → ?id= apna device hataya; ?user_id= (admin) revoke-all
// Saara DB access service-role se (RLS browser writes allow nahi karta).

const isAdmin = (role: string) => role === "admin" || role === "developer";

export async function GET(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const other = new URL(req.url).searchParams.get("user_id");
  if (other && !isAdmin(session.role)) {
    return NextResponse.json(
      { error: "Sirf admin doosron ke devices dekh sakta hai" },
      { status: 403 }
    );
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("user_passkeys")
    .select("id, user_id, device_name, last_used_at, date_created, date_updated")
    .eq("user_id", other ?? session.user.id)
    .order("date_created", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ devices: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: number; device_name?: string };
  const id = Number(body?.id);
  const name = String(body?.device_name ?? "")
    .trim()
    .slice(0, 60);
  if (!Number.isInteger(id) || !name) {
    return NextResponse.json({ error: "id aur device_name zaroori hai" }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("user_passkeys")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Device nahi mila" }, { status: 404 });
  if (row.user_id !== session.user.id && !isAdmin(session.role)) {
    return NextResponse.json({ error: "Sirf apna device badal sakte hain" }, { status: 403 });
  }

  const { error } = await admin.from("user_passkeys").update({ device_name: name }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const userId = url.searchParams.get("user_id");
  const admin = getAdminSupabase();

  // Admin revoke-all for a user
  if (userId) {
    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Sirf admin revoke-all kar sakta hai" }, { status: 403 });
    }
    const { error } = await admin.from("user_passkeys").delete().eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return NextResponse.json({ error: "id ya user_id zaroori hai" }, { status: 400 });
  }

  const { data: row } = await admin
    .from("user_passkeys")
    .select("id, user_id")
    .eq("id", numId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Device nahi mila" }, { status: 404 });
  if (row.user_id !== session.user.id && !isAdmin(session.role)) {
    return NextResponse.json({ error: "Sirf apna device hata sakte hain" }, { status: 403 });
  }

  const { error } = await admin.from("user_passkeys").delete().eq("id", numId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
