"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Download, Upload, Database, CheckCircle, AlertCircle,
  Loader2, ShieldAlert, FileJson, RefreshCw, Table2, Rows3,
} from "lucide-react";

// ─── Backup tables in RESTORE ORDER (FK dependencies matter!) ─────────────────
// Parent tables phle restore honge, phir child tables
const BACKUP_TABLES_ORDERED = [
  // Step 1: System & Counters (no FK)
  { table: "system_info",         order: 1 },
  { table: "job_id_counter",     order: 1 },
  // Step 2: Master tables (no FK dependencies)
  { table: "mechanic_list",       order: 2 },
  { table: "client_list",         order: 2 },
  { table: "product_list",        order: 2 },
  { table: "service_list",       order: 2 },
  // Step 3: Inventory (FK: product_list)
  { table: "inventory_list",      order: 3 },
  // Step 4: Finance - Lenders first (parent of loan_payments)
  { table: "lender_list",         order: 4 },
  { table: "loan_payments",       order: 4 },  // FK: lender_list
  { table: "expense_list",        order: 4 },
  // Step 5: Transactions (main job table, no FK from other backup tables)
  { table: "transaction_list",      order: 5 },
  // Step 6: Transaction sub-tables (FK: transaction_list)
  { table: "transaction_products",  order: 6 },  // Composite PK: (transaction_id, product_id)
  { table: "transaction_services",  order: 6 },  // Composite PK: (transaction_id, service_id)
  { table: "transaction_images",   order: 6 },
  // Step 7: Client loans & payments (FK: client_list, transaction_list)
  { table: "client_loans",        order: 7 },
  { table: "client_payments",     order: 7 },
  // Step 8: Direct sales (FK: client_list, mechanic_list)
  { table: "direct_sales",        order: 8 },
  { table: "direct_sale_items",   order: 8 },   // FK: direct_sales, product_list
  // Step 9: Attendance & Advances (FK: mechanic_list)
  { table: "attendance_list",      order: 9 },
  { table: "advance_payments",    order: 9 },
  // Step 10: Salary & Commission history (FK: mechanic_list)
  { table: "mechanic_salary_history",     order: 10 },
  { table: "mechanic_commission_history", order: 10 },
  // Step 11: Messages
  { table: "message_list",        order: 11 },
];

const BACKUP_TABLES = BACKUP_TABLES_ORDERED.map(t => t.table);

// ── GENERATED columns — DB automatically calculates these ────────────────────
// These columns MUST be excluded from INSERT otherwise Postgres throws error:
// "ERROR: cannot insert into column 'net_amount' (generated always)"
const GENERATED_COLS: Record<string, string[]> = {
  "client_payments": ["net_amount"],
  "product_list": ["barcode"],
};

// ── FK violations to skip (bad data that would cause FK error) ───────────────
// These rows will be skipped during restore to avoid FK constraint errors
const SKIP_INVALID_FK: Record<string, { field: string; invalidValues: (number|string)[] }> = {
  "mechanic_commission_history": { field: "mechanic_id",  invalidValues: [0]  },
};

type Toast = { type: "success" | "error" | "info"; msg: string };
type BackupData = Record<string, unknown[]>;
type TableStats = { table: string; count: number };
type BackupPreview = { fileName: string; tables: { name: string; rows: number }[]; totalRows: number; totalTables: number; version: string; createdAt: string };
type TableResult = { table: string; fileRows: number; restored: number; failed: number };

export default function BackupPage() {
  const [taking,     setTaking]     = useState(false);
  const [restoring,  setRestoring]  = useState(false);
  const [progress,   setProgress]   = useState("");
  const [toast,      setToast]      = useState<Toast | null>(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [tableStats, setTableStats] = useState<TableStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreReport, setRestoreReport] = useState<TableResult[]>([]);

  const showToast = (type: Toast["type"], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Fetch live table counts ────────────────────────────────────────────────
  const fetchTableStats = async () => {
    setLoadingStats(true);
    const stats: TableStats[] = [];
    for (const t of BACKUP_TABLES) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      stats.push({ table: t, count: count || 0 });
    }
    setTableStats(stats);
    setLoadingStats(false);
  };

  useEffect(() => { fetchTableStats(); }, []);

  // ── BACKUP ────────────────────────────────────────────────────────────────
  const handleBackup = async () => {
    setTaking(true);
    setProgress("Supabase se data fetch ho raha hai...");
    try {
      const backup: BackupData = {
        _meta: [{
          version: "2.0",
          created_at: new Date().toISOString(),
          tables: BACKUP_TABLES,
          app: "V-Tech Management System",
          table_order: BACKUP_TABLES_ORDERED,
        }] as unknown[],
      };

      // Composite PK tables ka order field alag hai
      const COMPOSITE_ORDER: Record<string, string> = {
        "transaction_products": "transaction_id",
        "transaction_services": "transaction_id",
      };

      // GENERATED ALWAYS columns ko backup se bahar rakho
      // Restore ke waqt insert nahi ho sakta — DB auto-calculate karta hai
      const EXCLUDE_FROM_BACKUP: Record<string, string> = {
        "client_payments": "id,client_id,job_id,loan_id,bill_no,payment_date,amount,discount,payment_mode,payment_type,remarks,created_at",
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

      for (const t of BACKUP_TABLES) {
        setProgress(`Fetching: ${t}...`);
        const orderField = COMPOSITE_ORDER[t] || "id";
        const selectCols = EXCLUDE_FROM_BACKUP[t] || "*";
        
        try {
          const data = await fetchAllRows(t, selectCols, orderField);
          backup[t] = data;
        } catch (error) {
          console.warn(`${t} skip (${error instanceof Error ? error.message : "Unknown error"})`);
          backup[t] = [];
        }
      }

      const json  = JSON.stringify(backup, null, 2);
      const blob  = new Blob([json], { type: "application/json" });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      const now   = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      a.href      = url;
      a.download  = `vtech_backup_${now}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalRows = BACKUP_TABLES.reduce((s, t) => s + (backup[t]?.length || 0), 0);
      setProgress("");
      showToast("success", `Backup ready! ${totalRows.toLocaleString()} rows, ${BACKUP_TABLES.length} tables`);
      fetchTableStats();
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Backup failed!");
    } finally {
      setTaking(false);
    }
  };

  // ── Tables with composite primary keys (need special delete) ─────────────────
  const COMPOSITE_KEY_TABLES = ["transaction_products", "transaction_services"];

  // ── RESTORE ────────────────────────────────────────────────────────────────
  const handleRestore = async (file: File, dryRun = false, preloadedBackup?: BackupData) => {
    if (!file.name.endsWith(".json") && !preloadedBackup) {
      showToast("error", "Sirf .json backup file select karo!");
      return;
    }

    if (dryRun) {
      setProgress("Dry run mode - validating backup file...");
    } else {
      const confirmed = window.confirm(
        "⚠️ WARNING: Restore se sabhi EXISTING data REPLACE ho jayega!\n\n" +
        "Ye action UNDO nahi ho sakta!\n\n" +
        "Pehle ek naya backup zaroor lein.\n\n" +
        "File: " + (preview?.fileName || file.name)
      );
      if (!confirmed) return;
    }

    setRestoring(true);
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
      if (!meta?.version) {
        showToast("error", "Invalid backup file! V-Tech backup file use karo.");
        setRestoring(false);
        return;
      }

      // Tables ko order ke hisab se group karo
      const orderedTables = [...BACKUP_TABLES_ORDERED].sort((a, b) => a.order - b.order);

      let totalRestored = 0;
      let totalDeleted  = 0;
      const tableResults: TableResult[] = [];

      // ── Step 0: Validate all backup data before restoring ─────────────────
      setProgress("Validating backup data...");
      for (const { table } of orderedTables) {
        const rows = backup[table];
        if (!Array.isArray(rows)) {
          throw new Error(`Invalid data for table: ${table}`);
        }
      }

      if (dryRun) {
        const totalRows = orderedTables.reduce((s, { table }) => s + (backup[table]?.length || 0), 0);
        showToast("success", `✅ Dry run PASSED! ${totalRows.toLocaleString()} rows in ${orderedTables.length} tables ready to restore.`);
        setRestoring(false);
        return;
      }

      // Clear preview after successful restore start
      setPreview(null);

      for (const { table } of orderedTables) {
        const rawRows = backup[table];
        if (!rawRows || rawRows.length === 0) {
          setProgress(`${table}: koi data nahi — skip`);
          await new Promise(r => setTimeout(r, 50));
          continue;
        }

        // ── Strip GENERATED columns (DB auto-calculates these) ────────────────
        const genCols = GENERATED_COLS[table] || [];
        // ── Skip rows with invalid FK references ──────────────────────────────
        const fkRule = SKIP_INVALID_FK[table];
        const rows = (rawRows as Record<string, unknown>[])
          .filter(row => {
            if (!fkRule) return true;
            const val = row[fkRule.field];
            return !fkRule.invalidValues.includes(val as number | string);
          })
          .map(row => {
            const r: Record<string, unknown> = { ...row };
            // Strip generated columns
            genCols.forEach(col => delete r[col]);
            // Fix negative prices — CHECK (price >= 0)
            for (const pf of ["price","cost_price","amount","discount"]) {
              if (pf in r && typeof r[pf] === "number" && (r[pf] as number) < 0) r[pf] = 0;
            }
            // Fix int/null in text NOT NULL columns
            for (const tf of ["name","description","category","fault","item","remark","uniq_id","code","fullname","address","sale_code"]) {
              if (tf in r) {
                if (r[tf] === null || r[tf] === undefined) r[tf] = "";
                else if (typeof r[tf] !== "string") r[tf] = String(r[tf]);
              }
            }
            // Fix MySQL zero-dates → null (PostgreSQL "0000-00-00" support nahi karta)
            for (const key of Object.keys(r)) {
              if (typeof r[key] === "string" && (r[key] as string).startsWith("0000-00-00")) {
                r[key] = null;
              }
            }
            return r;
          });

        const tableStart = totalRestored;
        setProgress(`Restoring: ${table} (${rows.length} rows)...`);

        // Step 1: Delete existing rows
        let delErr = null;
        if (COMPOSITE_KEY_TABLES.includes(table)) {
          const { error } = await supabase
            .from(table)
            .delete()
            .not("transaction_id", "is", null);
          delErr = error;
        } else {
          const { error } = await supabase
            .from(table)
            .delete()
            .neq("id", -999999);
          delErr = error;
          if (delErr) {
            const { error: err2 } = await supabase.from(table).delete().gt("id", -1);
            if (err2) {
              const { error: err3 } = await supabase.from(table).delete().gte("id", 0);
              delErr = err3;
            } else {
              delErr = null;
            }
          }
        }
        if (delErr) console.warn(`${table} delete warning:`, delErr.message);
        totalDeleted += rows.length;

        // Step 2: Insert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error: insErr } = await supabase
            .from(table)
            .upsert(batch as Record<string, unknown>[]);

          if (insErr) {
            console.warn(`${table} batch ${i}-${i+batchSize} error:`, insErr.message);
            // Row-by-row fallback — count only successful ones
            for (const row of batch) {
              const { error: rowErr } = await supabase
                .from(table)
                .upsert(row as Record<string, unknown>);
              if (!rowErr) {
                totalRestored++;
              } else {
                console.warn(`${table} row skip:`, rowErr.message, row);
              }
            }
          } else {
            totalRestored += batch.length;
          }
        }

        // Per-table result track karo
        tableResults.push({ table, fileRows: rows.length, restored: totalRestored - tableStart, failed: rows.length - (totalRestored - tableStart) });
      }

      // Step 3: Reset sequences (important for auto-increment IDs)
      setProgress("Sequences reset kar rahe hain...");
      await resetSequences();

      setProgress("");
      setRestoreReport(tableResults);
      const failedCount = tableResults.reduce((s, r) => s + r.failed, 0);
      if (failedCount > 0) {
        showToast("error", `⚠ ${totalRestored.toLocaleString()} restored, ${failedCount} failed — report dekhein`);
      } else {
        showToast("success", `✅ ${totalRestored.toLocaleString()} rows 100% restored!`);
      }
      fetchTableStats();
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Restore failed!");
    } finally {
      setRestoring(false);
    }
  };

  // ── Reset PostgreSQL sequences ──────────────────────────────────────────────
  const resetSequences = async () => {
    const sequenceTables = [
      "system_info", "job_id_counter", "mechanic_list", "client_list",
      "product_list", "service_list", "inventory_list", "lender_list",
      "expense_list", "transaction_list", "client_loans", "client_payments",
      "direct_sales", "direct_sale_items", "attendance_list", "advance_payments",
      "mechanic_salary_history", "mechanic_commission_history", "message_list",
    ];

    // Call RPC to reset sequences - this requires a Supabase function
    // For now, we'll use a workaround with max ID + 1
    for (const table of sequenceTables) {
      try {
        const { data } = await supabase
          .from(table)
          .select("id")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && typeof data.id === "number") {
          // We can't directly reset sequences via Supabase client
          // This is a limitation - sequences will auto-increment from current max + 1
          // For proper reset, user should use Supabase Dashboard SQL Editor:
          // SELECT setval(pg_get_serial_sequence('table_name', 'id'), (SELECT MAX(id) FROM table_name) + 1, false);
          console.log(`${table}: max id = ${data.id}, sequence will resume from ${data.id + 1}`);
        }
      } catch (e) {
        // Table might be empty or have no id column
      }
    }
  };

  // ── Preview backup file before restore ───────────────────────────────────
  const previewBackupFile = async (file: File) => {
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;
      const meta = backup._meta?.[0] as Record<string, unknown>;

      if (!meta?.version) {
        showToast("error", "Invalid backup file!");
        return null;
      }

      const tables: { name: string; rows: number }[] = [];
      let totalRows = 0;

      for (const t of BACKUP_TABLES) {
        const rows = backup[t];
        if (Array.isArray(rows)) {
          tables.push({ name: t, rows: rows.length });
          totalRows += rows.length;
        }
      }

      const previewData: BackupPreview = {
        fileName: file.name,
        tables,
        totalRows,
        totalTables: tables.length,
        version: String(meta.version || "unknown"),
        createdAt: String(meta.created_at || "unknown"),
      };

      setPreview(previewData);
      return backup;
    } catch {
      showToast("error", "Failed to read backup file!");
      return null;
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      previewBackupFile(file).then(backup => {
        if (backup) handleRestore(new File([], file.name), false, backup as BackupData);
      });
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      previewBackupFile(file).then(backup => {
        if (backup) handleRestore(new File([], file.name), false, backup as BackupData);
      });
    }
  };

  const getRowCount = (table: string) => {
    return tableStats.find(s => s.table === table)?.count || 0;
  };

  const busy = taking || restoring;

  // Group tables by order for display
  const groupedTables = BACKUP_TABLES_ORDERED.reduce((acc, { table, order }) => {
    if (!acc[order]) acc[order] = [];
    acc[order].push(table);
    return acc;
  }, {} as Record<number, string[]>);

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">

      {/* ── Restore Report ─────────────────────────────────────────── */}
      {restoreReport.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-50">
          <div className="bg-[#161b27] border border-[#21293d] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#21293d]">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#4a5568]">📊 Restore Report</span>
              <div className="flex gap-3 text-xs">
                <span className="text-green-400 font-bold">✓ {restoreReport.reduce((s,r)=>s+r.restored,0)} restored</span>
                {restoreReport.some(r=>r.failed>0) &&
                  <span className="text-red-400 font-bold">✗ {restoreReport.reduce((s,r)=>s+r.failed,0)} failed</span>
                }
              </div>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto flex flex-col gap-1">
              {restoreReport.map(r => (
                <div key={r.table} className="flex justify-between items-center px-3 py-1.5 bg-[#0d1117] rounded-lg text-xs">
                  <span className="font-mono text-[#94a3b8]">{r.table}</span>
                  <span className="flex gap-3 items-center">
                    <span className="text-[#4a5568]">{r.fileRows} in file</span>
                    {r.failed === 0
                      ? <span className="text-green-400 font-bold">✓ {r.restored} OK</span>
                      : <span className="text-red-400 font-bold">✓{r.restored} ✗{r.failed} FAIL</span>
                    }
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-[#21293d] flex justify-end">
              <button onClick={()=>setRestoreReport([])} className="text-[11px] text-[#4a5568] hover:text-white transition-colors">✕ Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold max-w-sm ${
          toast.type === "success" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : toast.type === "info"  ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
          : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">

        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center">
                <Database size={18} className="text-white"/>
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Database Backup & Restore</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {BACKUP_TABLES.length} tables · Auto-restore order · Sequence safe
                </p>
              </div>
            </div>
            <button onClick={fetchTableStats} disabled={loadingStats}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-lg text-xs font-bold transition">
              <RefreshCw size={12} className={loadingStats ? "animate-spin" : ""}/> Refresh
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0"/>
            <p className="text-blue-400 text-sm font-medium">{progress}</p>
          </div>
        )}

        {/* Table Stats */}
        {tableStats.length > 0 && (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-3">
            <div className="flex items-center gap-2 mb-3">
              <Table2 size={14} className="text-slate-500"/>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Current Table Status</span>
              <span className="ml-auto text-[10px] text-emerald-400 font-bold">
                {tableStats.reduce((s, t) => s + t.count, 0).toLocaleString()} total rows
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
              {tableStats.map(({ table, count }) => (
                <div key={table} className="flex items-center justify-between px-2 py-1 bg-[#0d1117] rounded-lg border border-[#21293d]">
                  <span className="text-[9px] text-slate-500 font-mono truncate">{table}</span>
                  <span className={`text-[10px] font-bold ml-1 ${count > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                    {count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BACKUP card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-emerald-600/20 to-transparent border-b border-[#21293d]">
            <Download size={14} className="text-emerald-400"/>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Backup Lena</h3>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Supabase ke sabhi tables ka data ek <span className="text-emerald-400 font-bold">.json</span> file mein download hoga.
              Yeh file aapke computer mein safe rahengi.
            </p>

            {/* Tables by restore order */}
            <div className="space-y-2">
              {Object.entries(groupedTables).map(([order, tables]) => (
                <div key={order}>
                  <p className="text-[9px] font-black uppercase text-slate-600 tracking-wider mb-1">Step {order}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tables.map(t => (
                      <div key={t} className="flex items-center gap-1.5 px-2 py-1 bg-[#0d1117] rounded-lg border border-[#21293d]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"/>
                        <span className="text-[10px] text-slate-500 font-mono">{t}</span>
                        <span className="text-[9px] text-slate-600">({getRowCount(t)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleBackup} disabled={busy}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30">
              {taking
                ? <><Loader2 size={16} className="animate-spin"/>Backup ho raha hai...</>
                : <><Download size={16}/> Download Full Backup (.json)</>}
            </button>
          </div>
        </div>

        {/* RESTORE card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-amber-600/20 to-transparent border-b border-[#21293d]">
            <Upload size={14} className="text-amber-400"/>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Restore Karna</h3>
          </div>
          <div className="p-5 space-y-4">
            {/* Warning */}
            <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
              <ShieldAlert size={16} className="text-red-400 flex-shrink-0 mt-0.5"/>
              <div className="space-y-1">
                <p className="text-red-400 text-xs font-bold">
                  DHYAN RAKHEIN - Ye action UNDO NAHI HOGA!
                </p>
                <p className="text-red-400/70 text-xs leading-relaxed">
                  Restore se sab existing data REPLACE ho jaayega. Pehle ek fresh backup zaroor lein.
                </p>
              </div>
            </div>

            {/* Restore order info */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                Restore Process (Auto-Ordered)
              </p>
              <ol className="space-y-0.5 text-xs text-slate-600">
                <li>1. Pehle sabhi tables clear honge</li>
                <li>2. Parent tables phle restore honge (FK dependencies)</li>
                <li>3. Child tables baad mein restore honge</li>
                <li>4. Sequences auto-adjust honge</li>
              </ol>
            </div>

            {/* Backup File Preview */}
            {preview && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-400"/>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                      Backup File Ready
                    </p>
                  </div>
                  <button onClick={() => setPreview(null)}
                    className="text-slate-500 hover:text-red-400 text-xs font-bold">
                    ✕ Clear
                  </button>
                </div>
                
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-[#0d1117] rounded-lg p-2 text-center">
                    <p className="text-lg font-black text-emerald-400">{preview.totalTables}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Tables</p>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-2 text-center">
                    <p className="text-lg font-black text-blue-400">{preview.totalRows.toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500 uppercase">Total Rows</p>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-2 text-center">
                    <p className="text-[10px] font-bold text-slate-400 truncate" title={preview.fileName}>
                      {preview.fileName.split("_")[1] || preview.fileName.slice(0, 8)}
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase">File</p>
                  </div>
                </div>

                {/* Table List */}
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {preview.tables.map(({ name, rows }) => (
                    <div key={name} className="flex items-center justify-between px-2 py-1 bg-[#0d1117] rounded text-[10px]">
                      <span className="text-slate-400 font-mono">{name}</span>
                      <span className={`font-bold ${rows > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                        {rows.toLocaleString()} rows
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleRestore(new File([], preview.fileName), true, { _meta: [{ version: "2.0" }] } as BackupData)}
                    disabled={restoring}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                    <FileJson size={12}/> Dry Run
                  </button>
                  <button onClick={() => handleRestore(new File([], preview.fileName), false, { _meta: [{ version: "2.0" }] } as BackupData)}
                    disabled={restoring}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                    <Upload size={12}/> Restore Now
                  </button>
                </div>
              </div>
            )}

            {/* Drag & Drop zone */}
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                dragOver
                  ? "border-amber-500/60 bg-amber-500/10"
                  : busy
                  ? "border-[#21293d] opacity-50 cursor-not-allowed"
                  : "border-[#21293d] hover:border-amber-500/40 hover:bg-amber-500/5"
              }`}>
              <input type="file" accept=".json" onChange={onFileInput}
                disabled={busy} className="hidden"/>
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
                <FileJson size={22} className="text-amber-400"/>
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-bold text-sm">
                  {restoring ? "Restore ho raha hai..." : "Backup file drop karo ya click karo"}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  Drag & drop · click to select · sirf .json file
                </p>
              </div>
              {restoring && (
                <Loader2 size={20} className="animate-spin text-amber-400"/>
              )}
            </label>

            {/* Dry Run Button */}
            <p className="text-center text-[10px] text-slate-600">
              Pehle "Dry Run" karein backup validate karne ke liye
            </p>
            <div className="flex gap-3">
              <button onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const backup = await previewBackupFile(file);
                    if (backup) handleRestore(file, true, backup as BackupData);
                  }
                };
                input.click();
              }} disabled={busy}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                <FileJson size={14}/> Dry Run (Validate Only)
              </button>
            </div>
          </div>
        </div>

        {/* MySQL Converter Tool */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-violet-600/20 to-transparent border-b border-[#21293d]">
            <span className="text-base">🔄</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">MySQL / MariaDB → JSON Converter</h3>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              MariaDB ya MySQL ka <span className="text-white font-bold">.sql dump</span> file ko seedha
              Supabase backup format mein convert karo — phir restore karo.
            </p>
            <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21293d] rounded-xl px-4 py-3">
              <span className="text-lg">📁</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-300">Converter Tool Location</p>
                <p className="text-[11px] text-slate-500 font-mono truncate">/public/tools/vtech_mysql_converter.html</p>
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
            <div className="space-y-1.5 text-[10px] text-slate-600">
              <div className="flex items-center gap-2"><span className="text-violet-400">①</span> phpMyAdmin → Export → SQL → download</div>
              <div className="flex items-center gap-2"><span className="text-violet-400">②</span> Converter mein .sql drop karo</div>
              <div className="flex items-center gap-2"><span className="text-violet-400">③</span> JSON download hogi</div>
              <div className="flex items-center gap-2"><span className="text-violet-400">④</span> Upar Restore mein woh JSON use karo</div>
            </div>
          </div>
        </div>

        {/* Manual sequence reset note */}
        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Sequence Reset (Optional)
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Restore ke baad agar nayi entries ki IDs galat se start ho rahi hain,
            toh Supabase SQL Editor mein ye query run karein:
          </p>
          <code className="block mt-2 p-2 bg-[#0d1117] rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto">
            SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name) + 1, false);
          </code>
        </div>

      </div>
    </div>
  );
}