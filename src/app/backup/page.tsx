"use client";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { downloadBlob } from "@/lib/nativePrint";
import {
  type SupabaseTableSchema,
  buildSchemaSnapshot,
  countPkViolations,
  parseBackupVersion,
} from "@/lib/backupSchema";
import {
  BACKUP_TABLES_ORDERED,
  BACKUP_TABLES,
  normalizeTextFieldsForRestore,
  dedupeRowsByPk,
  classifyRestoreError,
  restoreErrorHint,
} from "@/lib/backupRestore";
import { AUTH_LINKED_TABLES } from "@/lib/backupAuthRestore";
import { RESET_SEQUENCE_TABLES } from "@/lib/resetSequence";
import { toast } from "@/lib/toast";
import {
  Download,
  Upload,
  Database,
  Loader2,
  ShieldAlert,
  FileJson,
  RefreshCw,
  Table2,
  Rows3,
  Images,
  Server,
  Clock,
  Cloud,
  BookOpen,
  Trash2,
} from "lucide-react";

// Restore order + shared normalization helpers: src/lib/backupRestore.ts se aate
// hain (unit-tested). Is file me sirf UI + Supabase calls hain.

// ── Database Schema Columns — Used to strip extra columns from backup JSON ───
const TABLE_COLUMNS: Record<string, string[]> = {
  message_list: ["id", "fullname", "contact", "email", "message", "status", "date_created"],
  client_payments: [
    "id",
    "client_id",
    "job_id",
    "loan_id",
    "bill_no",
    "payment_date",
    "amount",
    "discount",
    "net_amount",
    "payment_mode",
    "payment_type",
    "remarks",
    "created_at",
  ],
  mechanic_list: [
    "id",
    "firstname",
    "middlename",
    "lastname",
    "contact",
    "designation",
    "daily_salary",
    "avatar",
    "commission_percent",
    "status",
    "delete_flag",
    "date_added",
    "date_updated",
    "salary_per_day",
    "image_path",
  ],
  users: [
    "id",
    "firstname",
    "lastname",
    "username",
    "password",
    "avatar",
    "last_login",
    "type",
    "mechanic_id",
    "date_added",
    "date_updated",
  ],
  loan_payments: ["id", "lender_id", "amount_paid", "payment_date", "remarks"],
  service_list: [
    "id",
    "name",
    "description",
    "price",
    "status",
    "delete_flag",
    "date_created",
    "date_updated",
    "hsn",
  ],
  advance_payments: ["id", "mechanic_id", "amount", "date_paid", "reason", "date_created"],
  inventory_list: [
    "id",
    "product_id",
    "quantity",
    "place",
    "stock_date",
    "supplier_id",
    "date_created",
    "date_updated",
    "purchase_cost",
    "courier_charges",
    // I6-Phase-2 (2026-09-25): place_zone/rack/bin/box DROP — export se out.
    // `place` (display path) retained.
    "purchase_order_id",
  ],
  direct_sale_items: ["id", "sale_id", "product_id", "qty", "price"],
  suppliers: [
    "id",
    "name",
    "contact",
    "email",
    "address",
    "status",
    "delete_flag",
    "date_created",
    "date_updated",
  ],
  spare_supplier: ["spare_id", "supplier_id"],
  locations: [
    "id",
    "zone",
    "rack",
    "bin",
    "box",
    "label",
    "created_at",
    "delete_flag",
    "status",
    "code",
    "zone_id",
    "rack_id",
    "bin_id",
    "box_id",
  ],
  product_locations: ["product_id", "location_id", "created_at"],
  purchase_orders: [
    "id",
    "po_code",
    "supplier_id",
    "status",
    "expected_date",
    "notes",
    "total_amount",
    "received_date",
    "date_created",
    "date_updated",
  ],
  purchase_order_items: [
    "id",
    "purchase_order_id",
    "product_id",
    "qty_ordered",
    "qty_received",
    "unit_cost",
    "date_created",
  ],
  transaction_list: [
    "id",
    "user_id",
    "mechanic_id",
    "code",
    "job_id",
    "brand_id",
    "brand_job_no",
    "item_name",
    "model",
    "serial_no",
    "warranty_claim_no",
    "service_type_id",
    "client_id",
    "client_name",
    "fault",
    "remark",
    "item",
    "uniq_id",
    "amount",
    "mechanic_amount",
    "mechanic_commission_amount",
    "del_status",
    "status",
    "date_created",
    "date_updated",
    "date_completed",
  ],
  product_list: [
    "id",
    "name",
    "description",
    "cost_price",
    "price",
    "image_path",
    "status",
    "delete_flag",
    "date_created",
    "date_updated",
    "hsn",
    "alert_quantity",
    "barcode",
    // I6-Phase-2 (2026-09-25): place_zone/rack/bin/box DROP — export se out.
  ],
  lender_list: [
    "id",
    "fullname",
    "contact",
    "loan_amount",
    "interest_rate",
    "tenure_months",
    "reason",
    "emi_amount",
    "start_date",
    "status",
    "date_created",
  ],
  attendance_list: [
    "id",
    "mechanic_id",
    "status",
    "curr_date",
    "time_in",
    "time_out",
    "lat_in",
    "lng_in",
    "lat_out",
    "lng_out",
  ],
  expense_list: ["id", "category", "amount", "remarks", "date_created"],
  mechanic_salary_history: ["id", "mechanic_id", "salary", "effective_date", "date_created"],
  transaction_services: ["transaction_id", "service_id", "service_name", "price"],
  transaction_images: ["id", "transaction_id", "image_path", "date_created"],
  transaction_products: ["transaction_id", "product_id", "product_name", "qty", "price"],
  client_list: [
    "id",
    "firstname",
    "middlename",
    "lastname",
    "contact",
    "email",
    "address",
    "image_path",
    "opening_balance",
    "delete_flag",
    "date_created",
    "date_updated",
    "payment_due_date",
    "payment_due_remarks",
    "login_allowed",
  ],
  client_loans: [
    "id",
    "client_id",
    "principal_amount",
    "interest_rate",
    "loan_period",
    "total_payable",
    "emi_amount",
    "remarks",
    "loan_date",
    "status",
    "created_at",
  ],
  direct_sales: [
    "id",
    "sale_code",
    "client_id",
    "mechanic_id",
    "total_amount",
    "payment_mode",
    "remarks",
    "last_edited_by",
    "last_edited_by_name",
    "last_edited_date",
    "date_created",
  ],
  system_info: ["id", "meta_field", "meta_value"],
  job_id_counter: ["id", "last_job_id"],
  brand_job_counters: ["brand_id", "last_sequence_number", "prefix", "date_updated"],
  mechanic_commission_history: [
    "id",
    "mechanic_id",
    "commission_percent",
    "effective_date",
    "date_created",
  ],
  wp_template_history: [
    "id",
    "template_key",
    "action",
    "old_value",
    "new_value",
    "changed_by",
    "changed_at",
  ],
  activity_logs: [
    "id",
    "user_id",
    "action",
    "module",
    "meta_id",
    "details",
    "date_created",
    "geo_lat",
    "geo_lng",
    "geo_distance_m",
  ],
  payment_reminders: [
    "id",
    "client_id",
    "amount_due",
    "reminder_date",
    "channel",
    "status",
    "remarks",
  ],
  push_subscriptions: [
    "id",
    "user_id",
    "endpoint",
    "p256dh",
    "auth",
    "device_name",
    "enabled",
    "date_created",
    "date_updated",
  ],
};

// ── FK violations to skip (bad data that would cause FK error) ───────────────
// These rows will be skipped during restore to avoid FK constraint errors
const SKIP_INVALID_FK: Record<string, { field: string; invalidValues: (number | string)[] }> = {
  mechanic_commission_history: { field: "mechanic_id", invalidValues: [0] },
};

type BackupData = Record<string, unknown[]>;
type TableStats = { table: string; count: number };
type BackupPreview = {
  fileName: string;
  tables: { name: string; rows: number }[];
  totalRows: number;
  totalTables: number;
  version: string;
  createdAt: string;
  /** Legacy/unknown version warning — preview card me dikhaya jata hai. */
  warning?: string | null;
};
type TableResult = {
  table: string;
  fileRows: number;
  restored: number;
  failed: number;
  errors?: string[];
};
type DiffRow = { table: string; fileRows: number; dbRows: number; diff: number };
type AuthRestorePlan = {
  remap: Record<string, string>;
  missing: { oldId: string; email: string }[];
  toCreate: { id: string; email: string; fullName: string }[];
  perTable: { table: string; rows: number }[];
  protectedAdmin: boolean;
  tempPasswordsEnabled?: boolean;
  totalRows: number;
};
type AuthRestoreResponse = {
  ok: boolean;
  dryRun: boolean;
  error?: string;
  plan?: AuthRestorePlan;
  results?: TableResult[];
  createdUsers?: string[];
  createErrors?: string[];
  credentials?: { email: string; password: string }[];
  adminPreserved?: boolean;
};

export default function BackupPage() {
  const [taking, setTaking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreReport, setRestoreReport] = useState<TableResult[]>([]);
  const [verifyFails, setVerifyFails] = useState<
    { table: string; fileRows: number; dbRows: number }[]
  >([]);
  // Auth-linked tables ke liye admin-only server restore (service-role).
  const [authBusy, setAuthBusy] = useState(false);
  const [authPlan, setAuthPlan] = useState<AuthRestorePlan | null>(null);
  const [authResults, setAuthResults] = useState<TableResult[] | null>(null);
  const [authCreateUsers, setAuthCreateUsers] = useState(false);
  const [authSetTempPassword, setAuthSetTempPassword] = useState(true);
  const [authTempPasswords, setAuthTempPasswords] = useState<{ email: string; password: string }[]>(
    []
  );
  const [authConfirmed, setAuthConfirmed] = useState(false);
  const [loadedBackup, setLoadedBackup] = useState<BackupData | null>(null);
  const [diffData, setDiffData] = useState<DiffRow[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  // Removed-column fail+override (backup decision #2): default fail, explicit opt-in.
  const [allowRemovedColumns, setAllowRemovedColumns] = useState(false);
  const [schemaMigrationIds, setSchemaMigrationIds] = useState<string[]>([]);
  const [repairing, setRepairing] = useState(false);
  const [serverBusy, setServerBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<{
    fileName: string;
    rows: number;
    tables: number;
    incomplete: boolean;
    storage?: { uploaded: boolean; error?: string };
    error?: string;
  } | null>(null);

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    if (type === "success") toast.success(msg);
    else if (type === "info") toast.info(msg);
    else toast.error(msg);
  };

  // ── Live schema (admin API se) — backup/restore dynamic table+column use ──
  // Static lists (BACKUP_TABLES_ORDERED / TABLE_COLUMNS) sirf fallback hain.
  // Yahan se LIVE schema milta hai: saari tables, columns, PK aur generated.
  const fetchSchema = useCallback(async (): Promise<SupabaseTableSchema[]> => {
    type SchemaResp = {
      ok?: boolean;
      tables?: SupabaseTableSchema[];
      migration_ids?: string[];
      error?: string;
    };
    let json: SchemaResp | null = null;
    try {
      const res = await fetch("/api/backup/schema", { cache: "no-store" });
      json = (await res.json()) as SchemaResp | null;
    } catch {
      throw new Error("Live schema load nahi ho paya");
    }
    if (json?.ok && Array.isArray(json.tables)) {
      setSchemaMigrationIds(Array.isArray(json.migration_ids) ? json.migration_ids : []);
      return json.tables;
    }
    throw new Error(json?.error || "Schema API failed");
  }, []);

  const { data: schemaTables, error: schemaQueryErr } = useQuery({
    queryKey: ["backup-schema"],
    queryFn: fetchSchema,
    staleTime: 30_000,
  });
  const schemaError =
    schemaQueryErr instanceof Error ? schemaQueryErr.message : schemaQueryErr ? "Load failed" : "";

  const schemaMap = useMemo(
    () => new Map((schemaTables ?? []).map((t) => [t.name, t])),
    [schemaTables]
  );

  // Golden order + jo nayi tables live me aa gayi hain wo end me append
  const liveOrdered = useMemo<{ table: string; order: number }[]>(() => {
    if (!schemaTables) return BACKUP_TABLES_ORDERED;
    const seen = new Set<string>();
    const base = BACKUP_TABLES_ORDERED.filter((b) => schemaMap.has(b.table)).map((b) => {
      seen.add(b.table);
      return b;
    });
    const maxOrder = base.reduce((m, b) => Math.max(m, b.order), 0);
    const extras = Array.from(schemaMap.keys())
      .filter((t) => !seen.has(t))
      .sort()
      .map((t) => ({ table: t, order: maxOrder + 1 }));
    return [...base, ...extras];
  }, [schemaTables, schemaMap]);

  const tableNames = useMemo(() => liveOrdered.map((o) => o.table), [liveOrdered]);

  // Runtime schema helpers (schema load hone se pehle sab empty/null return)
  const schemaOf = (table: string) => schemaMap.get(table) ?? null;
  const colsOf = (table: string) => schemaOf(table)?.cols ?? null;
  const pkOf = (table: string) => schemaOf(table)?.pk ?? [];
  const genOf = (table: string) => schemaOf(table)?.generated ?? [];

  // ── Fetch live table counts ────────────────────────────────────────────────
  const fetchTableStats = useCallback(async (): Promise<TableStats[]> => {
    const stats: TableStats[] = [];
    for (const t of tableNames) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      stats.push({ table: t, count: count || 0 });
    }
    return stats;
  }, [tableNames]);

  const {
    data: tableStats = [],
    isPending: loadingStats,
    refetch: refetchTableStats,
  } = useQuery({
    queryKey: ["backup-table-stats", tableNames],
    queryFn: fetchTableStats,
    staleTime: 30_000,
  });

  // ── REPAIR IMAGES ──────────────────────────────────────────────────────────
  // Restore (MariaDB conversion) ke baad image_path/avatar_url me dead paths
  // aa gaye hote hain, par files storage bucket me maujood rehti hain. Ye button
  // storage files ko DB rows se wapas link karta hai — sirf broken rows fix
  // hoti hain, pehle se sahi chal rahi images kabhi nahi badalti.
  const handleRepairImages = async () => {
    if (
      !confirm(
        "Storage files se broken image links repair karun? Sirf unhi rows fix hongi jinki image_path/avatar_url kharab (null/dead path) hai — jo images abhi sahi dikh rahi hain wo untouched rahengi."
      )
    )
      return;
    setRepairing(true);
    setProgress("Storage files scan + broken links repair ho rahe hain...");
    try {
      const res = await fetch("/api/repair-images", { method: "POST" });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Repair failed");
      setProgress("");
      const parts = Object.entries(
        json.report as Record<string, { files: number; fixed: number; skipped: number }>
      )
        .map(([bucket, r]) => `${bucket}: ${r.fixed} fixed / ${r.skipped} skip`)
        .join(" · ");
      showToast("success", `✅ ${parts}`);
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Repair failed!");
    } finally {
      setRepairing(false);
    }
  };

  // ── BACKUP ────────────────────────────────────────────────────────────────
  const handleBackup = async () => {
    if (!schemaTables) {
      showToast("error", schemaError || "Live schema load nahi hua — wait karke try karo.");
      return;
    }
    setTaking(true);
    setProgress("Supabase se data fetch ho raha hai...");
    try {
      const createdAt = new Date().toISOString();
      const backup: BackupData = {
        _meta: [
          {
            version: "4.0",
            created_at: createdAt,
            tables: tableNames,
            app: "V-Tech Management System",
            table_order: liveOrdered,
            warnings: [],
            schema_snapshot: buildSchemaSnapshot(schemaTables, schemaMigrationIds, createdAt),
          } as Record<string, unknown>,
        ] as unknown[],
      };

      // Helper function: Fetch all rows with pagination (Supabase default limit = 1000)
      const fetchAllRows = async (tableName: string, selectCols: string, orderField: string) => {
        const allRows: unknown[] = [];
        const PAGE_SIZE = 1000;
        let offset = 0;
        while (true) {
          const { data, error } = await supabase
            .from(tableName)
            .select(selectCols)
            .order(orderField, { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) {
            console.warn(`${tableName} fetch error at offset ${offset}:`, error.message);
            break;
          }
          if (!data || data.length === 0) break;

          allRows.push(...data);
          if (data.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }
        return allRows;
      };

      const mismatches: { table: string; expected: number; got: number }[] = [];

      for (const { table } of liveOrdered) {
        setProgress(`Fetching: ${table}...`);
        // Live schema se order/PK + generated columns (hardcoded se nahi)
        const pk = pkOf(table);
        const orderField = pk.length ? pk[0] : "id";
        const gens = new Set(genOf(table));
        const allCols = colsOf(table);
        // GENERATED columns backup me NAHI — restore par DB calculate karta hai.
        // Ye v3.0 backup restore se pehle explicit-col select ki wajah bhi hai.
        const selectCols =
          gens.size > 0 && allCols ? allCols.filter((c) => !gens.has(c)).join(",") : "*";

        try {
          const data = await fetchAllRows(table, selectCols, orderField);
          backup[table] = data;
          // Exact count verify — silent data loss (fetch break) pakadne ke liye
          const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
          if (count !== null && count !== data.length) {
            mismatches.push({ table, expected: count, got: data.length });
            console.warn(
              `${table} count mismatch: expected ${count}, got ${data.length} (backup INCOMPLETE)`
            );
          }
        } catch (error) {
          console.warn(
            `${table} skip (${error instanceof Error ? error.message : "Unknown error"})`
          );
          backup[table] = [];
          mismatches.push({ table, expected: -1, got: 0 });
        }
      }

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      downloadBlob(blob, `vtech_backup_${now}.json`);

      const totalRows = liveOrdered.reduce((s, o) => s + (backup[o.table]?.length || 0), 0);
      setProgress("");
      if (mismatches.length > 0) {
        // File save ho chuki hai, par mismatch hain — INCOMPLETE flag rkhna zaroori
        (backup._meta as Record<string, unknown>[])[0].warnings = mismatches as unknown[];
        showToast(
          "error",
          `⚠ Backup SAVED par RAWA wrong — ${mismatches.length} table(s) count mismatch (live schema se verify kiya hai).`
        );
      } else {
        showToast(
          "success",
          `Backup ready! ${totalRows.toLocaleString()} rows, ${tableNames.length} tables (count verified)`
        );
      }
      refetchTableStats();
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Backup failed!");
    } finally {
      setTaking(false);
    }
  };

  // ── SERVER BACKUP (scheduled-style — server ke backups/ folder me) ─────────
  const loadServerFiles = useCallback(async () => {
    const empty = {
      files: [] as { name: string; size: number; modified: string }[],
      storageFiles: [] as { name: string; modified: string }[],
    };
    try {
      const res = await fetch("/api/backup/scheduled", { cache: "no-store" });
      if (!res.ok) return empty;
      const json = await res.json();
      if (json?.ok) {
        return {
          files: (json.files ?? []) as typeof empty.files,
          storageFiles: (json.storageFiles ?? []) as typeof empty.storageFiles,
        };
      }
      return empty;
    } catch {
      /* ignore — sirf list, backup button phir bhi kaam karega */
      return empty;
    }
  }, []);

  // Server backups folder ki recent files — mount par ek baar load
  const { data: serverData, refetch: refetchServerFiles } = useQuery({
    queryKey: ["backup-server-files"],
    queryFn: loadServerFiles,
    staleTime: 30_000,
  });
  const serverFiles = useMemo(() => serverData?.files ?? [], [serverData]);
  const serverCloudFiles = useMemo(() => serverData?.storageFiles ?? [], [serverData]);

  const handleServerBackup = async () => {
    if (serverBusy) return;
    setServerBusy(true);
    setServerResult(null);
    try {
      const res = await fetch("/api/backup/scheduled", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Server backup fail hua.");
      setServerResult({
        fileName: json.fileName,
        rows: json.rows ?? 0,
        tables: json.tables ?? 0,
        incomplete: !!json.incomplete,
        storage: json.storage as { uploaded: boolean; error?: string } | undefined,
      });
      showToast(
        json.incomplete ? "error" : "success",
        json.incomplete
          ? `⚠ Server backup INCOMPLETE — ${json.mismatch?.length ?? 0} table(s) count mismatch`
          : `✅ Server backup done! ${(json.rows ?? 0).toLocaleString()} rows / ${json.tables} tables`
      );
      await refetchServerFiles();
    } catch (err) {
      setServerResult({
        fileName: "",
        rows: 0,
        tables: 0,
        incomplete: false,
        error: err instanceof Error ? err.message : "Fail",
      });
      showToast("error", err instanceof Error ? err.message : "Server backup fail!");
    } finally {
      setServerBusy(false);
    }
  };

  // ── Backup file delete (local backups/ folder ya Storage 'backups' bucket) ──
  const handleDeleteBackup = async (name: string, target: "local" | "cloud") => {
    const where = target === "cloud" ? "Supabase Storage bucket" : "server ke backups/ folder";
    if (!window.confirm(`Delete "${name}" — ${where} se?\n\nYe wapas nahi aayegi.`)) return;
    setDeleting(`${target}:${name}`);
    try {
      const res = await fetch(
        `/api/backup/scheduled?target=${target}&name=${encodeURIComponent(name)}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Delete fail hua.");
      showToast("success", `Deleted — ${name}`);
      await refetchServerFiles();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Delete fail!");
    } finally {
      setDeleting(null);
    }
  };

  // ── Backup file download (local backups/ folder ya Storage 'backups' bucket) ──
  const handleDownloadBackup = async (name: string, target: "local" | "cloud") => {
    setDownloading(`${target}:${name}`);
    try {
      const res = await fetch(
        `/api/backup/download?target=${target}&name=${encodeURIComponent(name)}`
      );
      if (!res.ok) {
        let msg = "Download fail hua.";
        try {
          const json = await res.json();
          msg = json?.error || msg;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(msg);
      }
      await downloadBlob(await res.blob(), name);
      showToast("success", `Download — ${name}`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Download fail!");
    } finally {
      setDownloading(null);
    }
  };

  // ── Tables that CANNOT be deleted (FK from other non-backup tables) ──────────
  // mechanic_list: "profiles" table ka FK constraint hai — delete nahi ho sakta
  // In tables mein sirf upsert karengen (existing rows update, naye add honge)
  const NO_DELETE_TABLES = ["mechanic_list"];

  // ── Restore-free tables ───────────────────────────────────────────────────
  // system_info = license key + business info/settings. MariaDB-dump conversion
  // se bane backup JSON me ye rows missing hoti hain (unme thi hi nahi), isliye
  // restore ke waqt inhe kabhi clear ya overwrite nahi karte — live values hi
  // waisi rahengi. warna license row delete ho jati aur app phir license mangta.
  const RESTORE_FREE_TABLES = ["system_info"];

  // ── Image columns — sirf valid Supabase Storage URL hi restore hogi ────────
  // MariaDB conversion ke backup me image paths purane/dead hote hain (jaise
  // "uploads/...") jo is Supabase environment me kaam nahi karte. Restore se
  // pehle live image URLs ka snapshot lete hain aur invalid path ko live value
  // se preserve karte hain — warna client/mechanic/product/job ke photos toot
  // jate. Is app ke legit backup me URLs valid (storage/v1/object/public) hote
  // hain → unka hamesha normal restore hota hai.
  const IMAGE_COLUMNS = ["image_path", "avatar", "avatar_url"];
  const STORAGE_URL_MARKER = "/storage/v1/object/public/";

  // ── Small delay helper (Supabase rate limit se bachne ke liye) ───────────────
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ── RESTORE ────────────────────────────────────────────────────────────────
  const handleRestore = async (file: File, dryRun = false, preloadedBackup?: BackupData) => {
    if (!file.name.endsWith(".json") && !preloadedBackup) {
      showToast("error", "Sirf .json backup file select karo!");
      return;
    }

    if (!schemaTables) {
      showToast("error", schemaError || "Live schema load nahi hua — wait karke try karo.");
      return;
    }

    if (dryRun) {
      setProgress("Dry run mode - validating backup file...");
    } else {
      const confirmed = window.confirm(
        "⚠️ WARNING: Restore se sabhi EXISTING data REPLACE ho jayega!\n\n" +
          "Ye action UNDO nahi ho sakta!\n\n" +
          "Pehle ek naya backup zaroor lein.\n\n" +
          "File: " +
          (preview?.fileName || file.name)
      );
      if (!confirmed) return;
    }

    setRestoring(true);
    setVerifyFails([]);
    setProgress(dryRun ? "Dry run: validating..." : "Backup file parse ho rahi hai...");
    try {
      let backup: BackupData;
      if (preloadedBackup) {
        backup = preloadedBackup;
      } else {
        const text = await file.text();
        backup = JSON.parse(text) as BackupData;
      }

      const meta = backup._meta?.[0] as Record<string, unknown>;
      const versionInfo = parseBackupVersion(meta);
      if (!versionInfo) {
        showToast("error", "Invalid backup file! V-Tech backup file use karo.");
        setRestoring(false);
        return;
      }
      if (versionInfo.warning) showToast("info", versionInfo.warning);

      // Tables ko order ke hisab se group karo (live schema se)
      const orderedTables = [...liveOrdered].sort((a, b) => a.order - b.order);

      let totalRestored = 0;
      const tableResults: TableResult[] = [];

      // ── Step 0: Validate all backup data before restoring ─────────────────
      setProgress("Validating backup data...");
      for (const { table } of orderedTables) {
        const rows = backup[table];
        // Naye/old file me tables missing ho sakti hai → empty treat karo
        if (rows !== undefined && !Array.isArray(rows)) {
          throw new Error(`Invalid data for table: ${table}`);
        }
      }

      if (dryRun) {
        // ── Enhanced dry run: file structure + PK/uniqueness + NOT NULL cover ──
        // Sirf file + live schema check hota hai — koi DB write nahi (D5/D6).
        const issues: string[] = [];
        let rowsChecked = 0;
        for (const { table } of orderedTables) {
          const rows = backup[table] as Record<string, unknown>[] | undefined;
          if (!rows || rows.length === 0) continue;
          rowsChecked += rows.length;

          const liveCols = colsOf(table);
          const pk = pkOf(table);
          const gens = new Set(genOf(table));

          // 1) PK value present + unique — missing/dup PK = upsert merge ya fail
          if (pk.length > 0) {
            const badPk = countPkViolations(rows, pk);
            if (badPk > 0) {
              issues.push(`${table}: ${badPk} rows me PK (${pk.join(",")}) missing/duplicate`);
            }
          }

          // 2) File me aise columns jo live schema me nahi → FAIL (explicit override
          //    ke bina silent strip nahi). Decision #2: fail + explicit override.
          if (liveCols) {
            const liveSet = new Set(liveCols);
            const unknown = new Set<string>();
            for (const row of rows) {
              for (const k of Object.keys(row)) {
                if (!liveSet.has(k)) unknown.add(k);
              }
            }
            if (unknown.size > 0) {
              const cols = Array.from(unknown).join(", ");
              if (allowRemovedColumns) {
                console.warn(`${table}: removed columns override — strip: ${cols}`);
              } else {
                issues.push(
                  `${table}: ${cols} column(s) live schema me nahi — restore FAIL (safe rehne ke liye "Removed columns drop karein" override enable karein)`
                );
              }
            }
          }

          // 3) NOT NULL columns jinki file me value missing hai → wo rows insert fail
          const notNull = (schemaOf(table)?.notNull ?? []).filter(
            (c) => !gens.has(c) // generated cols file me expected nahi
          );
          const notNullSet = new Set(notNull);
          if (notNullSet.size > 0) {
            let missingCells = 0;
            let affectedRows = 0;
            for (const row of rows) {
              let rowMissing = 0;
              for (const c of notNullSet) {
                const v = row?.[c];
                if (v === null || v === undefined) rowMissing++;
              }
              if (rowMissing > 0) {
                missingCells += rowMissing;
                affectedRows++;
              }
            }
            if (affectedRows > 0) {
              issues.push(
                `${table}: ${affectedRows} rows me ${missingCells} NOT NULL value missing (${Array.from(notNullSet).join(",")}) — ye rows insert fail hongi`
              );
            }
          }
        }

        if (issues.length > 0) {
          setProgress("");
          console.warn("Dry run issues:", issues);
          showToast(
            "error",
            `❌ Dry run FAILED — ${issues.length} issue(s): ${issues.slice(0, 3).join("; ")}${
              issues.length > 3 ? ` (+${issues.length - 3} aur)` : ""
            }`
          );
          setRestoring(false);
          return;
        }

        const totalRows = orderedTables.reduce(
          (s, { table }) => s + (backup[table]?.length || 0),
          0
        );
        console.debug(
          `Dry run ok: ${rowsChecked} rows checked across ${orderedTables.length} tables`
        );
        showToast(
          "success",
          `✅ Dry run PASSED! ${totalRows.toLocaleString()} rows in ${orderedTables.length} tables ready to restore.`
        );
        setRestoring(false);
        return;
      }

      // ── Step 0′: Real restore bhi removed-column policy enforce karta hai ──
      // (Dry run skip karke "Restore Now" dabane par bhi koi data delete na ho.)
      if (!allowRemovedColumns) {
        const removedIssues: string[] = [];
        for (const { table } of orderedTables) {
          const rows = backup[table] as Record<string, unknown>[] | undefined;
          const liveCols = colsOf(table);
          if (!rows?.length || !liveCols) continue;
          const liveSet = new Set(liveCols);
          const unknown = new Set<string>();
          for (const row of rows) {
            for (const k of Object.keys(row)) if (!liveSet.has(k)) unknown.add(k);
          }
          if (unknown.size > 0) {
            removedIssues.push(`${table}: ${Array.from(unknown).join(", ")}`);
          }
        }
        if (removedIssues.length > 0) {
          throw new Error(
            `Restore blocked — live schema me naye/hataye gaye columns: ${removedIssues.join(
              " | "
            )}. Jaane-bujhkar drop karne ke liye "Removed columns drop karein" override enable karein.`
          );
        }
      }

      // Clear preview after successful restore start
      setPreview(null);

      // ── Step 0a: Live image URLs ka snapshot (photos protect karne ke liye) ──
      // Restore ke waqt invalid/dead image paths (MariaDB conversion wale) ko
      // in live values se replace karengi, taaki images/photos/avatars nahi toote.
      setProgress("Live image URLs snapshot ho rahi hain...");
      const liveImages: Record<string, Map<string, Record<string, unknown>>> = {};
      for (const { table } of orderedTables) {
        const imgCols = (colsOf(table) ?? TABLE_COLUMNS[table] ?? []).filter((c) =>
          IMAGE_COLUMNS.includes(c)
        );
        if (imgCols.length === 0) continue;
        const m = new Map<string, Record<string, unknown>>();
        try {
          const PAGE = 1000;
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
              .from(table)
              .select(`id, ${imgCols.join(", ")}`)
              .range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            (data as unknown as Record<string, unknown>[]).forEach((row) => {
              if (row.id != null) m.set(String(row.id), row);
            });
            if (data.length < PAGE) break;
          }
        } catch {
          /* snapshot fail → ignore, images protection skip hoga */
        }
        liveImages[table] = m;
      }

      // ── Step 0b: Clear existing data in REVERSE ORDER (avoiding FK violations) ──
      // Schema badlaav ke baad purane backup me naye tables nahi hote. Agar hum
      // live schema ke SAARE tables clear kar dein aur phir backup me na hone ki
      // wajah se skip kar dein, to naye tables ki data delete ho jati hai.
      // Isliye sirf wahi tables clear karo jo backup file me maujood hain
      // (empty array = explicit clear; missing key = preserve).
      setProgress("Clearing existing data (reverse order)...");
      const tablesInBackup = orderedTables.filter(({ table }) =>
        Object.prototype.hasOwnProperty.call(backup, table)
      );
      const reverseOrderedTables = [...tablesInBackup].reverse();
      for (const { table } of reverseOrderedTables) {
        if (!NO_DELETE_TABLES.includes(table) && !RESTORE_FREE_TABLES.includes(table)) {
          setProgress(`Clearing table: ${table}...`);
          let delErr = null;
          const pk = pkOf(table);
          // Live schema PK se delete-all (uuid/text PK pe bhi chalta hai):
          // PK kabhi null nahi hota → "pk IS NOT NULL" sab rows match karta hai.
          if (pk.length > 0) {
            const col = pk[0];
            const { error } = await supabase.from(table).delete().not(col, "is", null);
            delErr = error;
          } else {
            console.warn(`${table} no PK — clear skip`);
          }
          if (delErr) {
            console.warn(`${table} clear warning:`, delErr.message);
          }
        }
      }

      for (const { table } of orderedTables) {
        if (RESTORE_FREE_TABLES.includes(table)) {
          setProgress(`${table}: protected — restore-free, skip`);
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }

        const rawRows = backup[table];
        if (!rawRows || rawRows.length === 0) {
          setProgress(`${table}: koi data nahi — skip`);
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }

        // ── Strip GENERATED columns (DB auto-calculates these) ────────────────
        const genCols = genOf(table);
        // ── Live schema PK (upsert onConflict + dedupe ke liye) ───────────────
        const pk = pkOf(table);
        // ── Image columns jo is table mein hain (protection ke liye) ───────────
        const imgCols = (colsOf(table) ?? TABLE_COLUMNS[table] ?? []).filter((c) =>
          IMAGE_COLUMNS.includes(c)
        );
        // ── Skip rows with invalid FK references ──────────────────────────────
        const fkRule = SKIP_INVALID_FK[table];
        const rows = (rawRows as Record<string, unknown>[])
          .filter((row) => {
            if (!fkRule) return true;
            const val = row[fkRule.field];
            return !fkRule.invalidValues.includes(val as number | string);
          })
          .map((row) => {
            const r: Record<string, unknown> = { ...row };
            // Filter properties to keep only columns that exist in the database table schema
            // (live schema se — naye columns bhi cover hote hain, koi strip nahi hota)
            const allowedCols = colsOf(table) ?? TABLE_COLUMNS[table];
            if (allowedCols) {
              Object.keys(r).forEach((key) => {
                if (!allowedCols.includes(key)) {
                  delete r[key];
                }
              });
            }
            // Strip generated columns
            genCols.forEach((col) => delete r[col]);
            // Fix negative prices — CHECK (price >= 0)
            for (const pf of ["price", "cost_price", "amount", "discount"]) {
              if (pf in r && typeof r[pf] === "number" && (r[pf] as number) < 0) r[pf] = 0;
            }
            // Fix int/null in text columns — nullable column ka NULL NULL hi
            // rehta hai (locations.code / brands.code par '' duplicate fail tha)
            Object.assign(r, normalizeTextFieldsForRestore(r, schemaOf(table)?.notNull ?? []));
            // Fix boolean NOT NULL columns (converter 0/1 se aa sakta hai)
            for (const bf of ["login_allowed"]) {
              if (bf in r) r[bf] = !!r[bf];
            }
            // Fix MySQL zero-dates → null (PostgreSQL "0000-00-00" support nahi karta)
            for (const key of Object.keys(r)) {
              if (typeof r[key] === "string" && (r[key] as string).startsWith("0000-00-00")) {
                r[key] = null;
              }
            }
            // ── Image protection: live working image hamesha preserve ─────────
            // Restore kabhi bhi kisi working image/photo/avatar ko nahi todoega:
            // live snapshot me valid storage URL hai to wahi rakhte hain (chahe
            // backup me dead path, empty ya null kuchh bhi ho). Backup me dead
            // MariaDB path ho aur live bhi na ho → column hatao (default).
            for (const imgCol of imgCols) {
              const liveVal = liveImages[table]?.get(String(r.id))?.[imgCol];
              if (typeof liveVal === "string" && liveVal.includes(STORAGE_URL_MARKER)) {
                r[imgCol] = liveVal;
                continue;
              }
              const v = r[imgCol];
              if (typeof v === "string" && v.trim() !== "" && !v.includes(STORAGE_URL_MARKER)) {
                // DON'T delete the property, otherwise it triggers NOT NULL constraint errors
                // We keep the dead path so that the 'Repair Images' button can fix it later.
                r[imgCol] = v;
              }
            }
            return r;
          });

        const tableStart = totalRestored;
        const tableErrors = new Set<string>();
        setProgress(`Restoring: ${table} (${rows.length} rows)...`);

        // Step 2: Insert in batches of 25 (rate limit se bachne ke liye smaller batches)
        const batchSize = 25;
        // Live PK columns ka onConflict — nikala hua composite PK (jaise
        // spare_supplier) bhi sahi se upsert (update/insert) ho sake
        const onConflict = pk.length ? { onConflict: pk.join(",") } : undefined;
        for (let i = 0; i < rows.length; i += batchSize) {
          let batch = rows.slice(i, i + batchSize);
          // Dedup within batch (single + composite PK) — "cannot affect row a
          // second time" error se bachao
          const deduped = dedupeRowsByPk(batch, pk);
          if (deduped.skipped > 0) {
            console.warn(`${table} batch ${i}: ${deduped.skipped} duplicates skipped`);
          }
          batch = deduped.rows;
          if (batch.length === 0) continue;
          setProgress(`Restoring: ${table} (${i + batch.length}/${rows.length})...`);

          const { error: insErr } = await supabase
            .from(table)
            .upsert(batch as Record<string, unknown>[], onConflict);

          if (insErr) {
            tableErrors.add(insErr.message);
            console.warn(`${table} batch ${i}-${i + batchSize} error:`, insErr.message);
            // Row-by-row fallback with delay (rate limit se bachne ke liye)
            for (const row of batch) {
              await sleep(120); // 120ms delay between each row
              try {
                const { error: rowErr } = await supabase
                  .from(table)
                  .upsert(row as Record<string, unknown>, onConflict);
                if (!rowErr) {
                  totalRestored++;
                } else {
                  // Row data (email/phone/URL) console me mat print karo — sirf error.
                  tableErrors.add(rowErr.message);
                  console.warn(`${table} row skip:`, rowErr.message);
                }
              } catch (networkErr) {
                const msg = networkErr instanceof Error ? networkErr.message : "network error";
                tableErrors.add(msg);
                console.warn(`${table} row network error:`, msg);
                await sleep(500); // Extra delay on network error
              }
            }
          } else {
            totalRestored += batch.length;
          }
          // Batch ke baad thoda wait (large tables ke liye)
          if (rows.length > 200) await sleep(50);
        }

        // Per-table result track karo
        tableResults.push({
          table,
          fileRows: rows.length,
          restored: totalRestored - tableStart,
          failed: rows.length - (totalRestored - tableStart),
          errors: Array.from(tableErrors),
        });
      }

      // ── Step 2b: Post-restore count verify (silent data loss pakdo) ────────
      // Har table ka exact count file rows se compare — mismatch = restore
      // PARTIAL (upsert errors report me agar skip ho gaye to ye pakdega).
      setProgress("Post-restore verify (count compare) ho rahi hai...");
      const verifiedFails: { table: string; fileRows: number; dbRows: number }[] = [];
      for (const { table } of orderedTables) {
        // Restore-free tables live values preserve karte hain — count match nahi
        // hoga, isliye verify se bahar
        if (RESTORE_FREE_TABLES.includes(table)) continue;
        // File ki raw length nahi — actual attempted rows (FK/dedup ke baad)
        // se compare karo, warna intentionally skipped rows par fake fail aata tha.
        const fileRows =
          tableResults.find((r) => r.table === table)?.fileRows ??
          (Array.isArray(backup[table]) ? backup[table].length : 0);
        if (fileRows === 0) continue;
        const { count, error: countErr } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (countErr) {
          console.warn(`${table} count verify skipped:`, countErr.message);
          continue;
        }
        const dbRows = count ?? 0;
        if (dbRows !== fileRows) {
          verifiedFails.push({ table, fileRows, dbRows });
          console.warn(`${table} post-restore verify FAILED: file=${fileRows}, db=${dbRows}`);
        }
      }
      // Purana code yahan ek fake "table (count verify)" row daalta tha jiska
      // `restored: 0` hota tha — isse 2334 rows successfully restore hone ke
      // baad bhi report me +2334 "failed" aur 15 duplicate rows dikhte the.
      // Ab verify alag section me, totals se bahar dikhte hain.
      setVerifyFails(verifiedFails);

      // Step 3: Reset sequences (important for auto-increment IDs)
      setProgress("Sequences reset ho rahi hain (naye IDs ke liye)...");
      const seqResults = await resetSequences();
      logger.debug("Sequence reset results:", seqResults);

      setProgress("");
      setRestoreReport(tableResults);
      clearLoaded(); // Diff panel clear karo restore ke baad
      const failedCount = tableResults.reduce((s, r) => s + r.failed, 0);
      // Count mismatch ko "100% restored + count verified" mat bolo — warna
      // restore visually success dikhata hai jabki data file se mismatch hai.
      if (failedCount > 0 || verifiedFails.length > 0) {
        showToast(
          "error",
          `⚠ ${totalRestored.toLocaleString()} restored, ${failedCount} failed${
            verifiedFails.length ? ` (+${verifiedFails.length} tables count mismatch)` : ""
          } — report dekhein`
        );
      } else {
        showToast(
          "success",
          `✅ ${totalRestored.toLocaleString()} rows 100% restored + count verified!`
        );
      }
      refetchTableStats();
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Restore failed!");
    } finally {
      setRestoring(false);
    }
  };

  // ── Reset PostgreSQL sequences via admin-only route ────────────────────────
  // D1 (K10): anon key se `reset_sequence` RPC ab deny hai (service_role only).
  // Browser yahan server-side admin route ko call karta hai jo service role se
  // RPC chalata hai + allowlist validate karta hai (src/lib/resetSequence.ts).
  const resetSequences = async () => {
    const sequenceTables = RESET_SEQUENCE_TABLES;

    const results: string[] = [];
    for (const table of sequenceTables) {
      try {
        // Method 1: admin-only route → service-role `reset_sequence` RPC
        const res = await fetch("/api/admin/reset-sequence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table_name: table }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          status?: string;
          result?: unknown;
        };
        if (res.ok && payload.status === "success") {
          logger.debug(`Sequence reset: ${payload.result}`);
          results.push(`✓ ${table}`);
        } else {
          // Method 2: Fallback — max ID fetch karke log karo
          const { data: row } = await supabase
            .from(table)
            .select("id")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (row && typeof row.id === "number") {
            logger.debug(`${table}: max id = ${row.id}, sequence will resume from ${row.id + 1}`);
            results.push(`⚠ ${table} (manual reset needed)`);
          }
        }
      } catch {
        // Table might not have id column — skip silently
      }
    }
    return results;
  };

  // ── File load + diff compute (no restore yet) ───────────────────────────
  const loadFileAndDiff = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      showToast("error", "Sirf .json backup file select karo!");
      return;
    }
    setDiffLoading(true);
    setDiffData(null);
    setLoadedBackup(null);
    setPreview(null);
    setAllowRemovedColumns(false);

    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;
      const meta = backup._meta?.[0] as Record<string, unknown>;

      const versionInfo = parseBackupVersion(meta);
      if (!versionInfo) {
        showToast("error", "Invalid backup file! V-Tech backup file use karo.");
        setDiffLoading(false);
        return;
      }
      if (versionInfo.warning) showToast("info", versionInfo.warning);

      // v3.0+ files me file ki apni table list hoti hai (live schema se) —
      // diff/preview usi se banao, static list se nahi
      const fileTables: string[] = Array.isArray(meta.tables)
        ? (meta.tables as string[])
        : BACKUP_TABLES;

      // Build preview info
      const tables: { name: string; rows: number }[] = [];
      let totalRows = 0;
      for (const t of fileTables) {
        const rows = backup[t];
        if (Array.isArray(rows)) {
          tables.push({ name: t, rows: rows.length });
          totalRows += rows.length;
        }
      }
      setPreview({
        fileName: file.name,
        tables,
        totalRows,
        totalTables: tables.length,
        version: versionInfo.version,
        createdAt: String(meta.created_at || "unknown"),
        warning: versionInfo.warning,
      });

      // Compute diff: file rows vs current DB rows
      const diff: DiffRow[] = [];
      for (const t of fileTables) {
        const fileRows = Array.isArray(backup[t]) ? backup[t].length : 0;
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        const dbRows = count || 0;
        diff.push({ table: t, fileRows, dbRows, diff: fileRows - dbRows });
      }

      setLoadedBackup(backup);
      setDiffData(diff);
    } catch {
      showToast("error", "File read karne mein error — valid JSON hai?");
    } finally {
      setDiffLoading(false);
    }
  };

  // ── ADMIN AUTH RESTORE (service-role, server-side) ────────────────────────
  // Browser restore in 8 auth-linked tables ko RLS/FK ki wajah se nahi likh
  // sakta. Ye route sirf admin/developer session se chalao; default dry-run.
  const callAuthRestore = async (confirm: boolean, createMissing: boolean) => {
    if (!loadedBackup) {
      showToast("error", "Pehle backup file load karo.");
      return;
    }
    const payload: Record<string, unknown[]> = {};
    for (const table of AUTH_LINKED_TABLES) {
      const rows = loadedBackup[table];
      if (!Array.isArray(rows)) continue;
      const cols = colsOf(table);
      payload[table] = cols
        ? rows.map((row) => {
            const r = row as Record<string, unknown>;
            const out: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(r)) {
              if (cols.includes(key)) out[key] = value;
            }
            return out;
          })
        : rows;
    }
    if (Object.keys(payload).length === 0) {
      showToast("error", "Is file me koi auth-linked table nahi hai.");
      return;
    }

    setAuthBusy(true);
    try {
      const res = await fetch("/api/backup/auth-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup: payload,
          createMissingUsers: createMissing,
          setTempPasswords: authSetTempPassword,
          confirm,
        }),
      });
      const json = (await res.json()) as AuthRestoreResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || "Admin restore fail hua.");
      setAuthPlan(json.plan ?? null);
      if (confirm) {
        setAuthResults(json.results ?? []);
        setAuthTempPasswords(json.credentials ?? []);
        setAuthConfirmed(false);
        const restored = (json.results ?? []).reduce((s, r) => s + r.restored, 0);
        const failed = (json.results ?? []).reduce((s, r) => s + r.failed, 0);
        showToast(
          failed ? "error" : "success",
          `Admin restore: ${restored} restored, ${failed} failed${
            json.adminPreserved ? " · admin profile safe" : ""
          }`
        );
        refetchTableStats();
      } else {
        setAuthResults(null);
        showToast(
          "info",
          `Plan ready: ${json.plan?.totalRows ?? 0} rows · ${json.plan?.missing.length ?? 0} user match nahi hue`
        );
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Admin restore fail hua!");
    } finally {
      setAuthBusy(false);
    }
  };

  const clearLoaded = () => {
    setLoadedBackup(null);
    setAuthPlan(null);
    setAuthResults(null);
    setAuthTempPasswords([]);
    setAuthConfirmed(false);
    setDiffData(null);
    setPreview(null);
    setAllowRemovedColumns(false);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFileAndDiff(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFileAndDiff(file);
  };

  const getRowCount = (table: string) => {
    return tableStats.find((s) => s.table === table)?.count || 0;
  };

  const busy = taking || restoring || serverBusy;

  // Group tables by order for display (live schema se nayi tables bhi aati hain)
  const groupedTables = useMemo(
    () =>
      liveOrdered.reduce(
        (acc, { table, order }) => {
          if (!acc[order]) acc[order] = [];
          acc[order].push(table);
          return acc;
        },
        {} as Record<number, string[]>
      ),
    [liveOrdered]
  );

  return (
    <div className="min-h-screen bg-app font-sans pb-12">
      {/* ── Restore Report ─────────────────────────────────────────── */}
      {restoreReport.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-50">
          <div className="bg-panel border border-app rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-app">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted">
                📊 Restore Report
              </span>
              <div className="flex gap-3 text-xs">
                <span className="text-green-400 font-bold">
                  ✓ {restoreReport.reduce((s, r) => s + r.restored, 0)} restored
                </span>
                {restoreReport.some((r) => r.failed > 0) && (
                  <span className="text-red-400 font-bold">
                    ✗ {restoreReport.reduce((s, r) => s + r.failed, 0)} failed
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto flex flex-col gap-1">
              {restoreReport.map((r) => {
                const firstError = r.errors?.[0];
                const hint = firstError ? restoreErrorHint(classifyRestoreError(firstError)) : "";
                return (
                  <div
                    key={r.table}
                    className="px-3 py-1.5 bg-app rounded-lg text-xs flex flex-col"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-muted">{r.table}</span>
                      <span className="flex gap-3 items-center">
                        <span className="text-muted">{r.fileRows} in file</span>
                        {r.failed === 0 ? (
                          <span className="text-green-400 font-bold">✓ {r.restored} OK</span>
                        ) : (
                          <span className="text-red-400 font-bold">
                            ✓{r.restored} ✗{r.failed} FAIL
                          </span>
                        )}
                      </span>
                    </div>
                    {r.failed > 0 && firstError && (
                      <div
                        className="mt-1 text-[10px] text-red-300 break-words"
                        title={r.errors?.join("\n")}
                      >
                        {r.errors?.slice(0, 2).join(" · ")}
                        {hint ? ` — ${hint}` : ""}
                        {(r.errors?.length ?? 0) > 2
                          ? ` (+${(r.errors?.length ?? 0) - 2} aur)`
                          : ""}
                      </div>
                    )}
                  </div>
                );
              })}
              {verifyFails.length > 0 && (
                <div className="mt-2 pt-2 border-t border-app text-[10px] text-amber-300 break-words">
                  Count mismatch (verify only):{" "}
                  {verifyFails.map((f) => `${f.table} ${f.dbRows}/${f.fileRows}`).join(" · ")}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-app flex justify-end">
              <button
                onClick={() => setRestoreReport([])}
                className="text-[11px] text-muted hover:text-white transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center">
                <Database size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Database Backup & Restore</h1>
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  {tableNames.length} tables · Auto-restore order · Sequence safe
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/backup/guide"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 text-sky-400 rounded-lg text-xs font-bold transition"
              >
                <BookOpen size={12} /> Guide
              </Link>
              <button
                onClick={handleRepairImages}
                disabled={repairing || busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                <Images size={12} className={repairing ? "animate-pulse" : ""} /> Repair Images
              </button>
              <button
                onClick={() => refetchTableStats()}
                disabled={loadingStats}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-panel-2 border border-app-2 hover:bg-panel-2 text-muted rounded-lg text-xs font-bold transition"
              >
                <RefreshCw size={12} className={loadingStats ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* MariaDB Sync card */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <RefreshCw size={15} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">Supabase → MariaDB Sync</p>
            <p className="text-[11px] text-muted mt-0.5">
              Saara data MariaDB (<span className="font-mono">vtech_db</span>) me copy karta hai —
              har 15 min pe auto bhi hota hai.
            </p>
          </div>
          <Link
            href="/sync"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-app rounded-lg text-xs font-black transition"
          >
            <RefreshCw size={12} /> Sync Tool
          </Link>
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0" />
            <p className="text-blue-400 text-sm font-medium">{progress}</p>
          </div>
        )}

        {/* Table Stats */}
        {tableStats.length > 0 && (
          <div className="bg-panel border border-app rounded-2xl px-5 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Table2 size={14} className="text-muted" />
              <span className="text-[10px] font-black uppercase text-muted tracking-wider">
                Current Table Status
              </span>
              <span className="ml-auto text-[10px] text-emerald-400 font-bold">
                {tableStats.reduce((s, t) => s + t.count, 0).toLocaleString()} total rows
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
              {tableStats.map(({ table, count }) => (
                <div
                  key={table}
                  className="flex items-center justify-between px-2 py-1 bg-app rounded-lg border border-app"
                >
                  <span className="text-[9px] text-muted font-mono truncate">{table}</span>
                  <span
                    className={`text-[10px] font-bold ml-1 ${count > 0 ? "text-emerald-400" : "text-muted-2"}`}
                  >
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BACKUP card */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-emerald-600/20 to-transparent border-b border-app">
            <Download size={14} className="text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">Backup Lena</h3>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-muted text-sm leading-relaxed">
              Supabase ke sabhi tables ka data ek{" "}
              <span className="text-emerald-400 font-bold">.json</span> file mein download hoga. Yeh
              file aapke computer mein safe rahengi.
            </p>

            {/* Tables by restore order */}
            <div className="space-y-2">
              {Object.entries(groupedTables).map(([order, tables]) => (
                <div key={order}>
                  <p className="text-[9px] font-black uppercase text-muted-2 tracking-wider mb-1">
                    Step {order}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tables.map((t) => (
                      <div
                        key={t}
                        className="flex items-center gap-1.5 px-2 py-1 bg-app rounded-lg border border-app"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-[10px] text-muted font-mono">{t}</span>
                        <span className="text-[9px] text-muted-2">({getRowCount(t)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleBackup}
              disabled={busy}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
            >
              {taking ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Backup ho raha hai...
                </>
              ) : (
                <>
                  <Download size={16} /> Download Full Backup (.json)
                </>
              )}
            </button>
          </div>
        </div>

        {/* SERVER BACKUP (scheduled) card */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-sky-600/20 to-transparent border-b border-app">
            <Server size={14} className="text-sky-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">
              Server Backup (Scheduled)
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-muted text-sm leading-relaxed">
              Download wale backup ki tarah hi, par file{" "}
              <span className="text-sky-400 font-bold">server ke backups/ folder</span> me banti
              hai. Isi ko daily schedule kar ke (Task Scheduler / cron){" "}
              <span className="text-app-2 font-bold">free-tier automatic backup</span> banta hai —
              browser/kholne ki zaroorat nahi.
            </p>

            <button
              onClick={handleServerBackup}
              disabled={busy}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-900/30"
            >
              {serverBusy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Server backup ho raha hai...
                </>
              ) : (
                <>
                  <Server size={16} /> Abhi Server Backup Run Karo
                </>
              )}
            </button>

            {serverResult && (
              <div
                className={`text-xs rounded-xl px-4 py-3 border ${
                  serverResult.error
                    ? "bg-red-500/8 border-red-500/20 text-red-400"
                    : serverResult.incomplete
                      ? "bg-red-500/8 border-red-500/20 text-red-400"
                      : "bg-emerald-500/8 border-emerald-500/20 text-emerald-400"
                }`}
              >
                {serverResult.error ? (
                  <>❌ {serverResult.error}</>
                ) : serverResult.incomplete ? (
                  <>⚠ INCOMPLETE — count mismatch. Pehle wali file se mahfuz rahna.</>
                ) : (
                  <>
                    ✅ {serverResult.rows.toLocaleString()} rows / {serverResult.tables} tables —
                    count verified
                  </>
                )}
                {serverResult.fileName && (
                  <span className="block text-muted mt-1 font-mono">{serverResult.fileName}</span>
                )}
                {serverResult.storage && (
                  <span
                    className={`block mt-1 text-[10px] ${
                      serverResult.storage.uploaded ? "text-emerald-400/80" : "text-amber-400/80"
                    }`}
                  >
                    {serverResult.storage.uploaded
                      ? `☁️ Cloud copy upload hui (Storage 'backups' bucket)`
                      : `☁️ Cloud copy FAIL — ${serverResult.storage.error ?? "unknown"}`}
                  </span>
                )}
              </div>
            )}

            {/* Recent files */}
            <div>
              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-2 tracking-wider mb-1.5">
                <Clock size={10} /> Recent backups (server)
              </p>
              {serverFiles.length === 0 ? (
                <p className="text-muted-2 text-xs">Koi server backup nahi — upar se run karo.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {serverFiles.slice(0, 5).map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-app rounded-lg border border-app text-[10px]"
                    >
                      <span className="text-muted font-mono truncate">{f.name}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-2">
                          {new Date(f.modified).toLocaleDateString("en-GB")} ·{" "}
                          {(f.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          onClick={() => handleDownloadBackup(f.name, "local")}
                          disabled={downloading === `local:${f.name}`}
                          title="Local backup download karo"
                          className="text-sky-400 hover:text-sky-300 disabled:opacity-40 transition-colors"
                        >
                          {downloading === `local:${f.name}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(f.name, "local")}
                          disabled={deleting === `local:${f.name}`}
                          title="Local backup delete karo"
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          {deleting === `local:${f.name}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-2 tracking-wider mb-1.5 mt-3">
                <Cloud size={10} /> Recent cloud copies (Storage bucket)
              </p>
              {serverCloudFiles.length === 0 ? (
                <p className="text-muted-2 text-xs">
                  Cloud copy nahi — run karne par &quot;backups&quot; bucket me private upload hoti
                  hai (Vercel par bhi persistent).
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {serverCloudFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-app rounded-lg border border-app text-[10px]"
                    >
                      <span className="text-muted font-mono truncate">{f.name}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-muted-2">
                          {f.modified ? new Date(f.modified).toLocaleDateString("en-GB") : ""}
                        </span>
                        <button
                          onClick={() => handleDownloadBackup(f.name, "cloud")}
                          disabled={downloading === `cloud:${f.name}`}
                          title="Cloud backup download karo"
                          className="text-sky-400 hover:text-sky-300 disabled:opacity-40 transition-colors"
                        >
                          {downloading === `cloud:${f.name}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Download size={12} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(f.name, "cloud")}
                          disabled={deleting === `cloud:${f.name}`}
                          title="Cloud backup delete karo"
                          className="text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          {deleting === `cloud:${f.name}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-2 leading-relaxed">
              💡 Daily schedule: Windows me Task Scheduler se{" "}
              <code className="text-muted">node scripts\supabase-json-backup.mjs --storage</code>{" "}
              chalate raho (local + cloud, exit 2 = incomplete). Download wala local copy weekly
              off-site (Drive) rakho. Upar wali list me file ke aage download icon se file utaaro
              aur trash icon se hatao (local + cloud dono), ya Dashboard → Storage → backups.
            </p>
          </div>
        </div>

        {/* RESTORE card */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-amber-600/20 to-transparent border-b border-app">
            <Upload size={14} className="text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">
              Restore Karna
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Warning */}
            <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
              <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-red-400 text-xs font-bold">
                  DHYAN RAKHEIN - Ye action UNDO NAHI HOGA!
                </p>
                <p className="text-red-400/70 text-xs leading-relaxed">
                  Restore se sab existing data REPLACE ho jaayega. Pehle ek fresh backup zaroor
                  lein.
                </p>
              </div>
            </div>

            {/* Restore order info */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">
                Restore Process (Auto-Ordered)
              </p>
              <ol className="space-y-0.5 text-xs text-muted-2">
                <li>1. Pehle sabhi tables clear honge</li>
                <li>2. Parent tables phle restore honge (FK dependencies)</li>
                <li>3. Child tables baad mein restore honge</li>
                <li>4. Sequences auto-adjust honge</li>
                <li>
                  5. system_info protected hai — clear/overwrite nahi hogi (license + settings safe)
                </li>
              </ol>
            </div>

            {/* ── STEP 1: File Drop Zone (sirf tab dikhao jab diff nahi load) ── */}
            {!diffData && !diffLoading && (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver
                    ? "border-amber-500/60 bg-amber-500/10"
                    : busy
                      ? "border-app opacity-50 cursor-not-allowed"
                      : "border-app hover:border-amber-500/40 hover:bg-amber-500/5"
                }`}
              >
                <input
                  type="file"
                  accept=".json"
                  onChange={onFileInput}
                  disabled={busy}
                  className="hidden"
                />
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
                  <FileJson size={26} className="text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-app-2 font-bold text-sm">Backup file select karo</p>
                  <p className="text-muted text-xs mt-1">
                    Drag & drop · ya click karke select karo · sirf .json
                  </p>
                  <p className="text-amber-400/60 text-[10px] mt-2 font-medium">
                    ✦ File select hote hi DB vs File difference dikhega
                  </p>
                </div>
              </label>
            )}

            {/* ── STEP 1b: Loading diff ── */}
            {diffLoading && (
              <div className="flex flex-col items-center gap-3 py-8 border border-app rounded-xl bg-app">
                <Loader2 size={22} className="animate-spin text-amber-400" />
                <p className="text-muted text-sm font-medium">
                  File parse ho rahi hai aur DB se compare ho raha hai...
                </p>
              </div>
            )}

            {/* ── STEP 2: Diff Table (file loaded, no restore yet) ── */}
            {diffData && loadedBackup && preview && !restoring && (
              <div className="rounded-xl border border-app-2 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600/15 to-transparent border-b border-app-2">
                  <div className="flex items-center gap-2">
                    <Rows3 size={14} className="text-blue-400" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                      File vs Database — Comparison
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] text-muted font-mono truncate max-w-[140px]"
                      title={preview.fileName}
                    >
                      📄 {preview.fileName}
                    </span>
                    <button
                      onClick={clearLoaded}
                      className="text-muted-2 hover:text-red-400 text-xs font-bold transition-colors"
                    >
                      ✕ Clear
                    </button>
                  </div>
                </div>

                {/* Summary bar */}
                <div className="grid grid-cols-4 divide-x divide-[#21293d] bg-app border-b border-app">
                  <div className="px-3 py-2 text-center">
                    <p className="text-sm font-black text-app-2">{preview.totalTables}</p>
                    <p className="text-[9px] text-muted-2 uppercase">Tables</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-sm font-black text-blue-400">
                      {preview.totalRows.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-2 uppercase">File Rows</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    <p className="text-sm font-black text-muted">
                      {diffData.reduce((s, d) => s + d.dbRows, 0).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-2 uppercase">DB Rows</p>
                  </div>
                  <div className="px-3 py-2 text-center">
                    {(() => {
                      const totalDiff = diffData.reduce((s, d) => s + d.diff, 0);
                      return (
                        <>
                          <p
                            className={`text-sm font-black ${totalDiff > 0 ? "text-emerald-400" : totalDiff < 0 ? "text-red-400" : "text-muted"}`}
                          >
                            {totalDiff > 0 ? "+" : ""}
                            {totalDiff.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-muted-2 uppercase">Net Change</p>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {preview.warning && (
                  <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-300">
                    ⚠️ {preview.warning}
                  </div>
                )}

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_80px_80px_70px] gap-0 px-3 py-1.5 bg-app border-b border-app-2">
                  <span className="text-[9px] font-black uppercase text-muted-2">Table</span>
                  <span className="text-[9px] font-black uppercase text-muted-2 text-right">
                    In File
                  </span>
                  <span className="text-[9px] font-black uppercase text-muted-2 text-right">
                    In DB
                  </span>
                  <span className="text-[9px] font-black uppercase text-muted-2 text-right">
                    Diff
                  </span>
                </div>

                {/* Diff rows */}
                <div className="max-h-64 overflow-y-auto divide-y divide-[#1a2133]">
                  {diffData.map(({ table, fileRows, dbRows, diff }) => {
                    const isNew = diff > 0; // file mein zyada = naye rows aayenge
                    const isLess = diff < 0; // file mein kam = rows hatenge
                    const isSame = diff === 0;
                    const rowBg = isNew ? "bg-emerald-500/4" : isLess ? "bg-red-500/4" : "";
                    return (
                      <div
                        key={table}
                        className={`grid grid-cols-[1fr_80px_80px_70px] gap-0 px-3 py-2 items-center ${rowBg} hover:bg-white/2 transition-colors`}
                      >
                        <span className="text-[11px] font-mono text-muted">{table}</span>
                        <span className="text-[11px] font-bold text-right text-blue-400">
                          {fileRows.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-right text-muted">
                          {dbRows.toLocaleString()}
                        </span>
                        <span
                          className={`text-[11px] font-black text-right ${
                            isNew ? "text-emerald-400" : isLess ? "text-red-400" : "text-muted-2"
                          }`}
                        >
                          {isSame ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-4 py-2 bg-app border-t border-app-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/40 inline-block" />
                    File mein zyada rows
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500/40 inline-block" />
                    DB mein zyada rows
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-2">
                    <span className="inline-block">—</span> Koi fark nahi
                  </span>
                </div>

                {/* Removed-column policy (decision #2): default FAIL, opt-in strip */}
                <label className="flex items-start gap-2 px-4 py-2.5 bg-amber-500/5 border-t border-app-2 text-[11px] text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRemovedColumns}
                    onChange={(e) => setAllowRemovedColumns(e.target.checked)}
                    disabled={restoring}
                    className="accent-amber-500 mt-0.5"
                  />
                  <span>
                    <b className="text-amber-300">Removed columns drop karein (override)</b>
                    <br />
                    File me maujood par live schema se hataaye gaye columns default me dry-run FAIL
                    karte hain. Sirf jaane-bujhkar enable karein — enabled par ye columns strip ho
                    jayenge (data loss ho sakta hai).
                  </span>
                </label>

                {/* Action Buttons */}
                <div className="flex gap-2 px-4 py-3 bg-app border-t border-app-2">
                  <button
                    onClick={() =>
                      handleRestore(new File([], preview.fileName), true, loadedBackup)
                    }
                    disabled={restoring}
                    className="flex-1 py-2.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-blue-500/30"
                  >
                    <FileJson size={13} /> Dry Run (Validate Only)
                  </button>
                  <button
                    onClick={() =>
                      handleRestore(new File([], preview.fileName), false, loadedBackup)
                    }
                    disabled={restoring}
                    className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30"
                  >
                    <Upload size={13} /> Restore Now
                  </button>
                </div>
              </div>
            )}

            {/* ── ADMIN AUTH RESTORE (auth/RLS ke 218 failures) ──────────── */}
            {loadedBackup &&
              AUTH_LINKED_TABLES.some(
                (t) => Array.isArray(loadedBackup[t]) && (loadedBackup[t] as unknown[]).length > 0
              ) && (
                <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={15} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-violet-300">
                        Admin Restore — auth-linked tables (service-role)
                      </p>
                      <p className="text-[11px] text-muted leading-relaxed mt-1">
                        Purane project ke user UUID naye project se match nahi karte isliye ye 8
                        tables browser restore mein fail hoti hain. Server purane UUID ko{" "}
                        <b>email</b> se naye auth users se map karta hai. Current admin ka profile
                        hamesha preserve hota hai. Service-role key browser mein kabhi nahi aati.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void callAuthRestore(false, authCreateUsers)}
                      disabled={authBusy}
                      className="px-3 py-2 bg-violet-600/80 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                    >
                      {authBusy ? " Chal raha hai..." : "🔍 Plan / Dry Run (no writes)"}
                    </button>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authCreateUsers}
                        onChange={(e) => {
                          const value = e.target.checked;
                          setAuthCreateUsers(value);
                          void callAuthRestore(false, value);
                        }}
                        disabled={authBusy}
                        className="accent-violet-500"
                      />
                      Missing auth users bhi banayein (email se)
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authSetTempPassword}
                        onChange={(e) => setAuthSetTempPassword(e.target.checked)}
                        disabled={authBusy || !authCreateUsers}
                        className="accent-violet-500"
                      />
                      Custom/fake email hai — naye users ko temporary password auto-set karo
                    </label>
                  </div>

                  {authPlan && (
                    <div className="rounded-lg bg-app border border-app px-3 py-2 text-[11px] text-muted space-y-1">
                      <p>
                        <b className="text-white">{authPlan.totalRows}</b> rows ·{" "}
                        <b className="text-white">{Object.keys(authPlan.remap).length}</b> UUID map
                        · <b className="text-amber-300">{authPlan.missing.length}</b> user match
                        nahi
                        {authPlan.protectedAdmin ? " · admin profile protected" : ""}
                      </p>
                      <p className="font-mono text-[10px] break-words">
                        {authPlan.perTable.map((t) => `${t.table}:${t.rows}`).join(" · ")}
                      </p>
                      {authPlan.missing.length > 0 && (
                        <p className="text-amber-300 text-[10px] break-words">
                          Missing: {authPlan.missing.map((m) => m.email).join(", ")}
                        </p>
                      )}
                      {authPlan.toCreate.length > 0 && (
                        <p className="text-sky-300 text-[10px] break-words">
                          Will create: {authPlan.toCreate.map((u) => u.email).join(", ")}
                          {authPlan.tempPasswordsEnabled
                            ? " · random temporary password set hoga (ek baar dikhega)"
                            : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {authPlan && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-app">
                      <label className="flex items-center gap-1.5 text-[11px] text-red-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={authConfirmed}
                          onChange={(e) => setAuthConfirmed(e.target.checked)}
                          disabled={authBusy}
                          className="accent-red-500"
                        />
                        Main confirm karta hoon — ye rows overwrite honge
                      </label>
                      <button
                        onClick={() => void callAuthRestore(true, authCreateUsers)}
                        disabled={authBusy || !authConfirmed}
                        className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition"
                      >
                        <Upload size={12} className="inline mr-1" /> Run Admin Restore
                      </button>
                    </div>
                  )}

                  {authResults && (
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-app border border-app px-3 py-2 space-y-1">
                      {authResults.map((r) => (
                        <div
                          key={r.table}
                          className="flex justify-between gap-3 text-[11px] font-mono"
                        >
                          <span className="text-muted">{r.table}</span>
                          <span className={r.failed ? "text-red-400" : "text-green-400"}>
                            ✓{r.restored} ✗{r.failed}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {authTempPasswords.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold text-emerald-300">
                          Temporary passwords — abhi copy kar lein (dobara nahi dikhenge)
                        </p>
                        <button
                          onClick={() => {
                            const text = authTempPasswords
                              .map((c) => `${c.email} → ${c.password}`)
                              .join("\n");
                            void navigator.clipboard
                              .writeText(text)
                              .then(() => showToast("success", "Credentials copy ho gaye."))
                              .catch(() =>
                                showToast("error", "Clipboard block ho gaya — manually copy karo.")
                              );
                          }}
                          className="px-2 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded text-[10px] font-bold flex-shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-0.5 font-mono text-[10px] text-emerald-200">
                        {authTempPasswords.map((c) => (
                          <div key={c.email} className="break-words">
                            {c.email} <span className="text-muted">→</span> {c.password}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted">
                        In users ko password apne hisaab se badalne do. Email inbox na hone ki wajah
                        se reset link kaam nahi karega — admin se password reset karwao.
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* ── Restoring indicator ── */}
            {restoring && (
              <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                <Loader2 size={16} className="animate-spin text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-sm font-medium">
                  {progress || "Restore ho raha hai..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MySQL Converter Tool */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-violet-600/20 to-transparent border-b border-app">
            <span className="text-base">🔄</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">
              MySQL / MariaDB → JSON Converter
            </h3>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted leading-relaxed">
              MariaDB ya MySQL ka <span className="text-white font-bold">.sql dump</span> file ko
              seedha Supabase backup format mein convert karo — phir restore karo.
            </p>
            <div className="flex items-center gap-2 bg-app border border-app rounded-xl px-4 py-3">
              <span className="text-lg">📁</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-app-2">Converter Tool Location</p>
                <p className="text-[11px] text-muted font-mono truncate">
                  /public/tools/vtech_mysql_converter.html
                </p>
              </div>
            </div>
            <a
              href="/tools/vtech_mysql_converter.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-sm transition-all"
            >
              🔄 Converter Tool Kholo
            </a>
            <div className="space-y-1.5 text-[10px] text-muted-2">
              <div className="flex items-center gap-2">
                <span className="text-violet-400">①</span> phpMyAdmin → Export → SQL → download
              </div>
              <div className="flex items-center gap-2">
                <span className="text-violet-400">②</span> Converter mein .sql drop karo
              </div>
              <div className="flex items-center gap-2">
                <span className="text-violet-400">③</span> JSON download hogi
              </div>
              <div className="flex items-center gap-2">
                <span className="text-violet-400">④</span> Upar Restore mein woh JSON use karo
              </div>
            </div>
          </div>
        </div>

        {/* Manual sequence reset note */}
        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-muted uppercase tracking-wider mb-1.5">
            Sequence Reset (Optional)
          </p>
          <p className="text-xs text-muted-2 leading-relaxed">
            Restore ke baad agar nayi entries ki IDs galat se start ho rahi hain, toh Supabase SQL
            Editor mein ye query run karein:
          </p>
          <code className="block mt-2 p-2 bg-app rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto">
            {"SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name) + 1, false);"}
          </code>
        </div>
      </div>
    </div>
  );
}
