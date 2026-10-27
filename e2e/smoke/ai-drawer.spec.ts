import { test, expect } from "@playwright/test";

import { hasAdminCreds } from "../utils";

/**
 * AI Assistant UI regressions (drawer + /ai page).
 *
 * Yahan jo cover hota hai:
 *  1. `/ai` par mobile bottom tab bar nahi (composer ke upar aa jata tha).
 *  2. Title gradient light theme me invisible na ho — legacy CSS rule
 *     `[class*="bg-grad-"] { color: #fff !important }` isse white-on-white kar
 *     deta tha.
 *  3. Drawer header ka refresh andar ka conversation reset kare.
 *  4. Drawer ke bahar click (mobile par bhi) minimize kare.
 *  5. Drawer ke andar dobara bottom tab bar na aaye.
 */
test.describe("ai assistant ui", () => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  test("/ai: no bottom tab bar + title actually visible (light theme)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vtech_theme", "light"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ai");

    const title = page.getByRole("heading", { name: "V-Tech Copilot" });
    await expect(title).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("nav[data-mobile-tabbar]")).toHaveCount(0);
    // Standalone mobile: bottom bar nahi hai, isliye back affordance zaroori
    await expect(page.getByLabel("Back to dashboard")).toBeVisible();
    await expect(page.getByLabel("Reset conversation")).toBeVisible();

    const style = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fill: (cs as unknown as Record<string, string>).webkitTextFillColor,
        image: cs.backgroundImage,
      };
    });
    // gradient text: fill transparent + gradient background — white fill ka
    // matlab legacy overrides ne title ko invisible kar diya
    expect(style.fill).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(style.image).toContain("gradient");

    // page document scroll na ho (warna header chhup jata hai)
    const scroll = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      ih: window.innerHeight,
    }));
    expect(scroll.h).toBeLessThanOrEqual(scroll.ih + 1);
  });

  test("drawer: refresh reset + outside click minimise (desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await page.getByTitle("AI Assistant").last().click();

    const drawer = page.locator('div[role="dialog"][aria-label="AI Assistant"]');
    await expect(drawer).toBeVisible();
    await expect
      .poll(async () => Math.round((await drawer.boundingBox())?.x ?? -1), { timeout: 5000 })
      .toBeLessThan(1440 - 400);

    const frame = page.frameLocator('iframe[title="AI Assistant"]');
    await expect(frame.locator("select.ai-provider-select")).toBeVisible({ timeout: 60_000 });
    await expect(frame.locator("nav[data-mobile-tabbar]")).toHaveCount(0);

    // refresh → draft clear (conversation reset ka observable proof)
    await frame.locator("textarea").fill("draft text");
    await page.getByLabel("Reset AI conversation").click();
    await expect(frame.locator("textarea")).toHaveValue("", { timeout: 5000 });

    // bahar click → minimise
    await page.mouse.click(40, 500);
    await expect
      .poll(async () => Math.round((await drawer.boundingBox())?.x ?? -1), { timeout: 5000 })
      .toBeGreaterThanOrEqual(1435);
  });

  test("drawer: mobile par 92% width + bahar tap minimise", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.waitForTimeout(500);
    await page.getByTitle("AI Assistant").last().click();

    const drawer = page.locator('div[role="dialog"][aria-label="AI Assistant"]');
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    // 92% width → ~30px strip bachi, wahin tap karke band hota hai
    expect(box!.width).toBeGreaterThan(340);
    expect(box!.width).toBeLessThan(390 - 20);

    await page.mouse.click(5, 500);
    await page.waitForTimeout(600);
    const after = await drawer.boundingBox();
    expect(Math.round(after!.x)).toBeGreaterThanOrEqual(380);
  });
});
