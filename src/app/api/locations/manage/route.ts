import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

const sb = getAdminSupabase();

/** Supabase errors plain object hote hain (Error instance nahi) → .message safely nikalo. */
function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && !!e.message) return String(e.message);
  return "Unknown error — server logs check karein";
}

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
        sb
          .from("location_racks")
          .select("*, location_zones(id, name)")
          .eq("delete_flag", 0)
          .order("name"),
        sb
          .from("location_bins")
          .select(
            "*, location_racks(id, name, zone_id, location_zones(id, name))"
          )
          .eq("delete_flag", 0)
          .order("name"),
        sb
          .from("location_boxes")
          .select(
            "*, location_bins(id, name, rack_id, location_racks(id, name, zone_id, location_zones(id, name)))"
          )
          .eq("delete_flag", 0)
          .order("name"),
      ]);

      // `tab=full` par bhi har item ke liye childCount banao (page isi fetch se
      // "Children" column dikhata hai). Zones→racks, racks→bins, bins→boxes.
      const countChildren = async (
        rows: unknown[],
        childTable: string,
        childFk: string
      ) => {
        if (rows.length === 0) return rows;
        const ids = rows.map((r) => (r as { id: number }).id);
        const { data: childRows } = await sb
          .from(childTable)
          .select(childFk)
          .eq("delete_flag", 0)
          .in(childFk, ids);
        const countMap: Record<number, number> = {};
        (childRows as unknown as Array<Record<string, unknown>> | null)?.forEach((r) => {
          const pid = r[childFk] as number;
          countMap[pid] = (countMap[pid] || 0) + 1;
        });
        return rows.map((r) => ({
          ...(r as Record<string, unknown>),
          childCount: countMap[(r as { id: number }).id] || 0,
        }));
      };

      // Box tab ke "Children" column ke liye: har box me kitne products assign hain.
      // Products `product_locations.location_id → locations.id` se map hote hain aur
      // `locations.box_id` FK idhar hota hai.
      const countBoxProducts = async (rows: unknown[]) => {
        if (rows.length === 0) return rows;
        const boxIds = rows.map((r) => (r as { id: number }).id);
        const { data: locRows } = await sb
          .from("locations")
          .select("id, box_id")
          .eq("delete_flag", 0)
          .in("box_id", boxIds);
        const locIds = (locRows as unknown as Array<{ id: number; box_id: number }> | null)?.map(
          (l) => l.id
        );
        const boxForLoc = new Map<number, number>();
        (locRows as unknown as Array<{ id: number; box_id: number }> | null)?.forEach((l) => {
          boxForLoc.set(l.id, l.box_id);
        });
        const countMap: Record<number, number> = {};
        if (locIds && locIds.length > 0) {
          const { data: plRows } = await sb
            .from("product_locations")
            .select("location_id, product_id")
            .in("location_id", locIds);
          const seen = new Set<string>();
          (plRows as unknown as Array<{ location_id: number; product_id: number }> | null)?.forEach(
            (r) => {
              const boxId = boxForLoc.get(r.location_id);
              if (boxId == null) return;
              const dedupe = `${boxId}:${r.product_id}`;
              if (seen.has(dedupe)) return;
              seen.add(dedupe);
              countMap[boxId] = (countMap[boxId] || 0) + 1;
            }
          );
        }
        return rows.map((r) => ({
          ...(r as Record<string, unknown>),
          childCount: countMap[(r as { id: number }).id] || 0,
        }));
      };

      const [zonesWith, racksWith, binsWith, boxesWith] = await Promise.all([
        countChildren(zones.data || [], "location_racks", "zone_id"),
        countChildren(racks.data || [], "location_bins", "rack_id"),
        countChildren(bins.data || [], "location_boxes", "bin_id"),
        countBoxProducts(boxes.data || []),
      ]);
      return NextResponse.json({
        zones: zonesWith,
        racks: racksWith,
        bins: binsWith,
        boxes: boxesWith,
      });
    }

    if (!tabParam || !TABLE[tabParam as Entity])
      return NextResponse.json({ error: "Invalid tab" }, { status: 400 });

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
        const { data: childRows } = await sb
          .from(childTable)
          .select(childFk)
          .eq("delete_flag", 0)
          .in(childFk, ids);
        const countMap: Record<number, number> = {};
        const rows = childRows as unknown as Array<Record<string, unknown>>;
        rows.forEach((r) => {
          const pid = r[childFk] as number;
          countMap[pid] = (countMap[pid] || 0) + 1;
        });
        items = items.map((r: Record<string, unknown>) => ({
          ...r,
          childCount: countMap[r.id as number] || 0,
        }));
      }
    }

    return NextResponse.json({ items });
  } catch (err: unknown) {
    console.error("[locations/manage] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
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
    if (fk) {
      if (!parent_id)
        return NextResponse.json(
          {
            error: `${tab.replace(/s$/, "")} ke liye parent select karna zaroori hai`,
          },
          { status: 400 }
        );
      row[fk] = parent_id;
    }

    const { data, error } = await sb.from(TABLE[tab]).insert(row).select("id").single();
    if (error) {
      if (error.code === "23505")
        return NextResponse.json({ error: "Already exists" }, { status: 409 });
      throw error;
    }

    return NextResponse.json({ id: data.id });
  } catch (err: unknown) {
    console.error("[locations/manage] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { tab, id, name, parent_id } = body as {
      tab: Entity;
      id: number;
      name: string;
      parent_id?: number | null;
    };

    if (!tab || !TABLE[tab] || !id)
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });

    const patch: Record<string, unknown> = { name: name.trim() };
    // Reparent support: parent_id bheja ho to FK update (child move karne ke liye).
    const fk = PARENT_FK[tab];
    if (fk && parent_id !== undefined) {
      if (!parent_id)
        return NextResponse.json(
          { error: `${tab.replace(/s$/, "")} ke liye parent select karna zaroori hai` },
          { status: 400 }
        );
      patch[fk] = parent_id;
    }

    const { error } = await sb.from(TABLE[tab]).update(patch).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[locations/manage] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { tab, id, delete_flag, status } = body as {
      tab: Entity;
      id: number;
      delete_flag?: number;
      status?: number;
    };

    if (!tab || !TABLE[tab] || !id)
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (delete_flag !== undefined) patch.delete_flag = delete_flag;
    if (status !== undefined) patch.status = status;

    const { error } = await sb.from(TABLE[tab]).update(patch).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[locations/manage] error:", err);
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

export { genCode };
