import { supabase } from "./supabase";
import { logActivity } from "./activity";

// ============================================================================
// requiredParts.ts — Job "Required Saman / Waiting for Part Purchase" CRUD.
//
// DB: `job_required_parts` (migration 20260905_job_required_parts.sql).
// Conventions (docs/DATA_MIGRATION_NOTES.md):
//   • transaction_id = canonical PK `transaction_list.id`.
//   • Har mutation par logActivity("...Required Part...", "Jobs", txnId).
// ============================================================================

export type RequiredPartStatus = 0 | 1 | 2; // 0 waiting | 1 ordered | 2 arrived

export interface RequiredPart {
  id: number;
  transaction_id: number;
  product_id: number | null;
  product_name: string;
  qty_needed: number;
  qty_received: number;
  status: RequiredPartStatus;
  supplier_id: number | null;
  source_name: string | null;
  phone: string | null;
  eta: string | null; // date (YYYY-MM-DD)
  photo_url: string | null;
  remark: string | null;
  created_by: number | null;
  date_created: string;
  date_updated: string;
}

export interface NewRequiredPart {
  transaction_id: number;
  product_id?: number | null;
  product_name: string;
  qty_needed: number;
  supplier_id?: number | null;
  source_name?: string | null;
  phone?: string | null;
  eta?: string | null;
  remark?: string | null;
  photo_url?: string | null;
}

const ORDER: RequiredPartStatus[] = [0, 1, 2];

/** Ek job ke required parts. Default sirf open (0/1); includeAll=true → sab (2 samet). */
export async function listRequiredParts(txnId: number, includeAll = false) {
  let q = supabase
    .from("job_required_parts")
    .select("*")
    .eq("transaction_id", txnId)
    .order("date_created", { ascending: true });
  if (!includeAll) q = q.in("status", ORDER);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as RequiredPart[];
}

export async function addRequiredPart(part: NewRequiredPart) {
  const { data, error } = await supabase
    .from("job_required_parts")
    .insert({
      transaction_id: part.transaction_id,
      product_id: part.product_id ?? null,
      product_name: part.product_name.trim(),
      qty_needed: Math.max(1, Math.round(part.qty_needed) || 1),
      qty_received: 0,
      status: 0,
      supplier_id: part.supplier_id ?? null,
      source_name: part.source_name?.trim() || null,
      phone: part.phone?.trim() || null,
      eta: part.eta || null,
      remark: part.remark?.trim() || null,
      photo_url: part.photo_url ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(
    "Added Required Part",
    "Jobs",
    part.transaction_id,
    `Required spare: ${(data as RequiredPart).product_name} x${(data as RequiredPart).qty_needed}`
  );
  return data as RequiredPart;
}

/** Low-level patch. Component-level convenience (status/qty) ise use karti hai. */
export async function updateRequiredPart(id: number, txnId: number, patch: Partial<RequiredPart>) {
  const { data, error } = await supabase
    .from("job_required_parts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity("Updated Required Part", "Jobs", txnId, "Required spare updated");
  return data as RequiredPart;
}

/** status toggle: 1 = Ordered · 2 = Arrived (arrive par qty_received = qty_needed) */
export async function setRequiredPartStatus(id: number, txnId: number, status: RequiredPartStatus) {
  const { data: row } = await supabase
    .from("job_required_parts")
    .select("qty_needed, qty_received, product_name")
    .eq("id", id)
    .single();
  const patch: Partial<RequiredPart> = { status };
  if (status === 2) patch.qty_received = Math.max(1, row?.qty_needed ?? 1);
  const res = await updateRequiredPart(id, txnId, patch);
  if (status === 2)
    await logActivity(
      "Required Part Arrived",
      "Jobs",
      txnId,
      `Spare aa gaya: ${row?.product_name ?? ""}`
    );
  else if (status === 1)
    await logActivity(
      "Required Part Ordered",
      "Jobs",
      txnId,
      `Spare order kar diya: ${row?.product_name ?? ""}`
    );
  return res;
}

/** Partial qty receive (age/case me naya maal hazir). >= needed → status 2 (Arrived). */
export async function receiveRequiredPartQty(id: number, txnId: number, qty: number) {
  const { data: row } = await supabase
    .from("job_required_parts")
    .select("qty_needed, qty_received, product_name")
    .eq("id", id)
    .single();
  const joined = Math.min(Math.max(Math.round(qty) || 0, 0), row?.qty_needed ?? 1);
  const patch: Partial<RequiredPart> = { qty_received: joined };
  if (joined >= (row?.qty_needed ?? 1)) patch.status = 2;
  const res = await updateRequiredPart(id, txnId, patch);
  await logActivity(
    "Required Part Received",
    "Jobs",
    txnId,
    `Spare ${row?.product_name ?? ""} received ${joined}/${row?.qty_needed}`
  );
  return res;
}

export async function removeRequiredPart(id: number, txnId: number) {
  const { error } = await supabase.from("job_required_parts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("Removed Required Part", "Jobs", txnId, "Required spare delete kar diya");
}

// ── Report: jobs waiting for part purchase ──────────────────────────────────
export interface WaitingPartRow extends RequiredPart {
  job_id: string | null;
  clientLabel: string;
  item: string;
  jobStatus: number;
}

export interface WaitingJobGroup {
  transaction_id: number;
  job_id: string | null;
  clientLabel: string;
  item: string;
  jobStatus: number;
  oldestWait: string;
  parts: WaitingPartRow[];
  supplierName: string | null;
}

interface JobLite {
  id: number;
  job_id: string | null;
  client_name: string | null;
  item: string | null;
  status: number;
  date_created: string;
}

/**
 * Report data — jobs (status 0..3, del_status=0) jinke koi open (status<2)
 * required parts hain. Delivered(5)/Cancelled(4) automatically OUT (derived).
 * client_name transaction_list me ID-string ho sakti hai (modern) ya naam
 * (legacy) — ID → client_list se resolve, baaki raw text. (Dual-era safe.)
 */
export async function fetchWaitingPartsReport(): Promise<WaitingJobGroup[]> {
  const { data: parts, error } = await supabase
    .from("job_required_parts")
    .select("*")
    .in("status", ORDER)
    .order("date_created", { ascending: true });
  if (error) throw new Error(error.message);
  if (!parts || parts.length === 0) return [];

  const txnIds = [...new Set((parts as RequiredPart[]).map((p) => p.transaction_id))];
  const { data: jobs } = await supabase
    .from("transaction_list")
    .select("id, job_id, client_name, item, status, date_created")
    .in("id", txnIds)
    .in("status", [0, 1, 2, 3])
    .eq("del_status", 0);
  if (!jobs || jobs.length === 0) return [];
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

  const groups: Map<number, WaitingJobGroup> = new Map();
  (parts as RequiredPart[]).forEach((p) => {
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

  return [...groups.values()].sort(
    (a, b) => new Date(a.oldestWait).getTime() - new Date(b.oldestWait).getTime()
  );
}
