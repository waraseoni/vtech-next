"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { openImageLightbox } from "@/components/ImageLightbox";
import { useRouter } from "next/navigation";
import { supabase, getCachedUser } from "@/lib/supabase";
import {
  Images,
  RefreshCw,
  Trash2,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  Link2,
} from "lucide-react";

type BucketFile = {
  name: string;
  url: string;
  size: number;
  created_at: string;
  referenced: boolean;
  refs: { label: string; href: string | null }[];
};
type BucketData = {
  bucket: string;
  label: string;
  total: number;
  orphanCount: number;
  files: BucketFile[];
};

const fmtSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 * 1024
      ? `${(b / 1024).toFixed(1)} KB`
      : `${(b / (1024 * 1024)).toFixed(2)} MB`;

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

export default function ImagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buckets, setBuckets] = useState<BucketData[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "referenced" | "orphan">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState("");

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Admin guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await getCachedUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (p?.role !== "admin" && p?.role !== "developer") router.push("/");
    })();
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      if (res.status === 403) {
        setError("Sirf Admin is page ko dekh sakta hai");
        return;
      }
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Load failed");
      setBuckets(json.buckets as BucketData[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleBuckets =
    activeBucket === "all" ? buckets : buckets.filter((b) => b.bucket === activeBucket);
  const visibleFiles = visibleBuckets
    .flatMap((b) => b.files.map((f) => ({ ...f, bucket: b.bucket })))
    .filter((f) =>
      statusFilter === "all" ? true : statusFilter === "orphan" ? !f.referenced : f.referenced
    );
  const totalFiles = buckets.reduce((s, b) => s + b.total, 0);
  const totalOrphans = buckets.reduce((s, b) => s + b.orphanCount, 0);

  const key = (b: string, n: string) => `${b}/${n}`;
  const toggleSelect = (k: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(k)) s.delete(k);
      else s.add(k);
      return s;
    });
  };

  const selectOrphans = () => {
    const s = new Set<string>();
    visibleBuckets.forEach((b) =>
      b.files.forEach((f) => {
        if (!f.referenced) s.add(key(b.bucket, f.name));
      })
    );
    setSelected(s);
  };

  const deleteFiles = async (items: { bucket: string; name: string }[]) => {
    if (items.length === 0) return;
    if (
      !confirm(
        `${items.length} image(s) permanently delete karni hain? Ye storage se hamesha ke liye hat jayengi — pahle download kar lena.`
      )
    )
      return;
    setDeleting(true);
    try {
      let removed = 0;
      for (const b of new Set(items.map((n) => n.bucket))) {
        const batch = items.filter((n) => n.bucket === b).map((n) => n.name);
        const res = await fetch("/api/images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket: b, names: batch }),
        });
        const json = await res.json();
        if (json.status === "success") removed += json.removed;
        else showToast("error", json.msg || `${b} delete fail`);
      }
      if (removed > 0) {
        showToast("success", `${removed} image(s) delete ho gayi ✅`);
        setSelected(new Set());
        load();
      }
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const copy = async (k: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(k);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      showToast("error", "Copy nahi ho paya");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans pb-12">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold max-w-sm ${
            toast.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-red-500/15 border-red-500/30 text-red-400"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Images size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Image Manager</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Storage buckets · orphan check · download / delete
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right mr-1">
                <p className="text-[10px] text-slate-500 font-bold">
                  {totalFiles.toLocaleString()} images ·{" "}
                  <span className="text-amber-400">{totalOrphans} orphan</span>
                </p>
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2637] border border-[#2a3550] hover:bg-[#252f45] text-slate-400 rounded-lg text-xs font-bold transition"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-3 flex items-center flex-wrap gap-2">
          <button
            onClick={() => setActiveBucket("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeBucket === "all" ? "bg-blue-500/20 border border-blue-500/40 text-blue-400" : "bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-slate-300"}`}
          >
            All Buckets
          </button>
          {buckets.map((b) => (
            <button
              key={b.bucket}
              onClick={() => setActiveBucket(b.bucket)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeBucket === b.bucket ? "bg-blue-500/20 border border-blue-500/40 text-blue-400" : "bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-slate-300"}`}
            >
              {b.label} <span className="opacity-60">({b.total})</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {(["all", "referenced", "orphan"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition ${
                  statusFilter === st
                    ? st === "orphan"
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                      : "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                    : "bg-[#0d1117] border border-[#21293d] text-slate-500 hover:text-slate-300"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk bar */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400">
            {selected.size > 0 ? `${selected.size} selected` : "Select images"}
          </span>
          <button
            onClick={selectOrphans}
            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition"
          >
            Select All Orphans
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
            className="px-3 py-1.5 bg-[#0d1117] border border-[#21293d] text-slate-500 rounded-lg text-xs font-bold transition disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={() =>
              deleteFiles(
                [...selected].map((k) => {
                  const [b, ...rest] = k.split("/");
                  return { bucket: b, name: rest.join("/") };
                })
              )
            }
            disabled={selected.size === 0 || deleting}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition disabled:opacity-40"
          >
            <Trash2 size={12} /> {deleting ? "Deleting..." : `Delete Selected (${selected.size})`}
          </button>
        </div>

        {/* Error / Loading / Grid */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-6 text-red-400 text-sm font-bold text-center">
            {error}
          </div>
        ) : loading ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-10 flex items-center justify-center gap-3">
            <Loader2 size={18} className="animate-spin text-blue-400" />
            <span className="text-slate-400 text-sm font-bold">Images load ho rahi hain...</span>
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl px-5 py-10 text-center text-slate-500 text-sm font-bold">
            Koi image nahi mili — filter badal kar dekhein.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visibleFiles.map((f) => {
              const k = key(f.bucket, f.name);
              const checked = selected.has(k);
              const isCopied = copiedKey === k;
              return (
                <div
                  key={k}
                  className={`bg-[#161b27] border rounded-2xl overflow-hidden flex flex-col ${checked ? "border-blue-500/60" : f.referenced ? "border-[#21293d]" : "border-amber-500/40"}`}
                >
                  {/* Thumb */}
                  <div className="relative aspect-square bg-[#0d1117] flex items-center justify-center overflow-hidden">
                    {f.referenced ? null : (
                      <span className="absolute top-2 left-2 z-10 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-lg">
                        Orphan
                      </span>
                    )}
                    <Image
                      src={f.url}
                      alt={f.name}
                      fill
                      unoptimized
                      className="w-full h-full object-contain p-1 cursor-zoom-in"
                      sizes="200px"
                      onDoubleClick={() => openImageLightbox(f.url, f.name)}
                    />
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(k)}
                      className="absolute top-2 right-2 w-4 h-4 rounded accent-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <p className="text-[10px] font-mono text-slate-400 truncate" title={f.name}>
                      {f.name}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-bold ${f.referenced ? "text-emerald-400" : "text-amber-400"}`}
                      >
                        {f.referenced ? "✓ Connected" : "✗ Orphan"}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        {fmtSize(f.size)} · {fmtDate(f.created_at)}
                      </span>
                    </div>

                    {/* Kis client/product/job/user se connected hai */}
                    {f.refs.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {f.refs.slice(0, 2).map((r, i) =>
                          r.href ? (
                            <a
                              key={i}
                              href={r.href}
                              className="text-[9px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 px-1.5 py-0.5 rounded-md truncate max-w-full transition"
                            >
                              {r.label}
                            </a>
                          ) : (
                            <span
                              key={i}
                              className="text-[9px] font-bold bg-blue-500/10 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-md truncate max-w-full"
                            >
                              {r.label}
                            </span>
                          )
                        )}
                        {f.refs.length > 2 && (
                          <span className="text-[9px] text-slate-600 font-bold">
                            +{f.refs.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Link */}
                    <div className="flex items-center gap-1 bg-[#0d1117] border border-[#21293d] rounded-lg px-2 py-1">
                      <Link2 size={10} className="text-blue-500 flex-shrink-0" />
                      <span
                        className="text-[9px] font-mono text-blue-300 truncate flex-1"
                        title={f.url}
                      >
                        {f.url}
                      </span>
                      <button
                        onClick={() => copy(k, f.url)}
                        title="Copy link"
                        className="text-slate-500 hover:text-blue-400 transition flex-shrink-0"
                      >
                        {isCopied ? (
                          <Check size={11} className="text-emerald-400" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-bold transition"
                      >
                        <Download size={11} /> Download
                      </a>
                      <button
                        onClick={() => deleteFiles([{ bucket: f.bucket, name: f.name }])}
                        disabled={deleting}
                        className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold transition disabled:opacity-40"
                        title="Delete from storage"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
