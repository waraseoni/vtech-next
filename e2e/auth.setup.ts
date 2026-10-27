import fs from "node:fs";
import path from "node:path";
import { test as setup, expect } from "@playwright/test";

/**
 * Admin login → storageState.
 *
 * Geofence trap: staff user office ke bahar ho to write-gate job/sale save
 * block karega, isliye e2e hamesha **admin** user se chalta hai (ya permit wale
 * user se). Credentials `.env.local` me:
 *
 *   E2E_ADMIN_EMAIL=...
 *   E2E_ADMIN_PASSWORD=...
 */
const authFile = path.join("e2e", ".auth", "state.json");

setup("admin login → storage state", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  setup.skip(
    !email || !password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD set nahi hain (.env.local ya CI secrets)"
  );

  await page.goto("/login");

  await page.getByPlaceholder("staff@vtech.com").fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: /Login to Dashboard/i }).click();

  // Login full page reload karta hai (`window.location.href = "/dashboard"`).
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  // Kuch routes (inventory/attendance/jobs/new/direct-sales/new) dev mode me
  // pehli baar hit par compile hote hain. Wo compile setup me hi karwa lete hain,
  // warna parallel specs 30s timeout par compile ke liye fail ho jaati hain.
  for (const route of [
    "/dashboard",
    "/inventory",
    "/attendance",
    "/attendance?view=report",
    "/direct-sales/new",
    "/jobs/new",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 120_000 });
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
