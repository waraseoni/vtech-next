import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) — server-side hi ───────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = getAdminSupabase();

const STORAGE_URL_MARKER = "/storage/v1/object/public/";

// ── Storage buckets → DB tables mapping ─────────────────────────────────────
// Restore (MariaDB conversion) ke baad image_path/avatar_url me purane dead
// paths aa gaye hote hain, par files storage bucket me maujood rehti hain.
// File naam = {id}-{ts}.{ext} (user-avatars me {uuid}-{ts}.{ext}), isliye file
// ka id-prefix DB row se match karke broken references wapas link ho sakti hain.
const REPAIR_MAP: {
  bucket: string;
  table: string;
  column: string;
  idColumn: string;
  idMode: "numeric" | "uuid";
}[] = [
  {
    bucket: "client-photos",
    table: "client_list",
    column: "image_path",
    idColumn: "id",
    idMode: "numeric",
  },
  {
    bucket: "mechanic-photos",
    table: "mechanic_list",
    column: "image_path",
    idColumn: "id",
    idMode: "numeric",
  },
  {
    bucket: "product-images",
    table: "product_list",
    column: "image_path",
    idColumn: "id",
    idMode: "numeric",
  },
  {
    bucket: "user-avatars",
    table: "profiles",
    column: "avatar_url",
    idColumn: "id",
    idMode: "uuid",
  },
  {
    bucket: "job-images",
    table: "transaction_images",
    column: "image_path",
    idColumn: "transaction_id",
    idMode: "numeric",
  },
];

function isBroken(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "" || !value.includes(STORAGE_URL_MARKER);
}

function parseFileId(name: string, mode: "numeric" | "uuid"): number | string | null {
  if (mode === "uuid") {
    const parts = name.split("-");
    parts.pop(); // "ts.ext" hatao
    if (parts.length === 0) return null;
    const id = parts.join("-");
    return id ? id : null;
  }
  const first = name.split("-")[0];
  const n = Number(first);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function listBucketFiles(bucket: string): Promise<string[]> {
  const names: string[] = [];
  const LIMIT = 100;
  for (let offset = 0; ; offset += LIMIT) {
    const { data, error } = await supabase.storage.from(bucket).list("", { limit: LIMIT, offset });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    data.forEach((f) => {
      if (f.metadata) names.push(f.name);
    });
    if (data.length < LIMIT) break;
  }
  return names;
}

function publicUrl(bucket: string, name: string): string {
  return supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
}

// File naam me timestamp (Date.now ms) hota hai: {id}-{ts}.ext ya {id}-{ts}-{rand}.ext
// Isse numeric tarah compare karte hain — ek hi client ki multiple files me
// sabse NAYI (jo sabse baad save hui) file choose hoti hai.
function fileTimestamp(name: string): number {
  const m = name.match(/^[^-]+-(\d+)/);
  return m ? Number(m[1]) : 0;
}

export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth)
      return NextResponse.json({ error: "Sirf Admin is action ko kar sakta hai" }, { status: 403 });

    const report: Record<string, { files: number; fixed: number; skipped: number }> = {};

    for (const { bucket, table, column, idColumn, idMode } of REPAIR_MAP) {
      const files = await listBucketFiles(bucket);

      if (idColumn === "transaction_id") {
        // ── job-images: files ko transaction ke hisaab se broken rows se pair karo ──
        const byTxn = new Map<number, string[]>();
        for (const name of files) {
          const txn = parseFileId(name, idMode);
          if (txn == null) continue;
          const t = Number(txn);
          if (!byTxn.has(t)) byTxn.set(t, []);
          byTxn.get(t)!.push(name);
        }
        const txnIds = [...byTxn.keys()];
        if (txnIds.length === 0) {
          report[bucket] = { files: files.length, fixed: 0, skipped: 0 };
          continue;
        }

        const { data: rows } = await supabase
          .from(table)
          .select(`id, ${idColumn}, ${column}`)
          .in(idColumn, txnIds);
        const brokenRows = ((rows as unknown as Record<string, unknown>[]) || []).filter((r) =>
          isBroken(r[column])
        );
        const brokenByTxn = new Map<number, Record<string, unknown>[]>();
        brokenRows.forEach((r) => {
          const k = Number(r[idColumn]);
          if (!brokenByTxn.has(k)) brokenByTxn.set(k, []);
          brokenByTxn.get(k)!.push(r);
        });

        let fixed = 0;
        const toInsert: Record<string, unknown>[] = [];
        for (const [txn, names] of byTxn) {
          const queue = brokenByTxn.get(txn) || [];
          names.sort();
          for (const name of names) {
            const url = publicUrl(bucket, name);
            const row = queue.shift();
            if (row) {
              const { error } = await supabase
                .from(table)
                .update({ [column]: url })
                .eq("id", row.id);
              if (!error) fixed++;
            } else {
              toInsert.push({ [idColumn]: txn, [column]: url });
            }
          }
        }
        if (toInsert.length > 0) {
          const { error } = await supabase.from(table).insert(toInsert);
          if (!error) fixed += toInsert.length;
        }
        report[bucket] = { files: files.length, fixed, skipped: files.length - fixed };
        continue;
      }

      // ── Normal buckets: ek client/row ki multiple files ho to SABSE NAYI chuno ──
      // (purane restore se orphan ho gayi files ko ignore karo — latest wahi hai
      // jo user ne sabse baad save ki thi)
      const latestByName = new Map<number | string, string>();
      for (const name of files) {
        const id = parseFileId(name, idMode);
        if (id == null) continue;
        const prev = latestByName.get(id);
        if (prev === undefined || fileTimestamp(name) > fileTimestamp(prev))
          latestByName.set(id, name);
      }
      const ids = [...latestByName.keys()];
      if (ids.length === 0) {
        report[bucket] = { files: files.length, fixed: 0, skipped: 0 };
        continue;
      }

      const { data: rows } = await supabase.from(table).select(`id, ${column}`).in("id", ids);
      const rowMap = new Map<string | number, Record<string, unknown>>(
        ((rows as unknown as Record<string, unknown>[]) || []).map((r) => [
          r.id as string | number,
          r,
        ])
      );

      let fixed = 0;
      let skipped = 0;
      for (const [id, name] of latestByName) {
        const row = rowMap.get(id);
        if (!row) {
          skipped++;
          continue;
        } // row exist nahi karti
        if (!isBroken(row[column])) {
          skipped++;
          continue;
        } // valid URL already
        const { error } = await supabase
          .from(table)
          .update({ [column]: publicUrl(bucket, name) })
          .eq("id", id);
        if (!error) fixed++;
        else skipped++;
      }
      report[bucket] = { files: files.length, fixed, skipped };
    }

    return NextResponse.json({ status: "success", report });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
