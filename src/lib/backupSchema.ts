// Shared schema-dive types + parser for backup/restore tooling.
// Live schema (Supabase OpenAPI) se table/column/PK info nikalta hai taaki
// backup/restore me hardcoded column lists se drift na ho (lossless backups).

export interface SupabaseTableSchema {
  name: string;
  /** Sab API-visible columns (property order = definition order). */
  cols: string[];
  /** Primary-key columns (`<pk/>` marker se detect). */
  pk: string[];
  /** GENERATED ALWAYS columns — restore me insert nahi karne (DB auto-calculate). */
  generated: string[];
  /** NOT NULL columns (OpenAPI `required`) — insert fail hone ki aadat dry-run me pakdo. */
  notNull: string[];
}

export interface BackupVersionInfo {
  /** Raw value from `_meta.version` (e.g. "4.0"). */
  version: string;
  major: number;
  /** Purane 3.x/2.x files — padhe jaate hain, par warning dikhti hai (hard-block nahi). */
  isLegacy: boolean;
  /** User ko dikhane ke liye message; null = clean 4.0. */
  warning: string | null;
}

export interface BackupSchemaSnapshot {
  captured_at: string;
  tables: Record<string, { cols: string[]; pk: string[]; notNull: string[]; generated: string[] }>;
  /** Local `supabase/migrations/*.sql` IDs (restore me DB verify ke liye). */
  migration_ids: string[];
}

/**
 * Backup version classify karo. 4.0 canonical hai; 3.x/2.x legacy me padhte hain
 * (disaster recovery ko block nahi karna), par unknown/legacy par clear warning.
 */
export function parseBackupVersion(
  meta: Record<string, unknown> | undefined | null
): BackupVersionInfo | null {
  if (!meta?.version) return null;
  const version = String(meta.version);
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) {
    return {
      version,
      major: 0,
      isLegacy: true,
      warning: `Backup version "${version}" samajh nahi aaya — legacy mode me padha ja raha hai.`,
    };
  }
  if (major >= 4) return { version, major, isLegacy: false, warning: null };
  if (major === 3 || major === 2) {
    return {
      version,
      major,
      isLegacy: true,
      warning: `Legacy backup format ${version} — 4.0 ka schema snapshot/migration IDs nahi hain. Restore chalega, par review zaroori.`,
    };
  }
  return {
    version,
    major,
    isLegacy: true,
    warning: `Purana backup format ${version} — limited metadata; restore ke baad counts verify karein.`,
  };
}

/** Backup `_meta.schema_snapshot` builder (browser + server CLI wahi shape). */
export function buildSchemaSnapshot(
  tables: SupabaseTableSchema[],
  migrationIds: string[],
  capturedAt: string = new Date().toISOString()
): BackupSchemaSnapshot {
  const snapshot: BackupSchemaSnapshot["tables"] = {};
  for (const t of tables) {
    snapshot[t.name] = {
      cols: [...t.cols],
      pk: [...t.pk],
      notNull: [...t.notNull],
      generated: [...t.generated],
    };
  }
  return { captured_at: capturedAt, tables: snapshot, migration_ids: [...migrationIds] };
}

export interface SupabaseOpenApiLike {
  definitions?: Record<
    string,
    {
      required?: string[];
      properties?: Record<string, { description?: string } | undefined>;
    }
  >;
}

/** Known GENERATED ALWAYS columns (OpenAPI me marker nahi milta — explicit map). */
export const GENERATED_COLUMNS: Record<string, string[]> = {
  client_payments: ["net_amount"],
  // `generated always as identity` — backup me purana id hota hai, insert par
  // PostgreSQL 428C9 deta hai. DB apna id khud banayega.
  staff_duty_schedule: ["id"],
  staff_geofence_permit: ["id"],
};

export function parseOpenApiToSchema(
  spec: SupabaseOpenApiLike,
  knownGenerated: Record<string, string[]> = GENERATED_COLUMNS
): SupabaseTableSchema[] {
  const defs = spec?.definitions ?? {};
  const tables: SupabaseTableSchema[] = [];

  for (const [name, def] of Object.entries(defs)) {
    const props = def?.properties ?? {};
    const cols: string[] = [];
    const pk: string[] = [];
    for (const [colName, meta] of Object.entries(props)) {
      const isPk = !!meta?.description?.includes("<pk/>");
      cols.push(colName);
      if (isPk) pk.push(colName);
    }
    tables.push({
      name,
      cols,
      pk,
      generated: knownGenerated[name] ?? [],
      notNull: def?.required ?? [],
    });
  }

  tables.sort((a, b) => a.name.localeCompare(b.name));
  return tables;
}

/**
 * Rows me PK violations count karo: missing (null/undefined/"") ya duplicate
 * combos. Dry-run (restore se pehle) isi se upsert-merge/fail andaza hota hai.
 * Composite PK bhi (har combo unique chahiye).
 */
export function countPkViolations(rows: Record<string, unknown>[], pk: string[]): number {
  if (pk.length === 0 || rows.length === 0) return 0;
  const seen = new Set<string>();
  let bad = 0;
  for (const row of rows) {
    const missing = pk.some((c) => row?.[c] === null || row?.[c] === undefined || row?.[c] === "");
    const key = pk.map((c) => String(row?.[c])).join("\u0000");
    if (missing || seen.has(key)) bad++;
    else seen.add(key);
  }
  return bad;
}
