// App version helper.
//
// Build-time par NEXT_PUBLIC_APP_VERSION inline hota hai (next.config.ts
// se package.json ka version inject hota hai). Direct access use karo —
// dynamic access (process.env[key]) ko Next.js client bundle me inline
// nahi karta, browser me undefined milta hai.

const APP_VERSION = (process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0").trim();
const COMMIT = (process.env.NEXT_PUBLIC_APP_COMMIT || "").trim();

/** Display version string, e.g. "v1.2.3" (optionally + short commit). */
export const APP_VERSION_LABEL = APP_VERSION ? `v${APP_VERSION}` : "dev";

export const APP_COMMIT = COMMIT;

/** Full detail line, e.g. "v1.2.3 (a1b2c3d)". */
export const APP_VERSION_FULL = COMMIT
  ? `${APP_VERSION_LABEL} (${COMMIT.slice(0, 7)})`
  : APP_VERSION_LABEL;
