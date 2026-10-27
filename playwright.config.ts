import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Next ki .env loading reuse karo — E2E_ADMIN_EMAIL/password `.env.local` me hi
// rakho (git-ignored). CI me workflow env/secret se aate hain.
loadEnvConfig(process.cwd());

const PORT = Number(process.env.E2E_PORT ?? 3000);
// `localhost` hi use karo, `127.0.0.1` nahi: `npm run dev` `-H 0.0.0.0` par
// chalta hai aur Next dev 127.0.0.1 origin ke dev resources (HMR/chunks) block
// kar deta hai -> client JS load nahi hota -> form native submit ho jaata hai.
// Isi wajah se login `?` par reload hota tha aur dashboard tak pahunchta hi nahi.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

// Credentials na ho to storageState path ki jagah empty state do — warna
// dependent specs ENOENT se fail hoti hain (setup skip hone par bhi Playwright
// dependents ko chalata hai). Specs khud `hasAdminCreds` par skip karti hain.
const hasAdminCreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);
const emptyState = { cookies: [], origins: [] };

/**
 * e2e config.
 *
 * - `setup` project admin login karke storageState save karta hai (ek hi login
 *   se saare specs chalti hain).
 * - Credentials na ho to setup skip hota hai; specs khud `hasAdminCreds` par
 *   skip karti hain (local `npm run e2e` bina setup ke red nahi rahega).
 *   CI me secrets add karna zaroori hai — tab hi real assertions chalti hain.
 * - `webServer` existing dev server reuse karta hai (double-start nahi).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared master data + job_id counter — serial hi safe
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  // Dev server par pehli hit par route compile hota hai (jaise /jobs/new par
  // 537 clients + mechanics + stock queries). Parallel suite me 60s default kam
  // padta tha — isliye global timeout badhaya. Assertions ke apne timeouts
  // alag hain, ye sirf poore test ka upper bound hai.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: hasAdminCreds ? path.join("e2e", ".auth", "state.json") : emptyState,
      },
      dependencies: ["setup"],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
