// Cross-project auth-linked restore helpers (pure, client-safe).
// Browser backup me auth.users nahi aate — isliye purane profile UUID ko naye
// project ke auth user se EMAIL ke through map karte hain. Current admin ka
// profile route me alag se preserve hota hai (lock-out se bachne ke liye).

/** Tables jinhain service-role + UUID remap chahiye (browser restore fail hota tha). */
export const AUTH_LINKED_TABLES = [
  "profiles",
  "stock_counts",
  "stock_adjustments",
  "messages",
  "push_subscriptions",
  "user_presence",
  "staff_geofence_permit",
  "user_passkeys",
] as const;

export type AuthLinkedTable = (typeof AUTH_LINKED_TABLES)[number];

/** Upsert/delete ke liye PK — live schema se verify kiya gaya. */
export const AUTH_TABLE_PK: Record<AuthLinkedTable, string[]> = {
  profiles: ["id"],
  stock_counts: ["id"],
  stock_adjustments: ["id"],
  messages: ["id"],
  push_subscriptions: ["id"],
  user_presence: ["user_id"],
  staff_geofence_permit: ["id"],
  user_passkeys: ["id"],
};

/** Har table me purane project se aane wale UUID columns. */
export const AUTH_UUID_COLUMNS: Record<AuthLinkedTable, string[]> = {
  profiles: ["id"],
  stock_counts: ["counted_by"],
  stock_adjustments: ["created_by"],
  messages: ["sender_id", "recipient_id"],
  push_subscriptions: ["user_id"],
  user_presence: ["user_id"],
  staff_geofence_permit: ["user_id", "granted_by"],
  user_passkeys: ["user_id"],
};

/** `generated always as identity` — server insert par id nahi bhejna. */
export const AUTH_GENERATED_COLUMNS: Record<AuthLinkedTable, string[]> = {
  profiles: [],
  stock_counts: [],
  stock_adjustments: [],
  messages: [],
  push_subscriptions: [],
  user_presence: [],
  staff_geofence_permit: ["id"],
  user_passkeys: [],
};

/** Backup rows me se sirf live schema me maujood columns rakho (drift-safe). */
export function filterRowsToColumns<T extends Record<string, unknown>>(
  rows: T[],
  cols: readonly string[]
): Record<string, unknown>[] {
  const allowed = new Set(cols);
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (allowed.has(key)) out[key] = value;
    }
    return out;
  });
}

export type AuthUserLike = { id: string; email?: string | null };
export type ProfileLike = Record<string, unknown>;

export type AuthRemapPlan = {
  /** old UUID → new-project UUID */
  remap: Record<string, string>;
  /** Jin profiles ka na user mila na create=request kiya gaya */
  missing: { oldId: string; email: string }[];
  /** Naye auth users banane hon (same UUID, password nahi) */
  toCreate: { id: string; email: string; fullName: string }[];
};

/**
 * Email se auth-user match. Jo user already naye project me hai uska ID use
 * karte hain (login identity preserve), warna optional create plan.
 * Pure function — auth API calls route me hi hote hain.
 */
export function buildAuthUuidRemap(
  profiles: ProfileLike[],
  authUsers: AuthUserLike[],
  createMissingUsers: boolean
): AuthRemapPlan {
  const byEmail = new Map<string, string>();
  const ids = new Set<string>();
  for (const u of authUsers) {
    if (!u.id) continue;
    ids.add(u.id);
    if (u.email) byEmail.set(u.email.trim().toLowerCase(), u.id);
  }

  const remap: Record<string, string> = {};
  const missing: { oldId: string; email: string }[] = [];
  const toCreate: { id: string; email: string; fullName: string }[] = [];
  const plannedEmails = new Set<string>();

  for (const p of profiles) {
    const oldId = typeof p.id === "string" ? p.id : "";
    const email = typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
    if (!oldId) continue;
    if (ids.has(oldId)) {
      remap[oldId] = oldId;
      continue;
    }
    const matched = email ? byEmail.get(email) : undefined;
    if (matched) {
      remap[oldId] = matched;
      continue;
    }
    if (createMissingUsers && email && !plannedEmails.has(email)) {
      plannedEmails.add(email);
      toCreate.push({
        id: oldId,
        email,
        fullName: typeof p.full_name === "string" ? p.full_name : "",
      });
      remap[oldId] = oldId;
      continue;
    }
    missing.push({ oldId, email: email || "<no-email>" });
  }

  return { remap, missing, toCreate };
}

/** Table ke rows me UUID columns remap karo + generated identity id hatao. */
export function remapAuthRows<T extends Record<string, unknown>>(
  table: AuthLinkedTable,
  rows: T[],
  remap: Record<string, string>
): Record<string, unknown>[] {
  const uuidCols = AUTH_UUID_COLUMNS[table] ?? [];
  const generated = AUTH_GENERATED_COLUMNS[table] ?? [];
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const col of generated) delete out[col];
    for (const col of uuidCols) {
      const value = out[col];
      if (typeof value === "string" && remap[value]) out[col] = remap[value];
    }
    return out;
  });
}
