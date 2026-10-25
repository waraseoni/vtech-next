import { test, expect } from "@playwright/test";

// Login test ko clean session chahiye — storageState bypass karo.
test.use({ storageState: { cookies: [], origins: [] } });

test("login: password login → dashboard", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/login");

  await page.getByPlaceholder("staff@vtech.com").fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: /Login to Dashboard/i }).click();

  // Login ke baad `window.location.href = "/dashboard"` — full reload.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
});
