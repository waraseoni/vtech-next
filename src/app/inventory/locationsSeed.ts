import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/inventory/locations` ka neutral server seed — API GET routes
 * (`/api/locations`, `/api/locations/manage?tab=full`) ka read-only mirror.
 * Caller cookie+RLS client pass karta hai.
 */

export type LocationsLocRow = {
  id: number;
  code: string | null;
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
  label: string | null;
  status: number;
  delete_flag: number;
  created_at: string;
  zone_id: number | null;
  rack_id: number | null;
  bin_id: number | null;
  box_id: number | null;
};

export type LocationsEntityRow = {
  id: number;
  name: string;
  status: number;
  delete_flag: number;
};

export type LocationsProductRow = { id: number; name: string };

export type LocationsRow = LocationsLocRow & {
  productCount: number;
  products: LocationsProductRow[];
};

export type LocationsHierarchy = {
  zones: LocationsEntityRow[];
  racks: LocationsEntityRow[];
  bins: LocationsEntityRow[];
  boxes: LocationsEntityRow[];
};

export type LocationsSeed = {
  rows: LocationsRow[];
  hierarchy: LocationsHierarchy;
};

export async function fetchLocationsSeed(supabase: SupabaseClient): Promise<LocationsSeed> {
  const [locRes, plRes, zonesRes, racksRes, binsRes, boxesRes] = await Promise.all([
    supabase.from("locations").select("*").eq("delete_flag", 0).order("code"),
    supabase.from("product_locations").select("location_id, product_id, product_list(name)"),
    supabase
      .from("location_zones")
      .select("id, name, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name"),
    supabase
      .from("location_racks")
      .select("id, name, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name"),
    supabase
      .from("location_bins")
      .select("id, name, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name"),
    supabase
      .from("location_boxes")
      .select("id, name, status, delete_flag")
      .eq("delete_flag", 0)
      .order("name"),
  ]);

  if (locRes.error) throw locRes.error;

  const locations = (locRes.data || []) as LocationsLocRow[];
  const plData = (plRes.data || []) as {
    location_id: number;
    product_id: number;
    product_list: LocationsProductRow | LocationsProductRow[] | null;
  }[];

  const countMap: Record<number, LocationsProductRow[]> = {};
  plData.forEach((row) => {
    if (!countMap[row.location_id]) countMap[row.location_id] = [];
    const product = Array.isArray(row.product_list) ? row.product_list[0] : row.product_list;
    if (product) countMap[row.location_id].push(product);
  });

  const rows: LocationsRow[] = locations.map((loc) => ({
    ...loc,
    products: countMap[loc.id] || [],
    productCount: (countMap[loc.id] || []).length,
  }));

  return {
    rows,
    hierarchy: {
      zones: (zonesRes.data || []) as LocationsEntityRow[],
      racks: (racksRes.data || []) as LocationsEntityRow[],
      bins: (binsRes.data || []) as LocationsEntityRow[],
      boxes: (boxesRes.data || []) as LocationsEntityRow[],
    },
  };
}
