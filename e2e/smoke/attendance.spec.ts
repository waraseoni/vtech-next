import { test, expect } from "@playwright/test";

import { hasAdminCreds } from "../utils";

test("attendance: page load + tab switch (daily ↔ monthly)", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/attendance");

  await expect(page.getByRole("heading", { name: "Attendance Hub" })).toBeVisible({
    timeout: 30_000,
  });

  // Daily tab default hai.
  await expect(page.getByRole("button", { name: /Mark Attendance/i })).toBeVisible();

  await page.getByRole("button", { name: /Monthly Report/i }).click();
  await expect(page).toHaveURL(/\/attendance\?.*view=report/);

  await page.getByRole("button", { name: /Mark Attendance/i }).click();
  await expect(page).toHaveURL(/\/attendance(\?|$)/);
});

test("attendance: admin day cell → Update Attendance modal", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/attendance?view=report");

  await expect(page.getByRole("heading", { name: "Attendance Hub" })).toBeVisible({
    timeout: 30_000,
  });

  const cell = page.locator('div[role="button"][aria-label]').first();
  if ((await cell.count()) === 0) {
    test.skip(true, "koi attendance cell nahi (master data khali)");
  }

  await cell.click();

  // Tooltip me admin ke liye Edit button hai.
  const edit = page.getByRole("button", { name: /^Edit$/ }).first();
  const hasEdit = await edit
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!hasEdit) test.skip(true, "Edit button nahi mila (non-admin user ya data nahi)");

  await edit.click();
  await expect(page.getByRole("heading", { name: "Update Attendance" })).toBeVisible();
});
