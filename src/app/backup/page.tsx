"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import {
  Calendar,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  HardDriveDownload,
  Loader2,
  Printer,
  RefreshCw,
} from "lucide-react";

type BackupFile = {
  name: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  category: "mariadb-dump" | "schema-reference";
};

type BackupResponse = {
  ok: boolean;
  files: BackupFile[];
  latestMariadbDump: BackupFile | null;
  error?: string;
};

const card = "bg-[#161b27] border border-[#21293d] rounded-2xl";
const input =
  "w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700 [color-scheme:dark]";
const btn =
  "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]";
const btnPrimary = `${btn} bg-blue-600 hover:bg-blue-500 text-white`;
const btnGhost = `${btn} bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-[#21293d]`;

function fmtDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function fmtBytes(size: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export default function BackupPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const loadBackups = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/backups", { cache: "no-store" });
      const json = (await res.json()) as BackupResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Backup list load nahi hui.");
      }
      setFiles(json.files || []);
    } catch (err) {
      console.error("backup page load error:", err);
      setError(err instanceof Error ? err.message : "Backup data load nahi hui.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const latestDump = useMemo(
    () => files.find((file) => file.category === "mariadb-dump") || null,
    [files]
  );

  const schemaRef = useMemo(
    () => files.find((file) => file.category === "schema-reference") || null,
    [files]
  );

  const openExport = (format: "excel" | "csv") => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (format === "csv") params.set("format", "csv");
    window.open(`/api/export-transactions?${params.toString()}`, "_blank");
  };

  const openPrint = () => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    window.open(`/api/print-transactions?${params.toString()}`, "_blank");
  };

  return (
    <AdminPage
      title="Backup"
      subtitle="Reference dumps browse karo aur Next.js app se transaction exports nikaalo."
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex flex-col gap-3 pb-4 border-b border-[#21293d] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Export Tools</h2>
              <p className="mt-1 text-sm text-slate-500">Current Supabase data ko print ya Excel/CSV me nikaalo.</p>
            </div>
            <button onClick={loadBackups} className={btnGhost}>
              <RefreshCw size={13} className="inline-block mr-1" />
              Reload
            </button>
          </div>

          <div className="grid gap-4 mt-4 md:grid-cols-2">
            <label className="block">
              <span className="block mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">From Date</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={input} />
            </label>
            <label className="block">
              <span className="block mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">To Date</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={input} />
            </label>
          </div>

          <div className="grid gap-3 mt-4 sm:grid-cols-3">
            <button onClick={() => openExport("excel")} className={btnPrimary}>
              <FileSpreadsheet size={13} className="inline-block mr-1" />
              Excel
            </button>
            <button onClick={() => openExport("csv")} className={btnGhost}>
              <FileText size={13} className="inline-block mr-1" />
              CSV
            </button>
            <button onClick={openPrint} className={btnGhost}>
              <Printer size={13} className="inline-block mr-1" />
              Print
            </button>
          </div>

          <div className="grid gap-3 mt-5 md:grid-cols-2">
            <QuickInfo
              icon={<Database size={16} />}
              title="Latest MariaDB Dump"
              value={latestDump ? latestDump.name : "Not found"}
              meta={latestDump ? `${fmtBytes(latestDump.size)} | ${fmtDateTime(latestDump.modifiedAt)}` : "php-ref/db folder scan se file nahi mili."}
            />
            <QuickInfo
              icon={<Calendar size={16} />}
              title="Schema Reference"
              value={schemaRef ? schemaRef.name : "Not found"}
              meta={schemaRef ? `${fmtBytes(schemaRef.size)} | ${fmtDateTime(schemaRef.modifiedAt)}` : "Supabase schema text file missing hai."}
            />
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <div className="px-4 py-4 border-b border-[#21293d] sm:px-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Reference Backup Files</h2>
            <p className="mt-1 text-sm text-slate-500">Workspace ke local dumps aur schema references yahan se directly download ho sakte hain.</p>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="animate-spin text-blue-400" size={26} />
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-sm text-center text-red-400">{error}</div>
          ) : files.length === 0 ? (
            <div className="px-5 py-10 text-sm text-center text-slate-500">Koi local backup file detect nahi hui.</div>
          ) : (
            <div className="divide-y divide-[#1a2234]">
              {files.map((file) => (
                <div key={`${file.relativePath}-${file.modifiedAt}`} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          file.category === "mariadb-dump"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {file.category === "mariadb-dump" ? "MariaDB Dump" : "Schema Ref"}
                      </span>
                      <span className="truncate text-sm font-bold text-white">{file.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{fmtBytes(file.size)} | {fmtDateTime(file.modifiedAt)}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-700">{file.relativePath}</p>
                  </div>
                  <a
                    href={`/api/backups/download?file=${encodeURIComponent(file.relativePath)}`}
                    className={btnGhost}
                  >
                    <Download size={13} className="inline-block mr-1" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={`${card} mt-4 p-4 sm:p-5`}>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400">
            <HardDriveDownload size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">What this page covers</h3>
            <p className="mt-1 text-sm text-slate-500">
              PHP reference jaisa local dump listing yahan aa gaya hai. Live Supabase full-database SQL dump create karna abhi wired nahi hai,
              lekin transactions export, print report, latest MariaDB dump access aur schema reference download ab usable hain.
            </p>
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function QuickInfo({
  icon,
  title,
  value,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-[#21293d] bg-[#111520] p-4">
      <div className="flex items-center gap-2 text-blue-400">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <p className="mt-2 text-sm font-black text-white truncate">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{meta}</p>
    </div>
  );
}
