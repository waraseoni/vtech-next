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
    cls:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
    color: "text-slate-400",
    bg:    "bg-slate-500/10 border border-slate-500/20",
    bar:   "bg-slate-500",
  },
  1: {
    label: "In Progress",
    cls:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    color: "text-blue-400",
    bg:    "bg-blue-500/10 border border-blue-500/20",
    bar:   "bg-blue-500",
  },
  2: {
    label: "Done",
    cls:   "bg-teal-500/10 text-teal-400 border-teal-500/20",
    color: "text-teal-400",
    bg:    "bg-teal-500/10 border border-teal-500/20",
    bar:   "bg-teal-500",
  },
  3: {
    label: "Paid",
    cls:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border border-emerald-500/20",
    bar:   "bg-emerald-500",
  },
  4: {
    label: "Cancelled",
    cls:   "bg-red-500/10 text-red-400 border-red-500/20",
    color: "text-red-400",
    bg:    "bg-red-500/10 border border-red-500/20",
    bar:   "bg-red-500",
  },
  5: {
    label: "Delivered",
    cls:   "bg-purple-500/10 text-purple-400 border-purple-500/20",
    color: "text-purple-400",
    bg:    "bg-purple-500/10 border border-purple-500/20",
    bar:   "bg-purple-500",
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
    cls:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
    color: "text-amber-400",
    bg:    "bg-amber-500/10 border border-amber-500/20",
    bar:   "bg-amber-500",
  },
  1: {
    label: "Partial",
    cls:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    color: "text-blue-400",
    bg:    "bg-blue-500/10 border border-blue-500/20",
    bar:   "bg-blue-500",
  },
  2: {
    label: "Received",
    cls:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border border-emerald-500/20",
    bar:   "bg-emerald-500",
  },
  3: {
    label: "Cancelled",
    cls:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
    color: "text-slate-400",
    bg:    "bg-slate-500/10 border border-slate-500/20",
    bar:   "bg-slate-500",
  },
};

/** Active / Inactive entity status (mechanics, suppliers, products, etc.) */
export const ENTITY_STATUS = {
  active: {
    label: "Active",
    cls:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "text-emerald-400",
    bg:    "bg-emerald-500/10 border border-emerald-500/20",
  },
  inactive: {
    label: "Inactive",
    cls:   "bg-slate-500/10 text-slate-400 border-slate-500/20",
    color: "text-slate-400",
    bg:    "bg-slate-500/10 border border-slate-500/20",
  },
};

/** Inline CSS colors for print / HTML rendering (server-side) */
export const JOB_STATUS_INLINE: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Pending",     color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  1: { label: "In Progress", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  2: { label: "Done",        color: "#2dd4bf", bg: "rgba(45,212,191,0.15)" },
  3: { label: "Paid",        color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  4: { label: "Cancelled",   color: "#f87171", bg: "rgba(248,113,113,0.15)" },
  5: { label: "Delivered",   color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
};
