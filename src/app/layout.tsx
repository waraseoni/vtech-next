import "./globals.css";
import Script from "next/script";
import RootClient from "./RootClient";
import type { Metadata, Viewport } from "next";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "V-Technologies";
const SITE_TAGLINE = process.env.NEXT_PUBLIC_SITE_TAGLINE || "Repair & Service Management System";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: `${SITE_NAME} repair shop management system. Track jobs, manage clients, inventory, and payments — all in one place.`,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: `Repair shop management system by ${SITE_NAME}. Track jobs, manage clients, and streamline your service business.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: `Repair shop management system by ${SITE_NAME}.`,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0e17",
};

// ─── Boot Guard (pre-hydration) ──────────────────────────────────────────────
// Firefox me stale HTML → missing chunks → scripts fail → React KABHI hydrate
// nahi hota → useEffect-based watchdogs (jo hydration ke baad attach hote hain)
// kabhi chal nahi sakte. Ye INLINE script HTML me chalti hai — hydration se
// PEHLE — isliye script/link failures catch kar ke auto-reload karti hai aur
// 8s boot watchdog chala hai. App hydrate hote hi __VTECH_BOOTED__=true set
// karta hai; agar 8s me set nahi hua → app mount hi nahi hua → reload.
// 30s cooldown tight infinite loop rokta hai.
//
// IMPORTANT: Ye script SERVER LAYOUT me hai (server component). Agar ise client
// component (RootClient) me rakha to React hydration par `<script>` element
// client-side create karta hai → "Encountered a script tag while rendering
// React component" error. Server layout ka output client par re-render nahi
// hota, isliye yahan safe hai.
const BOOT_GUARD = `(function(){
  var KEY="vtech_boot_guard";
  function ok(){
    try{var l=Number(sessionStorage.getItem(KEY)||"0");if(Date.now()-l<30000)return false;sessionStorage.setItem(KEY,String(Date.now()));}
    catch(e){}
    return true;
  }
  function go(){if(ok())window.location.reload();}
  window.addEventListener("error",function(e){
    var t=e&&e.target;
    if(!t||!t.tagName)return;
    if(t.tagName==="SCRIPT"||(t.tagName==="LINK"&&/stylesheet|modulepreload/i.test(t.rel||"")))go();
  },true);
  window.setTimeout(function(){if(!window.__VTECH_BOOTED__)go();},8000);
})();`;

// ─── Theme Boot (pre-paint) ──────────────────────────────────────────────────
// Default theme DARK hai. Fresh browser me localStorage khaali hota hai —
// data-theme attribute set na ho to CSS vars (:root = LIGHT palette) light
// render karte hain jabki dark:* classes aur body DARK rehte hain → "kuch
// light kuch dark" mix dikhtha tha. Ye inline script HTML parse hote hi
// (first paint se PEHLE) sahi attribute laga deti hai: saved vtech_theme
// ("light" | "dark" | "system"), warna default 'dark'. Server layout me hi
// hai — BOOT_GUARD wala reason (client render par <script> hydration error).
const THEME_BOOT = `(function(){
  var t="dark";
  try{
    var s=localStorage.getItem("vtech_theme");
    if(s==="light")t="light";
    else if(s==="system"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}
  }catch(e){}
  document.documentElement.setAttribute("data-theme",t);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme="dark" = server-rendered default (script bhi same rakhta hai);
    // suppressHydrationWarning: saved-light users ke case me script attribute
    // hydration se pehle badal deta hai — mismatch warning expected hai.
    <html lang="en" className="h-full" data-theme="dark" suppressHydrationWarning>
      {/* Body colors hardcoded NAHI — globals.css ka body{background:var(--background)}
          rule attribute ke hisaab se turant sahi color deta hai (pehle yahan
          bg-[#0d1117] text-slate-200 hardcoded tha jo light theme se ladta tha). */}
      <body
        className={`h-full m-0 font-sans antialiased overflow-x-hidden`}
      >
        <Script
          id="vtech-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT }}
        />
        <Script
          id="vtech-boot-guard"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: BOOT_GUARD }}
        />
        <RootClient>{children}</RootClient>
      </body>
    </html>
  );
}
