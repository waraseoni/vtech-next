"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Database, RefreshCw, ShieldAlert, Loader2, CheckCircle, XCircle,
  Clock, Table2, Rows3, TriangleAlert, FileText, CalendarClock, Server,
  Settings2, Power, Hand,
} from "lucide-react";

type HistoryRow = {
  id: number;
  started_at: string;
  finished_at: string;
  status: string;
  tables: number;
  rows: number;
  mismatches: number;
  duration_sec: number | string;
  details: string | null;
};

type SyncInfo = {
  supabase_url: string;
  mariadb: { host: string; port: number; db: string };
  mode: "auto" | "manual" | "off";
  task_enabled: boolean | null;
  scheduled: boolean;
  schedule_note: string;
  log_file: string;
  log: string[];
  history: HistoryRow[];
};

type SyncMode = SyncInfo["mode"];

const MODE_INFO: Record<SyncMode, { title: string; desc: string }> = {
  auto: { title: "Auto", desc: "Task Scheduler har 15 min me Supabase → MariaDB sync kar dega. Koi dhyan nahi dena padega." },
  manual: { title: "Manual", desc: "Auto-sync band. Jab bhi data fresh karna ho, 'Sync Now' dabao — wahi ek tarika." },
  off: { title: "Off", desc: "Sync bilkul band — na auto, na Sync Now. Jab tak ise Auto/Manual pe wapas na rakho, kuch nahi hoga." },
};

const fmtTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const fmtDur = (v: number | string) => {
  const n = Number(v);
  return isNaN(n) ? "—" : `${n.toFixed(1)}s`;
};

export default function SyncPage() {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/sync");
      if (res.status === 401 || res.status === 403) { setDenied(true); setError(""); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setInfo(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "API load fail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();
      if (json.status === "ok") {
        setInfo((prev) => prev ? { ...prev, history: json.history } : prev);
      } else {
        setError(json.error || "Sync failed");
        if (json.history) setInfo((prev) => prev ? { ...prev, history: json.history } : prev);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync request fail");
    } finally {
      setSyncing(false);
    }
  };

  const handleModeChange = async (mode: SyncMode) => {
    if (changingMode || mode === info?.mode) return;
    setChangingMode(true);
    setError("");
    try {
      const res = await fetch("/api/sync/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (json.status === "ok") {
        setInfo((prev) => prev ? { ...prev, mode, task_enabled: json.task_enabled } : prev);
      } else {
        setError(json.error || "Mode change fail");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mode change request fail");
    } finally {
      setChangingMode(false);
    }
  };

  const mode = info?.mode ?? "auto";
  const last = info?.history?.[0] ?? null;

  if (denied) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-6 flex items-center gap-3">
          <ShieldAlert size={20} className="text-red-400 flex-shrink-0" />
          <div>
            <p className="text-red-400 font-bold text-sm">Sirf Admin access</p>
            <p className="text-red-400/60 text-xs mt-1">Is tool ko sirf admin/developer role wale khol sakte hain.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">

      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Supabase → MariaDB Sync</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                Mode: <span className={mode === "auto" ? "text-emerald-400" : mode === "manual" ? "text-amber-400" : "text-red-400"}>{mode}</span>
                {" · "}MariaDB: {info?.mariadb.db ?? "vtech_db"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-lg text-xs font-bold transition disabled:opacity-50">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button onClick={handleSync} disabled={syncing || mode === "off"}
              title={mode === "off" ? "Sync OFF hai — pehle mode ko Auto/Manual karo" : undefined}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-[#0a0e16] rounded-lg text-xs font-black transition disabled:opacity-40 disabled:cursor-not-allowed">
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {syncing ? "Sync chal raha hai…" : mode === "off" ? "Sync OFF" : "Sync Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Sync Mode selector */}
      {!loading && info && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Settings2 size={14} className="text-slate-500" />
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sync Mode</span>
            </div>
            {info.task_enabled !== null && (
              <span className="text-[10px] font-bold text-slate-500">
                Task Scheduler:{" "}
                <span className={mode === "auto" ? "text-emerald-400" : "text-slate-500"}>
                  {info.task_enabled ? "ON" : "OFF"}
                </span>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(MODE_INFO) as SyncMode[]).map((m) => {
              const active = mode === m;
              return (
                <button key={m} onClick={() => handleModeChange(m)} disabled={changingMode}
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all ${
                    active
                      ? m === "auto" ? "bg-emerald-500/10 border-emerald-500/40"
                        : m === "manual" ? "bg-amber-500/10 border-amber-500/40"
                        : "bg-red-500/10 border-red-500/40"
                      : "bg-[#0d1117] border-[#21293d] hover:border-[#2a3550]"
                  } ${changingMode ? "opacity-60" : ""}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${active ? (m === "auto" ? "text-emerald-400" : m === "manual" ? "text-amber-400" : "text-red-400") : "text-slate-600"}`}>
                    {m === "auto" ? <RefreshCw size={16} /> : m === "manual" ? <Hand size={16} /> : <Power size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-black uppercase tracking-wider ${active ? "text-white" : "text-slate-400"}`}>{MODE_INFO[m].title}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">{MODE_INFO[m].desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Syncing banner */}
      {syncing && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-emerald-400 flex-shrink-0" />
          <p className="text-emerald-400 text-sm font-medium">
            Supabase se saara data MariaDB me copy ho raha hai… (30-60 sec lagte hain)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3.5">
          <p className="text-red-400 text-xs font-bold mb-1 flex items-center gap-1.5"><XCircle size={13} /> Sync fail ho gaya — error:</p>
          <pre className="text-red-400/70 text-[11px] font-mono whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {/* Last sync card */}
      {!loading && info && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-500" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Last Sync</span>
          </div>
          {last ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {last.status === "OK"
                    ? <CheckCircle size={16} className="text-emerald-400" />
                    : <XCircle size={16} className="text-red-400" />}
                  <span className={`text-sm font-black ${last.status === "OK" ? "text-emerald-400" : "text-red-400"}`}>
                    {last.status === "OK" ? "Successful" : "Failed"}
                  </span>
                  <span className="text-xs text-slate-400">{fmtTime(last.started_at)}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">#{last.id}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1"><Table2 size={10} /> Tables</p>
                  <p className="text-lg font-black text-white mt-1">{last.tables}</p>
                </div>
                <div className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1"><Rows3 size={10} /> Rows</p>
                  <p className="text-lg font-black text-white mt-1">{Number(last.rows).toLocaleString()}</p>
                </div>
                <div className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1"><TriangleAlert size={10} /> Mismatch</p>
                  <p className={`text-lg font-black mt-1 ${last.mismatches > 0 ? "text-amber-400" : "text-white"}`}>{last.mismatches}</p>
                </div>
                <div className="bg-[#0d1117] border border-[#21293d] rounded-xl px-3 py-2.5">
                  <p className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-1"><Clock size={10} /> Duration</p>
                  <p className="text-lg font-black text-white mt-1">{fmtDur(last.duration_sec)}</p>
                </div>
              </div>
              {last.status !== "OK" && last.details && (
                <pre className="text-red-400/70 text-[11px] font-mono whitespace-pre-wrap bg-red-500/5 border border-red-500/20 rounded-xl p-3">{last.details}</pre>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Abhi koi sync record nahi — pehli baar <span className="text-emerald-400 font-bold">Sync Now</span> dabao.
            </p>
          )}
        </div>
      )}

      {/* Auto-sync info */}
      {!loading && info && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4 flex items-center gap-3">
          <CalendarClock size={16} className={`flex-shrink-0 ${mode === "auto" ? "text-emerald-400" : mode === "manual" ? "text-amber-400" : "text-red-400"}`} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-300">
              {mode === "auto" ? "Auto-sync active" : mode === "manual" ? "Manual mode — auto-sync off" : "Sync OFF"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {mode === "auto"
                ? `${info.schedule_note} — is machine pe Task Scheduler har 15 min me script chala deta hai. Log: `
                : mode === "manual"
                  ? "Scheduled sync abhi band hai — data sirf 'Sync Now' dabane par update hoga. Log: "
                  : "Sync poori tarah band hai — na auto, na Sync Now. Mode on karke hi wapas shuru hoga. Log: "}
              <span className="font-mono text-slate-400">{info.log_file}</span>
            </p>
          </div>
        </div>
      )}

      {/* Connection info */}
      {!loading && info && (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-slate-500" />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Connection</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#0d1117] border border-[#21293d] rounded-lg px-3 py-2 flex items-center gap-2">
              <Database size={11} className="text-indigo-400" />
              <span className="text-slate-500">Source:</span>
              <span className="text-slate-300 font-mono truncate">{info.supabase_url.replace("https://", "")}</span>
            </div>
            <div className="bg-[#0d1117] border border-[#21293d] rounded-lg px-3 py-2 flex items-center gap-2">
              <Server size={11} className="text-emerald-400" />
              <span className="text-slate-500">Target:</span>
              <span className="text-slate-300 font-mono truncate">{info.mariadb.host}:{info.mariadb.port}/{info.mariadb.db}</span>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-gradient-to-r from-indigo-600/20 to-transparent border-b border-[#21293d]">
          <FileText size={14} className="text-indigo-400" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Sync History</h3>
          <span className="ml-auto text-[10px] text-slate-500">Last {(info?.history ?? []).length}</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(info?.history ?? []).length === 0 && !loading ? (
            <p className="px-5 py-6 text-sm text-slate-500 text-center">Koi history nahi.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#121723] text-slate-500 uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2 font-black">Time</th>
                  <th className="text-left px-3 py-2 font-black">Status</th>
                  <th className="text-right px-3 py-2 font-black">Tables</th>
                  <th className="text-right px-3 py-2 font-black">Rows</th>
                  <th className="text-right px-3 py-2 font-black">Mismatch</th>
                  <th className="text-right px-5 py-2 font-black">Duration</th>
                </tr>
              </thead>
              <tbody>
                {(info?.history ?? []).map((h) => (
                  <tr key={h.id} className="border-t border-[#1a2133]">
                    <td className="px-5 py-2 text-slate-300 whitespace-nowrap">{fmtTime(h.started_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black ${h.status === "OK"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"}`}>
                        {h.status === "OK" ? <CheckCircle size={9} /> : <XCircle size={9} />}
                        {h.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">{h.tables}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{Number(h.rows).toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right ${h.mismatches > 0 ? "text-amber-400 font-bold" : "text-slate-500"}`}>{h.mismatches}</td>
                    <td className="px-5 py-2 text-right text-slate-500 font-mono">{fmtDur(h.duration_sec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent log */}
      {!loading && info && info.log.length > 0 && (
        <div className="bg-[#0d1117] border border-[#21293d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[#21293d]">
            <FileText size={13} className="text-slate-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Recent Log</h3>
          </div>
          <div className="px-5 py-3 max-h-44 overflow-y-auto space-y-1">
            {info.log.map((l, i) => (
              <p key={i} className={`text-[10px] font-mono leading-relaxed ${l.includes("FAIL") ? "text-red-400/80" : "text-slate-500"}`}>{l}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
