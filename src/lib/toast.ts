// ============================================================================
// toast.ts — Single toast system (sonner) — Sprint 1 consolidation
//
// Pehle 3 systems the: sonner (unused), ~25 hand-rolled banners, ~97 alert().
// Ab sirf ye. Import karo:
//   import { toast } from "@/lib/toast";
//   toast.success("Saved!");
//   toast.error("Something failed");
//
// Rules:
//   - success → auto-dismiss (default)
//   - error   → persistent until user dismisses (galti kabhi miss nahi honi chahiye)
//   - warning/info → auto-dismiss
//   - multi-line messages: "Line1\nLine2" (CSS me pre-line set hai Toaster par)
//
// ─── Duplicate collapse (2026-09-29) ───────────────────────────────────────
// Geofence view-only me ek hi user action 4+ jagah se toast trigger kar sakta
// tha: CanWrite capture, useWriteGuard handler, likhne ke gate, aur har wo
// call-site jo `toast.error(error.message)` karta hai. Kyunki error object me
// poori Hindi message hoti thi, 33 call-sites me se koi bhi wahi message dobara
// dikha deta tha — staff ko 6-8 popups ek hi click pe. Sirf gate ka notifier
// 2.5s throttle tha, baaki sab chaaron path un-throttled the.
//
// Isliye `error` / `warning` / `info` par MESSAGE-BASED dedup: same text → same
// sonner `id` → naya toast purane ki jagah UPDATE hota hai, stack nahi hota.
// Seeding: koi bhi call-site change karne ki zaroorat nahi — 33 files chhedni
// parti, tab bhi guarantee nahi rehti (koi naya call-site aata rahega).
//
// `success` deliberately DEDUPE NAHI hota: 2 rows save hue to 2 alag confirmations
// sahi hain, ek me collapse karna galat feedback dega.
// ============================================================================

import { toast as sonnerToast } from "sonner";

type ToastOpts = { duration?: number; id?: string };

/** Is window ke andar dobara aaya to naya toast nahi, pehle wala update. */
const REPEAT_WINDOW_MS = 4000;

/** Re-trigger hua error ke liye bounded duration (chhota message = lamba error). */
const REPEAT_BOUND_MS = 5000;

/** Unbounded growth se bachao — message variety chhoti hai, par safety ke liye. */
const MAX_TRACKED = 256;

/**
 * Content-addressed toast id — text badla to naya id, text same to wahi id.
 * (Real hash chahiye to crypto; ye sirf dedup key hai, security se koi lena-dena
 * nahi — collision ka matlab bas do alag messages ek hi toast me collapse ho jaayein.)
 */
function dedupeId(msg: string): string {
  let h = 5381;
  for (let i = 0; i < msg.length; i++) h = ((h << 5) + h + msg.charCodeAt(i)) | 0;
  return `vt-${(h >>> 0).toString(36)}`;
}

const lastShownAt = new Map<string, number>();

/**
 * Deduped level ke liye sonner options. Pehle se isi id wala toast screen par
 * hai matlab wo REPEAT hai — aur repeat `error` ko `Infinity` rakhna matlab
 * staff ke screen par permanent stale popup. Isliye repeat par bounded.
 */
function optsFor(
  msg: string,
  fallback: number,
  opts?: ToastOpts
): { duration: number; id: string } {
  const id = opts?.id ?? dedupeId(msg);
  const now = Date.now();
  const prev = lastShownAt.get(id);
  const repeat = prev !== undefined && now - prev < REPEAT_WINDOW_MS;
  lastShownAt.set(id, now);
  if (lastShownAt.size > MAX_TRACKED) {
    for (const [k, t] of lastShownAt) if (now - t > REPEAT_WINDOW_MS) lastShownAt.delete(k);
  }
  let duration = opts?.duration ?? fallback;
  if (repeat && duration === Infinity) duration = REPEAT_BOUND_MS;
  return { duration, id };
}

export const toast = {
  /** Save confirmations — har call apna toast (dedupe nahi, stack sahi hai) */
  success: (msg: string, opts?: ToastOpts) =>
    sonnerToast.success(msg, { duration: opts?.duration ?? 3000 }),

  /** Error — persistent (user dismiss kare tabhi hat-ta hai) */
  error: (msg: string, opts?: ToastOpts) =>
    sonnerToast.error(msg, optsFor(msg, Infinity, opts)),

  warning: (msg: string, opts?: ToastOpts) =>
    sonnerToast.warning(msg, optsFor(msg, 5000, opts)),

  info: (msg: string, opts?: ToastOpts) =>
    sonnerToast.info(msg, optsFor(msg, 4000, opts)),

  /** Default sonner toast (type neutral) */
  message: (msg: string) => sonnerToast(msg),

  /** Loading spinner toast — returns dismiss fn; success se replace karo */
  loading: (msg: string) => sonnerToast.loading(msg),

  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};

export default toast;
