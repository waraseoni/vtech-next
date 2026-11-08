/**
 * Server-only public-site content loader.
 *
 * `system_info` service-role se padhta hai (RLS bypass), `site_content` JSON
 * validate karta hai, defaults + JSON + firm keys merge karta hai, aur result
 * ko `unstable_cache` (tag: `site-content`) me rakhta hai.
 *
 * DB/env fail → static defaults. Site kabhi blank/500 nahi hoti.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getAdminSupabase } from "./admin-supabase";
import { logger } from "./logger";
import {
  getDefaultSiteContent,
  getSiteMode,
  type PublicSiteContent,
  type SiteMode,
} from "./public-site-defaults";
import {
  mergeSiteContent,
  parseSiteContentJson,
  pickFirmRows,
  type FirmRow,
} from "./public-site-schema";

export const PUBLIC_SITE_CONTENT_TAG = "site-content";

async function readSystemInfoRows(): Promise<FirmRow[]> {
  try {
    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from("system_info").select("id, meta_field, meta_value");
    if (error) {
      logger.warn("public site content: system_info read failed:", error.message);
      return [];
    }
    return (data ?? []) as unknown as FirmRow[];
  } catch (error) {
    logger.warn("public site content: system_info unavailable:", error);
    return [];
  }
}

const loadCachedSiteContent = unstable_cache(
  async (mode: SiteMode): Promise<PublicSiteContent> => {
    const defaults = getDefaultSiteContent(mode);
    const rows = await readSystemInfoRows();
    const { values } = pickFirmRows(rows);
    const json = parseSiteContentJson(values.get("site_content"));
    const { content, warnings } = mergeSiteContent(defaults, json, rows);
    warnings.forEach((warning) => logger.warn(`[public-site] ${warning}`));
    return content;
  },
  ["public-site-content"],
  { tags: [PUBLIC_SITE_CONTENT_TAG], revalidate: 86400 }
);

/** Per-request deduped (React cache) + cross-request cached (unstable_cache). */
export const getPublicSiteContent = cache(async (): Promise<PublicSiteContent> => {
  const mode = getSiteMode();
  try {
    return await loadCachedSiteContent(mode);
  } catch (error) {
    logger.warn("public site content: falling back to defaults:", error);
    return getDefaultSiteContent(mode);
  }
});
