import { test, expect } from "@playwright/test";

import { hasAdminCreds } from "../utils";

/**
 * Settings → AI card (multi-provider).
 *
 * Read-only smoke: dono providers ke cards dikhne chahiye aur API key kabhi
 * plaintext me render nahi honi chahiye (sirf masked hint). Koi DB write nahi,
 * isliye live DB par bhi safe hai.
 */
test("settings: AI providers dono cards + key masked", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/settings");

  await expect(page.getByText("System Information")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("AI Settings", { exact: true })).toBeVisible();

  // Dono providers hamesha list hote hain (multi-provider catalog)
  await expect(page.getByText("Groq (Free)").first()).toBeVisible();
  await expect(page.getByText("Google Gemini").first()).toBeVisible();

  // Per-provider actions
  expect(await page.getByRole("button", { name: "Test API" }).count()).toBeGreaterThanOrEqual(2);
  expect(
    await page.getByRole("button", { name: "Save", exact: true }).count()
  ).toBeGreaterThanOrEqual(2);

  // Key kabhi plaintext me page par nahi aani chahiye
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/gsk_[A-Za-z0-9]{10,}/);
  expect(bodyText).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
});
