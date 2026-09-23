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
// ============================================================================

import { toast as sonnerToast } from "sonner";

type ToastOpts = { duration?: number };

export const toast = {
  success: (msg: string, opts?: ToastOpts) =>
    sonnerToast.success(msg, { duration: opts?.duration ?? 3000 }),

  /** Error — persistent (user dismiss kare tabhi hat-ta hai) */
  error: (msg: string, opts?: ToastOpts) =>
    sonnerToast.error(msg, { duration: opts?.duration ?? Infinity }),

  warning: (msg: string, opts?: ToastOpts) =>
    sonnerToast.warning(msg, { duration: opts?.duration ?? 5000 }),

  info: (msg: string, opts?: ToastOpts) =>
    sonnerToast.info(msg, { duration: opts?.duration ?? 4000 }),

  /** Default sonner toast (type neutral) */
  message: (msg: string) => sonnerToast(msg),

  /** Loading spinner toast — returns dismiss fn; success se replace karo */
  loading: (msg: string) => sonnerToast.loading(msg),

  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};

export default toast;
