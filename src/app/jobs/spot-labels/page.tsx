"use client";

// ─── Spot QR Labels — har job-spot ka printable QR label ──────────────────
// QR me plain URL hota hai: <origin>/jobs?spot=<id>
// Koi bhi phone camera scan karega → browser me us spot ke live items khulenge.
// Print: popup window with clean HTML — no sidebar, no theme, no glass.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Printer, Loader2, Trash2, RotateCw } from "lucide-react";
import Image from "next/image";
import SpotJobsModal from "@/components/SpotJobsModal";

type Spot = { id: number; name: string };
type Orientation = "portrait" | "landscape";
type PaperSize = "a4" | "a5" | "letter";
type QRSize = "small" | "medium" | "large";
type LabelMargin = "tight" | "normal" | "wide";

const PAPER_CSS: Record<PaperSize, Record<Orientation, string>> = {
  a4:    { portrait: "@page{size:210mm 297mm;margin:5mm}", landscape: "@page{size:297mm 210mm;margin:5mm}" },
  a5:    { portrait: "@page{size:148mm 210mm;margin:5mm}", landscape: "@page{size:210mm 148mm;margin:5mm}" },
  letter:{ portrait: "@page{size:216mm 279mm;margin:5mm}", landscape: "@page{size:279mm 216mm;margin:5mm}" },
};

const QR_SIZES: Record<QRSize, { label: string; maxW: number; cols: string }> = {
  small:  { label: "Small",  maxW: 80,  cols: "grid-template-columns:repeat(5,1fr)" },
  medium: { label: "Medium", maxW: 130, cols: "grid-template-columns:repeat(4,1fr)" },
  large:  { label: "Large",  maxW: 190, cols: "grid-template-columns:repeat(3,1fr)" },
};

const MARGINS: Record<LabelMargin, { label: string; cardPadding: string; gridGap: string }> = {
  tight:  { label: "Tight",  cardPadding: "10px 8px",  gridGap: "8px" },
  normal: { label: "Normal", cardPadding: "16px 12px", gridGap: "16px" },
  wide:   { label: "Wide",   cardPadding: "20px 16px", gridGap: "24px" },
};

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
    rows.forEach(r => linked.add(r.location_id));
    if (rows.length < 1000) break;
    from += 1000;
  }
  return linked;
}

export default function SpotLabelsPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<Record<number, number>>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [allLinkedIds, setAllLinkedIds] = useState<Set<number>>(new Set());
  const [jobsSpot, setJobsSpot] = useState<Spot | null>(null);
  const [printBusy, setPrintBusy] = useState(false);

  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [paperSize,   setPaperSize]   = useState<PaperSize>("a4");
  const [qrSize,      setQrSize]      = useState<QRSize>("medium");
  const [margin,       setMargin]       = useState<LabelMargin>("normal");

  const loadSpotsAndRefs = async (): Promise<Spot[]> => {
    const { data } = await supabase
      .from("locations")
      .select("id, rack")
      .eq("kind", "job")
      .eq("zone", "")
      .order("rack");
    const list: Spot[] = (data || []).map(l => ({ id: l.id, name: l.rack || "" }));
    setSpots(list);
    setAllLinkedIds(await fetchAllLinkedLocationIds());

    if (list.length > 0) {
      const { data: refData } = await supabase
        .from("transaction_list")
        .select("location_id")
        .in("location_id", list.map(s => s.id))
        .eq("del_status", 0);
      const counts: Record<number, number> = {};
      ((refData || []) as Array<{ location_id: number }>).forEach(r => {
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
        list.map(async s => [s.id, await qrDataUrl(`${origin}/jobs?spot=${s.id}`)] as const)
      );
      setUrls(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  const handleDeleteSpot = async (s: Spot) => {
    const used = refs[s.id] || 0;
    if (used > 0) {
      alert(`"${s.name}" par abhi ${used} job(s) pade hain.\nPehle unhe Move karo, ya deliver karke jobs page ka "Spot Clean" chalao.`);
      return;
    }
    if (!confirm(`"${s.name}" spot ko delete karein?`)) return;
    setDeleting(s.id);
    const { data: anyRef } = await supabase
      .from("transaction_list")
      .select("id")
      .eq("location_id", s.id)
      .limit(1);
    if (anyRef && anyRef.length > 0) {
      alert(`"${s.name}" abhi bhi purani records se linked hai.`);
      setDeleting(null);
      return;
    }
    const { error } = await supabase.from("locations").delete().eq("id", s.id);
    if (error) {
      alert("Delete failed: " + error.message);
    } else {
      setSpots(prev => prev.filter(x => x.id !== s.id));
      setUrls(prev => { const n = { ...prev }; delete n[s.id]; return n; });
      setRefs(prev => { const n = { ...prev }; delete n[s.id]; return n; });
    }
    setDeleting(null);
  };

  const handleDeleteEmptySpots = async () => {
    setBulkDeleting(true);
    try {
      const freshSpots = await loadSpotsAndRefs();
      const usedIds = await fetchAllLinkedLocationIds();
      if (!freshSpots.length) { alert("Koi job-spot hi nahi hai."); return; }
      const emptyIds = freshSpots.filter(s => !usedIds.has(s.id)).map(s => s.id);
      if (emptyIds.length === 0) { alert("Sabhi spots busy hain."); return; }
      if (!confirm(`${emptyIds.length} khali spot(s) delete honge.\nContinue?`)) return;
      const CHUNK = 200;
      let deleted = 0;
      let failMsg = "";
      const deletedIds = new Set<number>();
      for (let i = 0; i < emptyIds.length; i += CHUNK) {
        const chunk = emptyIds.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("locations").delete().eq("kind", "job").eq("zone", "").in("id", chunk);
        if (error) { failMsg = error.message; break; }
        chunk.forEach(id => deletedIds.add(id));
        deleted += chunk.length;
      }
      if (deletedIds.size > 0) {
        setSpots(prev => prev.filter(s => !deletedIds.has(s.id)));
        setUrls(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id)))));
        setRefs(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id)))));
      }
      alert(failMsg ? `${deleted} spot(s) delete hue, error: ${failMsg}` : `${deleted} khali spot(s) delete ho gaye.`);
    } catch (err) {
      alert("Bulk delete failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBulkDeleting(false);
    }
  };

  const emptyCount = spots.filter(s => !allLinkedIds.has(s.id)).length;

  // ── PRINT: Popup window with clean HTML — zero theme/sidebar/glass ──────
  const handlePrint = useCallback(() => {
    if (loading || spots.length === 0) return;
    setPrintBusy(true);

    const qr = QR_SIZES[qrSize];
    const mg = MARGINS[margin];

    const cardsHtml = spots.map(s => {
      const qrSrc = urls[s.id] || "";
      return `
        <div class="card">
          <p class="spot-name">${s.name}</p>
          <p class="brand">V-TECH · Job Spot</p>
          ${qrSrc ? `<img src="${qrSrc}" alt="QR ${s.name}" style="max-width:${qr.maxW}px;width:100%;height:auto;display:block;margin:0 auto;" />` : ""}
          <p class="scan-text">Scan → Jobs @ ${s.name}</p>
        </div>`;
    }).join("\n");

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Spot QR Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
  ${PAPER_CSS[paperSize][orientation]}
  .grid {
    display: grid;
    ${qr.cols}
    gap: ${mg.gridGap};
    padding: 0;
    width: 100%;
  }
  .card {
    background: #fff;
    border: 1.5px solid #ccc;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: ${mg.cardPadding};
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .spot-name {
    font-weight: 900;
    color: #0d1117;
    font-size: 14px;
    line-height: 1.2;
    word-break: break-word;
    width: 100%;
  }
  .brand {
    font-size: 9px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-top: 4px;
    margin-bottom: 8px;
  }
  .scan-text {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 6px;
    word-break: break-all;
    line-height: 1.3;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .card { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="grid">${cardsHtml}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(fullHtml);
      win.document.close();
      win.focus();
      // QR images load hone ka wait
      setTimeout(() => { win.print(); setPrintBusy(false); }, 800);
    } else {
      setPrintBusy(false);
      alert("Popup blocked — browser me popups allow karo.");
    }
  }, [loading, spots, urls, paperSize, orientation, qrSize, margin]);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Screen-only toolbar */}
      <div className="sticky top-0 z-10 bg-[#161b27] border-b border-[#21293d] px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/jobs"
            className="bg-[#21293d] hover:bg-[#2a3550] text-slate-300 rounded-lg p-2 transition-colors no-underline">
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
              {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Khali Delete ({emptyCount})
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={loading || printBusy}
            className="!text-white border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 bg-blue-600"
          >
            {printBusy ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print Sheet
          </button>
        </div>
      </div>

      {/* Print settings bar */}
      {!loading && spots.length > 0 && (
        <div className="bg-[#111520] border-b border-[#21293d] px-4 py-2.5 flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Paper</span>
            {(["a4", "a5", "letter"] as PaperSize[]).map(ps => (
              <button key={ps} onClick={() => setPaperSize(ps)}
                className={`px-2.5 py-1 rounded-md font-bold uppercase transition-all border ${
                  paperSize === ps
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                {ps === "letter" ? "Letter" : ps.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Layout</span>
            {(["portrait", "landscape"] as Orientation[]).map(o => (
              <button key={o} onClick={() => setOrientation(o)}
                className={`px-2.5 py-1 rounded-md font-bold capitalize transition-all border ${
                  orientation === o
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                <RotateCw size={11} className={`inline mr-1 ${o === "landscape" ? "" : "-rotate-90"}`} />
                {o}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider">QR</span>
            {(["small", "medium", "large"] as QRSize[]).map(q => (
              <button key={q} onClick={() => setQrSize(q)}
                className={`px-2.5 py-1 rounded-md font-bold capitalize transition-all border ${
                  qrSize === q
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                {QR_SIZES[q].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Gap</span>
            {(["tight", "normal", "wide"] as LabelMargin[]).map(m => (
              <button key={m} onClick={() => setMargin(m)}
                className={`px-2.5 py-1 rounded-md font-bold capitalize transition-all border ${
                  margin === m
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                    : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                {MARGINS[m].label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-slate-600 font-bold">
            {spots.length} label{spots.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="animate-spin text-blue-500" size={36} />
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">QR bana rahe hain…</p>
        </div>
      ) : spots.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-24">
          Koi spot nahi — pehle jobs form me &quot;+&quot; se spots banao.
        </p>
      ) : (
        <div className="p-6 max-w-5xl mx-auto">
          {/^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(window.location.origin) && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-[11px] font-bold text-amber-400">
              Warning: ye labels abhi <code>{window.location.origin}</code> ka QR banate hain — phone se scan karne par
              ye address khulega. Asli labels print karne se pehle production website par yahi page kholo.
            </div>
          )}
          <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: `repeat(${qrSize === "small" ? 5 : qrSize === "medium" ? 4 : 3}, 1fr)` }}>
            {spots.map(s => {
              const used = refs[s.id] || 0;
              return (
                <div key={s.id} onClick={() => setJobsSpot(s)}
                  title="Click karke is spot par rakhe jobs dekho"
                  className="relative bg-white rounded-xl p-4 flex flex-col items-center text-center border border-slate-200 shadow-sm break-inside-avoid cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    {used > 0 && (
                      <span className="text-[9px] font-black text-white bg-amber-500 rounded-full px-1.5 py-0.5">
                        {used}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSpot(s); }}
                      disabled={deleting === s.id}
                      title={used > 0 ? `${used} job(s) pade hain` : `"${s.name}" delete karo`}
                      className={`p-1 rounded-md transition-colors ${used > 0
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-red-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"}`}
                    >
                      {deleting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                  <p className="font-black text-[#0d1117] text-sm leading-tight break-words w-full">{s.name}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 mb-2 ${used > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {used > 0 ? `${used} item(s) · busy` : "khali"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">V-TECH · Job Spot</p>
                  {urls[s.id]
                    ? <Image src={urls[s.id]} alt={`QR ${s.name}`} width={200} height={200} className="mx-auto w-full h-auto" style={{ maxWidth: QR_SIZES[qrSize].maxW }} unoptimized />
                    : <div className="mx-auto w-full aspect-square bg-slate-100 animate-pulse rounded" style={{ maxWidth: QR_SIZES[qrSize].maxW }} />}
                  <p className="text-[9px] text-slate-400 mt-2 break-all leading-tight">Scan → Jobs @ {s.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SpotJobsModal spot={jobsSpot} onClose={() => setJobsSpot(null)} />
    </div>
  );
}
