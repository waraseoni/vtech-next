// ─────────────────────────────────────────────────────────────────────────────
// HARD REFRESH — Ctrl+F5 ka programmatic equivalent + app cache clear.
// ─────────────────────────────────────────────────────────────────────────────
// App ka sabse bada stake issue: jab WebView/PWA stale service-worker cache se
// purana HTML/chunk serve karta hai, to "V-TECH Secure Boot" loader ya login
// redirect hamesha ke liye atak jata hai. Sirf Ctrl+F5 (ya cache clear) isse
// theek karta hai — par Android app / Chrome-installed PWA me aisa koi keyboard
// nahi hota. Isliye "Clear Cache" button (src/components/ClearCacheButton.tsx)
// isi utility ko call karta hai.
//
// Do alag stale-data sources the:
//   1. Service worker / Cache Storage  → purana HTML, purane chunk URLs
//   2. React Query memory cache       → `router.refresh()` ke baad bhi purani
//      table/report rows (30s staleTime + 5min gcTime). Page reload se ye
//      apne aap clear hota hai, par simple "Refresh" button (router.refresh())
//      RQ cache ko chherta nahi — isliye "refresh ke baad bhi galat data".
//
// Ye utility:
//   1. Sab service-worker registrations + caches + precache metadata wipe
//   2. React Query in-memory cache clear
//   3. Cached brand logo (server par logo badalne ke baad purana dikhta hai)
//   4. `window.location.reload()` — ab cache clear ho chuka hai to fresh build
//
// SAFE (jaan-bujhkar PRESERVE): Supabase auth cookies, remember-email, theme,
// density, sidebar state, drafts, view preferences, passkey nudge. Ye user
// settings hain — inhe hatana matlab surprise logout / settings reset.
//
// Note: browser hamesha `window.location.reload()` ke liye current SW se hi
// jata hai, "hard" vs "soft" ka web-standard difference nahi hota. Asli fix
// caches ko wipe karna hai — isliye ye wahi karta hai. (skipWaiting/clientsClaim
// SW config par pehle se hai, isliye naya SW turant control le leta hai.)
// ─────────────────────────────────────────────────────────────────────────────

import { getQueryClient } from "@/lib/queryClient";

/**
 * Service worker ke saare caches + precache metadata ko wipe karta hai.
 * @returns Promise — ho gaya ya fail hua, dono cases me resolve.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
  } catch {
    /* cache API unavailable → ignore, reload hi kaam karega */
  }
  // Serwist/precache ke metadata localStorage me bhi ho sakte hai — clean.
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && /(serwist|nextjs|precache|sw)/i.test(key)) ls.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Poori app ka cache clear — SW + React Query + stale brand logo.
 * Reload NAHI karta: UI button pehle confirmation leta hai, phir hardReload().
 */
export async function clearAppCache(): Promise<void> {
  // 1. Service worker registrations — unregister + update-check.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          reg.update().catch(() => {});
          await reg.unregister().catch(() => {});
        })
      );
    }
  } catch {
    /* SW API unavailable / blocked → ignore */
  }

  // 2. React Query memory cache — "refresh ke baad bhi purana data" ka asli fix.
  try {
    getQueryClient().clear();
  } catch {
    /* provider mount hone se pehle bhi call ho sakta hai → ignore */
  }

  // 3. Brand logo cache — admin ne logo badla ho to purana na dikhe.
  try {
    window.localStorage.removeItem("vtech_brand_logo");
    window.localStorage.removeItem("vtech_brand_logo_at");
  } catch {
    /* ignore */
  }

  // 4. Cache Storage + Serwist precache metadata.
  await clearServiceWorkerCaches();
}

/**
 * Full hard reload (poora app cache wipe ke saath).
 * Hang hui loader / login / redirect sab par isse bacha jata hai.
 */
export async function hardReload(): Promise<void> {
  await clearAppCache();
  // Cooldown flag — reload ke turant baad boot-guard 30s loop guard ko bypass
  // karne ke liye allow karte hain (user ne deliberately refresh kiya hai).
  try {
    sessionStorage.setItem("vtech_manual_refresh", String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
}
