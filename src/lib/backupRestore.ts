// Shared restore rules for /backup. Pure helpers + golden FK-first table order.
// Goal: restore kabhi bhi nullable NULL ko "" me na badle, composite PK ka
// dedup sahi kare, aur naye master tables ko child tables se pehle restore kare.

export type RestoreTableOrder = { table: string; order: number };

// ─── Backup tables in RESTORE ORDER (FK dependencies matter!) ─────────────────
// Parent tables phle restore honge, phir child tables. Live schema se nayi
// tables end me auto-append hoti hain, par jinke FK known hain unhe yahin pin
// kiya hai (warn: auto-append = maxOrder + 1, jo transaction_list ke baad aata
// hai aur brand/model FK ko tod deta tha).
export const BACKUP_TABLES_ORDERED: RestoreTableOrder[] = [
  // Step 1: System & Counters (no FK)
  { table: "system_info", order: 1 },
  { table: "job_id_counter", order: 1 },
  // Step 2: Master tables (parents phle; child contacts/location-zones FK inhe)
  { table: "mechanic_list", order: 2 },
  { table: "users", order: 2 },
  { table: "profiles", order: 2 },
  { table: "client_list", order: 2 },
  { table: "product_list", order: 2 },
  { table: "service_list", order: 2 },
  { table: "suppliers", order: 2 },
  // Step 2b: Device identity masters — transaction_list inke FK hai, isliye
  // inhe order 5 se pehle hona zaroori hai (pehle maxOrder+1 par append hote the).
  { table: "brands", order: 2 },
  { table: "service_types", order: 2 },
  { table: "brand_job_counters", order: 2 },
  { table: "device_models", order: 2 },
  { table: "device_identifiers", order: 2 },
  // Step 2c: Location hierarchy. Live DB me locations.zone_id/rack_id/bin_id/
  // box_id → in tables ke FK hain, isliye hierarchy pehle (purana order ulta tha
  // aur zone_id wali rows 23503 se fail hoti thin).
  { table: "location_zones", order: 2 },
  { table: "location_racks", order: 2 },
  { table: "location_bins", order: 2 },
  { table: "location_boxes", order: 2 },
  { table: "locations", order: 2 },
  { table: "client_contacts", order: 2 },
  { table: "supplier_contacts", order: 2 },
  { table: "supplier_contact_persons", order: 2 },
  { table: "supplier_contact_phones", order: 2 },
  // Step 3: Pivot + Purchase Orders (FK: product_list, suppliers, locations)
  { table: "spare_supplier", order: 3 },
  { table: "product_locations", order: 3 },
  { table: "purchase_orders", order: 3 },
  { table: "purchase_order_items", order: 3 },
  // Step 4: Inventory + Stock + Finance (FK: product_list, locations, lenders)
  { table: "inventory_list", order: 4 },
  { table: "stock_counts", order: 4 },
  { table: "stock_adjustments", order: 4 },
  { table: "lender_list", order: 4 },
  { table: "loan_payments", order: 4 },
  // expense_list.supplier_payment_id → supplier_payments(id); parent pehle
  { table: "supplier_payments", order: 4 },
  { table: "expense_list", order: 4 },
  // Step 5: Transactions (main job table — parent of transaction sub-tables)
  { table: "transaction_list", order: 5 },
  // Step 6: Transaction sub-tables + required parts + client finance
  { table: "transaction_products", order: 6 },
  { table: "transaction_services", order: 6 },
  { table: "transaction_images", order: 6 },
  { table: "job_required_parts", order: 6 },
  { table: "client_loans", order: 6 },
  { table: "client_payments", order: 6 },
  // Step 7: Direct sales + Attendance/Advances/Salary
  { table: "direct_sales", order: 7 },
  { table: "direct_sale_items", order: 7 },
  { table: "attendance_list", order: 7 },
  { table: "advance_payments", order: 7 },
  { table: "mechanic_salary_history", order: 7 },
  { table: "mechanic_commission_history", order: 7 },
  // Step 8: Messaging + templates + logs
  { table: "message_list", order: 8 },
  { table: "messages", order: 8 },
  { table: "wp_template_history", order: 8 },
  { table: "activity_logs", order: 8 },
  { table: "payment_reminders", order: 8 },
  { table: "push_subscriptions", order: 8 },
  // Step 9: BoM + login/online tracking + staff identity/auth tables
  { table: "bom_templates", order: 9 },
  { table: "login_throttle", order: 9 },
  { table: "user_presence", order: 9 },
  { table: "staff_duty_schedule", order: 9 },
  { table: "staff_geofence_permit", order: 9 },
  { table: "user_passkeys", order: 9 },
];

export const BACKUP_TABLES = BACKUP_TABLES_ORDERED.map((t) => t.table);

// Text columns jahan MySQL dumps kabhi-kabhi number bhej dete hain.
const TEXT_FIELDS = [
  "name",
  "description",
  "category",
  "fault",
  "item",
  "remark",
  "remarks",
  "uniq_id",
  "code",
  "fullname",
  "address",
  "sale_code",
  "firstname",
  "lastname",
  "contact",
  "email",
  "message",
  "meta_value",
  "hsn",
] as const;

/**
 * Nullable text column ka NULL hamesha NULL rehne do. Purana code har text
 * field ka null → "" kar deta tha, jisse `locations_code_idx` (partial unique
 * on code) aur `brands_code_key` par 63+2 rows duplicate ho kar fail hote the.
 * Sirf NOT NULL columns me hi "" fallback rakhte hain.
 */
export function normalizeTextFieldsForRestore(
  row: Record<string, unknown>,
  notNullCols: readonly string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  const notNull = new Set(notNullCols);
  for (const col of TEXT_FIELDS) {
    if (!(col in out)) continue;
    const value = out[col];
    if (value === null || value === undefined) {
      if (notNull.has(col)) out[col] = "";
      continue;
    }
    if (typeof value !== "string") out[col] = String(value);
  }
  return out;
}

/**
 * Batch ke andar PK duplicates hatao. Single ya composite PK dono cover.
 * Missing PK wali row ko nahi hatate — DB uski asli error batayega (dry-run
 * pehle hi such rows flag karta hai).
 */
export function dedupeRowsByPk<T extends Record<string, unknown>>(
  rows: T[],
  pk: readonly string[]
): { rows: T[]; skipped: number } {
  if (pk.length === 0 || rows.length < 2) return { rows, skipped: 0 };
  const seen = new Set<string>();
  const out: T[] = [];
  let skipped = 0;
  for (const row of rows) {
    const values = pk.map((col) => row[col]);
    if (values.some((v) => v === null || v === undefined || v === "")) {
      out.push(row);
      continue;
    }
    const key = JSON.stringify(values);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return { rows: out, skipped };
}

export type RestoreErrorKind = "rls" | "fk" | "unique" | "identity" | "other";

export function classifyRestoreError(message: string): RestoreErrorKind {
  if (/row-level security/i.test(message)) return "rls";
  if (/violates foreign key constraint/i.test(message)) return "fk";
  if (/duplicate key value violates unique constraint/i.test(message)) return "unique";
  if (/cannot insert a non-default value|generated always/i.test(message)) return "identity";
  return "other";
}

/**
 * Cross-project restore me auth users UUID match nahi karte (backup me
 * `users` array empty hota hai, auth.users export hi nahi hota). Browser
 * service-role use nahi kar sakta — isliye in tables ko clear explanation
 * chahiye, silent "failed" count nahi.
 */
export function restoreErrorHint(kind: RestoreErrorKind): string {
  switch (kind) {
    case "rls":
      return "RLS: purane project ke user UUID naye project se match nahi karte — service-role restore/auth remap zaroori";
    case "fk":
      return "FK: parent row nahi mila (cross-project auth UUID ya order dependency)";
    case "unique":
      return "UNIQUE: duplicate key (code/name)";
    case "identity":
      return "IDENTITY: generated always column me explicit id bheja gaya";
    default:
      return "";
  }
}
