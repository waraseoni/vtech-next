import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) — server-side hi ───────────────────
const supabase = getAdminSupabase();

type RefRow = { id: string | number; [k: string]: unknown };
type FileRef = { label: string; href: string | null };

const fullName = (r: RefRow) =>
  [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ") || `#${r.id}`;

// Storage buckets → table mapping + kaunsi rows reference karti hain
const BUCKET_MAP: {
  bucket: string;
  label: string;
  table: string;
  column: string;
  idCols: string[];
  rowLabel: (r: RefRow) => string;
  hrefFor: (r: RefRow) => string | null;
}[] = [
  {
    bucket: "client-photos",
    label: "Client Photos",
    table: "client_list",
    column: "image_path",
    idCols: ["id", "firstname", "middlename", "lastname"],
    rowLabel: (r) => `Client: ${fullName(r)}`,
    hrefFor: (r) => `/clients/${r.id}`,
  },
  {
    bucket: "mechanic-photos",
    label: "Mechanic Photos",
    table: "mechanic_list",
    column: "image_path",
    idCols: ["id", "firstname", "middlename", "lastname"],
    rowLabel: (r) => `Mechanic: ${fullName(r)}`,
    hrefFor: (r) => `/mechanics/${r.id}`,
  },
  {
    bucket: "product-images",
    label: "Product Images",
    table: "product_list",
    column: "image_path",
    idCols: ["id", "name"],
    rowLabel: (r) => `Product: ${String(r.name || r.id)}`,
    hrefFor: () => null,
  },
  {
    bucket: "user-avatars",
    label: "User Avatars",
    table: "profiles",
    column: "avatar_url",
    idCols: ["id", "full_name"],
    rowLabel: (r) => `User: ${String(r.full_name || r.id)}`,
    hrefFor: () => null,
  },
  {
    bucket: "job-images",
    label: "Job Photos",
    table: "transaction_images",
    column: "image_path",
    idCols: ["id", "transaction_id"],
    rowLabel: (r) => `Job #${r.transaction_id}`,
    hrefFor: (r) => `/jobs/${r.transaction_id}`,
  },
];

type BucketFile = { name: string; size: number; created_at: string };

async function listBucketFiles(bucket: string): Promise<BucketFile[]> {
  const items: BucketFile[] = [];
  const LIMIT = 100;
  for (let offset = 0; ; offset += LIMIT) {
    const { data, error } = await supabase.storage.from(bucket).list("", { limit: LIMIT, offset });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    data.forEach((f) => {
      if (f.metadata)
        items.push({ name: f.name, size: f.metadata.size || 0, created_at: f.created_at || "" });
    });
    if (data.length < LIMIT) break;
  }
  return items;
}

// File name → reference rows (label + link)
async function fetchFileRefs(m: (typeof BUCKET_MAP)[number]): Promise<Map<string, FileRef[]>> {
  const map = new Map<string, FileRef[]>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(m.table)
      .select([m.column, ...m.idCols].join(", "))
      .ilike(m.column, `%/${m.bucket}/%`)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    ((data as unknown as RefRow[]) || []).forEach((row) => {
      const v = row[m.column];
      if (typeof v !== "string") return;
      const name = v.split(`/${m.bucket}/`).pop();
      if (!name) return;
      const ref = { label: m.rowLabel(row), href: m.hrefFor(row) };
      const existing = map.get(name);
      if (existing) existing.push(ref);
      else map.set(name, [ref]);
    });
    if (data.length < PAGE) break;
  }
  return map;
}

function publicUrl(bucket: string, name: string): string {
  return supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
}

// ── GET: saare buckets ki images + connection (kis client/product/job/user se) ──
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth)
      return NextResponse.json({ error: "Sirf Admin is action ko kar sakta hai" }, { status: 403 });

    const buckets = [];
    for (const m of BUCKET_MAP) {
      const files = await listBucketFiles(m.bucket);
      const refs = await fetchFileRefs(m);
      const fileList = files
        .map((f) => ({
          name: f.name,
          url: publicUrl(m.bucket, f.name),
          size: f.size,
          created_at: f.created_at,
          referenced: (refs.get(f.name)?.length || 0) > 0,
          refs: refs.get(f.name) || [],
        }))
        .sort((a, b) => (b.created_at || b.name).localeCompare(a.created_at || a.name));
      buckets.push({
        bucket: m.bucket,
        label: m.label,
        total: fileList.length,
        orphanCount: fileList.filter((f) => !f.referenced).length,
        files: fileList,
      });
    }

    return NextResponse.json({ status: "success", buckets });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}

// ── DELETE: storage se files remove (admin only) ─────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth)
      return NextResponse.json({ error: "Sirf Admin is action ko kar sakta hai" }, { status: 403 });

    const body = (await request.json()) as { bucket?: string; names?: string[] };
    if (!body.bucket || !Array.isArray(body.names) || body.names.length === 0) {
      return NextResponse.json({ error: "bucket + names required" }, { status: 400 });
    }

    const { error } = await supabase.storage.from(body.bucket).remove(body.names);
    if (error) {
      return NextResponse.json({ status: "failed", msg: error.message }, { status: 500 });
    }
    return NextResponse.json({ status: "success", removed: body.names.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
