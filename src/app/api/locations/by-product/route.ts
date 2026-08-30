import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

const sb = getAdminSupabase();

/**
 * Product locations reader (service-role / RLS-bypass).
 *
 * `product_locations` + `locations` tables ab `is_frontend_staff` RLS se gated
 * hain → browser anon-client inhe padh kar SIRF [] dekh payega. Isliye pages
 * (detail, list, locate, dashboard) is server route se data lete hain.
 *
 * Query:  GET /api/locations/by-product?ids=1,2,3,...
 * Return: { [product_id]: [{ zone, rack, bin, box }, ...] }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const idsParam = request.nextUrl.searchParams.get("ids") || "";
    const ids = Array.from(
      new Set(
        idsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    );

    const response: Record<number, { zone: string; rack: string; bin: string; box: string }[]> = {};
    if (ids.length === 0) return NextResponse.json(response);

    const { data, error } = await sb
      .from("product_locations")
      .select(
        "product_id, location_id, locations!inner(zone, rack, bin, box)"
      )
      .in("product_id", ids);
    if (error) throw error;

    for (const row of (data || []) as Array<{
      product_id: number;
      locations:
        | { zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }
        | Array<{ zone?: string | null; rack?: string | null; bin?: string | null; box?: string | null }>;
    }>) {
      const loc = Array.isArray(row.locations) ? row.locations[0] : row.locations;
      const entry = {
        zone: loc?.zone ?? "",
        rack: loc?.rack ?? "",
        bin: loc?.bin ?? "",
        box: loc?.box ?? "",
      };
      response[row.product_id] = response[row.product_id] || [];
      response[row.product_id].push(entry);
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("[locations/by-product] error:", err);
    const msg =
      err && typeof err === "object" && "message" in err && !!err.message
        ? String(err.message)
        : "Unknown error — server logs check karein";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
