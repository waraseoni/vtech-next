import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicSiteContent } from "@/lib/public-site-content";
import { buildPublicPageMetadata } from "@/lib/public-site-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  return buildPublicPageMetadata(content, {
    path: "/contact",
    title: `Contact ${content.brand.shortName}`,
    description: content.contactPage.subtitle,
  });
}

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
