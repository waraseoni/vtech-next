import { describe, expect, it } from "vitest";
import { getDefaultSiteContent } from "./public-site-defaults";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildLocalBusinessJsonLd,
  buildPublicPageMetadata,
  serializeJsonLd,
  toAbsoluteSiteUrl,
} from "./public-site-metadata";

const content = getDefaultSiteContent("full");

describe("public-site-metadata", () => {
  it("uses an absolute title so the root template brand is not duplicated", () => {
    const meta = buildPublicPageMetadata(content, {
      path: "/about",
      title: "About V-Technologies",
      description: "About description",
    });

    expect(meta.title).toEqual({ absolute: "About V-Technologies" });
    expect(meta.alternates).toEqual({ canonical: "/about" });
    expect(meta.robots).toMatchObject({ index: true, follow: true });
    expect(meta.description).toBe("About description");
  });

  it("falls back to DB SEO copy when page copy is empty", () => {
    const meta = buildPublicPageMetadata(content, { path: "/", title: "  " });

    expect(meta.title).toEqual({ absolute: content.seo.title });
    expect(meta.description).toBe(content.seo.description);
  });

  it("builds LocalBusiness JSON-LD from resolved content", () => {
    const jsonLd = buildLocalBusinessJsonLd(content);

    expect(jsonLd["@type"]).toBe("LocalBusiness");
    expect(jsonLd.name).toBe(content.brand.name);
    expect(jsonLd.telephone).toBe(content.contact.phone);
    expect(jsonLd.openingHours).toBe("Mo-Sa 10:00-20:00");
    expect(jsonLd.makesOffer).toHaveLength(3);
    expect(jsonLd.address).toMatchObject({ "@type": "PostalAddress", addressCountry: "IN" });
  });

  it("skips openingHours when day tokens are not parseable", () => {
    const copy = getDefaultSiteContent("full");
    copy.contact.businessDays = "Weekdays";
    const jsonLd = buildLocalBusinessJsonLd(copy);

    expect(jsonLd).not.toHaveProperty("openingHours");
  });

  it("emits geo coordinates and a map link when office GPS is configured", () => {
    const copy = getDefaultSiteContent("full");
    copy.contact.latitude = 23.167934;
    copy.contact.longitude = 79.935528;
    const jsonLd = buildLocalBusinessJsonLd(copy);

    expect(jsonLd.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 23.167934,
      longitude: 79.935528,
    });
    expect(jsonLd.hasMap).toContain("23.167934");
  });

  it("omits geo when GPS is missing", () => {
    expect(buildLocalBusinessJsonLd(content)).not.toHaveProperty("geo");
  });

  it("builds FAQPage JSON-LD from visible FAQ items", () => {
    const jsonLd = buildFaqJsonLd(content.faq);

    expect(jsonLd?.["@type"]).toBe("FAQPage");
    expect(jsonLd?.mainEntity).toHaveLength(content.faq.items.length);
    expect(jsonLd?.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: content.faq.items[0].q,
      acceptedAnswer: { "@type": "Answer", text: content.faq.items[0].a },
    });
  });

  it("returns null when no FAQ item has both question and answer", () => {
    expect(
      buildFaqJsonLd({
        badge: "FAQ",
        title: "FAQ",
        subtitle: "",
        items: [
          { q: "  ", a: "Answer" },
          { q: "Question", a: "   " },
        ],
      })
    ).toBeNull();
  });

  it("builds breadcrumbs with absolute item URLs", () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Stage Lighting", path: "/stage-lighting" },
    ]);

    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[1].position).toBe(2);
    expect(jsonLd.itemListElement[1].item).toBe(toAbsoluteSiteUrl("/stage-lighting"));
  });

  it("escapes '<' in serialized JSON-LD", () => {
    const raw = serializeJsonLd({ name: "</script><script>alert(1)</script>" });

    expect(raw).not.toContain("</script>");
    expect(raw).toContain("\\u003c");
  });
});
