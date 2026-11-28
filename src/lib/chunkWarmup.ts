"use client";

/**
 * NAV PERF (audit, 29 Nov 2026) — modal/panel chunk warm-up.
 *
 * `next/dynamic(..., { ssr: false })` wale modals ka JS chunk pehli baar open
 * karne par download hota hai. Pehla open isliye 300-800 ms late lagta hai
 * ("click kiya, modal khula hi nahi"), jabki dusra open instant hota hai —
 * exactly wahi "kabhi jaldi, kabhi der" symptom.
 *
 * Ye helper browser ke idle time par wahi chunks download kar deta hai, to
 * pehla open bhi cache se instant ho jata hai. Best-effort: fail ho to chup-chaap
 * ignore (asli open par phir bhi load ho jayega).
 */
export function warmChunksOnIdle(
  loaders: Array<() => Promise<unknown>>,
  timeoutMs = 3000
): () => void {
  if (typeof window === "undefined") return () => {};

  let cancelled = false;
  const warm = () => {
    if (cancelled) return;
    for (const load of loaders) {
      try {
        void load().catch(() => {});
      } catch {
        /* ignore — real open par phir bhi load hoga */
      }
    }
  };

  const ric = (
    window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;

  if (typeof ric === "function") {
    const id = ric(warm, { timeout: timeoutMs });
    return () => {
      cancelled = true;
      (window as unknown as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(
        id
      );
    };
  }

  const timer = window.setTimeout(warm, timeoutMs);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
