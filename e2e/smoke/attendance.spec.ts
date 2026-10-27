import { test, expect } from "@playwright/test";

import { clickUntilUrl, hasAdminCreds } from "../utils";

test("attendance: page load + tab switch (daily ↔ monthly)", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/attendance");

  await expect(page.getByRole("heading", { name: "Attendance Hub" })).toBeVisible({
    timeout: 60_000,
  });

  // Daily tab default hai.
  await expect(page.getByRole("button", { name: /Mark Attendance/i })).toBeVisible();

  // Hydration se pehle ka click kho jaata hai → clickUntilUrl repeat karta hai.
  await clickUntilUrl(page, page.getByRole("button", { name: /Monthly Report/i }), /view=report/);
  await clickUntilUrl(
    page,
    page.getByRole("button", { name: /Mark Attendance/i }),
    /\/attendance(\?|$)/
  );
});

test("attendance: admin day cell → Update Attendance modal", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");

  await page.goto("/attendance?view=report");

  await expect(page.getByRole("heading", { name: "Attendance Hub" })).toBeVisible({
    timeout: 60_000,
  });

  const cell = page.locator('div[role="button"][aria-label]').first();
  if ((await cell.count()) === 0) {
    test.skip(true, "koi attendance cell nahi (master data khali)");
  }

  await cell.click();

  // Tooltip me admin ke liye Edit button hai.
  const edit = page.getByRole("button", { name: /^Edit$/ }).first();
  const hasEdit = await edit
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!hasEdit) test.skip(true, "Edit button nahi mila (non-admin user ya data nahi)");

  await edit.click();
  await expect(page.getByRole("heading", { name: "Update Attendance" })).toBeVisible({
    timeout: 60_000,
  });
});
