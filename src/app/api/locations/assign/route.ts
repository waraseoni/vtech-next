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
      // Agar hierarchy me nahi hai to auto-create kar do (old data migration).
      // Duplicate prevention: pehle active (delete_flag=0) check, phir soft-deleted
      // bhi check — agar mil jaye to reactivate karo, naya mat banao.
      const findOrCreate = async (
        table: string,
        name: string,
        parentCol: string | null,
        parentId: number | null
      ): Promise<{ id: number } | null> => {
        if (!name) return null;

        // 1. Active record dhoondo
        let q = sb.from(table).select("id").eq("name", name).eq("delete_flag", 0);
        if (parentCol && parentId != null) q = q.eq(parentCol, parentId);
        const { data: rec } = await q.maybeSingle();
        if (rec?.id) return rec;

        // 2. Soft-deleted record mila to reactivate karo (duplicate prevention)
        let q2 = sb.from(table).select("id").eq("name", name);
        if (parentCol && parentId != null) q2 = q2.eq(parentCol, parentId);
        const { data: deleted } = await q2.maybeSingle();
        if (deleted?.id) {
          await sb.from(table).update({ delete_flag: 0 }).eq("id", deleted.id);
          return deleted;
        }

        // 3. Bilkul naya — create with parent FK
        const payload: Record<string, unknown> = { name };
        if (parentCol && parentId != null) payload[parentCol] = parentId;
        const { data: ins } = await sb.from(table).insert(payload).select("id").single();
        return ins;
      };

      const zRec = await findOrCreate("location_zones", z, null, null);
      const rRec = await findOrCreate("location_racks", r, "zone_id", zRec?.id ?? null);
      const bRec = await findOrCreate("location_bins", b, "rack_id", rRec?.id ?? null);
      const xRec = await findOrCreate("location_boxes", bx, "bin_id", bRec?.id ?? null);

      const zone_id = zRec?.id ?? null;
      const rack_id = rRec?.id ?? null;
      const bin_id = bRec?.id ?? null;
      const box_id = xRec?.id ?? null;

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
