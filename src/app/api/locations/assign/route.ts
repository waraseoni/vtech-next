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
      } else {
        const { data: newLoc, error: insErr } = await sb
          .from("locations")
          .insert({ zone: z, rack: r, bin: b, box: bx })
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
