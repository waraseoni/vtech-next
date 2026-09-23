// ============================================================================
// status-colors.ts — Centralized status badge colors
//
// Har status ke liye consistent Tailwind classes. Import karo aur use karo.
// Colors intentionally distinct hain taaki ek nazar me pata chale:
//   slate = waiting/neutral, blue = active, teal = done, emerald = paid,
//   red = cancelled, purple = delivered, amber = pending (PO).
// ============================================================================

/** Job / Repair status (0-5) — used in jobs, clients, reports, my-account */
export type JobStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface StatusStyle {
  label: string;
  /** Tailwind classes: bg, text, border — dark theme me use karo */
  cls: string;
  /** Sirf text color class (quantity wagner ke liye) */
  color: string;
  /** Sirf bg + border class (icon background ke liye) */
  bg: string;
  /** Dot indicator color */
  bar: string;
}

export const JOB_STATUS: Record<number, StatusStyle> = {
  0: {
    label: "Pending",
    cls: "bg-muted/10 text-muted border-muted/20",
    color: "text-muted",
    bg: "bg-muted/10 border border-muted/20",
    bar: "bg-muted",
  },
  1: {
    label: "In Progress",
    cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border border-blue-500/20",
    bar: "bg-blue-500",
  },
  2: {
    label: "Done",
    cls: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border border-teal-500/20",
    bar: "bg-teal-500",
  },
  3: {
    label: "Paid",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border border-emerald-500/20",
    bar: "bg-emerald-500",
  },
  4: {
    label: "Cancelled",
    cls: "bg-red-500/10 text-red-400 border-red-500/20",
    color: "text-red-400",
    bg: "bg-red-500/10 border border-red-500/20",
    bar: "bg-red-500",
  },
  5: {
    label: "Delivered",
    cls: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border border-purple-500/20",
    bar: "bg-purple-500",
  },
};

/** Service job status (0-5) — daily-service report uses different labels */
export const SERVICE_STATUS: Record<number, StatusStyle> = {
  0: { ...JOB_STATUS[0], label: "Pending" },
  1: { ...JOB_STATUS[1], label: "Accepted" },
  2: { ...JOB_STATUS[2], label: "In Progress" },
  3: { ...JOB_STATUS[3], label: "Ready" },
  4: { ...JOB_STATUS[4], label: "Cancelled" },
  5: { ...JOB_STATUS[5], label: "Delivered" },
};

/** Pending jobs report — only 0-3 */
export const PENDING_JOB_STATUS: Record<number, StatusStyle> = {
  0: { ...JOB_STATUS[0], label: "Pending" },
  1: { ...JOB_STATUS[1], label: "In Progress" },
  2: { ...JOB_STATUS[2], label: "Done" },
  3: { ...JOB_STATUS[3], label: "Paid" },
};

/** Purchase Order status */
export type POStatus = 0 | 1 | 2 | 3;

export const PO_STATUS: Record<number, StatusStyle> = {
  0: {
    label: "Pending",
    cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border border-amber-500/20",
    bar: "bg-amber-500",
  },
  1: {
    label: "Partial",
    cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border border-blue-500/20",
    bar: "bg-blue-500",
  },
  2: {
    label: "Received",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border border-emerald-500/20",
    bar: "bg-emerald-500",
  },
  3: {
    label: "Cancelled",
    cls: "bg-muted/10 text-muted border-muted/20",
    color: "text-muted",
    bg: "bg-muted/10 border border-muted/20",
    bar: "bg-muted",
  },
};

/** Active / Inactive entity status (mechanics, suppliers, products, etc.) */
export const ENTITY_STATUS = {
  active: {
    label: "Active",
    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border border-emerald-500/20",
  },
  inactive: {
    label: "Inactive",
    cls: "bg-muted/10 text-muted border-muted/20",
    color: "text-muted",
    bg: "bg-muted/10 border border-muted/20",
  },
};

/** Inline CSS colors for print / HTML rendering (server-side) */
export const JOB_STATUS_INLINE: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Pending", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  1: { label: "In Progress", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  2: { label: "Done", color: "#2dd4bf", bg: "rgba(45,212,191,0.15)" },
  3: { label: "Paid", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  4: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  5: { label: "Delivered", color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
};

// ============================================================================
// Label-only maps — pages jo sirf STATUS_MAP[k] = "Label" use karte thein
// (jobs, clients, export/print APIs, gemini-tools). Single source of truth.
// ============================================================================

/** Job status → plain label string (0-5) */
export const STATUS_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(JOB_STATUS).map(([k, v]) => [Number(k), v.label])
);

/** Job status → short Hinglish explanation (job detail view ke liye) */
export const STATUS_EXPLANATIONS: Record<number, string> = {
  0: "Kaam shuru nahi hua hai",
  1: "Kaam chal raha hai, jald ready hoga",
  2: "Kaam pura ho gaya hai",
  3: "Bill chuka diya gaya hai",
  4: "Transaction radd kar diya gaya hai",
  5: "Aapko item mil chuka hai",
};

/**
 * PHP-style badge color name → Tailwind (job view page legacy pattern).
 * print/export routes isko inline CSS me map karte hain.
 */
export const BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  secondary: { bg: "bg-slate-600", text: "text-white", border: "border-slate-700" },
  primary: { bg: "bg-blue-600", text: "text-white", border: "border-blue-700" },
  info: { bg: "bg-cyan-500", text: "text-white", border: "border-cyan-600" },
  success: { bg: "bg-green-600", text: "text-white", border: "border-green-700" },
  danger: { bg: "bg-red-600", text: "text-white", border: "border-red-700" },
  warning: { bg: "bg-yellow-500", text: "text-app", border: "border-yellow-600" },
};

/** Status → PHP-style badge color name (view page legacy) */
export const STATUS_BADGE_COLOR: Record<number, string> = {
  0: "secondary",
  1: "primary",
  2: "info",
  3: "success",
  4: "danger",
  5: "warning",
};

/** Delivery status (del_status) */
export const DEL_STATUS: Record<number, string> = { 0: "In Shop", 1: "Delivered" };

/**
 * getLabel(status, fallback?) — null/undefined/unknown par fallback.
 * Pages me jo `STATUS_MAP[txn.status] || String(txn.status)` pattern tha.
 */
export function getLabel(status: number | null | undefined, fallback = "?"): string {
  if (status == null) return fallback;
  return STATUS_LABELS[status] || fallback;
}

/**
 * getBadge(status) — full StatusStyle with fallback to Pending style.
 * Pages me jo `STATUS_MAP[job.status] || { label: ..., cls: ... }` tha.
 */
export function getBadge(status: number | null | undefined): StatusStyle {
  return JOB_STATUS[status ?? 0] || JOB_STATUS[0];
}

/**
 * getStatusStyle(status, map?) — map-aware lookup with Pending fallback.
 * StatusBadge component isse use karta hai; PO/SERVICE maps pass kar sakte ho.
 */
export function getStatusStyle(
  status: number | null | undefined,
  map?: Record<number, StatusStyle>
): StatusStyle {
  const source = map || JOB_STATUS;
  if (status != null && source[status]) return source[status];
  return source[0] || JOB_STATUS[0];
}
