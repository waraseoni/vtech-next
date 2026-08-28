import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: [
          "/dashboard",
          "/jobs",
          "/clients",
          "/inventory",
          "/reports",
          "/settings",
          "/sync",
          "/api/",
          "/login",
          "/my-account",
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://vtech-next.vercel.app"}/sitemap.xml`,
  };
}
