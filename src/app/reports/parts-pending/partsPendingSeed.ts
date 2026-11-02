import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/reports/parts-pending` ka neutral server seed — client ke load()
 * (system_info + fetchWaitingPartsReport) ka read-only mirror.
 * `@/lib/requiredParts` browser singleton use karta hai, isliye wahi queries
 * yahan inline hain. Caller cookie+RLS client pass karta hai.
 */

export type PartsPendingRawPart = {
  id: number;
  transaction_id: number;
  product_id: number | null;
  product_name: string;
  qty_needed: number;
  qty_received: number;
  status: 0 | 1 | 2;
  supplier_id: number | null;
  purchase_order_id: number | null;
  source_name: string | null;
  phone: string | null;
  eta: string | null;
  photo_url: string | null;
  remark: string | null;
  created_by: number | null;
  date_created: string;
  date_updated: string;
};

export type PartsPendingPart = PartsPendingRawPart & {
  job_id: string | null;
  clientLabel: string;
  item: string;
  jobStatus: number;
};

export type PartsPendingGroup = {
  transaction_id: number;
  job_id: string | null;
  clientLabel: string;
  item: string;
  jobStatus: number;
  oldestWait: string;
  parts: PartsPendingPart[];
  supplierName: string | null;
};

export type PartsPendingSeed = {
  firmName: string;
  groups: PartsPendingGroup[];
};

interface JobLite {
  id: number;
  job_id: string | null;
  client_name: string | null;
  item: string | null;
  status: number;
  date_created: string;
}

const ORDER = [0, 1, 2];

export async function fetchPartsPendingSeed(supabase: SupabaseClient): Promise<PartsPendingSeed> {
  const [sysRes, partsRes] = await Promise.all([
    supabase.from("system_info").select("meta_field, meta_value"),
    supabase
      .from("job_required_parts")
      .select("*")
      .in("status", ORDER)
      .order("date_created", { ascending: true }),
  ]);

  if (partsRes.error) throw new Error(partsRes.error.message);

  const info: Record<string, string> = {};
  (sysRes.data || []).forEach((r) => {
    info[r.meta_field] = r.meta_value;
  });
  const firmName = info.name || "V-Technologies";

  const parts = (partsRes.data || []) as PartsPendingRawPart[];
  if (parts.length === 0) return { firmName, groups: [] };

  const txnIds = [...new Set(parts.map((p) => p.transaction_id))];
  const { data: jobs } = await supabase
    .from("transaction_list")
    .select("id, job_id, client_name, item, status, date_created")
    .in("id", txnIds)
    .in("status", [0, 1, 2, 3])
    .eq("del_status", 0);
  if (!jobs || jobs.length === 0) return { firmName, groups: [] };
  const jobRows = jobs as JobLite[];

  // client_name resolve (dual-era)
  const clientIds = [
    ...new Set(jobRows.map((j) => j.client_name).filter((c) => c && /^\d+$/.test(String(c)))),
  ].map((c) => parseInt(String(c), 10));
  const clientMap: Record<number, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("client_list")
      .select("id, name")
      .in("id", clientIds);
    (clients || []).forEach((c) => (clientMap[c.id] = c.name));
  }

  // suppliers id → name (source display)
  const { data: suppliers } = await supabase.from("suppliers").select("id, name");
  const supMap: Record<number, string> = {};
  (suppliers || []).forEach((s) => (supMap[s.id] = s.name));

  const jobMap = new Map<number, JobLite>();
  jobRows.forEach((j) => jobMap.set(j.id, j));

  const groups: Map<number, PartsPendingGroup> = new Map();
  parts.forEach((p) => {
    const job = jobMap.get(p.transaction_id);
    if (!job) return;
    let g = groups.get(p.transaction_id);
    if (!g) {
      const rawClient = String(job.client_name ?? "");
      const clientLabel = clientMap[parseInt(rawClient, 10)] || rawClient || "—";
      g = {
        transaction_id: p.transaction_id,
        job_id: job.job_id,
        clientLabel,
        item: String(job.item ?? ""),
        jobStatus: job.status,
        oldestWait: p.date_created,
        parts: [],
        supplierName: null,
      };
      groups.set(p.transaction_id, g);
    }
    if (new Date(p.date_created).getTime() < new Date(g.oldestWait).getTime())
      g.oldestWait = p.date_created;
    g.parts.push({
      ...p,
      job_id: job.job_id,
      clientLabel: g.clientLabel,
      item: g.item,
      jobStatus: g.jobStatus,
    });
    if (p.supplier_id && !g.supplierName) g.supplierName = supMap[p.supplier_id] || null;
  });

  return {
    firmName,
    groups: [...groups.values()].sort(
      (a, b) => new Date(a.oldestWait).getTime() - new Date(b.oldestWait).getTime()
    ),
  };
}
