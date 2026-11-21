import { isNativeApp } from "@/lib/nativeApp";

/**
 * Cross-origin (external) link opener jo browser aur Capacitor WebView dono me kaam kare.
 *
 * WebView me `<a target="_blank">` khulta nahi — Capacitor ke BridgeWebChromeClient me
 * `onCreateWindow` override nahi hai. `window.open` ko nativePrint bridge patch karta hai,
 * par dynamic import ke chalte user ke pehle click par patch abhi installed na ho.
 * Isliye native me seedha top-level navigation: BridgeWebViewClient host-mismatch par
 * `ACTION_VIEW` se WhatsApp/browser khol deta hai — patch se independent.
 */
export function openExternalLink(url: string): void {
  if (typeof window === "undefined") return;

  // Sirf http(s) — kisi bhi caller se javascript:/data: URL na chal jaye.
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
  } catch {
    return;
  }

  if (isNativeApp()) {
    window.location.assign(url);
    return;
  }

  // Browser: normal new-tab behavior. `noopener` return value null deta hai
  // (Chrome), isliye usse popup-block ka signal mat mana.
  window.open(url, "_blank", "noopener,noreferrer");
}
