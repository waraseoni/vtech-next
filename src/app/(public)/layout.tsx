import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicSiteContent } from "@/lib/public-site-content";
import {
  buildLocalBusinessJsonLd,
  buildPublicPageMetadata,
  serializeJsonLd,
} from "@/lib/public-site-metadata";
import { PublicShell } from "./components/public-shell";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPublicSiteContent();
  return buildPublicPageMetadata(content, {
    path: "/",
    title: content.seo.title,
    description: content.seo.description,
  });
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const content = await getPublicSiteContent();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildLocalBusinessJsonLd(content)),
        }}
      />
      <PublicShell content={content}>{children}</PublicShell>
    </>
  );
}
