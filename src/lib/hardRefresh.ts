// ─────────────────────────────────────────────────────────────────────────────
// HARD REFRESH — Ctrl+F5 ka programmatic equivalent.
// ─────────────────────────────────────────────────────────────────────────────
// App ka sabse bada stake issue: jab WebView/PWA stale service-worker cache se
// purana HTML/chunk serve karta hai, to "V-TECH Secure Boot" loader ya login
// redirect hamesha ke liye atak jata hai. Sirf Ctrl+F5 (ya cache clear) isse
// theek karta hai — par Android app me aise koi keyboard nahi hota.
//
// Ye utility:
//   1. Sab service-worker caches + precache metadata wipe karta hai
//      (taaki agla load hamesha FRESH network se ho, stale chunk 404 nahi de)
//   2. Detect karta hai ki user agle load par dobara-flash hone se bache
//   3. `window.location.reload()` se hard reload karta hai (SW bypass nahi,
//      par ab cache clear ho chuka hai to fresh build hi milega)
//
// Note: browser hamesha `window.location.reload()` ke liye current SW se hi
// jata hai, "hard" vs "soft" ka web-standard difference nahi hota. Asli fix
// caches ko wipe karna hai — isliye ye wahi karta hai. (skipWaiting/clientsClaim
// SW config par pehle se hai, isliye naya SW turant control le leta hai.)
// ─────────────────────────────────────────────────────────────────────────────

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
 * Full hard reload (PWA cache wipe ke saath).
 * Hang hui loader / login / redirect sab par isse bacha jata hai.
 */
export async function hardReload(): Promise<void> {
  // SW ko reload se PEHLE update-check + control lene ka mauka do (skipWaiting on hai).
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        reg.update().catch(() => {});
        reg.unregister().catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
  await clearServiceWorkerCaches();
  // Cooldown flag — reload ke turant baad boot-guard 30s loop guard ko bypass
  // karne ke liye allow karte hain (user ne deliberately refresh kiya hai).
  try {
    sessionStorage.setItem("vtech_manual_refresh", String(Date.now()));
  } catch {
    /* ignore */
  }
  window.location.reload();
}
