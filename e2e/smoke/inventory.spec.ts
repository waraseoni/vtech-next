import { test, expect } from "@playwright/test";

import { hasAdminCreds } from "../utils";

test("inventory: list load + search + out-of-stock filter", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/inventory");

  const search = page.getByPlaceholder("Search products, descriptions, barcode...");
  await expect(search).toBeVisible({ timeout: 30_000 });

  // Koi bhi aisa term jo match na kare → empty state dikhna chahiye.
  await search.fill("zzz-e2e-no-such-product");
  await expect(page.getByText(/No products (found|match)/).first()).toBeVisible();

  // Clear → list wapas.
  await search.fill("");
  await expect(page.getByText(/No products (found|match)/).first()).toBeHidden();

  // Filter pill apply hota hai (active style red = out-of-stock).
  const outPill = page.getByRole("button", { name: /^Out\b/ });
  await outPill.click();
  await expect(outPill).toHaveClass(/bg-red-600/);
});
