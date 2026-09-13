// ─── LITE MODE ───────────────────────────────────────────────────────────────
// NEXT_PUBLIC_LITE_MODE=1 ke saath build karo → sirf "login + attendance +
// staff" wali app milti hai. Baaki modules/routes middleware + client guard se
// band → unke JS chunks kabhi download nahi hote (Link prefetch bhi block hota
// hai kyunki middleware hi unki RSC fetch ko redirect kar deta hai).
//
// Full version = flag ke bina normal build (default). Ye module sirf env pe
// depend karta hai — is liye proxy.ts (server) aur client components dono me
// safely import kar sakte hain.
// ─────────────────────────────────────────────────────────────────────────────

export const LITE_MODE = process.env.NEXT_PUBLIC_LITE_MODE === "1";

/** Lite me enabled module keys — sidebar (isModuleEnabled) ke liye. */
export const LITE_MODULES: string[] = ["dashboard", "people"];

/**
 * Lite me explicitly allowed routes. Jo routes kisi module ki mapping me nahi
 * aate (attendance, users, own profile) unhe yahan allow karte hain.
 * Prefix-based matching: /mechanics → /mechanics/salary bhi allowed.
 */
const LITE_ROUTES = [
  "/dashboard", // landing after login
  "/attendance", // daily punch + monthly register
  "/mechanics", // Staff (People module)
  "/services", // Service catalog (People module)
  "/users", // staff/user management (attendance linkage)
  "/profile", // own profile (mechanic linkage)
  "/my-account", // client/self account portal (login ke baad ka default target)
] as const;

/** True agar pathname lite me allowed hai. */
export function isLiteRouteAllowed(pathname: string): boolean {
  for (const r of LITE_ROUTES) {
    if (pathname === r || pathname.startsWith(r + "/")) return true;
  }
  return false;
}