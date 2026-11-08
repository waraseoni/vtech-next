import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminSupabase } from "@/lib/admin-supabase";
import { requireAdmin } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { PUBLIC_SITE_CONTENT_TAG } from "@/lib/public-site-content";
import {
  getDefaultSiteContent,
  getSiteMode,
  SERVICE_IDS,
  type SiteContentJson,
} from "@/lib/public-site-defaults";
import {
  cleanSiteText,
  cleanSiteUrl,
  mergeSiteContent,
  parseSiteContentJson,
  pickFirmRows,
  sanitizeSiteContentJson,
  serializeSiteContentJson,
  type FirmRow,
} from "@/lib/public-site-schema";

const admin = getAdminSupabase();

const FIRM_TEXT_FIELDS = {
  name: 120,
  short_name: 60,
  tagline: 120,
  owner: 120,
  contact: 60,
  whatsapp: 80,
  email: 160,
  address: 400,
  biz_days: 60,
  announcement: 200,
  footer_text: 300,
  logo: 2048,
  cover: 2048,
} as const;

const FIRM_URL_FIELDS = ["logo", "cover", "map_url", "facebook", "instagram", "youtube"] as const;
const FIRM_TIME_FIELDS = ["biz_open", "biz_close"] as const;

async function readRows(): Promise<FirmRow[]> {
  const { data, error } = await admin.from("system_info").select("id, meta_field, meta_value");
  if (error) throw new Error(error.message);
  return (data ?? []) as FirmRow[];
}

async function readFieldRow(field: string): Promise<{ id: number | string } | null> {
  const { data } = await admin
    .from("system_info")
    .select("id")
    .eq("meta_field", field)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function writeField(field: string, value: string): Promise<string | null> {
  const existing = await readFieldRow(field);
  if (existing) {
    const { error } = await admin
      .from("system_info")
      .update({ meta_value: value })
      .eq("id", existing.id);
    return error ? error.message : null;
  }
  const { error } = await admin
    .from("system_info")
    .insert({ meta_field: field, meta_value: value });
  return error ? error.message : null;
}

type FirmPatch = Record<string, string | number | null>;

function validateFirmPatch(input: unknown): { value: FirmPatch; errors: string[] } {
  const value: FirmPatch = {};
  const errors: string[] = [];
  if (input === undefined) return { value, errors };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { value, errors: ["firm object expected"] };
  }

  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    const isText = key in FIRM_TEXT_FIELDS;
    const isUrl = (FIRM_URL_FIELDS as readonly string[]).includes(key);
    const isTime = (FIRM_TIME_FIELDS as readonly string[]).includes(key);
    const isYear = key === "established_year";
    if (!isText && !isUrl && !isTime && !isYear) {
      errors.push(`${key}: unknown field`);
      continue;
    }

    const rawValue = raw[key];
    if (rawValue !== null && typeof rawValue !== "string" && typeof rawValue !== "number") {
      errors.push(`${key}: text value expected`);
      continue;
    }
    const text = rawValue === null ? "" : String(rawValue).trim();

    if (isYear) {
      if (text && !/^(18|19|20|21)\d{2}$/.test(text)) {
        errors.push(`${key}: 4-digit year expected`);
        continue;
      }
      value[key] = text;
      continue;
    }
    if (isTime) {
      if (text && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(text)) {
        errors.push(`${key}: HH:MM time expected`);
        continue;
      }
      value[key] = text;
      continue;
    }
    if (isUrl) {
      if (text && cleanSiteUrl(text, "") === "") {
        errors.push(`${key}: https:// ya / se shuru hone wala URL do`);
        continue;
      }
      value[key] = cleanSiteText(
        text,
        FIRM_TEXT_FIELDS[key as keyof typeof FIRM_TEXT_FIELDS] ?? 2048,
        ""
      );
      continue;
    }
    value[key] = cleanSiteText(text, FIRM_TEXT_FIELDS[key as keyof typeof FIRM_TEXT_FIELDS], "");
  }
  return { value, errors };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Section patch ko existing DB section par deep-merge karta hai. Editor sirf
 * changed fields bhejta hai; baaki saved overrides preserve rehte hain. Arrays
 * aur `null` (explicit reset) replace hote hain, recursively merge nahi.
 */
function mergeSectionPatch(existing: unknown, patch: unknown): unknown {
  if (!isPlainObject(existing) || !isPlainObject(patch)) return patch;
  const out: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    out[key] =
      isPlainObject(value) && isPlainObject(existing[key])
        ? mergeSectionPatch(existing[key], value)
        : value;
  }
  return out;
}

function applySectionPatch(existing: SiteContentJson, patch: SiteContentJson): SiteContentJson {
  const next = { ...existing } as Record<string, unknown>;
  for (const key of ["seo", "home", "faq", "about", "contactPage", "footer"] as const) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const value = patch[key];
    if (value === null) delete next[key];
    else next[key] = mergeSectionPatch(existing[key], value);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "services")) {
    const patchServices = patch.services;
    if (patchServices === null) {
      delete next.services;
    } else {
      const existingServices = (existing.services ?? {}) as Record<string, unknown>;
      const services: Record<string, unknown> = { ...existingServices };
      for (const id of SERVICE_IDS) {
        if (!patchServices || !Object.prototype.hasOwnProperty.call(patchServices, id)) continue;
        const value = patchServices[id];
        if (value === null) delete services[id];
        else if (value) services[id] = mergeSectionPatch(existingServices[id], value);
      }
      next.services = services;
    }
  }
  return next as SiteContentJson;
}

async function writeActivity(
  action: string,
  details: string,
  userId: string,
  mechanicRow: { mechanic_id: number | null } | null
) {
  try {
    await admin.from("activity_logs").insert({
      user_id: mechanicRow?.mechanic_id ?? 0,
      action,
      module: "Settings",
      meta_id: "site-content",
      details,
      date_created: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn(`[site-content] activity log failed for ${userId}:`, error);
  }
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const rows = await readRows();
    const { values } = pickFirmRows(rows);
    const raw = values.get("site_content") ?? "";
    const json = parseSiteContentJson(raw) ?? {};
    const mode = getSiteMode();
    const { content } = mergeSiteContent(getDefaultSiteContent(mode), json, rows);

    return NextResponse.json({
      ok: true,
      mode,
      updatedAt: content.updatedAt,
      // Effective (defaults + DB) values — editor preview ke liye.
      content,
      // Sirf DB overrides — save patch banane ke liye.
      patch: json,
      // Raw firm values; khaali = default chalu hai (form placeholder dikhaye).
      firm: Object.fromEntries(values),
    });
  } catch (error) {
    logger.error("[site-content] read failed:", error);
    return NextResponse.json({ error: "Site content load nahi hua" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Valid JSON body bhejo" }, { status: 400 });
  }

  if (!Object.prototype.hasOwnProperty.call(body, "expectedUpdatedAt")) {
    return NextResponse.json(
      { error: "expectedUpdatedAt chahiye (current value ya null)" },
      { status: 400 }
    );
  }
  const expectedUpdatedAt =
    typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt.trim()
      ? body.expectedUpdatedAt.trim()
      : null;

  const firmCheck = validateFirmPatch(body.firm);
  if (firmCheck.errors.length > 0) {
    return NextResponse.json(
      { error: "Kuch fields invalid hain", fieldErrors: firmCheck.errors },
      { status: 400 }
    );
  }
  const firmPatch = firmCheck.value;

  let patch: SiteContentJson | null = null;
  if (body.patch !== undefined) {
    patch = sanitizeSiteContentJson(body.patch);
    if (!patch) {
      return NextResponse.json(
        { error: "site content patch invalid hai (version 1 object expected)" },
        { status: 400 }
      );
    }
  }

  const hasPatch = !!patch && Object.keys(patch).length > 0;
  const hasFirm = Object.keys(firmPatch).length > 0;
  if (!hasPatch && !hasFirm) {
    return NextResponse.json({ error: "Koi change nahi mila" }, { status: 400 });
  }

  try {
    const rows = await readRows();
    const { values } = pickFirmRows(rows);
    const currentUpdatedAt = values.get("site_content_updated_at") ?? null;

    if ((currentUpdatedAt || null) !== expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: "Content kisi aur ne update kar diya — reload karke dobara try karein",
          currentUpdatedAt,
        },
        { status: 409 }
      );
    }

    const existingJson = parseSiteContentJson(values.get("site_content")) ?? {};
    const nextJson = hasPatch ? applySectionPatch(existingJson, patch!) : existingJson;

    let serialized = "";
    if (hasPatch) {
      const serializedResult = serializeSiteContentJson(nextJson);
      if (!serializedResult.ok) {
        return NextResponse.json({ error: serializedResult.error }, { status: 400 });
      }
      serialized = serializedResult.raw;
    }

    const failed: { field: string; error: string }[] = [];
    for (const [field, value] of Object.entries(firmPatch)) {
      const error = await writeField(field, String(value));
      if (error) failed.push({ field, error });
    }
    if (failed.length > 0) {
      logger.warn("[site-content] partial firm save failure:", failed);
      return NextResponse.json(
        {
          error: "Kuch fields save nahi hui — baaki changes bhi nahi likhe gaye",
          failed,
        },
        { status: 500 }
      );
    }

    const updatedAt = new Date().toISOString();
    if (hasPatch) {
      const jsonError = await writeField("site_content", serialized);
      if (jsonError) {
        return NextResponse.json(
          { error: `site_content save failed: ${jsonError}` },
          { status: 500 }
        );
      }
    }
    const stampError = await writeField("site_content_updated_at", updatedAt);
    if (stampError) {
      return NextResponse.json({ error: `updated_at save failed: ${stampError}` }, { status: 500 });
    }

    revalidateTag(PUBLIC_SITE_CONTENT_TAG, "max");
    revalidatePath("/", "layout");
    revalidatePath("/sitemap.xml");

    const touched = [
      ...(hasPatch ? Object.keys(patch!) : []),
      ...Object.keys(firmPatch).map((field) => `firm:${field}`),
    ];
    const { data: mechanicRow } = await admin
      .from("profiles")
      .select("mechanic_id")
      .eq("id", session.user.id)
      .maybeSingle();
    await writeActivity(
      "Updated Website Content",
      `Saved: ${touched.join(", ")}`,
      session.user.id,
      mechanicRow ?? null
    );

    return NextResponse.json({ ok: true, updatedAt, patch: nextJson });
  } catch (error) {
    logger.error("[site-content] save failed:", error);
    return NextResponse.json({ error: "Website content save nahi hua" }, { status: 500 });
  }
}
