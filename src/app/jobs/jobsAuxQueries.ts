import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPeekNextJobIdWith } from "@/lib/jobIdCounterQuery";

/**
 * Neutral read layer for Jobs ke auxiliary surfaces (`/jobs/bulk`,
 * `/jobs/bulk-edit`, `/jobs/combined-invoice`, `/jobs/spot-labels`).
 * Server RSC layout seed aur browser fallback dono yahi functions call karte
 * hain — query filters/order pehle jaisa exact hai.
 */

export type JobClientRow = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
};

export type JobClientAddressRow = JobClientRow & { address: string | null };

export type JobMechanicRow = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
};

export type JobSpotRow = { id: number; name: string };

export type BulkJobSeed = {
  clients: JobClientRow[];
  mechanics: JobMechanicRow[];
  nextJobId: number;
};

export type BulkEditSeed = {
  clients: JobClientRow[];
  mechanics: JobMechanicRow[];
};

export type CombinedInvoiceSeed = { clients: JobClientAddressRow[] };

export type SpotLabelsSeed = {
  spots: JobSpotRow[];
  refs: Record<number, number>;
  allLinkedIds: number[];
};

export async function fetchBulkJobSeed(supabase: SupabaseClient): Promise<BulkJobSeed> {
  const [cRes, mRes, nextJobId] = await Promise.all([
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .eq("status", 1)
      .order("firstname"),
    fetchPeekNextJobIdWith(supabase),
  ]);

  return {
    clients: (cRes.data || []) as JobClientRow[],
    mechanics: (mRes.data || []) as JobMechanicRow[],
    nextJobId,
  };
}

export async function fetchBulkEditSeed(supabase: SupabaseClient): Promise<BulkEditSeed> {
  const [cRes, mRes] = await Promise.all([
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("firstname"),
  ]);

  return {
    clients: (cRes.data || []) as JobClientRow[],
    mechanics: (mRes.data || []) as JobMechanicRow[],
  };
}

/** Default (bina search) client list — combined invoice ka step 1. */
export async function fetchCombinedInvoiceSeed(
  supabase: SupabaseClient
): Promise<CombinedInvoiceSeed> {
  const { data } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname, contact, address")
    .eq("delete_flag", 0)
    .order("firstname")
    .limit(50);
  return { clients: (data || []) as JobClientAddressRow[] };
}

async function fetchAllLinkedLocationIds(supabase: SupabaseClient): Promise<number[]> {
  const linked = new Set<number>();
  let from = 0;
  for (;;) {
    const { data } = await supabase
      .from("transaction_list")
      .select("location_id")
      .not("location_id", "is", null)
      .range(from, from + 999);
    const rows = (data || []) as Array<{ location_id: number }>;
    rows.forEach((r) => linked.add(r.location_id));
    if (rows.length < 1000) break;
    from += 1000;
  }
  return [...linked];
}

/** Spot labels ka data — QR URLs server par nahi ban sakte (browser origin). */
export async function fetchSpotLabelsSeed(supabase: SupabaseClient): Promise<SpotLabelsSeed> {
  const { data } = await supabase
    .from("locations")
    .select("id, rack")
    .eq("kind", "job")
    .eq("zone", "")
    .order("rack");
  const spots: JobSpotRow[] = (data || []).map((l: { id: number; rack: string | null }) => ({
    id: l.id,
    name: l.rack || "",
  }));

  const [allLinkedIds, refRes] = await Promise.all([
    fetchAllLinkedLocationIds(supabase),
    spots.length > 0
      ? supabase
          .from("transaction_list")
          .select("location_id")
          .in(
            "location_id",
            spots.map((s) => s.id)
          )
          .eq("del_status", 0)
      : Promise.resolve({ data: [] as Array<{ location_id: number }> }),
  ]);

  const refs: Record<number, number> = {};
  ((refRes.data || []) as Array<{ location_id: number }>).forEach((r) => {
    refs[r.location_id] = (refs[r.location_id] || 0) + 1;
  });

  return { spots, refs, allLinkedIds };
}
