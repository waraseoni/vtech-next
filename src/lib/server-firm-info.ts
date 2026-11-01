/**
 * Per-request cached `system_info` reader (server only).
 *
 * React `cache()` ek hi server render ke andar duplicate calls dedupe karta hai,
 * isliye ek page par multiple modules firm-info maangein to DB par ek hi query
 * jati hai. Money data yahan nahi aata — sirf branding/WA template keys.
 */

import { cache } from "react";
import { getServerSupabase } from "./api-auth";
import { logger } from "./logger";

export type FirmInfo = Record<string, string>;

export const getFirmInfo = cache(async (): Promise<FirmInfo> => {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase.from("system_info").select("meta_field, meta_value");
    const info: FirmInfo = {};
    (data || []).forEach((r: { meta_field: string; meta_value: string | null }) => {
      info[r.meta_field] = r.meta_value ?? "";
    });
    return info;
  } catch (e) {
    logger.warn("system_info fetch failed:", e);
    return {};
  }
});
