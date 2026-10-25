import { expect, type Page } from "@playwright/test";

/** Write specs (job create / direct sale) DB me real rows banate hain. */
export const allowWrites = process.env.E2E_ALLOW_WRITES === "1";

/** Login creds — inke bina authed specs skip hoti hain. */
export const hasAdminCreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

/** SearchableSelect ka trigger → menu → first enabled option. */
export async function pickFromSearchable(
  page: Page,
  opts: { trigger: RegExp; search: RegExp }
): Promise<void> {
  await page.getByRole("button", { name: opts.trigger }).first().click();

  const searchInput = page.getByPlaceholder(opts.search);
  await expect(searchInput).toBeVisible();

  // Desktop menu: searchBox ka parent = menu panel, uske andar option rows.
  // (Mobile sheet bhi same structure use karta hai.)
  const menu = searchInput.locator("xpath=../..");
  const options = menu.locator("div.cursor-pointer");
  await expect(options.first()).toBeVisible();
  await options.first().click();
}

/** SearchableSelect me koi option hai ya nahi (empty master data → skip). */
export async function searchableHasOptions(
  page: Page,
  opts: { trigger: RegExp; search: RegExp }
): Promise<boolean> {
  await page.getByRole("button", { name: opts.trigger }).first().click();
  const searchInput = page.getByPlaceholder(opts.search);
  await expect(searchInput).toBeVisible();
  const menu = searchInput.locator("xpath=../..");
  const count = await menu.locator("div.cursor-pointer").count();
  await page.keyboard.press("Escape");
  return count > 0;
}
