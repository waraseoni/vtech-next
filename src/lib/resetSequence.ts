/**
 * D1 (K10) — `reset_sequence(text)` RPC ke liye server-side allowlist.
 *
 * Anon/browser se ye RPC kabhi call nahi hoti: `reset_sequence` sequences
 * badalti hai (write) aur service_role ke bina RLS bypass nahi karna chahiye.
 * Browser backup page sirf `/api/admin/reset-sequence` ko table name bhejta
 * hai; route admin verify karta hai + yahan se allowlist check karta hai.
 *
 * Allowlist = backup page ke `sequenceTables` ke saath same (ek hi source).
 */

export const RESET_SEQUENCE_TABLES = [
  "system_info",
  "job_id_counter",
  "mechanic_list",
  "profiles",
  "client_list",
  "product_list",
  "service_list",
  "suppliers",
  "inventory_list",
  "lender_list",
  "expense_list",
  "transaction_list",
  "client_loans",
  "client_payments",
  "direct_sales",
  "direct_sale_items",
  "attendance_list",
  "advance_payments",
  "mechanic_salary_history",
  "mechanic_commission_history",
  "message_list",
  "messages",
  "wp_template_history",
  "activity_logs",
  "payment_reminders",
  "push_subscriptions",
  "client_contacts",
  "supplier_contacts",
  "supplier_contact_persons",
  "supplier_contact_phones",
  "location_zones",
  "location_racks",
  "location_bins",
  "location_boxes",
  "locations",
  "brands",
  "service_types",
  "device_models",
  "device_identifiers",
  "staff_duty_schedule",
  "staff_geofence_permit",
  "user_passkeys",
  "stock_counts",
  "stock_adjustments",
  "supplier_payments",
  "job_required_parts",
  "bom_templates",
  "login_throttle",
] as const;

export type ResetSequenceTable = (typeof RESET_SEQUENCE_TABLES)[number];

const allowed = new Set<string>(RESET_SEQUENCE_TABLES);

/** Allowlist check — arbitrary sequence name RPC me na jaye. */
export function isResetSequenceTable(name: unknown): name is ResetSequenceTable {
  return typeof name === "string" && allowed.has(name);
}
