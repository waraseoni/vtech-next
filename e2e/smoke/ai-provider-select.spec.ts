import { test, expect } from "@playwright/test";

import { hasAdminCreds } from "../utils";

/**
 * `/ai` page provider selector (per-session, read-only).
 *
 * - Default "Auto" hona chahiye (Settings ka active provider server par resolve hota hai).
 * - Sirf known providers options me aane chahiye.
 * - Koi API key page par nahi.
 */
test("ai: provider selector (auto default, no key leak)", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/ai");

  await expect(page.getByText("V-Tech Copilot")).toBeVisible({ timeout: 60_000 });

  const select = page.locator("select").filter({ has: page.locator("option[value='auto']") });
  await expect(select).toBeVisible();

  const values = await select
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));

  expect(values[0]).toBe("auto");
  for (const value of values.slice(1)) {
    expect(["groq", "gemini"]).toContain(value);
  }

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/gsk_[A-Za-z0-9]{10,}/);
  expect(bodyText).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
});
