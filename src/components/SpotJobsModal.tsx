"use client";

// ─── SpotJobsModal — kisi spot/location par rakhe saare jobs ka modal ────────
// Jobs page (Loc column), Client view (spot link) aur Spot QR Labels page —
// teeno isi ko use karte hain. Query mode:
//   spot.id  → exact location_id filter (dual-write wale naye jobs)
//   sirf naam → uniq_id text filter (legacy jobs jinki location_id null hai)

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { X, MapPin, Loader2 } from "lucide-react";

type SpotJob = { id: number; job_id: string; item: string; status: number; del_status: number };

// Job status badges (jobs/[id]/view ke STATUS_MAP se)
const JOB_STATUS_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: "Pending",     cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  1: { label: "On-Progress", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  2: { label: "Done",        cls: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  3: { label: "Paid",        cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  4: { label: "Cancelled",   cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  5: { label: "Delivered",   cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export type SpotRef = { id?: number | null; name: string };

export default function SpotJobsModal({ spot, onClose }: {
  spot: SpotRef | null;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<SpotJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!spot) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setJobs([]);
      try {
        let q = supabase
          .from("transaction_list")
          .select("id, job_id, item, status, del_status")
          .limit(200);
        q = spot.id
          ? q.eq("location_id", spot.id)
          : q.eq("uniq_id", spot.name).eq("del_status", 0);
        const { data } = await q.order("job_id", { ascending: false });
        if (alive) setJobs((data || []) as SpotJob[]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [spot]);

  // Modal ke andar do group: abhi pade hue vs purane records
  const isLive = (j: SpotJob) => j.del_status === 0 && j.status !== 4 && j.status !== 5;

  // Koi spot selected nahi → kuch bhi render na karo (hooks upar ho chuke,
  // isliye conditional return yahan safe hai)
  if (!spot) return null;

  const jobsUrl = spot.id ? `/jobs?spot=${spot.id}` : `/jobs?search=${encodeURIComponent(spot.name || "")}`;

  return (
    <div className="no-print fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#21293d]">
          <p className="font-black text-white text-sm flex items-center gap-1.5">
            <MapPin size={15} className="text-amber-400" /> {spot?.name}
          </p>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-[#21293d] flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-blue-400" />
            </div>
          ) : jobs.length === 0 ? (
            <p className="text-center text-slate-600 text-xs py-10">Is spot par abhi kuch nahi rakha.</p>
          ) : (() => {
            const live = jobs.filter(isLive);
            const past = jobs.filter(j => !isLive(j));
            return (
              <>
                {live.map(j => {
                  const badge = JOB_STATUS_BADGE[j.status] || { label: `Status ${j.status}`, cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
                  return (
                    <Link key={j.id} href={`/jobs/${j.id}/view`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.04] no-underline transition-colors">
                      <span className="font-black text-blue-400 text-xs">#{j.job_id}</span>
                      <span className="text-slate-300 text-xs truncate flex-1">{j.item}</span>
                      <span className={`text-[9px] font-bold border rounded-md px-1.5 py-0.5 flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                    </Link>
                  );
                })}
                {past.length > 0 && (
                  <div className="px-5 py-3">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">
                      Purane records ({past.length})
                    </p>
                    <div className="space-y-1">
                      {past.slice(0, 20).map(j => {
                        const badge = JOB_STATUS_BADGE[j.status] || { label: `Status ${j.status}`, cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
                        return (
                          <Link key={j.id} href={`/jobs/${j.id}/view`}
                            className="flex items-center gap-3 opacity-60 hover:opacity-100 no-underline transition-opacity">
                            <span className="text-slate-500 text-[10px] font-bold">#{j.job_id}</span>
                            <span className="text-slate-600 text-[10px] truncate flex-1">{j.item}</span>
                            <span className={`text-[9px] font-bold border rounded-md px-1 py-0.5 flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                          </Link>
                        );
                      })}
                      {past.length > 20 && (
                        <p className="text-[9px] text-slate-700">+{past.length - 20} aur…</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>

        <div className="px-5 py-3 border-t border-[#21293d] flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-600">
            {jobs.filter(isLive).length} live · {jobs.filter(j => !isLive(j)).length} purane
          </p>
          <Link href={jobsUrl}
            className="bg-blue-600 hover:bg-blue-700 !text-white rounded-lg px-3 py-1.5 text-[11px] font-bold no-underline transition-colors flex-shrink-0">
            Jobs me kholo
          </Link>
        </div>
      </div>
    </div>
  );
}
