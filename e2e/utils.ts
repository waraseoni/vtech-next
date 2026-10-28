import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Write specs (job create / direct sale) DB me real rows banate hain.
 *
 * Double guard: flag ke saath `E2E_WRITE_HOST` bhi match karna chahiye.
 * Warna CI/prod URL par galti se flag lagne se live data me rows ban sakti hain.
 * Local writes ke liye bhi `E2E_WRITE_HOST=localhost` explicitly set karein.
 */
const writeFlag = process.env.E2E_ALLOW_WRITES === "1";
const writeHost = (() => {
  try {
    return new URL(process.env.E2E_BASE_URL || "http://localhost:3000").hostname;
  } catch {
    return "";
  }
})();
export const allowWrites =
  writeFlag && Boolean(process.env.E2E_WRITE_HOST) && writeHost === process.env.E2E_WRITE_HOST;

/** Login creds — inke bina authed specs skip hoti hain. */
export const hasAdminCreds = Boolean(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

/**
 * SearchableSelect ka trigger → menu → first real option.
 *
 * Note: menu ke top par optional "clear" row hoti hai (jab `clearLabel` diya ho)
 * jo `cursor-pointer` bhi hai — usse skip karna zaroori hai, warna selection
 * clear ho jaati hai. Real option row ke andar `div.min-w-0` hota hai.
 */
const OPTION_ROW = "div.cursor-pointer:has(> div.min-w-0)";

/**
 * Options master data se aate hain (query async). Dev server par pehla load
 * slow hota hai — isliye instant `count()` nahi, bounded wait. `/jobs/new` par
 * 4-5 sequential Supabase queries chalti hain, parallel suite load me 20s se
 * zyada lag sakta hai — isliye caller apna timeout de sakta hai.
 */
const OPTIONS_TIMEOUT = 20_000;

async function openMenu(page: Page, trigger: RegExp, search: RegExp) {
  await page.getByRole("button", { name: trigger }).first().click();
  const searchInput = page.getByPlaceholder(search);
  await expect(searchInput).toBeVisible({ timeout: 15_000 });
  // Desktop menu: searchBox ka parent = menu panel.
  return searchInput.locator("xpath=../..");
}

/** SearchableSelect me select karne layak option hai ya nahi (empty master data → skip). */
export async function searchableHasOptions(
  page: Page,
  opts: { trigger: RegExp; search: RegExp; filter?: RegExp; timeout?: number }
): Promise<boolean> {
  const menu = await openMenu(page, opts.trigger, opts.search);
  const options = opts.filter
    ? menu.locator(OPTION_ROW).filter({ hasText: opts.filter })
    : menu.locator(OPTION_ROW);
  const has = await options
    .first()
    .waitFor({ state: "visible", timeout: opts.timeout ?? OPTIONS_TIMEOUT })
    .then(() => true)
    .catch(() => false);
  await page.keyboard.press("Escape");
  return has;
}

/** SearchableSelect ka trigger → menu → pehla matching option. */
export async function pickFromSearchable(
  page: Page,
  opts: { trigger: RegExp; search: RegExp; filter?: RegExp; timeout?: number }
): Promise<void> {
  const menu = await openMenu(page, opts.trigger, opts.search);
  const options = opts.filter
    ? menu.locator(OPTION_ROW).filter({ hasText: opts.filter })
    : menu.locator(OPTION_ROW);
  await expect(options.first()).toBeVisible({ timeout: opts.timeout ?? OPTIONS_TIMEOUT });
  await options.first().click();
}

/**
 * Dev mode me pehli paint SSR se aati hai, React hydration uske kuch der baad
 * hoti hai. Us window me click "kho" jaata hai (listener attach hi nahi hua) —
 * isliye click repeat karte hain jab tak URL effect na dikhe. Buttons
 * idempotent hone chahiye (tab switch jaisa).
 */
export async function clickUntilUrl(
  page: Page,
  button: Locator,
  urlPattern: RegExp,
  timeout = 45_000
): Promise<void> {
  await expect(async () => {
    if (!urlPattern.test(page.url())) await button.click();
    expect(page.url()).toMatch(urlPattern);
  }).toPass({ timeout, intervals: [500, 1_000, 2_000] });
}
