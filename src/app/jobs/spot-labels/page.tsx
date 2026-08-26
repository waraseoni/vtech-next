"use client";

// ─── Spot QR Labels — har job-spot ka printable QR label ──────────────────
// QR me plain URL hota hai: <origin>/jobs?search=<spot naam>
// Koi bhi phone camera scan karega → browser me us spot ke live items khulenge.
// Print: window.print() — @media print CSS sirf labels dikhata hai.

import { useEffect, useState } from "react";
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

const PAPER_CONFIG: Record<PaperSize, Record<Orientation, { pageW: string; pageH: string }>> = {
  a4:    { portrait: { pageW: "210mm", pageH: "297mm" }, landscape: { pageW: "297mm", pageH: "210mm" } },
  a5:    { portrait: { pageW: "148mm", pageH: "210mm" }, landscape: { pageW: "210mm", pageH: "148mm" } },
  letter:{ portrait: { pageW: "216mm", pageH: "279mm" }, landscape: { pageW: "279mm", pageH: "216mm" } },
};

const QR_SIZES: Record<QRSize, { label: string; img: string; cols: string }> = {
  small:  { label: "Small",  img: "max-w-[80px]",  cols: "grid-cols-4 lg:grid-cols-5" },
  medium: { label: "Medium", img: "max-w-[130px]", cols: "grid-cols-3 lg:grid-cols-4" },
  large:  { label: "Large",  img: "max-w-[190px]", cols: "grid-cols-2 lg:grid-cols-3" },
};

const MARGINS: Record<LabelMargin, { label: string; card: string; grid: string }> = {
  tight:  { label: "Tight",  card: "p-2.5 gap-1.5", grid: "gap-2" },
  normal: { label: "Normal", card: "p-4 gap-2",     grid: "gap-4" },
  wide:   { label: "Wide",   card: "p-5 gap-3",     grid: "gap-6" },
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

// HAR transaction reference (koi bhi status/del_status) — spot "khali" tabhi hai
// jab iska koi link na ho; warna locations.delete() par FK violation aayega.
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
  // Har spot par kitne live jobs pade hain (delete permission isi se decide hota hai)
  const [refs, setRefs] = useState<Record<number, number>>({});
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Jin spots ka KOI bhi transaction link hai (live ya purana) — inhe delete nahi kiya ja sakta
  const [allLinkedIds, setAllLinkedIds] = useState<Set<number>>(new Set());
  // Spot card click → us spot ke linked jobs ka modal (shared component)
  const [jobsSpot, setJobsSpot] = useState<Spot | null>(null);
  // Print settings
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [paperSize,   setPaperSize]   = useState<PaperSize>("a4");
  const [qrSize,      setQrSize]      = useState<QRSize>("medium");
  const [margin,       setMargin]       = useState<LabelMargin>("normal");

  // Spots + live occupancy + saare references — ek jagah, taaki UI aur bulk-delete
  // dono same data par chalein
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
      // QR me exact spot param — /jobs?spot=<id> location_id par filter karta hai
      // (search=<naam> fuzzy hai, "A3" "A30" ko bhi pakad leta)
      const entries = await Promise.all(
        list.map(async s => [s.id, await qrDataUrl(`${origin}/jobs?spot=${s.id}`)] as const)
      );
      setUrls(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  // Spot delete — sirf tab jab us par koi live job na ho
  const handleDeleteSpot = async (s: Spot) => {
    const used = refs[s.id] || 0;
    if (used > 0) {
      alert(`"${s.name}" par abhi ${used} job(s) pade hain.\nPehle unhe Move karo, ya deliver karke jobs page ka "Spot Clean" chalao.`);
      return;
    }
    if (!confirm(`"${s.name}" spot ko delete karein?\n\nNote: pehle se print kiye hue QR labels ab scan karne par kuch nahi dikhayenge.`)) return;
    setDeleting(s.id);
    // Live-check ke baad bhi purane delivered/cancelled jobs spot se linked rah
    // sakte hain — unka reference hone par FK violation hota hai, isliye server
    // se confirm karo ki spot ka KOI bhi link nahi bacha.
    const { data: anyRef } = await supabase
      .from("transaction_list")
      .select("id")
      .eq("location_id", s.id)
      .limit(1);
    if (anyRef && anyRef.length > 0) {
      alert(`"${s.name}" abhi bhi purani records se linked hai (delivered/purane jobs).\nPehle jobs page ka "Spot Clean" chalao, phir delete karo.`);
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

  // Bulk cleanup — jo spots par KOI bhi transaction link nahi (live ya purana),
  // sab ek saath delete. Delete se pehle FRESH DB re-check hota hai taaki stale
  // UI galat spot na delete kare (kisi ne abhi-abhi job rakha ho to wo safe rahega).
  const handleDeleteEmptySpots = async () => {
    setBulkDeleting(true);
    try {
      // Step 1+2: fresh spots + HAR reference (koi bhi status/del_status) — warna FK violation
      const freshSpots = await loadSpotsAndRefs();
      const usedIds = await fetchAllLinkedLocationIds();
      if (!freshSpots.length) { alert("Koi job-spot hi nahi hai."); return; }

      const emptyIds = freshSpots.filter(s => !usedIds.has(s.id)).map(s => s.id);
      if (emptyIds.length === 0) {
        alert("Sabhi spots busy hain — delete karne ko kuch khali nahi hai.");
        return;
      }
      if (!confirm(
        `${emptyIds.length} khali spot(s) delete honge — ${freshSpots.length - emptyIds.length} busy wale rahenge.\n\n` +
        `Dhyan do: pehle print hue in spots ke QR labels ab scan par kuch nahi dikhayenge.\n\nContinue?`
      )) return;

      // Step 3: chunks me delete (URL length safe)
      const CHUNK = 200;
      let deleted = 0;
      let failMsg = "";
      const deletedIds = new Set<number>();
      for (let i = 0; i < emptyIds.length; i += CHUNK) {
        const chunk = emptyIds.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("locations")
          .delete()
          .eq("kind", "job")
          .eq("zone", "")
          .in("id", chunk);
        if (error) { failMsg = error.message; break; }
        chunk.forEach(id => deletedIds.add(id));
        deleted += chunk.length;
      }

      // Step 4: UI sync — jo successfully delete hue wahi hatado
      if (deletedIds.size > 0) {
        setSpots(prev => prev.filter(s => !deletedIds.has(s.id)));
        setUrls(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id)))));
        setRefs(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !deletedIds.has(Number(id)))));
      }

      alert(
        failMsg
          ? `${deleted} spot(s) delete hue, phir error aaya: ${failMsg}`
          : `${deleted} khali spot(s) delete ho gaye.`
      );
    } catch (err) {
      console.error("handleDeleteEmptySpots error:", err);
      alert("Bulk delete failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBulkDeleting(false);
    }
  };

  // Khali = jiska KOI bhi transaction link nahi — isi se bulk-delete button ka
  // dikhna/hatna decide hota hai
  const emptyCount = spots.filter(s => !allLinkedIds.has(s.id)).length;

  return (
    <div className="min-h-screen bg-[#0d1117] print-area-wrapper">
      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-10 bg-[#161b27] border-b border-[#21293d] px-4 py-3 flex items-center justify-between gap-2">
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
              title={`${emptyCount} spot(s) bilkul khali hain — sab ek saath delete karo`}
              className="border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 bg-red-600/90 hover:bg-red-600 !text-white"
            >
              {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Khali Delete ({emptyCount})
            </button>
          )}
          <button
            onClick={() => window.print()}
            disabled={loading}
            className="!text-white border-none rounded-lg px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 bg-blue-600"
          >
            <Printer size={13} /> Print Sheet
          </button>
        </div>
      </div>

      {/* Print settings bar — screen only */}
      {!loading && spots.length > 0 && (
        <div className="no-print bg-[#111520] border-b border-[#21293d] px-4 py-2.5 flex flex-wrap items-center gap-4 text-[11px]">
          {/* Paper */}
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

          {/* Orientation */}
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

          {/* QR Size */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase tracking-wider">QR</span>
            {(["small", "medium", "large"] as QRSize[]).map(q => (
              <button key={q} onClick={() => setQrSize(q)}
                className={`px-2.5 py-1 rounded-md font-bold capitalize transition-all border ${
                  qrSize === q
                    ? "bg-blue-600/20 border-blue-500/40 text-blue-40"
                    : "bg-transparent border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                {QR_SIZES[q].label}
              </button>
            ))}
          </div>

          {/* Margin */}
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

          {/* Preview label count */}
          <span className="ml-auto text-slate-600 font-bold">
            {spots.length} label{spots.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {loading ? (
        <div className="no-print flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="animate-spin text-blue-500" size={36} />
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">QR bana rahe hain…</p>
        </div>
      ) : spots.length === 0 ? (
        <p className="no-print text-center text-slate-600 text-sm py-24">
          Koi spot nahi — pehle jobs form me &quot;+&quot; se spots banao.
        </p>
      ) : (
        /* Labels grid — print me yahi dikhega */
        <div className={`p-6 max-w-5xl mx-auto print-area-labels ${MARGINS[margin].grid}`}>
          {/^https?:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(window.location.origin) && (
            <div className="no-print mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-[11px] font-bold text-amber-400">
              Warning: ye labels abhi <code>{window.location.origin}</code> ka QR banate hain — phone se scan karne par
              ye address khulega. Asli labels print karne se pehle production website par yahi page kholo.
            </div>
          )}
          <div className={`grid grid-cols-2 md:${QR_SIZES[qrSize].cols} ${MARGINS[margin].grid}`}>
            {spots.map(s => {
              const used = refs[s.id] || 0;
              return (
                <div key={s.id} onClick={() => setJobsSpot(s)}
                  title="Click karke is spot par rakhe jobs dekho"
                  className={`relative bg-white rounded-xl flex flex-col items-center text-center border border-slate-200 shadow-sm break-inside-avoid cursor-pointer hover:border-blue-500 hover:shadow-md transition-all ${MARGINS[margin].card}`}>
                  {/* Screen-only controls — print me nahi aate */}
                  <div className="no-print absolute top-1.5 right-1.5 flex items-center gap-1">
                    {used > 0 && (
                      <span className="text-[9px] font-black text-white bg-amber-500 rounded-full px-1.5 py-0.5">
                        {used}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteSpot(s); }}
                      disabled={deleting === s.id}
                      title={used > 0 ? `${used} job(s) pade hain — pehle khali karo` : `"${s.name}" delete karo`}
                      className={`p-1 rounded-md transition-colors ${used > 0
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-red-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"}`}
                    >
                      {deleting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>

                  <p className="font-black text-[#0d1117] text-sm leading-tight break-words w-full">{s.name}</p>
                  <p className={`no-print text-[9px] font-bold uppercase tracking-widest mt-0.5 mb-1 ${used > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {used > 0 ? `${used} item(s) · busy` : "khali"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">V-TECH · Job Spot</p>
                  {urls[s.id]
                    ? <Image src={urls[s.id]} alt={`QR ${s.name}`} width={200} height={200} className={`${QR_SIZES[qrSize].img} h-auto`} unoptimized />
                    : <div className={`${QR_SIZES[qrSize].img} aspect-square bg-slate-100 animate-pulse rounded`} />}
                  <p className="text-[9px] text-slate-400 mt-1 break-all leading-tight">Scan → Jobs @ {s.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spot ke linked jobs modal — card click par (shared component) */}
      <SpotJobsModal spot={jobsSpot} onClose={() => setJobsSpot(null)} />


      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Hide everything except labels grid */
          .print-area-wrapper { background: none !important; min-height: auto !important; }
          .print-area-wrapper > *:not(.print-area-labels) { display: none !important; }

          /* Labels grid — no padding, full width */
          .print-area-labels { padding: 0 !important; max-width: none !important; margin: 0 !important; }

          /* Label cards — remove hover effects, shadows, force white bg */
          .print-area-labels .break-inside-avoid {
            box-shadow: none !important;
            border: 1.5px solid #ccc !important;
            background: #ffffff !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }

        /* Dynamic @page — server-side rendered via inline style */
      `}</style>

      {/* Dynamic print page size/orientation */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${PAPER_CONFIG[paperSize][orientation].pageW} ${PAPER_CONFIG[paperSize][orientation].pageH};
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
}
