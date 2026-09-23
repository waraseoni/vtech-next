// ============================================================================
// StatusBadge — Job status (0-5) ka consistent pill badge
//
// Single source of truth: @/lib/status-colors JOB_STATUS.
// Har list/table/card me same look — naya page banate waqt import karo,
// apna STATUS_MAP copy mat banao.
//
// Usage:
//   <StatusBadge status={txn.status} />
//   <StatusBadge status={job.status} size="sm" />
//   <StatusBadge status={po.status} map={PO_STATUS} />   // PO ke liye
// ============================================================================

import React from "react";
import { StatusStyle, getStatusStyle } from "@/lib/status-colors";

interface StatusBadgeProps {
  status: number | null | undefined;
  /** Override map — PO_STATUS, SERVICE_STATUS etc. Default: JOB_STATUS */
  map?: Record<number, StatusStyle>;
  size?: "sm" | "md";
  /** Show colored bar/dot ke saath */
  withBar?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  map,
  size = "md",
  withBar = false,
}) => {
  const style = getStatusStyle(status, map);
  const sizeCls =
    size === "sm"
      ? "px-2 py-0.5 text-[9px]"
      : "px-2.5 py-1 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-black uppercase tracking-wider border ${sizeCls} ${style.cls}`}
    >
      {withBar && (
        <span className={`w-1.5 h-1.5 rounded-full ${style.bar}`} aria-hidden />
      )}
      {style.label}
    </span>
  );
};

export default StatusBadge;
