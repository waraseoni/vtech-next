import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://vtech-next.vercel.app";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.7 },
    { url: `${base}/job-status`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}
