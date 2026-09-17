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