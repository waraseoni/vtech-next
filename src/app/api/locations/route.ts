import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

const supabase = getAdminSupabase();

function genCode(ids: { zone_id?: number; rack_id?: number; bin_id?: number; box_id?: number }) {
  const segs: string[] = [];
  if (ids.zone_id) segs.push(`Z${ids.zone_id}`);
  if (ids.rack_id) segs.push(`R${ids.rack_id}`);
  if (ids.bin_id) segs.push(`B${ids.bin_id}`);
  if (ids.box_id) segs.push(`X${ids.box_id}`);
  return segs.join("-");
}

export async function GET() {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: locData, error: locErr } = await supabase
      .from("locations")
      .select(
        "*, location_zones(name), location_racks(name), location_bins(name), location_boxes(name)"
      )
      .eq("delete_flag", 0)
      .order("code");
    if (locErr) throw locErr;

    const { data: plData } = await supabase
      .from("product_locations")
      .select("location_id, product_id, product_list(name)");

    return NextResponse.json({ locations: locData || [], productLocations: plData || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { zone, rack, bin, box, label, zone_id, rack_id, bin_id, box_id } = body;

    const ids = {
      zone_id: zone_id || undefined,
      rack_id: rack_id || undefined,
      bin_id: bin_id || undefined,
      box_id: box_id || undefined,
    };
    const code = genCode(ids);

    const row: Record<string, unknown> = {
      zone: zone || null,
      rack: rack || null,
      bin: bin || null,
      box: box || null,
      label: label || null,
      status: 1,
      delete_flag: 0,
      code,
      ...Object.fromEntries(Object.entries(ids).filter(([, v]) => v)),
    };

    const { data, error } = await supabase.from("locations").insert([row]).select("id").single();
    if (error) throw error;

    return NextResponse.json({ id: data.id, code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, zone, rack, bin, box, label, zone_id, rack_id, bin_id, box_id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const ids = {
      zone_id: zone_id || undefined,
      rack_id: rack_id || undefined,
      bin_id: bin_id || undefined,
      box_id: box_id || undefined,
    };
    const code = genCode(ids);

    const update: Record<string, unknown> = {
      zone: zone || null,
      rack: rack || null,
      bin: bin || null,
      box: box || null,
      label: label || null,
      code,
      ...Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v || null])),
    };

    const { error } = await supabase.from("locations").update(update).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, delete_flag, status } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (delete_flag !== undefined) patch.delete_flag = delete_flag;
    if (status !== undefined) patch.status = status;

    const { error } = await supabase.from("locations").update(patch).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
