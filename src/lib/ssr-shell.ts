/**
 * SSR shell flag (WS-4 boot-gate stage 2/3) — DEFAULT OFF.
 *
 * NEXT_PUBLIC_SSR_SHELL:
 *   "off" (default)  — purana behavior: client auth ready hone ke baad shell paint.
 *   "all"            — har protected route par server-resolved role se shell
 *                      first paint me; splash gate hat jata hai.
 *   "/jobs,/dashboard" — sirf in route prefixes par (route-by-route rollout).
 *
 * Flag on hone par auth/license/idle checks post-hydration enhancement ban
 * jaate hain (Stage 3): server session se paint hota hai, phir client
 * validation/redirect chalta hai. Middleware + RLS waise hi gates hain.
 */
export type SsrShellAuth = {
  profile: { full_name: string; role: string; avatar_url?: string | null };
  email: string | null;
};

const RAW = (process.env.NEXT_PUBLIC_SSR_SHELL || "off").trim();
const NORMALIZED = RAW.toLowerCase();

export function isSsrShellEnabled(): boolean {
  return NORMALIZED !== "" && NORMALIZED !== "off";
}

export function isSsrShellRoute(pathname: string): boolean {
  if (!isSsrShellEnabled()) return false;
  if (NORMALIZED === "all") return true;
  return RAW.split(",").some((entry) => {
    const p = entry.trim();
    return p !== "" && (pathname === p || pathname.startsWith(p + "/"));
  });
}
