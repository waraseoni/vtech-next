"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Download, Upload, Database, CheckCircle, AlertCircle,
  Loader2, ShieldAlert, FileJson, RefreshCw, Trash2,
} from "lucide-react";

// ─── Sabhi tables jo backup mein shamil honge ─────────────────────────────────
// NOTE: profiles aur users skip — ye auth tables hain, Supabase manage karta hai
// NOTE: mechanic_commission_history aur mechanic_salary_history bhi include
const BACKUP_TABLES = [
  // System
  "system_info",
  // Masters
  "client_list",
  "mechanic_list",
  "product_list",
  "service_list",
  // Inventory
  "inventory_list",
  // Jobs / Transactions
  "job_id_counter",
  "transaction_list",
  "transaction_products",
  "transaction_services",
  "transaction_images",
  // Payments
  "client_payments",
  "client_loans",
  // Direct Sales
  "direct_sales",
  "direct_sale_items",
  // Finance
  "advance_payments",
  "lender_list",
  "loan_payments",
  "expense_list",
  // Attendance & Messages
  "attendance_list",
  "message_list",
  // History logs
  "mechanic_commission_history",
  "mechanic_salary_history",
];

type Toast = { type: "success" | "error" | "info"; msg: string };
type BackupData = Record<string, unknown[]>;

export default function BackupPage() {
  const router = useRouter();
  const [taking,    setTaking]    = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress,  setProgress]  = useState("");
  const [toast,     setToast]     = useState<Toast | null>(null);
  const [dragOver,  setDragOver]  = useState(false);

  const showToast = (type: Toast["type"], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── BACKUP — sabhi tables ka data JSON mein export karo ──────────────────
  const handleBackup = async () => {
    setTaking(true);
    setProgress("Supabase se data fetch ho raha hai...");
    try {
      const backup: BackupData = {
        _meta: [{
          version: "1.0",
          created_at: new Date().toISOString(),
          tables: BACKUP_TABLES,
          app: "V-Tech Management System",
        }] as unknown[],
      };

      for (const table of BACKUP_TABLES) {
        setProgress(`Fetching: ${table}...`);
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("id", { ascending: true });

        if (error) {
          console.warn(`${table} skip (${error.message})`);
          backup[table] = [];
        } else {
          backup[table] = data || [];
        }
      }

      // JSON file download karo
      const json     = JSON.stringify(backup, null, 2);
      const blob     = new Blob([json], { type: "application/json" });
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      const now      = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      a.href         = url;
      a.download     = `vtech_backup_${now}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalRows = BACKUP_TABLES.reduce((s, t) => s + (backup[t]?.length || 0), 0);
      setProgress("");
      showToast("success", `Backup ready! ${totalRows.toLocaleString()} rows, ${BACKUP_TABLES.length} tables`);
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Backup failed!");
    } finally {
      setTaking(false);
    }
  };

  // ── RESTORE — JSON file se data wapas Supabase mein daal do ─────────────
  const handleRestore = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      showToast("error", "Sirf .json backup file select karo!");
      return;
    }

    const confirmed = window.confirm(
      "⚠️ RESTORE se sabhi existing data replace ho jayega!\n\n" +
      "Kya aap pakka restore karna chahte hain?\n\n" +
      "File: " + file.name
    );
    if (!confirmed) return;

    setRestoring(true);
    setProgress("Backup file parse ho rahi hai...");
    try {
      const text = await file.text();
      const backup: BackupData = JSON.parse(text);

      // Version check
      const meta = backup._meta?.[0] as Record<string, unknown>;
      if (!meta?.version) {
        showToast("error", "Invalid backup file! V-Tech backup file use karo.");
        setRestoring(false);
        return;
      }

      let totalRestored = 0;

      for (const table of BACKUP_TABLES) {
        const rows = backup[table];
        if (!rows || rows.length === 0) {
          setProgress(`${table}: koi data nahi — skip`);
          continue;
        }

        setProgress(`Restoring: ${table} (${rows.length} rows)...`);

        // Pehle table clear karo
        const { error: delErr } = await supabase
          .from(table)
          .delete()
          .gte("id", 0);   // sabhi rows delete

        if (delErr) {
          console.warn(`${table} clear failed:`, delErr.message);
        }

        // Batch mein insert karo (100 rows at a time)
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error: insErr } = await supabase
            .from(table)
            .insert(batch);
          if (insErr) {
            console.warn(`${table} batch insert failed:`, insErr.message);
          } else {
            totalRestored += batch.length;
          }
        }
      }

      setProgress("");
      showToast("success", `Restore complete! ${totalRestored.toLocaleString()} rows restored`);
    } catch (err: unknown) {
      setProgress("");
      showToast("error", err instanceof Error ? err.message : "Restore failed!");
    } finally {
      setRestoring(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleRestore(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleRestore(file);
  };

  const busy = taking || restoring;

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">

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

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center">
              <Database size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Database Backup & Restore</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                {BACKUP_TABLES.length} tables · JSON format
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex items-center gap-3">
            <Loader2 size={16} className="animate-spin text-blue-400 flex-shrink-0"/>
            <p className="text-blue-400 text-sm font-medium">{progress}</p>
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
              Supabase ke sabhi tables ka data ek <span className="text-emerald-400 font-bold">.json</span> file mein download hoga।
              Yeh file aapke computer mein safe rahengi।
            </p>

            {/* Tables list */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {BACKUP_TABLES.map(t => (
                <div key={t} className="flex items-center gap-1.5 px-2 py-1 bg-[#0d1117] rounded-lg border border-[#21293d]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"/>
                  <span className="text-[10px] text-slate-500 font-mono truncate">{t}</span>
                </div>
              ))}
            </div>

            <button onClick={handleBackup} disabled={busy}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30">
              {taking
                ? <><Loader2 size={16} className="animate-spin"/>Backup ho raha hai...</>
                : <><Download size={16}/> Download Backup (.json)</>}
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
              <p className="text-red-400 text-xs font-semibold leading-relaxed">
                <span className="font-black">Dhyan rakhein:</span> Restore se sab existing data
                replace ho jaayega। Pehle ek fresh backup zaroor lein।
              </p>
            </div>

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
                  {restoring ? "Restore ho raha hai..." : "Backup file drop karo"}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  ya click karke select karo · sirf .json file
                </p>
              </div>
              {restoring && (
                <Loader2 size={20} className="animate-spin text-amber-400"/>
              )}
            </label>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Yeh kaise kaam karta hai</p>
          <div className="space-y-2.5">
            {[
              { icon: Download, color: "text-emerald-400", title: "Backup", desc: "Supabase se sabhi tables ka data fetch karke ek JSON file banata hai aur download karta hai" },
              { icon: Upload,   color: "text-amber-400",  title: "Restore", desc: "JSON file padhta hai, pehle tables clear karta hai, phir data wapas insert karta hai" },
              { icon: RefreshCw, color: "text-blue-400",  title: "Regular Backup", desc: "Har hafte backup lena zaroori hai — especially important data change hone ke baad" },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <Icon size={14} className={`${color} flex-shrink-0 mt-0.5`}/>
                <div>
                  <span className="text-slate-400 text-xs font-bold">{title}: </span>
                  <span className="text-slate-600 text-xs">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supabase built-in backup note */}
        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl px-4 py-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
            Supabase Built-in Backup (Pro Plan)
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            Supabase Pro plan mein automatic daily backups hote hain।
            Dashboard → Project → Database → Backups mein ja kar restore kar sakte hain।
            Free plan ke liye yeh page use karein।
          </p>
        </div>

      </div>
    </div>
  );
}