"use client";

import { useSystemInfo } from "@/lib/queries/system-info";
import {
  normalizeServiceCenterMode,
  serviceCenterModeLabel,
  type ServiceCenterMode,
} from "@/lib/serviceCenterMode";

// Authenticated topbar me hamesha dikhne wala read-only mode chip.
// Public pages is shell ke bahar hain, isliye wahan ye render hi nahi hota.
const STYLES: Record<ServiceCenterMode, string> = {
  autonomous: "border-slate-500/25 bg-slate-500/10 text-slate-300 dark:text-slate-300",
  single_brand: "border-blue-500/25 bg-blue-500/10 text-blue-300 dark:text-blue-300",
  multi_brand: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300 dark:text-indigo-300",
};

// Mobile par jagah kam — chhota code, desktop par poorna label.
const SHORT: Record<ServiceCenterMode, string> = {
  autonomous: "AUTO",
  single_brand: "1-BR",
  multi_brand: "MULTI",
};

export default function ServiceCenterModeBadge() {
  const info = useSystemInfo();
  const mode = normalizeServiceCenterMode(info.service_center_mode);

  return (
    <span
      title={`Service Center Mode: ${serviceCenterModeLabel(mode)}`}
      aria-label={`Service Center Mode: ${serviceCenterModeLabel(mode)}`}
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider sm:px-2 sm:text-[9px] ${STYLES[mode]}`}
    >
      <span className="hidden sm:inline">Mode: </span>
      <span className="sm:hidden">{SHORT[mode]}</span>
      <span className="hidden sm:inline">{serviceCenterModeLabel(mode)}</span>
    </span>
  );
}
