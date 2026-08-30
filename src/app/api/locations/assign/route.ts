import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

const sb = getAdminSupabase();

/** Supabase errors plain object hote hain (Error instance nahi) → .message safely nikalo. */
function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && !!e.message) return String(e.message);
  return "Unknown error — server logs check karein";
}

/**
 * Product stock location save — server-side + service-role (RLS-bypass).
 * Browser anon-client ab `locations` / `product_locations` par directly
 * SELECT/INSERT nahi kar sakta (RLS `is_frontend_staff` lockdown), isliye ye
 * route service-role se kaam karta hai. `locations.rack` NOT NULL hai → missing
 * fields empty string se bheje jaate hain (null se nahi).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { product_id, zone, rack, bin, box } = body as {
      product_id?: number;
      zone?: string;
      rack?: string;
      bin?: string;
      box?: string;
    };

    if (!product_id)
      return NextResponse.json({ error: "product_id required" }, { status: 400 });

    const z = (zone || "").trim();
    const r = (rack || "").trim();
    const b = (bin || "").trim();
    const bx = (box || "").trim();
    const anySet = !!(z || r || b || bx);

    let locationId: number | null = null;

    if (anySet) {
      // Kanonical normalized hierarchy se FK ids resolve karo (name ➜ id).
      // `locations` row tab free-text strings ke SAATH proper FK references
      // (zone_id/rack_id/bin_id/box_id) rakhta hai — same source of truth.
      const [zRec, rRec, bRec, xRec] = await Promise.all([
        sb.from("location_zones").select("id").eq("name", z).eq("delete_flag", 0).maybeSingle(),
        sb.from("location_racks").select("id").eq("name", r).eq("delete_flag", 0).maybeSingle(),
        sb.from("location_bins").select("id").eq("name", b).eq("delete_flag", 0).maybeSingle(),
        sb.from("location_boxes").select("id").eq("name", bx).eq("delete_flag", 0).maybeSingle(),
      ]);
      const zone_id = z && zRec?.data?.id ? zRec.data.id : null;
      const rack_id = r && rRec?.data?.id ? rRec.data.id : null;
      const bin_id = b && bRec?.data?.id ? bRec.data.id : null;
      const box_id = bx && xRec?.data?.id ? xRec.data.id : null;

      const { data: existing } = await sb
        .from("locations")
        .select("id")
        .eq("zone", z)
        .eq("rack", r)
        .eq("bin", b)
        .eq("box", bx)
        .maybeSingle();

      if (existing) {
        locationId = existing.id;
        // Pichle save ke baad hierarchy badli ho to FKs sync rakho.
        const { error: updErr } = await sb
          .from("locations")
          .update({ zone_id, rack_id, bin_id, box_id })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { data: newLoc, error: insErr } = await sb
          .from("locations")
          .insert({ zone: z, rack: r, bin: b, box: bx, zone_id, rack_id, bin_id, box_id })
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (newLoc) locationId = newLoc.id;
      }
    }

    // `product_locations` ka PK `(product_id, location_id)` hai (koi `id` column
    // nahi). Edit UI location ko singular treat karta hai → product ke saare rows
    // delete karke ek naya insert (idempotent, duplicate nahi banta).
    const { error: delErr } = await sb
      .from("product_locations")
      .delete()
      .eq("product_id", product_id);
    if (delErr) throw delErr;

    if (locationId !== null) {
      const { error: insErr } = await sb
        .from("product_locations")
        .insert({ product_id, location_id: locationId });
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true, locationId });
  } catch (err: unknown) {
    console.error("[locations/assign] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
