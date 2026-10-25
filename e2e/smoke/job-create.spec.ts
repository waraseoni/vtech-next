import { test, expect } from "@playwright/test";

import { allowWrites, hasAdminCreds, pickFromSearchable, searchableHasOptions } from "../utils";

test("job create: wizard step-1 → Quick Save → job view", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");
  test.skip(!allowWrites, "E2E_ALLOW_WRITES=1 nahi hai (ye test DB me job row banata hai)");

  await page.goto("/jobs/new");
  await expect(page.getByRole("heading", { name: /New Job/i })).toBeVisible({ timeout: 30_000 });

  const clientPick = {
    trigger: /^Search client/i,
    search: /Name ya contact se search karo/,
  };
  test.skip(
    !(await searchableHasOptions(page, clientPick)),
    "koi client nahi mila — master data seed karo"
  );

  await pickFromSearchable(page, clientPick);

  const mechanicPick = {
    trigger: /Select Mechanic/i,
    search: /Mechanic ka naam type karo/,
  };
  test.skip(
    !(await searchableHasOptions(page, mechanicPick)),
    "koi mechanic nahi mila — master data seed karo"
  );
  await pickFromSearchable(page, mechanicPick);

  // RHF validation: fault required, item optional (purana behaviour).
  await page.getByPlaceholder("e.g. Screen broken, Not charging").fill("E2E smoke — display issue");
  await page.getByPlaceholder("e.g. iPhone 15 Pro, Samsung S24").fill("E2E Test Device");

  await page.getByRole("button", { name: /Quick Save/i }).click();

  // Quick Save = billing skip, Pending job → view page.
  await expect(page).toHaveURL(/\/jobs\/\d+\/view/, { timeout: 45_000 });
});
