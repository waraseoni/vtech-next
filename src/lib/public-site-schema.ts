/**
 * Public-site content validation + merge (pure, testable).
 *
 * Rules (binding — see docs/plans/public_site_db_content_plan_nov08_2026.md):
 * - Precedence: hardcoded defaults < `site_content` JSON < existing firm keys.
 * - DB value sirf non-empty + valid hone par override karta hai; warna default.
 * - Invalid item drop; poora section invalid → default section.
 * - `site_content` corrupt/oversized → defaults.
 * - `meta_field` par unique constraint nahi hai → lowest `id` deterministic pick.
 */

import type { ArtKind } from "@/app/(public)/components/equipment-art";
import {
  PUBLIC_ICONS,
  SERVICE_IDS,
  applySiteTokens,
  digitsOnly,
  formatBusinessHours,
  type AboutContent,
  type BrandContent,
  type ContactInfoContent,
  type ContactPageContent,
  type DeepPartial,
  type EquipmentItem,
  type EvHighlight,
  type FaqContent,
  type FaqItem,
  type FeatureItem,
  type FeaturedItem,
  type FooterContent,
  type HomeContent,
  type LegalLink,
  type PublicIcon,
  type PublicSiteContent,
  type SeoContent,
  type ServiceId,
  type ServicePageContent,
  type SiteContentJson,
  type StatItem,
  type StepItem,
  type TeamMember,
  type Testimonial,
} from "./public-site-defaults";

export const SITE_CONTENT_MAX_BYTES = 200 * 1024;
export const SITE_CONTENT_VERSION = 1;

export const ART_KINDS: readonly ArtKind[] = [
  "moving-head",
  "par",
  "strobe",
  "beam-bar",
  "pixel-bar",
  "fog",
  "bubble",
  "dmx",
  "laser",
  "led-wall",
  "plc",
  "hmi",
  "panel",
  "pcb",
  "vfd",
  "servo",
  "scada",
  "power-module",
  "relay",
  "industrial",
  "smps",
  "ev-charger",
  "ups",
  "battery-charger",
  "led-driver",
  "adapter",
];

export type FirmRow = {
  id?: number | string | null;
  meta_field: string;
  meta_value: string | null;
};

export type FirmRowMap = {
  values: Map<string, string>;
  warnings: string[];
};

export type MergedSiteContent = {
  content: PublicSiteContent;
  warnings: string[];
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

/** Trimmed, control-char-free string; empty → null. Newlines preserved. */
function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return cleaned || null;
}

export function cleanSiteText(value: unknown, maxLength: number, fallback: string): string {
  const text = readString(value);
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

export function cleanSiteUrl(value: unknown, fallback = ""): string {
  const text = readString(value);
  if (!text || text.length > 2048 || /\s/.test(text)) return fallback;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") return text;
    } catch {
      /* invalid URL */
    }
  }
  return fallback;
}

function cleanBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Decimal coordinate; blank/invalid/out-of-range → null (0 valid nahi mana). */
function cleanCoordinate(value: unknown, min: number, max: number): number | null {
  const text = typeof value === "string" ? value.trim() : value;
  if (text === "" || text === null || text === undefined) return null;
  const n = typeof text === "number" ? text : Number(text);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 1e6) / 1e6;
}

function cleanNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  integer = true
): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return integer ? Math.round(n) : n;
}

export function cleanArtKind(value: unknown, fallback: ArtKind): ArtKind {
  return typeof value === "string" && (ART_KINDS as readonly string[]).includes(value)
    ? (value as ArtKind)
    : fallback;
}

export function cleanPublicIcon(value: unknown, fallback: PublicIcon): PublicIcon {
  return typeof value === "string" && (PUBLIC_ICONS as readonly string[]).includes(value)
    ? (value as PublicIcon)
    : fallback;
}

export function cleanTime(value: unknown, fallback: string): string {
  const text = readString(value);
  return text && /^([01]?\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

export function formatPhoneDisplay(value: string): string {
  const text = value.trim();
  if (!text) return "";
  if (text.startsWith("+")) return text;
  const digits = digitsOnly(text);
  return digits ? `+91 ${digits}` : text;
}

function cleanStringList(value: unknown, maxItems: number, itemMax: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value.slice(0, maxItems)) {
    const text = readString(item);
    if (text) out.push(text.slice(0, itemMax));
  }
  return out.length ? out : null;
}

function cleanStats(value: unknown, maxItems = 8): StatItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: StatItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const label = readString(row.label);
    const numeric = cleanNumber(row.value, 0, 1_000_000_000, NaN);
    if (!label || !Number.isFinite(numeric)) continue;
    out.push({
      value: numeric,
      suffix: cleanSiteText(row.suffix, 8, "+"),
      label: label.slice(0, 60),
    });
  }
  return out.length ? out : null;
}

function cleanTestimonials(value: unknown, maxItems = 12): Testimonial[] | null {
  if (!Array.isArray(value)) return null;
  const out: Testimonial[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const quote = readString(row.quote);
    const name = readString(row.name);
    if (!quote || !name) continue;
    const rating = cleanNumber(row.rating, 1, 5, 5);
    out.push({ quote: quote.slice(0, 600), name: name.slice(0, 80), rating });
  }
  return out.length ? out : null;
}

function cleanFeatures(value: unknown, maxItems = 12): FeatureItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: FeatureItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const title = readString(row.title);
    const desc = readString(row.desc);
    if (!title || !desc) continue;
    out.push({
      icon: cleanPublicIcon(row.icon, "shield"),
      title: title.slice(0, 80),
      desc: desc.slice(0, 300),
    });
  }
  return out.length ? out : null;
}

function cleanFeatured(value: unknown, maxItems = 24): FeaturedItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: FeaturedItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const title = readString(row.title);
    const desc = readString(row.desc);
    if (!title || !desc) continue;
    out.push({
      art: cleanArtKind(row.art, "pcb"),
      title: title.slice(0, 80),
      desc: desc.slice(0, 200),
    });
  }
  return out.length ? out : null;
}

function cleanTeam(value: unknown, maxItems = 12): TeamMember[] | null {
  if (!Array.isArray(value)) return null;
  const out: TeamMember[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const name = readString(row.name);
    const role = readString(row.role);
    const quote = readString(row.quote);
    if (!name || !role || !quote) continue;
    out.push({
      name: name.slice(0, 80),
      role: role.slice(0, 80),
      quote: quote.slice(0, 400),
    });
  }
  return out.length ? out : null;
}

function cleanSteps(value: unknown, maxItems = 10): StepItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: StepItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const title = readString(row.title);
    const desc = readString(row.desc);
    if (!title || !desc) continue;
    out.push({ title: title.slice(0, 120), desc: desc.slice(0, 300) });
  }
  return out.length ? out : null;
}

function cleanPoints(value: unknown, maxItems = 20): StepItem[] | null {
  return cleanSteps(value, maxItems);
}

function cleanEquipment(value: unknown, maxItems = 40): EquipmentItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: EquipmentItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const name = readString(row.name);
    const detail = readString(row.detail);
    if (!name || !detail) continue;
    const badge = row.badge === "available" || row.badge === "coming" ? row.badge : undefined;
    const image = cleanSiteUrl(row.image, "");
    const turnaround = readString(row.turnaround);
    const warranty = readString(row.warranty);
    const price = cleanNumber(row.startingPrice, 0, 10_000_000, NaN, false);
    out.push({
      art: cleanArtKind(row.art, "pcb"),
      name: name.slice(0, 120),
      detail: detail.slice(0, 300),
      ...(badge ? { badge } : {}),
      ...(image ? { image } : {}),
      ...(turnaround ? { turnaround: turnaround.slice(0, 80) } : {}),
      ...(Number.isFinite(price) && price > 0 ? { startingPrice: Math.round(price) } : {}),
      ...(warranty ? { warranty: warranty.slice(0, 120) } : {}),
    });
  }
  return out.length ? out : null;
}

function cleanFaqItems(value: unknown, maxItems = 10): FaqItem[] | null {
  if (!Array.isArray(value)) return null;
  const out: FaqItem[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const q = readString(row.q);
    const a = readString(row.a);
    if (!q || !a) continue;
    out.push({ q: q.slice(0, 160), a: a.slice(0, 800) });
  }
  return out.length ? out : null;
}

function cleanLegalLinks(value: unknown, maxItems = 10): LegalLink[] | null {
  if (!Array.isArray(value)) return null;
  const out: LegalLink[] = [];
  for (const item of value.slice(0, maxItems)) {
    const row = asRecord(item);
    if (!row) continue;
    const label = readString(row.label);
    const href = cleanSiteUrl(row.href, "");
    if (!label || !href) continue;
    out.push({ label: label.slice(0, 60), href });
  }
  return out.length ? out : null;
}

function rowNumericId(id: FirmRow["id"]): number | null {
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && id.trim() && Number.isFinite(Number(id))) return Number(id);
  return null;
}

/**
 * `meta_field` par unique constraint nahi hai. Lowest numeric `id` wins;
 * missing ids original order par rehte hain. Duplicates warn hote hain.
 */
export function pickFirmRows(rows: FirmRow[]): FirmRowMap {
  const warnings: string[] = [];
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    const aId = rowNumericId(a.row.id);
    const bId = rowNumericId(b.row.id);
    if (aId === null && bId === null) return a.index - b.index;
    if (aId === null) return 1;
    if (bId === null) return -1;
    if (aId !== bId) return aId - bId;
    return a.index - b.index;
  });

  const values = new Map<string, string>();
  for (const { row } of indexed) {
    const field = readString(row.meta_field);
    if (!field) continue;
    const value = typeof row.meta_value === "string" ? row.meta_value.trim() : "";
    if (!value) continue;
    if (values.has(field)) {
      warnings.push(`system_info duplicate meta_field "${field}" — lowest id used`);
      continue;
    }
    values.set(field, value);
  }
  return { values, warnings };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function parseSiteContentJson(raw: string | null | undefined): SiteContentJson | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (byteLength(raw) > SITE_CONTENT_MAX_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.version !== undefined && Number(parsed.version) !== SITE_CONTENT_VERSION) {
      return null;
    }
    return parsed as SiteContentJson;
  } catch {
    return null;
  }
}

function mergeHome(
  home: HomeContent,
  patch: DeepPartial<HomeContent> | null | undefined
): HomeContent {
  if (!patch) return home;
  return {
    heroBadge: cleanSiteText(patch.heroBadge, 120, home.heroBadge),
    heroTitle: cleanSiteText(patch.heroTitle, 200, home.heroTitle),
    heroHighlight: cleanSiteText(patch.heroHighlight, 160, home.heroHighlight),
    heroSubtitle: cleanSiteText(patch.heroSubtitle, 600, home.heroSubtitle),
    trustChips: cleanStringList(patch.trustChips, 8, 60) ?? home.trustChips,
    stats: cleanStats(patch.stats) ?? home.stats,
    featured: cleanFeatured(patch.featured) ?? home.featured,
    why: cleanFeatures(patch.why, 12) ?? home.why,
    testimonials: cleanTestimonials(patch.testimonials, 12) ?? home.testimonials,
    ctaTitle: cleanSiteText(patch.ctaTitle, 160, home.ctaTitle),
    ctaSubtitle: cleanSiteText(patch.ctaSubtitle, 400, home.ctaSubtitle),
  };
}

function mergeAbout(
  about: AboutContent,
  patch: DeepPartial<AboutContent> | null | undefined
): AboutContent {
  if (!patch) return about;
  const emergency =
    patch.emergency === null
      ? null
      : isRecord(patch.emergency)
        ? {
            value: cleanSiteText(patch.emergency.value, 40, about.emergency?.value ?? "24×7"),
            label: cleanSiteText(
              patch.emergency.label,
              80,
              about.emergency?.label ?? "Emergency Repair Service"
            ),
          }
        : about.emergency;

  return {
    badge: cleanSiteText(patch.badge, 80, about.badge),
    title: cleanSiteText(patch.title, 200, about.title),
    highlight: cleanSiteText(patch.highlight, 160, about.highlight),
    subtitle: cleanSiteText(patch.subtitle, 600, about.subtitle),
    stats: cleanStats(patch.stats) ?? about.stats,
    storyHeading: cleanSiteText(patch.storyHeading, 160, about.storyHeading),
    storyHighlight: cleanSiteText(patch.storyHighlight, 160, about.storyHighlight),
    story: cleanStringList(patch.story, 12, 1200) ?? about.story,
    quote: cleanSiteText(patch.quote, 800, about.quote),
    badges: cleanStringList(patch.badges, 8, 60) ?? about.badges,
    emergency,
    why: cleanFeatures(patch.why, 12) ?? about.why,
    team: cleanTeam(patch.team, 12) ?? about.team,
    testimonials: cleanTestimonials(patch.testimonials, 12) ?? about.testimonials,
    visitTitle: cleanSiteText(patch.visitTitle, 100, about.visitTitle),
  };
}

function mergeContactPage(
  page: ContactPageContent,
  patch: DeepPartial<ContactPageContent> | null | undefined
): ContactPageContent {
  if (!patch) return page;
  const form = asRecord(patch.formCopy);
  return {
    badge: cleanSiteText(patch.badge, 80, page.badge),
    title: cleanSiteText(patch.title, 200, page.title),
    highlight: cleanSiteText(patch.highlight, 160, page.highlight),
    subtitle: cleanSiteText(patch.subtitle, 600, page.subtitle),
    serviceOptions: cleanStringList(patch.serviceOptions, 20, 60) ?? page.serviceOptions,
    formCopy: {
      name: cleanSiteText(form?.name, 60, page.formCopy.name),
      mobile: cleanSiteText(form?.mobile, 60, page.formCopy.mobile),
      email: cleanSiteText(form?.email, 60, page.formCopy.email),
      service: cleanSiteText(form?.service, 60, page.formCopy.service),
      message: cleanSiteText(form?.message, 60, page.formCopy.message),
      submit: cleanSiteText(form?.submit, 60, page.formCopy.submit),
    },
  };
}

function mergeFaq(faq: FaqContent, patch: DeepPartial<FaqContent> | null | undefined): FaqContent {
  if (!patch) return faq;
  return {
    badge: cleanSiteText(patch.badge, 60, faq.badge),
    title: cleanSiteText(patch.title, 120, faq.title),
    subtitle: cleanSiteText(patch.subtitle, 400, faq.subtitle),
    items: cleanFaqItems(patch.items) ?? faq.items,
  };
}

function mergeService(
  service: ServicePageContent,
  patch: DeepPartial<ServicePageContent> | null | undefined
): ServicePageContent {
  if (!patch) return service;
  const headings = asRecord(patch.headings);
  let evHighlight = service.evHighlight;
  if (patch.evHighlight === null) {
    evHighlight = null;
  } else if (isRecord(patch.evHighlight)) {
    const base = service.evHighlight;
    const body = cleanSiteText(patch.evHighlight.body, 800, base?.body ?? "");
    const title = cleanSiteText(patch.evHighlight.title, 120, base?.title ?? "EV Charger");
    if (body && title) {
      evHighlight = {
        enabled: cleanBool(patch.evHighlight.enabled, base?.enabled ?? true),
        badge: cleanSiteText(patch.evHighlight.badge, 60, base?.badge ?? "New Service"),
        title,
        highlight: cleanSiteText(
          patch.evHighlight.highlight,
          120,
          base?.highlight ?? "Repair & Service"
        ),
        body,
        chips: cleanStringList(patch.evHighlight.chips, 8, 60) ?? base?.chips ?? [],
        images: cleanStringList(patch.evHighlight.images, 6, 2048) ?? base?.images ?? [],
      };
      evHighlight.images = evHighlight.images.filter((image) => cleanSiteUrl(image, "") !== "");
    }
  }

  return {
    ...service,
    enabled: cleanBool(patch.enabled, service.enabled),
    label: cleanSiteText(patch.label, 80, service.label),
    desc: cleanSiteText(patch.desc, 200, service.desc),
    art: cleanArtKind(patch.art, service.art),
    badge: cleanSiteText(patch.badge, 80, service.badge),
    title: cleanSiteText(patch.title, 120, service.title),
    highlight: cleanSiteText(patch.highlight, 120, service.highlight),
    subtitle: cleanSiteText(patch.subtitle, 600, service.subtitle),
    minimalSubtitle: cleanSiteText(patch.minimalSubtitle, 600, service.minimalSubtitle),
    headings: {
      equipment: cleanSiteText(headings?.equipment, 100, service.headings.equipment),
      process: cleanSiteText(headings?.process, 100, service.headings.process),
      why: cleanSiteText(headings?.why, 100, service.headings.why),
      equipmentNote: cleanSiteText(headings?.equipmentNote, 100, service.headings.equipmentNote),
    },
    equipment: cleanEquipment(patch.equipment) ?? service.equipment,
    steps: cleanSteps(patch.steps) ?? service.steps,
    points: cleanPoints(patch.points) ?? service.points,
    evHighlight,
  };
}

function mergeFooter(
  footer: FooterContent,
  patch: DeepPartial<FooterContent> | null | undefined
): FooterContent {
  if (!patch) return footer;
  return {
    tagline: cleanSiteText(patch.tagline, 300, footer.tagline),
    whatsappCta: cleanSiteText(patch.whatsappCta, 200, footer.whatsappCta),
    copyrightText: cleanSiteText(patch.copyrightText, 120, footer.copyrightText),
    legalLinks: cleanLegalLinks(patch.legalLinks) ?? footer.legalLinks,
  };
}

function resolveTokensDeep<T>(value: T, content: PublicSiteContent): T {
  if (typeof value === "string") return applySiteTokens(value, content) as T;
  if (Array.isArray(value)) {
    return value.map((item) => resolveTokensDeep(item, content)) as T;
  }
  if (isRecord(value)) {
    const out: UnknownRecord = {};
    for (const key of Object.keys(value)) {
      out[key] = resolveTokensDeep(value[key], content);
    }
    return out as T;
  }
  return value;
}

/**
 * Defaults + JSON + firm keys merge. Pure function — loader isi ko call karta
 * hai, tests bhi. Koi DB access nahi.
 */
export function mergeSiteContent(
  defaults: PublicSiteContent,
  json: SiteContentJson | null,
  rows: FirmRow[]
): MergedSiteContent {
  const { values: firm, warnings } = pickFirmRows(rows);
  const content: PublicSiteContent = structuredClone(defaults);

  if (json) {
    content.seo = {
      title: cleanSiteText(json.seo?.title, 120, content.seo.title),
      description: cleanSiteText(json.seo?.description, 320, content.seo.description),
      keywords: cleanSiteText(json.seo?.keywords, 500, content.seo.keywords),
    };
    content.home = mergeHome(content.home, json.home);
    content.about = mergeAbout(content.about, json.about);
    content.contactPage = mergeContactPage(content.contactPage, json.contactPage);
    content.faq = mergeFaq(content.faq, json.faq);
    for (const id of SERVICE_IDS) {
      content.services[id] = mergeService(content.services[id], json.services?.[id]);
    }
    content.footer = mergeFooter(content.footer, json.footer);
  }

  // Firm keys last — Settings ke canonical fields (name/contact/etc.) jeette hain.
  const brand: BrandContent = content.brand;
  brand.name = cleanSiteText(firm.get("name"), 120, brand.name);
  brand.shortName = cleanSiteText(firm.get("short_name"), 60, brand.shortName);
  brand.tagline = cleanSiteText(firm.get("tagline"), 120, brand.tagline);
  brand.owner = cleanSiteText(firm.get("owner"), 120, brand.owner);
  brand.establishedYear = cleanNumber(
    firm.get("established_year"),
    1900,
    2100,
    brand.establishedYear ?? new Date().getFullYear()
  );
  brand.logoUrl = cleanSiteUrl(firm.get("logo"), brand.logoUrl);
  brand.coverUrl = cleanSiteUrl(firm.get("cover"), brand.coverUrl);

  const contact: ContactInfoContent = content.contact;
  contact.phone = formatPhoneDisplay(cleanSiteText(firm.get("contact"), 60, contact.phone));
  const phoneDigits = digitsOnly(contact.phone);
  contact.phoneHref = phoneDigits ? `tel:+${phoneDigits}` : contact.phoneHref;
  const whatsappDigits = digitsOnly(cleanSiteText(firm.get("whatsapp"), 80, contact.whatsapp));
  contact.whatsapp = whatsappDigits || contact.whatsapp;
  contact.whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : contact.whatsappHref;
  contact.email = cleanSiteText(firm.get("email"), 160, contact.email);
  contact.address = cleanSiteText(firm.get("address"), 400, contact.address);
  contact.businessDays = cleanSiteText(firm.get("biz_days"), 60, contact.businessDays);
  contact.openTime = cleanTime(firm.get("biz_open"), contact.openTime);
  contact.closeTime = cleanTime(firm.get("biz_close"), contact.closeTime);
  contact.businessHours = formatBusinessHours(
    contact.businessDays,
    contact.openTime,
    contact.closeTime
  );
  contact.mapUrl = cleanSiteUrl(firm.get("map_url"), contact.mapUrl);
  // Office GPS geofence settings se — dono valid hone par hi expose karte hain.
  const latitude = cleanCoordinate(firm.get("geofence_lat"), -90, 90);
  const longitude = cleanCoordinate(firm.get("geofence_lng"), -180, 180);
  contact.latitude = latitude !== null && longitude !== null ? latitude : null;
  contact.longitude = latitude !== null && longitude !== null ? longitude : null;
  contact.facebook = cleanSiteUrl(firm.get("facebook"), contact.facebook);
  contact.instagram = cleanSiteUrl(firm.get("instagram"), contact.instagram);
  contact.youtube = cleanSiteUrl(firm.get("youtube"), contact.youtube);
  contact.announcement = cleanSiteText(firm.get("announcement"), 200, contact.announcement);

  content.footer.tagline = cleanSiteText(firm.get("footer_text"), 300, content.footer.tagline);
  content.updatedAt = cleanSiteText(firm.get("site_content_updated_at"), 64, "");
  if (!content.updatedAt) content.updatedAt = null;

  return {
    content: resolveTokensDeep(content, content),
    warnings,
  };
}

/* ─── Save-side sanitizers ────────────────────────────────────────────────────
 * Incoming editor patch ko whitelist karke sirf valid, non-empty fields rakhte
 * hain. Jo key chhut gayi wo default par fallback karti hai — isliye save
 * karte waqt defaults freeze nahi hote.
 */

function keepText(value: unknown, max: number): string | undefined {
  const text = readString(value);
  return text ? text.slice(0, max) : undefined;
}

function sanitizeSeo(value: unknown): DeepPartial<SeoContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<SeoContent> = {};
  const title = keepText(row.title, 120);
  const description = keepText(row.description, 320);
  const keywords = keepText(row.keywords, 500);
  if (title) out.title = title;
  if (description) out.description = description;
  if (keywords) out.keywords = keywords;
  return out;
}

function sanitizeHome(value: unknown): DeepPartial<HomeContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<HomeContent> = {};
  const heroBadge = keepText(row.heroBadge, 120);
  const heroTitle = keepText(row.heroTitle, 200);
  const heroHighlight = keepText(row.heroHighlight, 160);
  const heroSubtitle = keepText(row.heroSubtitle, 600);
  const ctaTitle = keepText(row.ctaTitle, 160);
  const ctaSubtitle = keepText(row.ctaSubtitle, 400);
  if (heroBadge) out.heroBadge = heroBadge;
  if (heroTitle) out.heroTitle = heroTitle;
  if (heroHighlight) out.heroHighlight = heroHighlight;
  if (heroSubtitle) out.heroSubtitle = heroSubtitle;
  if (ctaTitle) out.ctaTitle = ctaTitle;
  if (ctaSubtitle) out.ctaSubtitle = ctaSubtitle;
  const trustChips = cleanStringList(row.trustChips, 8, 60);
  const stats = cleanStats(row.stats);
  const featured = cleanFeatured(row.featured);
  const why = cleanFeatures(row.why, 12);
  const testimonials = cleanTestimonials(row.testimonials, 12);
  if (trustChips) out.trustChips = trustChips;
  if (stats) out.stats = stats;
  if (featured) out.featured = featured;
  if (why) out.why = why;
  if (testimonials) out.testimonials = testimonials;
  return out;
}

function sanitizeAbout(value: unknown): DeepPartial<AboutContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<AboutContent> = {};
  const badge = keepText(row.badge, 80);
  const title = keepText(row.title, 200);
  const highlight = keepText(row.highlight, 160);
  const subtitle = keepText(row.subtitle, 600);
  const storyHeading = keepText(row.storyHeading, 160);
  const storyHighlight = keepText(row.storyHighlight, 160);
  const quote = keepText(row.quote, 800);
  const visitTitle = keepText(row.visitTitle, 100);
  if (badge) out.badge = badge;
  if (title) out.title = title;
  if (highlight) out.highlight = highlight;
  if (subtitle) out.subtitle = subtitle;
  if (storyHeading) out.storyHeading = storyHeading;
  if (storyHighlight) out.storyHighlight = storyHighlight;
  if (quote) out.quote = quote;
  if (visitTitle) out.visitTitle = visitTitle;
  const stats = cleanStats(row.stats);
  const story = cleanStringList(row.story, 12, 1200);
  const badges = cleanStringList(row.badges, 8, 60);
  const why = cleanFeatures(row.why, 12);
  const team = cleanTeam(row.team, 12);
  const testimonials = cleanTestimonials(row.testimonials, 12);
  if (stats) out.stats = stats;
  if (story) out.story = story;
  if (badges) out.badges = badges;
  if (why) out.why = why;
  if (team) out.team = team;
  if (testimonials) out.testimonials = testimonials;
  if (row.emergency === null) {
    out.emergency = null;
  } else if (isRecord(row.emergency)) {
    const value = keepText(row.emergency.value, 40);
    const label = keepText(row.emergency.label, 80);
    out.emergency = { ...(value ? { value } : {}), ...(label ? { label } : {}) };
  }
  return out;
}

function sanitizeContactPage(value: unknown): DeepPartial<ContactPageContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<ContactPageContent> = {};
  const badge = keepText(row.badge, 80);
  const title = keepText(row.title, 200);
  const highlight = keepText(row.highlight, 160);
  const subtitle = keepText(row.subtitle, 600);
  if (badge) out.badge = badge;
  if (title) out.title = title;
  if (highlight) out.highlight = highlight;
  if (subtitle) out.subtitle = subtitle;
  const serviceOptions = cleanStringList(row.serviceOptions, 20, 60);
  if (serviceOptions) out.serviceOptions = serviceOptions;
  const form = asRecord(row.formCopy);
  if (form) {
    const formCopy: DeepPartial<ContactPageContent["formCopy"]> = {};
    const name = keepText(form.name, 60);
    const mobile = keepText(form.mobile, 60);
    const email = keepText(form.email, 60);
    const service = keepText(form.service, 60);
    const message = keepText(form.message, 60);
    const submit = keepText(form.submit, 60);
    if (name) formCopy.name = name;
    if (mobile) formCopy.mobile = mobile;
    if (email) formCopy.email = email;
    if (service) formCopy.service = service;
    if (message) formCopy.message = message;
    if (submit) formCopy.submit = submit;
    out.formCopy = formCopy;
  }
  return out;
}

function sanitizeFaq(value: unknown): DeepPartial<FaqContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<FaqContent> = {};
  const badge = keepText(row.badge, 60);
  const title = keepText(row.title, 120);
  const subtitle = keepText(row.subtitle, 400);
  if (badge) out.badge = badge;
  if (title) out.title = title;
  if (subtitle) out.subtitle = subtitle;
  const items = cleanFaqItems(row.items);
  if (items) out.items = items;
  return out;
}

function sanitizeService(value: unknown): DeepPartial<ServicePageContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<ServicePageContent> = {};
  if (typeof row.enabled === "boolean") out.enabled = row.enabled;
  const label = keepText(row.label, 80);
  const desc = keepText(row.desc, 200);
  const badge = keepText(row.badge, 80);
  const title = keepText(row.title, 120);
  const highlight = keepText(row.highlight, 120);
  const subtitle = keepText(row.subtitle, 600);
  const minimalSubtitle = keepText(row.minimalSubtitle, 600);
  if (label) out.label = label;
  if (desc) out.desc = desc;
  if (badge) out.badge = badge;
  if (title) out.title = title;
  if (highlight) out.highlight = highlight;
  if (subtitle) out.subtitle = subtitle;
  if (minimalSubtitle) out.minimalSubtitle = minimalSubtitle;
  if (typeof row.art === "string" && (ART_KINDS as readonly string[]).includes(row.art)) {
    out.art = row.art as ArtKind;
  }
  const headings = asRecord(row.headings);
  if (headings) {
    const next: DeepPartial<ServicePageContent["headings"]> = {};
    const equipment = keepText(headings.equipment, 100);
    const process = keepText(headings.process, 100);
    const why = keepText(headings.why, 100);
    const equipmentNote = keepText(headings.equipmentNote, 100);
    if (equipment) next.equipment = equipment;
    if (process) next.process = process;
    if (why) next.why = why;
    if (equipmentNote) next.equipmentNote = equipmentNote;
    out.headings = next;
  }
  const equipment = cleanEquipment(row.equipment);
  const steps = cleanSteps(row.steps);
  const points = cleanPoints(row.points);
  if (equipment) out.equipment = equipment;
  if (steps) out.steps = steps;
  if (points) out.points = points;
  if (row.evHighlight === null) {
    out.evHighlight = null;
  } else if (isRecord(row.evHighlight)) {
    const ev: DeepPartial<EvHighlight> = {};
    if (typeof row.evHighlight.enabled === "boolean") ev.enabled = row.evHighlight.enabled;
    const evBadge = keepText(row.evHighlight.badge, 60);
    const evTitle = keepText(row.evHighlight.title, 120);
    const evHighlight = keepText(row.evHighlight.highlight, 120);
    const evBody = keepText(row.evHighlight.body, 800);
    if (evBadge) ev.badge = evBadge;
    if (evTitle) ev.title = evTitle;
    if (evHighlight) ev.highlight = evHighlight;
    if (evBody) ev.body = evBody;
    const chips = cleanStringList(row.evHighlight.chips, 8, 60);
    if (chips) ev.chips = chips;
    const images = cleanStringList(row.evHighlight.images, 6, 2048);
    if (images) ev.images = images.filter((image) => cleanSiteUrl(image, "") !== "");
    out.evHighlight = ev;
  }
  return out;
}

function sanitizeFooter(value: unknown): DeepPartial<FooterContent> | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  const out: DeepPartial<FooterContent> = {};
  const tagline = keepText(row.tagline, 300);
  const whatsappCta = keepText(row.whatsappCta, 200);
  const copyrightText = keepText(row.copyrightText, 120);
  if (tagline) out.tagline = tagline;
  if (whatsappCta) out.whatsappCta = whatsappCta;
  if (copyrightText) out.copyrightText = copyrightText;
  const legalLinks = cleanLegalLinks(row.legalLinks);
  if (legalLinks) out.legalLinks = legalLinks;
  return out;
}

/**
 * Editor se aane wale patch ko whitelist/sanitize karta hai. `null` section ka
 * matlab hai "override hatao" (defaults wapas). Unknown keys silently drop.
 * `null` return = invalid top-level shape/version.
 */
export function sanitizeSiteContentJson(input: unknown): SiteContentJson | null {
  const root = asRecord(input);
  if (!root) return null;
  if (root.version !== undefined && Number(root.version) !== SITE_CONTENT_VERSION) return null;

  const out: SiteContentJson = {};
  if (root.seo === null) out.seo = null;
  else {
    const seo = sanitizeSeo(root.seo);
    if (seo) out.seo = seo;
  }
  if (root.home === null) out.home = null;
  else {
    const home = sanitizeHome(root.home);
    if (home) out.home = home;
  }
  if (root.about === null) out.about = null;
  else {
    const about = sanitizeAbout(root.about);
    if (about) out.about = about;
  }
  if (root.contactPage === null) out.contactPage = null;
  else {
    const contactPage = sanitizeContactPage(root.contactPage);
    if (contactPage) out.contactPage = contactPage;
  }
  if (root.faq === null) out.faq = null;
  else {
    const faq = sanitizeFaq(root.faq);
    if (faq) out.faq = faq;
  }
  if (root.footer === null) out.footer = null;
  else {
    const footer = sanitizeFooter(root.footer);
    if (footer) out.footer = footer;
  }
  if (root.services === null) {
    out.services = {};
  } else if (isRecord(root.services)) {
    const services: Partial<Record<ServiceId, DeepPartial<ServicePageContent> | null>> = {};
    for (const id of SERVICE_IDS) {
      if (root.services[id] === null) services[id] = null;
      else {
        const service = sanitizeService(root.services[id]);
        if (service) services[id] = service;
      }
    }
    out.services = services;
  }
  return out;
}

/** Convenience for save-route validation: sanitize + size-check a JSON object. */
export function serializeSiteContentJson(json: SiteContentJson):
  | {
      ok: true;
      raw: string;
    }
  | { ok: false; error: string } {
  let raw: string;
  try {
    raw = JSON.stringify({ ...json, version: SITE_CONTENT_VERSION });
  } catch {
    return { ok: false, error: "site_content JSON serialize nahi hua" };
  }
  if (byteLength(raw) > SITE_CONTENT_MAX_BYTES) {
    return { ok: false, error: `site_content ${SITE_CONTENT_MAX_BYTES / 1024}KB se bada hai` };
  }
  return { ok: true, raw };
}

export type { ServiceId };
