/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, NetworkOnly, StaleWhileRevalidate } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// ─────────────────────────────────────────────────────────────────────────────
// Fix: "loader par atak jata hai, Ctrl+F5 se hi load hota hai" (10 Aug 2026)
// ─────────────────────────────────────────────────────────────────────────────
// Purana config Serwist ke `defaultCache` se HTML (NetworkFirst) + RSC/Flight
// payloads (NetworkFirst) + navigationPreload:true use karta tha.
//   - Har navigation/RSC request par `src/proxy.ts` `supabase.auth.getUser()`
//     chalta hai (network round-trip). Jab response >~3s leta hai, NetworkFirst
//     stale cache se PURANE build ka HTML/RSC serve kar deta hai.
//   - Purana HTML/RSC naye build ke chunk URLs nahi jaanta → chunk 404 →
//     hydration/Router fail → "V-TECH Secure Boot" loader hamesha ke liye atak
//     jata hai. Ctrl+F5 SW bypass karta hai → fresh HTML+chunks → load hota hai.
// Fix: App Router ke HTML + RSC kabhi cache NAAHI karo (hamesha network);
// sirf content-hashed static assets cache karo. Offline → precache app shell.
const CUSTOM_CACHE: RuntimeCaching[] = [
  // ⛔ HTML navigation (page load / hard refresh / login ke baad) — kabhi cache
  //    nahi. Online → hamesha fresh network HTML. Offline → precache fallback.
  {
    matcher: ({ request }) => request.mode === "navigate",
    handler: async ({ request }) => {
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.status === 304)) return res;
      } catch {
        const url = new URL(request.url);
        const fallback =
          (await serwist.matchPrecache(url.pathname)) ||
          (await serwist.matchPrecache("/"));
        if (fallback) return fallback;
      }
      return fetch(request);
    },
  },
  // ⛔ RSC / Flight payloads (soft-navigation data) — kabhi cache nahi.
  //    Stale RSC = purana router tree → page load par atak jata hai.
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin && !url.pathname.startsWith("/api/") && request.headers.get("RSC") === "1",
    handler: new NetworkOnly(),
  },
  // ✅ /_next/static/**/*.js — content-hashed URLs, cache karne me safe (fast loads)
  {
    matcher: /\/_next\/static.+\.js$/i,
    handler: new CacheFirst({
      cacheName: "next-static-js-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 1440 * 60, maxAgeFrom: "last-used" })],
    }),
  },
  // ✅ Images — hashed URLs, StaleWhileRevalidate safe
  {
    matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "static-image-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 720 * 60 * 60, maxAgeFrom: "last-used" })],
    }),
  },
  // ✅ Fonts — hashed URLs, safe
  {
    matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "static-font-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 10080 * 60, maxAgeFrom: "last-used" })],
    }),
  },
  // ✅ CSS — hashed URLs, safe
  {
    matcher: /\.(?:css|less)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "static-style-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 1440 * 60, maxAgeFrom: "last-used" })],
    }),
  },
  // ⛔ API routes — dynamic/auth data, kabhi cache nahi
  {
    matcher: ({ url }) => url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // ⛔ Baaki sab same-origin — hamesha network (auth app hai, offline app shell useless)
  {
    matcher: ({ sameOrigin }) => sameOrigin,
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: CUSTOM_CACHE,
});

// Purane defaultCache runtime caches (jo stale HTML/RSC pin karte the) ek baar
// naye SW ke activate par delete kar do — sab users next update par clean ho.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const stale = ["pages", "pages-rsc-prefetch", "pages-rsc", "next-data", "apis", "others", "cross-origin"];
      await Promise.all(stale.map((name) => caches.delete(name)));
    })()
  );
});

serwist.addEventListeners();
