# Clear Cache Button — 20 Nov 2026

**Status:** Implemented · gates green (see below)

## Problem

- Desktop par Ctrl+F5 / DevTools se cache clear karna aasan hai, par **Chrome se installed PWA** ya
  **Capacitor WebView app** me ye option nahi hota.
- Sirf "Refresh" button (`router.refresh()`) RSC laata hai — **React Query ka in-memory cache nahi
  chherta** (30s `staleTime`, 5min `gcTime`). Isliye "refresh ke baad bhi purana/galat data" dikhta
  tha.
- Doosra source: service worker / Cache Storage me purana HTML + purane chunk URLs → chunk 404 →
  "V-TECH Secure Boot" loader par atak jana. Pull-to-refresh/back-button me pehle se `hardReload()`
  tha, par user ko koi **visible button** nahi milta tha.

## Kya kiya

1. `src/lib/hardRefresh.ts` ko poora cache-clear path banaya:
   - **Service worker** registrations (`unregister` + `update`) aur saare **Cache Storage** caches
   - **React Query** in-memory cache (`getQueryClient().clear()`)
   - Stale **brand logo** (`vtech_brand_logo`, `vtech_brand_logo_at`)
   - Serwist/precache localStorage metadata
   - Phir `window.location.reload()` + `vtech_manual_refresh` cooldown flag
2. Naya `src/components/ClearCacheButton.tsx` — **two-step confirm** (native `confirm()` WebView me
   unreliable), busy state, toast, error fallback.
3. Button do jagah:
   - **Sidebar → System → Clear Cache** (mobile drawer me bhi yahi shared nav hai)
   - **User dropdown → Clear Cache** (header avatar, ek tap me accessible)
4. Tests: `src/lib/hardRefresh.test.ts` + `src/components/ClearCacheButton.test.tsx`.

## Kya NAHI hataya (important)

Auth cookies / Supabase session, remember-email, theme, density, sidebar collapse, drafts, view
preferences (`jobs_hide_delivered` etc.), passkey nudge flag — ye **user settings** hain, cache
nahi. Inhe hatane par unexpected logout / settings reset hota. Purana `clearServiceWorkerCaches()
` bhi sirf `serwist|nextjs|precache|sw` wale keys hatata hai, koi app data key nahi.

## UX flow

`Clear Cache` click → `Confirm / Cancel` → Confirm → cache wipe → fresh reload.
Cancel par kuch nahi hota. Confirm ke baad dropdown/drawer band ho jata hai (reload se pehle).

## Gates

- `prettier --check` OK
- `tsc --noEmit` 0
- `eslint` 0
- `vitest` 699/699 (naye 5 tests: 2 lib + 3 component)
- `next build` ✓

## Expert advice

1. **"Clear Cache" ko reset button ki tarah mat use karein.** Ye page reload karta hai — pending
   unsaved form/draft overwrite na ho. Isliye two-step confirm hai. Drafts (estimate) localStorage
   me preserved hain, phir bhi user ko batcha dena chahiye.
2. **Aslifix caching policy hai, button sirf safety net.** SW config me HTML/RSC/API pehle se hi
   `NetworkOnly`/`no-store` hai; sirf content-hashed JS/CSS/images/fonts cache hote hain. Button tab
   bhi isliye rakha hai kyunki deployment ke turant baad kisi device ka old SW control kar raha ho
   to user khud nikal sake.
3. **Agar "galat data" baar-baar dikhe to ye data bug ho sakta hai**, cache nahi — race condition,
   stale RQ key, ya missing `invalidateQueries`. Button se dikkat chali gayi to cause RQ/DB query
   me dhundho, cache clear ko permanent solution mat mana.
4. **Mobile me is button ko discoverable rakhna zaroori hai** — isliye sidebar (System) ke saath user
   dropdown me bhi diya. Agar future me native Kotlin app aaye to wahan bhi yahi semantic (SW nahi,
   webview cache + local DB cache) alag se banana padega.

## Files

- `src/lib/hardRefresh.ts`
- `src/components/ClearCacheButton.tsx`
- `src/app/RootClient.tsx` (sidebar + dropdown)
- `src/lib/hardRefresh.test.ts`
- `src/components/ClearCacheButton.test.tsx`
