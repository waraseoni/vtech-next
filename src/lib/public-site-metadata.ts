import type { Metadata } from "next";
import {
  buildMapLink,
  getServiceList,
  type FaqContent,
  type PublicSiteContent,
} from "./public-site-defaults";

const RAW_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://vtech-next.vercel.app").trim();

export const PUBLIC_SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export function toAbsoluteSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${PUBLIC_SITE_URL}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/** Public marketing pages ke liye DB-driven metadata (OG/Twitter/canonical inclusive). */
export function buildPublicPageMetadata(
  content: PublicSiteContent,
  page: { path: string; title: string; description?: string; image?: string }
): Metadata {
  const title = page.title.trim() || content.seo.title;
  const description = page.description?.trim() || content.seo.description;
  const image = toAbsoluteSiteUrl(page.image?.trim() || content.brand.coverUrl);
  const url = toAbsoluteSiteUrl(page.path);
  const keywords = content.seo.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title: { absolute: title },
    description,
    ...(keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: page.path },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url,
      siteName: content.brand.name,
      title,
      description,
      ...(image ? { images: [{ url: image, alt: content.brand.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

const DAY_TOKENS: Record<string, string> = {
  mon: "Mo",
  tue: "Tu",
  wed: "We",
  thu: "Th",
  fri: "Fr",
  sat: "Sa",
  sun: "Su",
};

function schemaDays(days: string): string {
  const token = (value: string) => DAY_TOKENS[value.trim().slice(0, 3).toLowerCase()] ?? "";
  const range = days.split(/\s*[–-]\s*/);
  if (range.length === 2) {
    const from = token(range[0]);
    const to = token(range[1]);
    return from && to ? `${from}-${to}` : "";
  }
  return days
    .split(",")
    .map((day) => token(day))
    .filter(Boolean)
    .join(",");
}

function schemaOpeningHours(content: PublicSiteContent): string {
  const days = schemaDays(content.contact.businessDays);
  const time = /^([01]?\d|2[0-3]):[0-5]\d$/;
  if (!days || !time.test(content.contact.openTime) || !time.test(content.contact.closeTime)) {
    return "";
  }
  return `${days} ${content.contact.openTime}-${content.contact.closeTime}`;
}

/** LocalBusiness JSON-LD — sirf already-resolved public content se. */
export function buildLocalBusinessJsonLd(content: PublicSiteContent) {
  const { brand, contact } = content;
  const services = getServiceList(content);
  const sameAs = [contact.facebook, contact.instagram, contact.youtube].filter(Boolean);
  const openingHours = schemaOpeningHours(content);
  const hasMap = buildMapLink(content);
  const hasGeo = contact.latitude !== null && contact.longitude !== null;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brand.name,
    description: content.seo.description,
    url: toAbsoluteSiteUrl("/"),
    ...(brand.logoUrl ? { logo: toAbsoluteSiteUrl(brand.logoUrl) } : {}),
    ...(brand.coverUrl ? { image: toAbsoluteSiteUrl(brand.coverUrl) } : {}),
    telephone: contact.phone,
    email: contact.email,
    address: { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "IN" },
    ...(hasMap ? { hasMap } : {}),
    ...(hasGeo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: contact.latitude,
            longitude: contact.longitude,
          },
        }
      : {}),
    ...(openingHours ? { openingHours } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(services.length > 0
      ? {
          makesOffer: services.map((service) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: service.label,
              description: service.desc,
            },
          })),
        }
      : {}),
  };
}

/** FAQPage JSON-LD — sirf visible FAQ items se, isliye home page par render hota hai. */
export function buildFaqJsonLd(faq: FaqContent) {
  const items = faq.items.filter((item) => item.q.trim() && item.a.trim());
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteSiteUrl(item.path),
    })),
  };
}

/** JSON string ko inline `<script>` ke liye safe banata hai. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
