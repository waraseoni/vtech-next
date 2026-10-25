import { test, expect } from "@playwright/test";

import { allowWrites, hasAdminCreds, pickFromSearchable, searchableHasOptions } from "../utils";

test("direct sale: save via atomic RPC → sale view", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");
  test.skip(!allowWrites, "E2E_ALLOW_WRITES=1 nahi hai (ye test DB me sale row banata hai)");

  await page.goto("/direct-sales/new");
  await expect(page.getByRole("heading", { name: "New Direct Sale" })).toBeVisible({
    timeout: 30_000,
  });

  const productPick = {
    trigger: /Search karke product select karo/,
    search: /Product ka naam type karo/,
  };
  test.skip(
    !(await searchableHasOptions(page, productPick)),
    "koi product nahi mila — master data seed karo"
  );
  await pickFromSearchable(page, productPick);

  // Admin ke liye staff mandatory hai; staff login par ye select render hi nahi hota.
  const staffTrigger = page.getByRole("button", { name: /Select Staff Member/i });
  if (await staffTrigger.isVisible()) {
    await pickFromSearchable(page, {
      trigger: /Select Staff Member/i,
      search: /Staff|Mechanic/i,
    });
  }

  const walkIn = page.getByPlaceholder("Walk-in Customer");
  if (await walkIn.isVisible()) await walkIn.fill("E2E Customer");

  await page.getByRole("button", { name: /Create Sale/i }).click();

  // Out-of-stock product par pehla click sirf confirm maangta hai.
  const confirm = page.getByRole("button", { name: /Confirm Oversell/i });
  const needsConfirm = await confirm
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (needsConfirm) await confirm.click();

  // RPC `save_direct_sale` success → router.replace view page.
  await expect(page).toHaveURL(/\/direct-sales\/\d+\/view/, { timeout: 45_000 });
});
