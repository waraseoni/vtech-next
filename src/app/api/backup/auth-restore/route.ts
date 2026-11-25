import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import {
  AUTH_LINKED_TABLES,
  AUTH_TABLE_PK,
  type AuthLinkedTable,
  type AuthUserLike,
  buildAuthUuidRemap,
  remapAuthRows,
  filterRowsToColumns,
} from "@/lib/backupAuthRestore";
import { parseOpenApiToSchema, type SupabaseOpenApiLike } from "@/lib/backupSchema";
import { dedupeRowsByPk, normalizeTextFieldsForRestore } from "@/lib/backupRestore";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only restore for auth-linked tables (service_role, server-side only).
//
// Browser restore (/backup) ke 218 failures ka reason cross-project auth UUID
// tha: backup me auth.users nahi aate aur RLS + profiles FK purane UID reject
// karte hain. Ye route:
//   1. purane profile UUID ko EMAIL se naye project ke auth user se map karta hai
//   2. current admin ka profile snapshot le kar end me wapas restore karta hai
//      (backup admin UID overwrite se lock-out nahi hota)
//   3. service-role se RLS bypass karke sirf 8 auth tables me upsert karta hai
//
// Default = DRY RUN (`confirm: false`). Live writes sirf explicit `confirm: true`
// aur admin session ke saath. Service-role key kabhi browser me nahi jaati.
// ─────────────────────────────────────────────────────────────────────────────

type AuthRestoreBody = {
  backup?: Record<string, unknown>;
  createMissingUsers?: boolean;
  /** Naye auth users ko random temporary password set karo (email inbox nahi hai). */
  setTempPasswords?: boolean;
  confirm?: boolean;
};

type TempCredential = { email: string; password: string };

type TableResult = {
  table: string;
  fileRows: number;
  restored: number;
  failed: number;
  errors: string[];
};

async function fetchLiveSchemaColumns(url: string, key: string): Promise<Record<string, string[]>> {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Live schema fetch failed (${res.status})`);
  const spec = (await res.json()) as SupabaseOpenApiLike;
  const out: Record<string, string[]> = {};
  for (const table of parseOpenApiToSchema(spec)) out[table.name] = table.cols;
  return out;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Sirf admin/developer ye restore chalaa sakta hai" },
      { status: 403 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service-role env missing" }, { status: 500 });
  }

  let body: AuthRestoreBody;
  try {
    body = (await req.json()) as AuthRestoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const backup = body.backup;
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    return NextResponse.json({ error: "backup object required" }, { status: 400 });
  }

  const tables = AUTH_LINKED_TABLES.filter((t) => backup[t] !== undefined);
  if (tables.length === 0) {
    return NextResponse.json(
      { error: "Backup me koi auth-linked table nahi mila (profiles/messages/etc.)" },
      { status: 400 }
    );
  }

  const rowsByTable = {} as Record<AuthLinkedTable, Record<string, unknown>[]>;
  for (const table of tables) {
    const rows = backup[table];
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: `Invalid rows for table: ${table}` }, { status: 400 });
    }
    rowsByTable[table] = rows as Record<string, unknown>[];
  }

  const supabase = getAdminSupabase();

  // ── Current admin profile: restore ke baad exact wapas likhte hain ─────────
  const { data: currentAdminProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", admin.user.id)
    .maybeSingle();

  // ── Naye project ke auth users (paginated) ────────────────────────────────
  const authUsers: AuthUserLike[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return NextResponse.json(
        { error: `Auth users list fail: ${error.message}` },
        { status: 502 }
      );
    }
    const users = data?.users ?? [];
    authUsers.push(...users.map((u) => ({ id: u.id, email: u.email ?? null })));
    if (users.length < 200) break;
  }

  const plan = buildAuthUuidRemap(
    (rowsByTable.profiles ?? []) as Record<string, unknown>[],
    authUsers,
    !!body.createMissingUsers
  );

  const perTable = tables.map((table) => ({ table, rows: rowsByTable[table].length }));

  if (!body.confirm) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      plan: {
        ...plan,
        perTable,
        protectedAdmin: !!currentAdminProfile,
        tempPasswordsEnabled: !!body.setTempPasswords,
        totalRows: perTable.reduce((s, t) => s + t.rows, 0),
      },
    });
  }

  // ── CONFIRMED: optional missing auth users create ─────────────────────────
  const createdUsers: string[] = [];
  const credentials: TempCredential[] = [];
  const createErrors: string[] = [];
  if (body.createMissingUsers) {
    for (const user of plan.toCreate) {
      const { data, error } = await supabase.auth.admin.createUser({
        id: user.id,
        email: user.email,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });
      if (!error && data.user) {
        createdUsers.push(user.email);
        plan.remap[user.id] = data.user.id;
        // Custom/fake email par reset link nahi aata — service-role se hi
        // temporary password set karo aur sirf is response me ek baar dikhao.
        if (body.setTempPasswords) {
          const tempPassword = `Vt!${randomBytes(9).toString("base64url")}`;
          const { error: pwErr } = await supabase.auth.admin.updateUserById(data.user.id, {
            password: tempPassword,
          });
          if (pwErr) createErrors.push(`${user.email}: password set fail — ${pwErr.message}`);
          else credentials.push({ email: user.email, password: tempPassword });
        }
      } else {
        createErrors.push(`${user.email}: ${error?.message ?? "unknown error"}`);
        // Email already exists with another UID → uski ID se remap karo.
        const existing = authUsers.find(
          (u) => u.email?.trim().toLowerCase() === user.email.toLowerCase()
        );
        if (existing) plan.remap[user.id] = existing.id;
        else delete plan.remap[user.id];
      }
    }
  }

  // Auth users jinka backup me profile nahi hai (geofence/presence) — unka UID
  // same hi rehta hai.
  for (const u of authUsers) {
    if (u.id && !plan.remap[u.id]) plan.remap[u.id] = u.id;
  }

  // ── Live schema columns (drift-safe) ──────────────────────────────────────
  let schemaCols: Record<string, string[]> = {};
  try {
    schemaCols = await fetchLiveSchemaColumns(url, key);
  } catch {
    // Schema fetch fail = fallback: backup ki columns hi bhejo, DB khud error
    // batayega. Dry-run plan already dikh chuka hota hai.
  }

  // ── Service-role upsert (parent profiles pehle) ──────────────────────────
  const orderedTables = AUTH_LINKED_TABLES.filter((t) => tables.includes(t));
  const results: TableResult[] = [];

  for (const table of orderedTables) {
    const fileRows = rowsByTable[table].length;
    let rows = remapAuthRows(table, rowsByTable[table], plan.remap);
    const cols = schemaCols[table];
    if (cols?.length) rows = filterRowsToColumns(rows, cols);
    rows = rows.map((r) => normalizeTextFieldsForRestore(r));

    const pk = AUTH_TABLE_PK[table];
    const dedup = dedupeRowsByPk(rows, pk);
    const errors = new Set<string>();
    let restored = 0;

    const batchSize = 50;
    for (let i = 0; i < dedup.rows.length; i += batchSize) {
      const batch = dedup.rows.slice(i, i + batchSize);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: pk.join(",") });
      if (!error) {
        restored += batch.length;
        continue;
      }
      errors.add(error.message);
      // Batch fail → row-by-row taaki ek bad row baaki rows na roke.
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from(table)
          .upsert(row, { onConflict: pk.join(",") });
        if (!rowErr) restored++;
        else errors.add(rowErr.message);
      }
    }

    results.push({
      table,
      fileRows,
      restored,
      failed: fileRows - restored,
      errors: Array.from(errors),
    });
  }

  // ── Current admin profile hamesha preserved (lock-out guard) ─────────────
  let adminPreserved = false;
  if (currentAdminProfile) {
    const cols = schemaCols.profiles;
    const preserved = cols?.length
      ? filterRowsToColumns([currentAdminProfile], cols)[0]
      : currentAdminProfile;
    const { error } = await supabase.from("profiles").upsert(preserved, { onConflict: "id" });
    adminPreserved = !error;
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    plan: { ...plan, perTable, totalRows: perTable.reduce((s, t) => s + t.rows, 0) },
    results,
    createdUsers,
    createErrors,
    credentials,
    adminPreserved,
  });
}
