import type { MetadataRoute } from "next";
import { getPublicSiteContent } from "@/lib/public-site-content";
import { SERVICE_IDS } from "@/lib/public-site-defaults";
import { PUBLIC_SITE_URL } from "@/lib/public-site-metadata";

// Content DB se aata hai — hourly ISR, aur save route ka revalidateTag content
// cache fresh karta hai. Disabled services sitemap me kabhi nahi aate.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getPublicSiteContent();
  const parsed = content.updatedAt ? new Date(content.updatedAt) : null;
  const lastModified = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${PUBLIC_SITE_URL}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${PUBLIC_SITE_URL}/about`, lastModified, changeFrequency: "yearly", priority: 0.7 },
    { url: `${PUBLIC_SITE_URL}/contact`, lastModified, changeFrequency: "yearly", priority: 0.7 },
    { url: `${PUBLIC_SITE_URL}/policies`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];

  for (const id of SERVICE_IDS) {
    if (!content.services[id].enabled) continue;
    entries.push({
      url: `${PUBLIC_SITE_URL}/${id}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return entries;
}
