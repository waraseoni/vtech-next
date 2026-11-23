"use client";

// ─── DeviceIdentity — structured device display (single source) ──────────────
// UX plan §4.5. `item` derived label 40+ jagah apne aap rich hai; ye component
// sirf un chuni hui jagahon par additional structured line/card dikhata hai.
// Format ka saru `formatDeviceIdentity()` — kahin alag .join/.map nahi.

import { Check, Copy, Cpu, Hash, ShieldCheck, Smartphone, Tag } from "lucide-react";
import { useState } from "react";
import { formatDeviceIdentity } from "@/lib/deviceIdentity";
import { toast } from "@/lib/toast";

export type DeviceIdentityJob = {
  item?: string | null;
  brand?: string | null;
  brand_name?: string | null;
  model?: string | null;
  /** DB column. */
  serial_no?: string | null;
  identifier?: string | null;
  warranty_status?: string | null;
  warranty_until?: string | null;
};

type Props = {
  job: DeviceIdentityJob;
  /** card = labeled rows + copy + warranty; compact = 1-2 lines; inline = label only. */
  variant?: "card" | "compact" | "inline";
  className?: string;
  /** Public tracking jaise surfaces par internal serial chhupaane ke liye. */
  showIdentifier?: boolean;
};

function WarrantyBadge({ job }: { job: DeviceIdentityJob }) {
  if (!job.warranty_status && !job.warranty_until) return null;
  const active = /active|valid|yes|1|true/i.test(job.warranty_status ?? "");
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
        active ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
      }`}
      title={job.warranty_until ? `Warranty: ${job.warranty_until}` : undefined}
    >
      <ShieldCheck size={10} /> {active ? "Warranty active" : (job.warranty_status ?? "Warranty")}
    </span>
  );
}

export default function DeviceIdentity({
  job,
  variant = "card",
  className = "",
  showIdentifier = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const info = formatDeviceIdentity(job);
  const visibleIdentifier = showIdentifier ? info.identifier : undefined;

  // Legacy row (koi structured field nahi) — extra line dikhane ka koi fayda nahi,
  // purana `item` already upar dikhta hai. Compact me label bhi=waisa hi.
  if (info.isLegacy && variant !== "card") return null;

  if (variant === "inline") {
    return (
      <span className={className} title={info.label}>
        {info.label}
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`min-w-0 ${className}`}>
        <p className="truncate text-xs font-semibold text-app" title={info.label}>
          {info.label}
        </p>
        {visibleIdentifier && (
          <p className="text-[9px] text-muted-2 truncate" title={visibleIdentifier}>
            S/N {visibleIdentifier}
          </p>
        )}
        <WarrantyBadge job={job} />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-app bg-panel-2/40 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 flex items-center gap-1.5">
          <Smartphone size={13} /> Device Identity
        </p>
        <WarrantyBadge job={job} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-2 flex items-center gap-1">
            <Tag size={10} /> Brand
          </p>
          <p className="text-xs font-semibold text-app truncate" title={info.brand || "—"}>
            {info.brand || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-2 flex items-center gap-1">
            <Cpu size={10} /> Model
          </p>
          <p className="text-xs font-semibold text-app truncate" title={info.model || "—"}>
            {info.model || "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-2 flex items-center gap-1">
            <Hash size={10} /> Identifier
          </p>
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-app truncate" title={visibleIdentifier || "—"}>
              {visibleIdentifier || "—"}
            </p>
            {visibleIdentifier && (
              <button
                type="button"
                title={copied ? "Copied!" : "Identifier copy karo"}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(visibleIdentifier!);
                    setCopied(true);
                    toast.success("Identifier copy ho gaya!");
                  } catch {
                    toast.error("Copy nahi hua — manually select karlein.");
                  }
                }}
                className="flex-shrink-0 text-muted hover:text-blue-400 transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            )}
          </div>
        </div>
      </div>
      {info.isLegacy && (
        <p className="text-[9px] text-muted-2 mt-2" title={info.label}>
          Item: {info.label}
        </p>
      )}
    </div>
  );
}
