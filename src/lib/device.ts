/**
 * Server-side device class (mobile vs desktop) — hydration-safe viewport branch
 * ke liye.
 *
 * Kyun: `JobsBody` me `isMobile` pehle `useState(false)` se shuru hota tha, phir
 * mount par `matchMedia(max-width:1023px)` effect use flip karta tha. Mobile par
 * iska matlab: SSR/hydration DESKTOP tree ka hota tha, phir MOBILE tree poora
 * dobara render + re-layout (double layout) — /jobs par mobile TBT ka ~40% isi
 * flip se tha (docs/plans/perf_baseline.md Session 6 addendum). Ab server
 * `initialIsMobile` deta hai to pehla render hi sahi tree ka hota hai.
 *
 * Priority: client-hint `Sec-CH-UA-Mobile` (reliable jab `Accept-CH` opt-in ho),
 * warna User-Agent heuristic. Ye sirf EK hint hai — component ka matchMedia
 * listener mount ke baad asli viewport par correct kar deta hai (e.g. desktop UA
 * par narrow window), to ye correctness-critical nahi, sirf first-paint hint hai.
 */

/** Structural type — Next ka `ReadonlyHeaders` bhi ise satisfy karta hai. */
type HeaderReader = { get(name: string): string | null };

export function isMobileUserAgent(headers: HeaderReader): boolean {
  const clientHint = headers.get("sec-ch-ua-mobile");
  if (clientHint) return clientHint === "?1";
  const ua = headers.get("user-agent") ?? "";
  return /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile Safari/i.test(ua);
}
