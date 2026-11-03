// Sentry client init — LAZY (3 Nov 2026, WS-1).
//
// Pehle yahan static `import * as Sentry` tha, aur `withSentryConfig` is config
// ko har client entry me inject karta hai — isliye poora SDK (~250KB raw) har
// route ke always-loaded shared chunk me chala jata tha, chahe DSN set ho ya
// na ho. Ab SDK sirf idle par load hota hai; DSN nahi hai to download hi nahi
// hota. error.tsx/global-error.tsx bhi `ensureSentry()` se same module cache
// ka initialized instance use karte hain.
import { ensureSentry } from "./src/lib/sentry-lazy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn && typeof window !== "undefined") {
  const init = () => {
    ensureSentry().catch(() => {});
  };

  // First paint/hydration se pehle load nahi — network + parse cost TBT se hat jata hai.
  // (Purane Safari me requestIdleCallback nahi hota → timeout fallback.)
  const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback : null;
  if (idle) idle(init, { timeout: 4000 });
  else window.setTimeout(init, 1500);
}
