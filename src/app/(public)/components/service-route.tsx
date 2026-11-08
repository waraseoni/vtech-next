import type { Metadata } from "next";
import { getPublicSiteContent } from "@/lib/public-site-content";
import type { ServiceId } from "@/lib/public-site-defaults";
import {
  buildBreadcrumbJsonLd,
  buildPublicPageMetadata,
  serializeJsonLd,
} from "@/lib/public-site-metadata";
import { ServicePageView } from "./service-page-view";

export async function buildServiceMetadata(serviceId: ServiceId, path: string): Promise<Metadata> {
  const content = await getPublicSiteContent();
  const service = content.services[serviceId];
  if (!service.enabled) {
    return {
      title: { absolute: "Not Found" },
      robots: { index: false, follow: false },
    };
  }
  const heading = [service.title, service.highlight].filter(Boolean).join(" ");
  return buildPublicPageMetadata(content, {
    path,
    title: `${heading} — ${content.brand.shortName}`,
    description: service.subtitle,
  });
}

export async function ServicePageRoute({
  serviceId,
  path,
}: {
  serviceId: ServiceId;
  path: string;
}) {
  const content = await getPublicSiteContent();
  const service = content.services[serviceId];

  return (
    <>
      {service.enabled && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              buildBreadcrumbJsonLd([
                { name: "Home", path: "/" },
                { name: service.label, path },
              ])
            ),
          }}
        />
      )}
      <ServicePageView serviceId={serviceId} />
    </>
  );
}
