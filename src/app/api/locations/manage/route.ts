import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Entity = "zones" | "racks" | "bins" | "boxes";
const TABLE: Record<Entity, string> = {
  zones: "location_zones",
  racks: "location_racks",
  bins: "location_bins",
  boxes: "location_boxes",
};
const PARENT_FK: Record<Entity, string | null> = {
  zones: null,
  racks: "zone_id",
  bins: "rack_id",
  boxes: "bin_id",
};
const COUNT_CHILD: Record<Entity, { table: string; fk: string } | null> = {
  zones: { table: "location_racks", fk: "zone_id" },
  racks: { table: "location_bins", fk: "rack_id" },
  bins: { table: "location_boxes", fk: "bin_id" },
  boxes: null,
};

function genCode(parts: { zone?: number; rack?: number; bin?: number; box?: number }) {
  const segs: string[] = [];
  if (parts.zone) segs.push(`Z${parts.zone}`);
  if (parts.rack) segs.push(`R${parts.rack}`);
  if (parts.bin) segs.push(`B${parts.bin}`);
  if (parts.box) segs.push(`X${parts.box}`);
  return segs.join("-");
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tabParam = request.nextUrl.searchParams.get("tab");
    const parentId = request.nextUrl.searchParams.get("parent_id");

    if (tabParam === "full") {
      const [zones, racks, bins, boxes] = await Promise.all([
        sb.from("location_zones").select("*").eq("delete_flag", 0).order("name"),
        sb.from("location_racks").select("*, location_zones(name)").eq("delete_flag", 0).order("name"),
        sb.from("location_bins").select("*, location_racks(name, zone_id)").eq("delete_flag", 0).order("name"),
        sb.from("location_boxes").select("*, location_bins(name, rack_id)").eq("delete_flag", 0).order("name"),
      ]);
      return NextResponse.json({
        zones: zones.data || [],
        racks: racks.data || [],
        bins: bins.data || [],
        boxes: boxes.data || [],
      });
    }

    if (!tabParam || !TABLE[tabParam as Entity]) return NextResponse.json({ error: "Invalid tab" }, { status: 400 });

    const tab = tabParam as Entity;

    let query = sb.from(TABLE[tab]).select("*").eq("delete_flag", 0).order("name");

    const fk = PARENT_FK[tab];
    if (fk && parentId) {
      query = query.eq(fk, Number(parentId));
    }

    const { data, error } = await query;
    if (error) throw error;

    let items = data || [];

    if (COUNT_CHILD[tab]) {
      const childTable = COUNT_CHILD[tab]!.table;
      const childFk = COUNT_CHILD[tab]!.fk;
      const ids = items.map((r: { id: number }) => r.id);
      if (ids.length > 0) {
        const { data: childRows } = await sb.from(childTable).select(childFk).eq("delete_flag", 0).in(childFk, ids);
        const countMap: Record<number, number> = {};
        const rows = childRows as unknown as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const pid = r[childFk] as number;
          countMap[pid] = (countMap[pid] || 0) + 1;
        });
        items = items.map((r: Record<string, unknown>) => ({ ...r, childCount: countMap[r.id as number] || 0 }));
      }
    }

    return NextResponse.json({ items });
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
    const { tab, name, parent_id } = body as { tab: Entity; name: string; parent_id?: number };

    if (!tab || !TABLE[tab]) return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const row: Record<string, unknown> = { name: name.trim(), status: 1, delete_flag: 0 };
    const fk = PARENT_FK[tab];
    if (fk && parent_id) row[fk] = parent_id;

    const { data, error } = await sb.from(TABLE[tab]).insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Already exists" }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ id: data.id });
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
    const { tab, id, name } = body as { tab: Entity; id: number; name: string };

    if (!tab || !TABLE[tab] || !id) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

    const { error } = await sb.from(TABLE[tab]).update({ name: name.trim() }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
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
    const { tab, id, delete_flag, status } = body as { tab: Entity; id: number; delete_flag?: number; status?: number };

    if (!tab || !TABLE[tab] || !id) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (delete_flag !== undefined) patch.delete_flag = delete_flag;
    if (status !== undefined) patch.status = status;

    const { error } = await sb.from(TABLE[tab]).update(patch).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export { genCode };
