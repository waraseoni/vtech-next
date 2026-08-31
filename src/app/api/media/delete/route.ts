import { NextRequest, NextResponse } from "next/server";
import { requireStaffWithRole } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";

/**
 * POST /api/media/delete
 * Staff-authenticated — messenger media (storage `media` bucket) delete karo.
 *
 * Body: { paths: string[] }   (storage paths e.g. "abc_xyz/123-img.jpg")
 *
 * Client-side supabase.storage.remove() kisi storage.objects RLS quirk se
 * chupchaap fail ho sakta tha (deleteMessage me error swallow ho jata tha) —
 * isliye storage delete ab service_role (RLS-bypass) server route se hota hai,
 * jisse file sach me bucket se hat jati hai. Sirf us conversation ka member
 * (sender/recipient) apni message ki media hi delete kar sakta hai.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffWithRole();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const me = auth.user.id;

    const body = (await req.json().catch(() => ({}))) as { paths?: unknown };
    if (!Array.isArray(body.paths) || body.paths.length === 0) {
      return NextResponse.json({ error: "paths required" }, { status: 400 });
    }
    const paths = body.paths.filter((p): p is string => typeof p === "string" && p.length > 0);
    if (paths.length === 0) {
      return NextResponse.json({ error: "paths required" }, { status: 400 });
    }

    const admin = getAdminSupabase();

    // Sirf usi message ki media delete karo jisme ye user sender YA recipient hai.
    const allowed: string[] = [];
    for (const p of paths) {
      const { data } = await admin
        .from("messages")
        .select("id")
        .eq("media_url", p)
        .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
        .maybeSingle();
      if (data) allowed.push(p);
    }

    if (allowed.length === 0) {
      return NextResponse.json({ error: "Koi authorized media nahi mili" }, { status: 403 });
    }

    const { error } = await admin.storage.from("media").remove(allowed);
    if (error) {
      return NextResponse.json({ status: "failed", msg: error.message }, { status: 500 });
    }
    return NextResponse.json({ status: "success", removed: allowed.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
