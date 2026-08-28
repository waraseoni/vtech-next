"use client";

// ─── Spot QR Labels — har job-spot ka printable QR label ──────────────────
// QR me plain URL hota hai: <origin>/jobs?spot=<id>
// Print Sheet → preview modal with grid settings + live preview → popup window print.

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Printer,
  Loader2,
  Trash2,
  X,
  Eye,
  Settings,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Grid3X3,
} from "lucide-react";
import Image from "next/image";
import SpotJobsModal from "@/components/SpotJobsModal";

type Spot = { id: number; name: string };
type Orientation = "portrait" | "landscape";
type PaperSize = "a4" | "a5" | "letter";
type LabelMargin = "tight" | "normal" | "wide";

const PAPER_MM: Record<PaperSize, Record<Orientation, { w: number; h: number }>> = {
  a4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } },
  a5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 } },
  letter: { portrait: { w: 216, h: 279 }, landscape: { w: 279, h: 216 } },
};

const GAP_MM: Record<LabelMargin, number> = { tight: 4, normal: 8, wide: 12 };
const CARD_PAD_PCT: Record<LabelMargin, number> = { tight: 3, normal: 5, wide: 7 };

const PRESET_GRIDS: Array<{ cols: number; rows: number; label: string }> = [
  { cols: 3, rows: 3, label: "3×3" },
  { cols: 3, rows: 4, label: "3×4" },
  { cols: 3, rows: 5, label: "3×5" },
  { cols: 4, rows: 3, label: "4×3" },
  { cols: 4, rows: 4, label: "4×4" },
  { cols: 4, rows: 5, label: "4×5" },
  { cols: 5, rows: 3, label: "5×3" },
  { cols: 5, rows: 4, label: "5×4" },
  { cols: 5, rows: 5, label: "5×5" },
  { cols: 6, rows: 4, label: "6×4" },
  { cols: 6, rows: 5, label: "6×5" },
];

async function qrDataUrl(text: string, size = 220): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0d1117", light: "#ffffff" },
  });
}

async function fetchAllLinkedLocationIds(): Promise<Set<number>> {
  const linked = new Set<number>();
  let from = 0;
  for (;;) {
    const { data } = await supabase
      .from("transaction_list")
      .select("location_id")
      .not("location_id", "is", null)
      .range(from, from + 999);
    const rows = (data || []) as Array<{ location_id: number }>;
    rows.forEach((r) => linked.add(r.location_id));
    if (rows.length < 1000) break;
    from += 1000;
  }
  return linked;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function SpotLabelsPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<Record<number, number>>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [allLinkedIds, setAllLinkedIds] = useState<Set<number>>(new Set());
  const [jobsSpot, setJobsSpot] = useState<Spot | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [margin, setMargin] = useState<LabelMargin>("normal");
  const [gridCols, setGridCols] = useState(4);
  const [gridRows, setGridRows] = useState(3);
  const [zoom, setZoom] = useState(100);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const labelsPerPage = gridCols * gridRows;
  const totalPages = Math.ceil(spots.length / labelsPerPage) || 1;

  const loadSpotsAndRefs = async (): Promise<Spot[]> => {
    const { data } = await supabase
      .from("locations")
      .select("id, rack")
      .eq("kind", "job")
      .eq("zone", "")
      .order("rack");
    const list: Spot[] = (data || []).map((l) => ({ id: l.id, name: l.rack || "" }));
    setSpots(list);
    setAllLinkedIds(await fetchAllLinkedLocationIds());
    if (list.length > 0) {
      const { data: refData } = await supabase
        .from("transaction_list")
        .select("location_id")
        .in(
          "location_id",
          list.map((s) => s.id)
        )
        .eq("del_status", 0);
      const counts: Record<number, number> = {};
      ((refData || []) as Array<{ location_id: number }>).forEach((r) => {
        counts[r.location_id] = (counts[r.location_id] || 0) + 1;
      });
      setRefs(counts);
    }
    return list;
  };

  useEffect(() => {
    (async () => {
      const list = await loadSpotsAndRefs();
      const origin = window.location.origin;
      const entries = await Promise.all(
        list.map(async (s) => [s.id, await qrDataUrl(`${origin}/jobs?spot=${s.id}`)] as const)
      );
      setUrls(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const handleDeleteSpot = async (s: Spot) => {
    const used = refs[s.id] || 0;
    if (used > 0) {
      alert(`"${s.name}" par ${used} job(s) hain.`);
      return;
    }
    if (!confirm(`"${s.name}" delete karein?`)) return;
    setDeleting(s.id);
    const { data: anyRef } = await supabase
      .from("transaction_list")
      .select("id")
      .eq("location_id", s.id)
      .limit(1);
    if (anyRef && anyRef.length > 0) {
      alert(`"${s.name}" linked hai.`);
      setDeleting(null);
      return;
    }
    const { error } = await supabase.from("locations").delete().eq("id", s.id);
    if (error) alert("Delete failed: " + error.message);
    else {
      setSpots((prev) => prev.filter((x) => x.id !== s.id));
      setUrls((prev) => {
        const n = { ...prev };
        delete n[s.id];
        return n;
      });
      setRefs((prev) => {
        const n = { ...prev };
        delete n[s.id];
        return n;
      });
    }
    setDeleting(null);
  };

  const handleDeleteEmptySpots = async () => {
    setBulkDeleting(true);
    try {
      const freshSpots = await loadSpotsAndRefs();
      const usedIds = await fetchAllLinkedLocationIds();
      if (!freshSpots.length) {
        alert("Koi spot nahi.");
        return;
      }
      const emptyIds = freshSpots.filter((s) => !usedIds.has(s.id)).map((s) => s.id);
      if (emptyIds.length === 0) {
        alert("Sabhi busy hain.");
        return;
      }
      if (!confirm(`${emptyIds.length} khali spot(s) delete honge?`)) return;
      let deleted = 0;
      const deletedIds = new Set<number>();
      for (let i = 0; i < emptyIds.length; i += 200) {
        const chunk = emptyIds.slice(i, i + 200);
        const { error } = await supabase
          .from("locations")
          .delete()
          .eq("kind", "job")
          .eq("zone", "")
          .in("id", chunk);
        if (error) {
          alert(error.message);
          break;
        }
        chunk.forEach((id) => deletedIds.add(id));
        deleted += chunk.length;
      }
      if (deletedIds.size > 0) {
        setSpots((prev) => prev.filter((s) => !deletedIds.has(s.id)));
        setUrls((prev) =>
          Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id))))
        );
        setRefs((prev) =>
          Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id))))
        );
      }
      alert(`${deleted} spot(s) delete ho gaye.`);
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBulkDeleting(false);
    }
  };

  const emptyCount = spots.filter((s) => !allLinkedIds.has(s.id)).length;

  const previewPages = useMemo(() => {
    const pages: Spot[][] = [];
    for (let i = 0; i < spots.length; i += labelsPerPage) {
      pages.push(spots.slice(i, i + labelsPerPage));
    }
    return pages.length ? pages : [[]];
  }, [spots, labelsPerPage]);

  const zoomIn = () => setZoom((z) => Math.min(z + 15, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 15, 40));
  const zoomFit = () => setZoom(100);

  // ── POPUP PRINT ─────────────────────────────────────────────────────────
  const handlePopupPrint = useCallback(() => {
    if (spots.length === 0) return;
    const padPct = CARD_PAD_PCT[margin];
    const gapCss = `${GAP_MM[margin]}mm`;
    const paper = PAPER_MM[paperSize][orientation];
    const padCss = `${padPct}%`;

    const pagesHtml = previewPages
      .map((pageSpots) => {
        const cards = pageSpots
          .map((s) => {
            const qrSrc = urls[s.id] || "";
            return `<div class="card">
  <p class="spot-name">${s.name}</p>
  <p class="brand">V-TECH · Job Spot</p>
  ${qrSrc ? `<img src="${qrSrc}" alt="QR" class="qr-img" />` : `<div class="qr-placeholder"></div>`}
  <p class="scan-text">Scan → Jobs @ ${s.name}</p>
</div>`;
          })
          .join("");
        const remain = labelsPerPage - pageSpots.length;
        const emptyCells =
          remain > 0
            ? Array.from({ length: remain }, () => `<div class="card card--empty"></div>`).join("")
            : "";
        return `<div class="page">${cards}${emptyCells}</div>`;
      })
      .join("");

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Spot QR Labels</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:${paper.w}mm ${paper.h}mm;margin:5mm}
html,body{width:100%;height:100%}
.page{
  display:grid;grid-template-columns:repeat(${gridCols},1fr);grid-template-rows:repeat(${gridRows},1fr);
  gap:${gapCss};page-break-after:always;width:100%;height:100vh;
}
.page:last-child{page-break-after:auto}
.card{
  background:#fff;border:1.5px solid #d1d5db;border-radius:8px;
  display:flex;flex-direction:column;align-items:center;text-align:center;
  justify-content:center;
  padding:${padCss};overflow:hidden;
  page-break-inside:avoid;break-inside:avoid;
}
.card--empty{border:1px dashed #e5e7eb;background:#fafafa}
.spot-name{
  font-weight:900;color:#0d1117;font-size:clamp(7px,2.5vw,14px);line-height:1.2;
  width:100%;overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;
}
.brand{font-size:clamp(5px,1.5vw,9px);font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.12em;margin:2% 0 4%}
.qr-img{width:60%;max-width:150px;height:auto;display:block;margin:0 auto}
.qr-placeholder{width:60%;max-width:150px;aspect-ratio:1;background:#f1f5f9;border-radius:8px;margin:0 auto}
.scan-text{font-size:clamp(5px,1.5vw,9px);color:#94a3b8;margin-top:auto;word-break:break-all;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
@media print{body{margin:0;padding:0}.card{box-shadow:none}}
</style></head><body>${pagesHtml}</body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(fullHtml);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
    } else {
      alert("Popup blocked — browser me popups allow karo.");
    }
  }, [
    spots,
    urls,
    paperSize,
    orientation,
    margin,
    gridCols,
    gridRows,
    labelsPerPage,
    previewPages,
  ]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    if (!previewOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        handlePopupPrint();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewOpen, handlePopupPrint]);

  const SettingBtn = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
        active
          ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
          : "bg-transparent border-[#21293d] text-slate-500 hover:text-slate-300 hover:border-slate-500"
      }`}
    >
      {children}
    </button>
  );

  // ── Preview card — all % based, scales with card size ──────────────────
  const PreviewCard = ({ spot }: { spot: Spot }) => {
    const padPct = CARD_PAD_PCT[margin];
    return (
      <div
        className="bg-white flex flex-col items-center text-center overflow-hidden"
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 8,
          padding: `${padPct}%`,
          justifyContent: "center",
        }}
      >
        <p
          style={{
            fontWeight: 900,
            color: "#0d1117",
            fontSize: "clamp(7px, 2.5vw, 14px)",
            lineHeight: 1.2,
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {spot.name}
        </p>
        <p
          style={{
            fontSize: "clamp(5px, 1.5vw, 9px)",
            fontWeight: 700,
            color: "#64748b",
            textTransform: "uppercase" as const,
            letterSpacing: "0.12em",
            margin: "2% 0 4%",
          }}
        >
          V-TECH · Job Spot
        </p>
        {urls[spot.id] ? (
          <Image
            src={urls[spot.id]}
            alt={`QR ${spot.name}`}
            width={150}
            height={150}
            style={{
              width: "60%",
              maxWidth: 150,
              height: "auto",
              display: "block",
              margin: "0 auto",
            }}
          />
        ) : (
          <div
            style={{
              width: "60%",
              maxWidth: 150,
              aspectRatio: "1",
              background: "#f1f5f9",
              borderRadius: 8,
              margin: "0 auto",
            }}
          />
        )}
        <p
          style={{
            fontSize: "clamp(5px, 1.5vw, 9px)",
            color: "#94a3b8",
            marginTop: "auto",
            wordBreak: "break-all",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          Scan → Jobs @ {spot.name}
        </p>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="sticky top-0 z-10 bg-[#161b27] border-b border-[#21293d] px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/jobs"
            className="bg-[#21293d] hover:bg-[#2a3550] text-slate-300 rounded-lg p-2 transition-colors no-underline"
          >
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-sm font-black text-white">Spot QR Labels</h1>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
            {spots.length} spots
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!loading && emptyCount > 0 && (
            <button
              onClick={handleDeleteEmptySpots}
              disabled={bulkDeleting}
              className="border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 bg-red-600/90 hover:bg-red-600 !text-white"
            >
              {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}{" "}
              Khali Delete ({emptyCount})
            </button>
          )}
          <button
            onClick={() => setPreviewOpen(true)}
            disabled={loading || spots.length === 0}
            className="!text-white border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 bg-blue-600"
          >
            <Printer size={13} /> Print Sheet
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="animate-spin text-blue-500" size={36} />
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
            QR bana rahe hain…
          </p>
        </div>
      ) : spots.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-24">
          Koi spot nahi — pehle jobs form me &quot;+&quot; se spots banao.
        </p>
      ) : (
        <div className="p-6 max-w-5xl mx-auto">
          {/^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(
            window.location.origin
          ) && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-[11px] font-bold text-amber-400">
              Warning: ye labels abhi <code>{window.location.origin}</code> ka QR banate hain.
              Production website par kholo.
            </div>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(gridCols, 6)}, 1fr)` }}
          >
            {spots.map((s) => {
              const used = refs[s.id] || 0;
              return (
                <div
                  key={s.id}
                  onClick={() => setJobsSpot(s)}
                  className="relative bg-white rounded-xl p-4 flex flex-col items-center text-center border border-slate-200 shadow-sm break-inside-avoid cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    {used > 0 && (
                      <span className="text-[9px] font-black text-white bg-amber-500 rounded-full px-1.5 py-0.5">
                        {used}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSpot(s);
                      }}
                      disabled={deleting === s.id}
                      className={`p-1 rounded-md transition-colors ${used > 0 ? "text-slate-300 cursor-not-allowed" : "text-red-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"}`}
                    >
                      {deleting === s.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                  <p className="font-black text-[#0d1117] text-sm leading-tight break-words w-full line-clamp-2">
                    {s.name}
                  </p>
                  <p
                    className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 mb-2 ${used > 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    {used > 0 ? `${used} item(s) · busy` : "khali"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    V-TECH · Job Spot
                  </p>
                  {urls[s.id] ? (
                    <Image
                      src={urls[s.id]}
                      alt={`QR ${s.name}`}
                      width={200}
                      height={200}
                      className="mx-auto w-full h-auto"
                    />
                  ) : (
                    <div className="mx-auto w-full aspect-square bg-slate-100 animate-pulse rounded" />
                  )}
                  <p className="text-[9px] text-slate-400 mt-2 break-all leading-tight">
                    Scan → Jobs @ {s.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SpotJobsModal spot={jobsSpot} onClose={() => setJobsSpot(null)} />

      {previewOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d1117]">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b27] border-b border-[#21293d] flex-shrink-0">
            <div className="flex items-center gap-3">
              <Eye size={16} className="text-blue-400" />
              <h2 className="text-sm font-black text-white">Print Preview</h2>
              <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">
                {spots.length} labels · {totalPages} page{totalPages > 1 ? "s" : ""} · {gridCols}×
                {gridRows} · {labelsPerPage}/page
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-[#111520] border border-[#21293d] rounded-lg px-1 py-0.5">
                <button
                  onClick={zoomOut}
                  className="p-1 text-slate-500 hover:text-white transition-colors rounded"
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={zoomFit}
                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white transition-colors tabular-nums min-w-[40px] text-center"
                >
                  {zoom}%
                </button>
                <button
                  onClick={zoomIn}
                  className="p-1 text-slate-500 hover:text-white transition-colors rounded"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
              <div className="w-px h-5 bg-[#21293d] mx-1" />
              <button
                onClick={handlePopupPrint}
                className="!text-white border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 flex items-center gap-1.5 bg-blue-600"
              >
                <Printer size={13} /> Print
              </button>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* ── SETTINGS SIDEBAR ── */}
            <div className="w-56 flex-shrink-0 bg-[#111520] border-r border-[#21293d] overflow-y-auto p-3 space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <Settings size={13} /> Settings
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Paper
                </label>
                <div className="flex gap-1">
                  {(["a4", "a5", "letter"] as PaperSize[]).map((ps) => (
                    <SettingBtn key={ps} active={paperSize === ps} onClick={() => setPaperSize(ps)}>
                      {ps === "letter" ? "Ltr" : ps.toUpperCase()}
                    </SettingBtn>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Layout
                </label>
                <div className="flex gap-1">
                  {(["portrait", "landscape"] as Orientation[]).map((o) => (
                    <SettingBtn
                      key={o}
                      active={orientation === o}
                      onClick={() => setOrientation(o)}
                    >
                      <RotateCw
                        size={10}
                        className={`inline mr-1 ${o === "landscape" ? "" : "-rotate-90"}`}
                      />
                      {o}
                    </SettingBtn>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Grid3X3 size={11} /> Grid (Cols × Rows)
                </label>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {PRESET_GRIDS.map((g) => (
                    <button
                      key={g.label}
                      onClick={() => {
                        setGridCols(g.cols);
                        setGridRows(g.rows);
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        gridCols === g.cols && gridRows === g.rows
                          ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                          : "bg-transparent border-[#21293d] text-slate-500 hover:text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 items-center">
                  <div className="flex-1">
                    <label className="text-[9px] text-slate-600 block mb-0.5">Cols</label>
                    <div className="flex gap-0.5">
                      {[2, 3, 4, 5, 6].map((c) => (
                        <button
                          key={c}
                          onClick={() => setGridCols(c)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                            gridCols === c
                              ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                              : "bg-transparent border-[#21293d] text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="text-slate-600 font-bold mt-4">×</span>
                  <div className="flex-1">
                    <label className="text-[9px] text-slate-600 block mb-0.5">Rows</label>
                    <div className="flex gap-0.5">
                      {[2, 3, 4, 5, 6].map((r) => (
                        <button
                          key={r}
                          onClick={() => setGridRows(r)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                            gridRows === r
                              ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                              : "bg-transparent border-[#21293d] text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                  Gap
                </label>
                <div className="flex gap-1">
                  {(["tight", "normal", "wide"] as LabelMargin[]).map((g) => (
                    <SettingBtn key={g} active={margin === g} onClick={() => setMargin(g)}>
                      {g}
                    </SettingBtn>
                  ))}
                </div>
              </div>

              <div className="h-px bg-[#21293d]" />

              <div className="rounded-xl bg-[#161b27] border border-[#21293d] p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Paper</span>
                  <span className="text-white font-bold">
                    {paperSize.toUpperCase()} {orientation}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Grid</span>
                  <span className="text-blue-400 font-black">
                    {gridCols} × {gridRows}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Per Page</span>
                  <span className="text-white font-bold">{labelsPerPage}</span>
                </div>
                <div className="h-px bg-[#21293d]" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Pages</span>
                  <span className="text-blue-400 font-black text-sm">{totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Labels</span>
                  <span className="text-white font-bold">{spots.length}</span>
                </div>
              </div>

              <p className="text-[9px] text-slate-600 leading-relaxed">
                Ctrl+P se print. Escape se close.
              </p>
            </div>

            {/* ── PREVIEW AREA ── */}
            <div ref={previewScrollRef} className="flex-1 overflow-auto bg-[#080c14] p-6">
              <div
                className="space-y-10"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              >
                {previewPages.map((pageSpots, pi) => {
                  const pg = PAPER_MM[paperSize][orientation];
                  const availW = 780;
                  const scale = availW / pg.w;
                  const previewW = pg.w * scale;
                  const previewH = pg.h * scale;
                  const pad = 5 * scale;
                  const gapPx = GAP_MM[margin] * scale;

                  return (
                    <div key={pi} className="flex flex-col items-center">
                      <div className="flex items-center gap-3 mb-3">
                        {pi > 0 && (
                          <button
                            onClick={() => {
                              const el = previewScrollRef.current;
                              if (!el) return;
                              el.querySelector(`[data-page="${pi - 1}"]`)?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }}
                            className="text-slate-600 hover:text-white transition-colors p-1 rounded"
                          >
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider tabular-nums">
                          Page {pi + 1} / {totalPages}
                        </span>
                        {pi < totalPages - 1 && (
                          <button
                            onClick={() => {
                              const el = previewScrollRef.current;
                              if (!el) return;
                              el.querySelector(`[data-page="${pi + 1}"]`)?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            }}
                            className="text-slate-600 hover:text-white transition-colors p-1 rounded"
                          >
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>

                      <div
                        data-page={pi}
                        className="bg-white rounded-lg shadow-2xl overflow-hidden"
                        style={{ width: previewW, height: previewH, padding: pad }}
                      >
                        <div
                          className="w-full h-full"
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                            gap: gapPx,
                          }}
                        >
                          {pageSpots.map((s) => (
                            <PreviewCard key={s.id} spot={s} />
                          ))}
                          {Array.from({
                            length: Math.max(0, labelsPerPage - pageSpots.length),
                          }).map((_, ei) => (
                            <div
                              key={`empty-${ei}`}
                              className="rounded-lg"
                              style={{ border: "1px dashed #e5e7eb" }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
