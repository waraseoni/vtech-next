import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicSiteContent } from "@/lib/public-site-content";
import { buildPublicPageMetadata } from "@/lib/public-site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  return buildPublicPageMetadata(content, {
    path: "/about",
    title: `About ${content.brand.shortName}`,
    description: content.about.subtitle,
  });
}

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
