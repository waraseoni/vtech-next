import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

const sb = getAdminSupabase();

/** Supabase errors plain object hote hain (Error instance nahi) → .message safely nikalo. */
function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && !!e.message) return String(e.message);
  return "Unknown error — server logs check karein";
}

/**
 * Location picker suggestions — server-side + service-role (RLS-bypass).
 * Anon-client reads of `location_*` tables ab RLS (`is_frontend_staff`) se gated
 * hain; isliye browser ise directly nahi padh sakta. Ye route distinct
 * zone/rack/bin/box options bhejta hai taaki dropdown hamesha sahi data dikhaye.
 */
export async function GET() {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [zones, racks, bins, boxes, legacy] = await Promise.all([
      sb.from("location_zones").select("id, name").eq("delete_flag", 0),
      sb.from("location_racks").select("id, name, zone_id").eq("delete_flag", 0),
      sb.from("location_bins").select("id, name, rack_id").eq("delete_flag", 0),
      sb.from("location_boxes").select("id, name, bin_id").eq("delete_flag", 0),
      sb.from("locations").select("zone, rack, bin, box").eq("delete_flag", 0),
    ]);

    const add = (rows: unknown[] | null | undefined, col: string) =>
      ((rows || []) as { [k: string]: unknown }[])
        .map((r) => String(r[col] ?? "").trim())
        .filter((v) => v !== "");
    const uniq = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      // Flat option lists (backward-compat + legacy free-text values).
      zone: uniq([...add(zones.data, "name"), ...add(legacy.data, "zone")]),
      rack: uniq([...add(racks.data, "name"), ...add(legacy.data, "rack")]),
      bin: uniq([...add(bins.data, "name"), ...add(legacy.data, "bin")]),
      box: uniq([...add(boxes.data, "name"), ...add(legacy.data, "box")]),
      // Normalized hierarchy with parent links — cascading picker ke liye.
      hierarchy: {
        zones: zones.data || [],
        racks: racks.data || [],
        bins: bins.data || [],
        boxes: boxes.data || [],
      },
    });
  } catch (err: unknown) {
    console.error("[locations/options] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
