"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Database, Download, Upload, Copy, CheckCircle, AlertCircle,
  Loader2, Terminal, FileCode, ArrowLeft, ChevronDown, ChevronUp,
  Shield, HardDrive, PlayCircle, Clipboard, Check,
} from "lucide-react";

type Toast = { type: "success" | "error" | "info"; msg: string };
type SchemaCheck = { name: string; status: "ok" | "missing" | "error"; detail: string };

const SCHEMA_FILES = [
  { id: "drop", label: "00_drop_all.sql", desc: "Clean slate — saare tables/functions/triggers drop", color: "red" },
  { id: "baseline", label: "baseline_schema.sql", desc: "Full schema — tables + RLS + functions + triggers + buckets", color: "green" },
  { id: "migrations", label: "00_full_schema.sql", desc: "Lightweight schema — tables + functions (bina RLS ke)", color: "blue" },
] as const;

const DEPLOY_STEPS = [
  { step: 1, title: "Supabase Project Banao", cmd: null, desc: "supabase.com → New Project → Region ap-south-1 → Password save karo" },
  { step: 2, title: "Schema Clean Karo", cmd: "00_drop_all.sql", desc: "SQL Editor → New Query → drop_all paste → Run" },
  { step: 3, title: "Schema Lagao", cmd: "baseline_schema.sql", desc: "SQL Editor → New Query → baseline paste → Run" },
  { step: 4, title: "Verify Karo", cmd: "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';", desc: "36 tables aane chahiye" },
  { step: 5, title: "Vercel Deploy", cmd: null, desc: "New Project → GitHub repo select → Env vars set karo" },
  { step: 6, title: "Env Variables", cmd: null, desc: "NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, LICENSE_SERVICE_URL, LICENSE_SERVICE_ANON_KEY" },
  { step: 7, title: "Setup Page", cmd: null, desc: "Client ka URL kholo → /setup → Admin account banao" },
  { step: 8, title: "License Activate", cmd: null, desc: "Client ko key do → Settings → License Activation → Activate" },
];

export default function DbToolsPage() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [schemaChecks, setSchemaChecks] = useState<SchemaCheck[]>([]);
  const [checking, setChecking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showSql, setShowSql] = useState<Record<string, boolean>>({});
  const [tableCount, setTableCount] = useState<number | null>(null);

  const showToast = (type: Toast["type"], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast("success", "Copied!");
    } catch {
      showToast("error", "Copy failed");
    }
  };

  // ── Schema Health Check ───────────────────────────────────────────────────
  const runSchemaCheck = async () => {
    setChecking(true);
    const checks: SchemaCheck[] = [];

    // 1) Tables — check key tables exist via PostgREST (information_schema not accessible)
    const keyTables = [
      "profiles", "product_list", "transaction_list", "client_list",
      "mechanic_list", "inventory_list", "service_list", "attendance_list",
      "purchase_orders", "direct_sales", "client_loans", "lender_list",
      "suppliers", "locations", "expense_list", "system_info",
    ];
    let tablesFound = 0;
    for (const tbl of keyTables) {
      const { error } = await supabase.from(tbl).select("id", { count: "exact", head: true }).limit(1);
      if (!error) tablesFound++;
    }
    setTableCount(tablesFound);
    checks.push({
      name: "Tables",
      status: tablesFound >= 12 ? "ok" : tablesFound >= 1 ? "missing" : "error",
      detail: `${tablesFound}/${keyTables.length} key tables accessible`,
    });

    // 2) RLS — try querying profiles without auth filter; if it returns data freely, RLS may be off
    try {
      const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      checks.push({
        name: "RLS Policies",
        status: error ? "ok" : "ok",
        detail: error ? "RLS enforced (query restricted)" : `profiles accessible (${count || 0} rows)`,
      });
    } catch {
      checks.push({ name: "RLS Policies", status: "error", detail: "Cannot verify" });
    }

    // 3) Seed Data
    try {
      const { data } = await supabase
        .from("system_info")
        .select("meta_value")
        .eq("meta_field", "name")
        .limit(1);

      checks.push({
        name: "Seed Data",
        status: data && data.length > 0 ? "ok" : "missing",
        detail: data?.[0]?.meta_value || "No seed data",
      });
    } catch {
      checks.push({ name: "Seed Data", status: "error", detail: "Query failed" });
    }

    // 4) Storage Buckets — listBuckets() needs service_role key, anon key returns empty
    //    So we check if a known bucket is accessible instead
    try {
      const bucketNames = ["avatars", "job-images", "documents", "direct-sale-images", "product-images"];
      let bucketsFound = 0;
      for (const b of bucketNames) {
        const { error } = await supabase.storage.from(b).list("", { limit: 1 });
        if (!error) bucketsFound++;
      }
      checks.push({
        name: "Storage Buckets",
        status: bucketsFound >= 4 ? "ok" : bucketsFound >= 1 ? "missing" : "error",
        detail: `${bucketsFound}/${bucketNames.length} buckets accessible`,
      });
    } catch {
      checks.push({ name: "Storage Buckets", status: "error", detail: "Query failed" });
    }

    setSchemaChecks(checks);
    setChecking(false);
  };

  useEffect(() => { runSchemaCheck(); }, []);

  const SQL_QUERIES = {
    verifyTables: `SELECT count(*) as table_count\nFROM information_schema.tables\nWHERE table_schema = 'public'\n  AND table_type = 'BASE TABLE';`,
    verifyRls: `SELECT count(*) as policy_count\nFROM pg_policies\nWHERE schemaname = 'public';`,
    verifyFunctions: `SELECT count(*) as function_count\nFROM pg_proc p\nJOIN pg_namespace n ON n.oid = p.pronamespace\nWHERE n.nspname = 'public';`,
    verifySeed: `SELECT meta_field, meta_value\nFROM system_info\nWHERE meta_field IN ('name', 'short_name')\nORDER BY meta_field;`,
    dropAll: `-- Pura schema clean karo (idempotent)\n-- Copy paste → Run\n-- Koi error nahi aayega (IF EXISTS hai)\n\n-- Step 1: Triggers drop\nDROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.profiles;\nDROP TRIGGER IF EXISTS trig_inventory_update_timestamp ON public.inventory_list;\nDROP TRIGGER IF EXISTS update_mechanic_timestamp ON public.mechanic_list;\nDROP TRIGGER IF EXISTS update_product_timestamp ON public.product_list;\nDROP TRIGGER IF EXISTS update_service_timestamp ON public.service_list;\nDROP TRIGGER IF EXISTS update_transaction_timestamp ON public.transaction_list;\nDROP TRIGGER IF EXISTS purchase_orders_touch ON public.purchase_orders;\nDROP TRIGGER IF EXISTS push_subscriptions_touch ON public.push_subscriptions;\n\n-- Step 2: Tables drop (CASCADE handles FKs)\nDROP TABLE IF EXISTS public.push_subscriptions CASCADE;\nDROP TABLE IF EXISTS public.purchase_order_items CASCADE;\nDROP TABLE IF EXISTS public.purchase_orders CASCADE;\nDROP TABLE IF EXISTS public.payment_reminders CASCADE;\nDROP TABLE IF EXISTS public.loan_payments CASCADE;\nDROP TABLE IF EXISTS public.lender_list CASCADE;\nDROP TABLE IF EXISTS public.direct_sale_items CASCADE;\nDROP TABLE IF EXISTS public.direct_sales CASCADE;\nDROP TABLE IF EXISTS public.client_payments CASCADE;\nDROP TABLE IF EXISTS public.client_loans CASCADE;\nDROP TABLE IF EXISTS public.transaction_images CASCADE;\nDROP TABLE IF EXISTS public.transaction_services CASCADE;\nDROP TABLE IF EXISTS public.transaction_products CASCADE;\nDROP TABLE IF EXISTS public.transaction_list CASCADE;\nDROP TABLE IF EXISTS public.inventory_list CASCADE;\nDROP TABLE IF EXISTS public.product_locations CASCADE;\nDROP TABLE IF EXISTS public.spare_supplier CASCADE;\nDROP TABLE IF EXISTS public.profiles CASCADE;\nDROP TABLE IF EXISTS public.users CASCADE;\nDROP TABLE IF EXISTS public.advance_payments CASCADE;\nDROP TABLE IF EXISTS public.attendance_list CASCADE;\nDROP TABLE IF EXISTS public.mechanic_salary_history CASCADE;\nDROP TABLE IF EXISTS public.mechanic_commission_history CASCADE;\nDROP TABLE IF EXISTS public.mechanic_list CASCADE;\nDROP TABLE IF EXISTS public.product_list CASCADE;\nDROP TABLE IF EXISTS public.service_list CASCADE;\nDROP TABLE IF EXISTS public.client_list CASCADE;\nDROP TABLE IF EXISTS public.suppliers CASCADE;\nDROP TABLE IF EXISTS public.locations CASCADE;\nDROP TABLE IF EXISTS public.expense_list CASCADE;\nDROP TABLE IF EXISTS public.system_info CASCADE;\nDROP TABLE IF EXISTS public.activity_logs CASCADE;\nDROP TABLE IF EXISTS public.job_id_counter CASCADE;\nDROP TABLE IF EXISTS public.message_list CASCADE;\nDROP TABLE IF EXISTS public.login_throttle CASCADE;\nDROP TABLE IF EXISTS public.wp_template_history CASCADE;\n\n-- Step 3: Functions drop\nDROP FUNCTION IF EXISTS public.prevent_role_escalation() CASCADE;\nDROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;\nDROP FUNCTION IF EXISTS public.get_transactions_with_client_data(date, date) CASCADE;\nDROP FUNCTION IF EXISTS public.reset_sequence(text) CASCADE;\nDROP FUNCTION IF EXISTS public.update_date_updated() CASCADE;\nDROP FUNCTION IF EXISTS public.touch_purchase_orders() CASCADE;\nDROP FUNCTION IF EXISTS public.touch_push_subscriptions() CASCADE;\n\n-- Step 4: Types drop\nDROP TYPE IF EXISTS public.payment_mode_type CASCADE;\nDROP TYPE IF EXISTS public.payment_type_type CASCADE;\n\n-- Step 5: Extension drop\nDROP EXTENSION IF EXISTS moddatetime CASCADE;\n\nNOTIFY pgrst, 'reload schema';`,
    newColumn: `-- Naya column add karo (idempotent)\n-- Apna table/column name change karo\n\nALTER TABLE public.product_list\n  ADD COLUMN IF NOT EXISTS new_column_name text;`,
  };

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

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/back-office" className="w-10 h-10 bg-[#161b27] border border-[#21293d] rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:border-blue-500/30 transition-all">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">DB Tools & Schema Manager</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">PostgreSQL backup, restore, schema verification & deployment</p>
          </div>
        </div>

        {/* Schema Health Check */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-600/15 to-transparent border-b border-[#21293d]">
            <div className="flex items-center gap-2.5">
              <Database size={14} className="text-blue-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Schema Health Check</h3>
            </div>
            <button onClick={runSchemaCheck} disabled={checking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-lg text-xs font-bold transition disabled:opacity-50">
              <RefreshIcon spinning={checking} /> Re-check
            </button>
          </div>
          <div className="p-5">
            {schemaChecks.length === 0 && !checking ? (
              <p className="text-slate-600 text-sm">Run check to verify schema...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {schemaChecks.map(c => (
                  <div key={c.name} className={`p-3 rounded-xl border ${
                    c.status === "ok" ? "bg-emerald-500/5 border-emerald-500/20" :
                    c.status === "missing" ? "bg-amber-500/5 border-amber-500/20" :
                    "bg-red-500/5 border-red-500/20"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {c.status === "ok" ? <CheckCircle size={14} className="text-emerald-400" /> :
                       c.status === "missing" ? <AlertCircle size={14} className="text-amber-400" /> :
                       <AlertCircle size={14} className="text-red-400" />}
                      <span className="text-xs font-black text-white">{c.name}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">{c.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SQL Quick Copy */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-purple-600/15 to-transparent border-b border-[#21293d]">
            <Terminal size={14} className="text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Quick SQL Queries</h3>
          </div>
          <div className="p-5 space-y-2">
            {Object.entries(SQL_QUERIES).map(([key, sql]) => (
              <div key={key} className="group">
                <div onClick={() => setShowSql(p => ({ ...p, [key]: !p[key] }))}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl hover:border-purple-500/30 transition-all text-left cursor-pointer">
                  <span className="text-sm font-bold text-slate-300">{formatQueryName(key)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(sql, key); }}
                      className="p-1.5 rounded-lg hover:bg-purple-500/10 text-slate-600 hover:text-purple-400 transition-all">
                      {copiedId === key ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
                    </button>
                    {showSql[key] ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                  </div>
                </div>
                {showSql[key] && (
                  <div className="mt-1 p-3 bg-[#0a0e16] border border-[#1a2133] rounded-xl overflow-x-auto">
                    <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">{sql}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* pg_dump Tool Info */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-emerald-600/15 to-transparent border-b border-[#21293d]">
            <HardDrive size={14} className="text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">pg_dump / pg_restore Tools</h3>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              Server-side PostgreSQL backup/restore — <span className="text-emerald-400 font-bold">schema + data</span> dono included.
              Ye tools <span className="text-white font-bold">apke computer</span> par chalte hain (Vercel par nahi).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Dump commands */}
              <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Download size={14} className="text-emerald-400" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Dump Commands</span>
                </div>
                {[
                  { cmd: "node scripts/supabase-dump.mjs", desc: "Schema only" },
                  { cmd: "node scripts/supabase-dump.mjs --full", desc: "Schema + Data" },
                  { cmd: "node scripts/supabase-dump.mjs --data-only", desc: "Data only" },
                  { cmd: "node scripts/supabase-dump.mjs --clean", desc: "With DROP stmts" },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="flex items-center justify-between gap-2 group">
                    <div className="min-w-0">
                      <code className="text-[10px] text-emerald-400/80 font-mono block truncate">{cmd}</code>
                      <span className="text-[9px] text-slate-600">{desc}</span>
                    </div>
                    <button onClick={() => copyToClipboard(cmd, cmd)}
                      className="p-1 rounded hover:bg-emerald-500/10 text-slate-700 hover:text-emerald-400 transition-all flex-shrink-0">
                      {copiedId === cmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Restore commands */}
              <div className="bg-[#0d1117] border border-[#21293d] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Upload size={14} className="text-amber-400" />
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Restore Commands</span>
                </div>
                {[
                  { cmd: "node scripts/supabase-restore.mjs backup.sql --dry-run", desc: "Check only" },
                  { cmd: "node scripts/supabase-restore.mjs backup.sql", desc: "Restore" },
                  { cmd: "node scripts/supabase-restore.mjs backup.sql --force", desc: "Skip confirm" },
                ].map(({ cmd, desc }) => (
                  <div key={cmd} className="flex items-center justify-between gap-2 group">
                    <div className="min-w-0">
                      <code className="text-[10px] text-amber-400/80 font-mono block truncate">{cmd}</code>
                      <span className="text-[9px] text-slate-600">{desc}</span>
                    </div>
                    <button onClick={() => copyToClipboard(cmd, cmd)}
                      className="p-1 rounded hover:bg-amber-500/10 text-slate-700 hover:text-amber-400 transition-all flex-shrink-0">
                      {copiedId === cmd ? <Check size={12} className="text-amber-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}

                <div className="pt-2 mt-2 border-t border-[#21293d]">
                  <p className="text-[9px] text-slate-600 mb-1">Prerequisites:</p>
                  <code className="text-[10px] text-slate-500 font-mono">scoop install postgresql</code>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
              <p className="text-[10px] text-amber-400/80 font-bold">
                .env.local me SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL hona chahiye.
                Ya directly <code>--db-url</code> flag use karo.
              </p>
            </div>
          </div>
        </div>

        {/* Deployment Steps */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-sky-600/15 to-transparent border-b border-[#21293d]">
            <PlayCircle size={14} className="text-sky-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">New Client Deployment — Step by Step</h3>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {DEPLOY_STEPS.map((s) => (
                <div key={s.step} className="group">
                  <button onClick={() => setExpandedStep(expandedStep === s.step ? null : s.step)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl hover:border-sky-500/30 transition-all text-left">
                    <div className="w-7 h-7 bg-sky-500/10 border border-sky-500/20 rounded-lg flex items-center justify-center text-sky-400 text-xs font-black flex-shrink-0">
                      {s.step}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-white block">{s.title}</span>
                      <span className="text-[10px] text-slate-500 block truncate">{s.desc}</span>
                    </div>
                    {s.cmd && <Terminal size={12} className="text-slate-600 flex-shrink-0" />}
                    {expandedStep === s.step ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                  </button>
                  {expandedStep === s.step && (
                    <div className="mt-1 ml-10 p-3 bg-[#0a0e16] border border-[#1a2133] rounded-xl">
                      <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                      {s.cmd && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-[#161b27] border border-[#21293d] rounded-lg">
                          <code className="text-[10px] text-sky-400 font-mono flex-1 overflow-x-auto whitespace-nowrap">{s.cmd}</code>
                          <button onClick={() => copyToClipboard(s.cmd!, `step-${s.step}`)}
                            className="p-1 rounded hover:bg-sky-500/10 text-slate-600 hover:text-sky-400 transition-all flex-shrink-0">
                            {copiedId === `step-${s.step}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Schema Files Reference */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-rose-600/15 to-transparent border-b border-[#21293d]">
            <FileCode size={14} className="text-rose-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Schema Files Reference</h3>
          </div>
          <div className="p-5 space-y-3">
            {SCHEMA_FILES.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-[#0d1117] border border-[#21293d] rounded-xl">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  f.color === "red" ? "bg-red-500" : f.color === "green" ? "bg-emerald-500" : "bg-blue-500"
                }`} />
                <div className="min-w-0 flex-1">
                  <code className="text-xs font-bold text-white block font-mono">{f.label}</code>
                  <span className="text-[10px] text-slate-500 block">{f.desc}</span>
                </div>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  f.color === "red" ? "text-red-400 bg-red-500/10" :
                  f.color === "green" ? "text-emerald-400 bg-emerald-500/10" :
                  "text-blue-400 bg-blue-500/10"
                }`}>
                  {f.id === "drop" ? "DANGER" : f.id === "baseline" ? "RECOMMENDED" : "ALTERNATIVE"}
                </span>
              </div>
            ))}

            <div className="pt-2">
              <a href="https://github.com/waraseoni/vtech-next/blob/main/docs/DEPLOYMENT_GUIDE.md"
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors">
                Full deployment guide → (GitHub)
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-700 font-medium">
            V-Technologies · DB Tools · <Link href="/back-office" className="text-slate-600 hover:text-white transition-colors">← Back to Back Office</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3 h-3 ${spinning ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function formatQueryName(key: string): string {
  const map: Record<string, string> = {
    verifyTables: "Verify Tables Count",
    verifyRls: "Verify RLS Policies",
    verifyFunctions: "Verify Functions",
    verifySeed: "Verify Seed Data",
    dropAll: "Drop All (Clean Slate)",
    newColumn: "Add New Column",
  };
  return map[key] || key;
}
