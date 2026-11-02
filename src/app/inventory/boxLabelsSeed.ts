import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoxLabelData } from "@/lib/boxPrint";
import type { LocationParts } from "@/lib/locations";

/**
 * `/inventory/box-labels` ka neutral server seed — `/api/locations/manage`
 * (boxes) + `/api/locations` ka read-only mirror. Caller cookie+RLS client
 * pass karta hai.
 */

export type BoxLabelsBoxOption = {
  id: number;
  name: string;
  path: string;
  binId: number | null;
};

export type BoxLabelsBoxRow = BoxLabelData & {
  qty: number;
  printQty: number;
  selected?: boolean;
  custom?: boolean;
};

export type BoxLabelsSeed = {
  boxes: BoxLabelsBoxRow[];
  boxOptions: BoxLabelsBoxOption[];
  partsMap: Record<string, Partial<LocationParts> | null>;
};

type BoxDbRow = {
  id: number;
  name: string;
  bin_id: number | null;
  location_bins?: {
    name?: string;
    location_racks?: { name?: string; location_zones?: { name?: string } | null } | null;
  } | null;
};

type LocDbRow = {
  id: number;
  box_id: number | null;
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
};

const toParts = (r: LocDbRow): Partial<LocationParts> => ({
  zone: r.zone ?? undefined,
  rack: r.rack ?? undefined,
  bin: r.bin ?? undefined,
  box: r.box ?? undefined,
});

export async function fetchBoxLabelsSeed(supabase: SupabaseClient): Promise<BoxLabelsSeed> {
  const [boxesRes, locRes, plRes] = await Promise.all([
    supabase
      .from("location_boxes")
      .select(
        "id, name, bin_id, location_bins(name, location_racks(name, location_zones(name)))"
      )
      .eq("delete_flag", 0)
      .order("name"),
    supabase
      .from("locations")
      .select("id, box_id, zone, rack, bin, box")
      .eq("delete_flag", 0),
    supabase.from("product_locations").select("location_id, product_id, product_list(name)"),
  ]);

  if (boxesRes.error) throw boxesRes.error;

  const boxesRaw = (boxesRes.data || []) as unknown as BoxDbRow[];
  const boxOptions: BoxLabelsBoxOption[] = boxesRaw.map((b) => {
    const zone = b.location_bins?.location_racks?.location_zones?.name || "";
    const rack = b.location_bins?.location_racks?.name || "";
    const bin = b.location_bins?.name || "";
    const path = [zone, rack, bin, b.name].filter(Boolean).join(" ▸ ");
    return { id: b.id, name: b.name, path, binId: b.bin_id ?? null };
  });

  const locRows = (locRes.data || []) as LocDbRow[];
  const partsByBox: Record<number, Partial<LocationParts> | null> = {};
  for (const loc of locRows) {
    if (!loc.box_id) continue;
    if (!partsByBox[loc.box_id]) partsByBox[loc.box_id] = toParts(loc);
  }
  const boxIdByLoc = new Map(locRows.map((l) => [l.id, l.box_id]));

  const plMap = new Map<number, string[]>();
  (
    (plRes.data || []) as {
      location_id: number;
      product_id: number;
      product_list: { name?: string } | { name?: string }[] | null;
    }[]
  ).forEach((pl) => {
    const boxId = boxIdByLoc.get(pl.location_id);
    if (boxId == null) return;
    const product = Array.isArray(pl.product_list) ? pl.product_list[0] : pl.product_list;
    const name = product?.name;
    if (!name) return;
    const arr = plMap.get(boxId) || [];
    if (!arr.includes(name)) arr.push(name);
    plMap.set(boxId, arr);
  });

  const boxes: BoxLabelsBoxRow[] = boxOptions.map((o) => ({
    boxId: o.name,
    locationPath: o.path,
    items: (plMap.get(o.id) || []).map((n) => ({ name: n })),
    qty: 1,
    printQty: 1,
    selected: false,
  }));

  return {
    boxes,
    boxOptions,
    partsMap: Object.fromEntries(boxOptions.map((o) => [o.name, partsByBox[o.id] || null])),
  };
}
