/**
 * Kya ye page Capacitor Android app (WebView) ke andar load ho raha hai?
 *
 * Web aur native app DONO ek hi remote URL load karte hain
 * (`capacitor.config.ts` → `server.url: https://vtech-next.vercel.app`), isliye
 * user-agent se farak nahi chalta — Capacitor bridge hi ekmatr reliable signal
 * hai.
 *
 * Kuch browser APIs WebView me EXIST to karti hain par kaam NAHI karti. Misal:
 * `PublicKeyCredential` WebView me defined hai, isliye
 * `browserSupportsWebAuthn()` true return karta hai — par platform authenticator
 * (fingerprint / Windows Hello) WebView se wired hi nahi hai, tap karne par
 * kuch nahi hota. Aisi jagah `isNativeApp()` se gate karo.
 *
 * Note: heavy `@capacitor/*` plugin imports nahi karte — ye helper public
 * login page par bhi load hota hai, isliye global bridge padhna kaafi hai.
 */

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as CapacitorWindow;
  return !!(w.Capacitor?.isNativePlatform && w.Capacitor.isNativePlatform());
}
