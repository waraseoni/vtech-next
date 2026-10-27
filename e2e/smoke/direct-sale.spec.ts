import { test, expect } from "@playwright/test";

import { allowWrites, hasAdminCreds, pickFromSearchable, searchableHasOptions } from "../utils";

// Dev server par pehli hit par route compile hota hai + RPC round-trip —
// options ke liye extra wait.
const MASTER_TIMEOUT = 90_000;

test("direct sale: save via atomic RPC → sale view", async ({ page }) => {
  test.skip(!hasAdminCreds, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");
  test.skip(!allowWrites, "E2E_ALLOW_WRITES=1 nahi hai (ye test DB me sale row banata hai)");

  await page.goto("/direct-sales/new");
  await expect(page.getByRole("heading", { name: "New Direct Sale" })).toBeVisible({
    timeout: 60_000,
  });

  const productPick = {
    trigger: /Search karke product select karo/,
    search: /Product ka naam type karo/,
  };
  // In-stock product prefer karo: out-of-stock par form oversell confirm maangta
  // hai (do submit), jo load ke waqt flaky ho jaata hai. Koi in-stock product na
  // ho to pehla product hi le lo — oversell path neeche handle hai.
  const inStock = /Stock: \d/;
  const hasInStock = await searchableHasOptions(page, {
    ...productPick,
    filter: inStock,
    timeout: MASTER_TIMEOUT,
  });
  const hasAny =
    hasInStock || (await searchableHasOptions(page, { ...productPick, timeout: MASTER_TIMEOUT }));
  test.skip(!hasAny, "koi product nahi mila — master data seed karo");

  await pickFromSearchable(
    page,
    hasInStock
      ? { ...productPick, filter: inStock, timeout: MASTER_TIMEOUT }
      : { ...productPick, timeout: MASTER_TIMEOUT }
  );

  // Product select sirf dropdown bharta hai — "Add" se hi line item banti hai
  // (warna Create Sale disabled rehta hai: items.length === 0).
  await page.getByRole("button", { name: /^Add$/ }).first().click();
  await expect(page.getByRole("button", { name: /Create Sale/i })).toBeEnabled({ timeout: 15_000 });

  // Admin ke liye staff mandatory hai; staff login par ye select render hi nahi hota.
  const staffTrigger = page.getByRole("button", { name: /Select Staff Member/i });
  if (await staffTrigger.isVisible()) {
    await pickFromSearchable(page, {
      trigger: /Select Staff Member/i,
      // SaleForm me staff select par explicit searchPlaceholder nahi hai →
      // SearchableSelect ka default.
      search: /^Search karo/,
      timeout: MASTER_TIMEOUT,
    });
  }

  const walkIn = page.getByPlaceholder("Walk-in Customer");
  if (await walkIn.isVisible()) await walkIn.fill("E2E Customer");

  await page.getByRole("button", { name: /Create Sale/i }).click();

  // Out-of-stock product par pehla click sirf confirm maangta hai (button
  // "Confirm Oversell" ban jaata hai). Dev server slow ho to state flip late
  // hota hai — isliye bounded wait + dobara visibility check.
  const confirm = page.getByRole("button", { name: /Confirm Oversell/i });
  const needsConfirm = await confirm
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (needsConfirm) await confirm.click();

  // RPC `save_direct_sale` success → router.replace view page.
  await expect(page).toHaveURL(/\/direct-sales\/\d+\/view/, { timeout: 60_000 });
});
