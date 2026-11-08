import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultSiteContent, getServiceList, getSiteMode } from "./public-site-defaults";
import {
  SITE_CONTENT_MAX_BYTES,
  mergeSiteContent,
  parseSiteContentJson,
  sanitizeSiteContentJson,
  serializeSiteContentJson,
  type FirmRow,
} from "./public-site-schema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const fullDefaults = () => getDefaultSiteContent("full");
const minimalDefaults = () => getDefaultSiteContent("minimal");

describe("public site defaults", () => {
  it("freezes the current full-site copy", () => {
    const content = fullDefaults();
    expect(content.mode).toBe("full");
    expect(content.brand.name).toBeTruthy();
    expect(content.home.stats).toHaveLength(4);
    expect(content.home.featured).toHaveLength(8);
    expect(content.home.why).toHaveLength(6);
    expect(content.home.testimonials).toHaveLength(4);
    expect(content.about.team).toHaveLength(3);
    expect(content.services["stage-lighting"].equipment.length).toBeGreaterThan(0);
    expect(content.services["power-supply"].evHighlight?.enabled).toBe(true);
    expect(content.faq.items.length).toBeGreaterThan(0);
  });

  it("keeps minimal mode free of seller-only sections", () => {
    const content = minimalDefaults();
    expect(content.mode).toBe("minimal");
    expect(content.home.stats).toEqual([]);
    expect(content.home.featured).toEqual([]);
    expect(content.about.story).toEqual([]);
    expect(content.about.team).toEqual([]);
    expect(content.home.heroTitle).toContain("{brand}");
  });

  it("derives mode from NEXT_PUBLIC_SITE_NAME unless overridden", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_NAME", "Acme Electronics");
    vi.stubEnv("NEXT_PUBLIC_SITE_MODE", "");
    expect(getSiteMode()).toBe("minimal");

    vi.stubEnv("NEXT_PUBLIC_SITE_MODE", "full");
    expect(getSiteMode()).toBe("full");
  });

  it("filters disabled services from the nav list", () => {
    const content = fullDefaults();
    content.services.industrial.enabled = false;
    const list = getServiceList(content);
    expect(list.map((service) => service.href)).not.toContain("/industrial");
    expect(list.length).toBe(2);
  });
});

describe("parseSiteContentJson", () => {
  it("accepts valid objects and version 1", () => {
    expect(parseSiteContentJson('{"version":1,"home":{"ctaTitle":"Hi"}}')).toEqual({
      version: 1,
      home: { ctaTitle: "Hi" },
    });
    expect(parseSiteContentJson("{}")).toEqual({});
  });

  it("rejects corrupt, non-object, future-version and oversized payloads", () => {
    expect(parseSiteContentJson("{not json")).toBeNull();
    expect(parseSiteContentJson("[]")).toBeNull();
    expect(parseSiteContentJson("null")).toBeNull();
    expect(parseSiteContentJson('{"version":2}')).toBeNull();
    expect(parseSiteContentJson("x".repeat(SITE_CONTENT_MAX_BYTES + 1))).toBeNull();
    expect(parseSiteContentJson("")).toBeNull();
    expect(parseSiteContentJson(null)).toBeNull();
  });
});

describe("mergeSiteContent precedence", () => {
  it("applies defaults < JSON < firm keys per field", () => {
    const { content } = mergeSiteContent(
      fullDefaults(),
      {
        seo: { title: "JSON SEO Title" },
        home: { ctaTitle: "JSON CTA", heroBadge: "JSON badge" },
      },
      [
        { id: 3, meta_field: "name", meta_value: "DB Brand" },
        { id: 1, meta_field: "contact", meta_value: "9876543210" },
      ]
    );

    expect(content.seo.title).toBe("JSON SEO Title");
    expect(content.home.ctaTitle).toBe("JSON CTA");
    expect(content.home.heroBadge).toBe("JSON badge");
    expect(content.brand.name).toBe("DB Brand");
    expect(content.contact.phone).toBe("+91 9876543210");
    expect(content.contact.phoneHref).toBe("tel:+919876543210");
  });

  it("keeps optional equipment pricing fields and drops invalid ones", () => {
    const { content } = mergeSiteContent(
      fullDefaults(),
      {
        services: {
          "power-supply": {
            equipment: [
              {
                art: "smps",
                name: "SMPS",
                detail: "12V supply",
                badge: "available",
                turnaround: "Same day",
                startingPrice: 450,
                warranty: "3 months",
              },
              {
                art: "ups",
                name: "UPS",
                detail: "No price",
                startingPrice: -5,
                warranty: "   ",
              },
            ],
          },
        },
      },
      []
    );

    const items = content.services["power-supply"].equipment;
    expect(items[0]).toMatchObject({
      turnaround: "Same day",
      startingPrice: 450,
      warranty: "3 months",
    });
    expect(items[1].startingPrice).toBeUndefined();
    expect(items[1].warranty).toBeUndefined();
  });

  it("falls back to defaults for blank or whitespace-only firm values", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(defaults, null, [
      { id: 1, meta_field: "name", meta_value: "   " },
      { id: 2, meta_field: "contact", meta_value: "" },
      { id: 3, meta_field: "established_year", meta_value: "not-a-year" },
    ]);

    expect(content.brand.name).toBe(defaults.brand.name);
    expect(content.contact.phone).toBe(defaults.contact.phone);
    expect(content.brand.establishedYear).toBe(defaults.brand.establishedYear);
  });

  it("picks the lowest id deterministically for duplicate meta_field rows", () => {
    const rows: FirmRow[] = [
      { id: 9, meta_field: "name", meta_value: "High Id" },
      { id: 2, meta_field: "name", meta_value: "Low Id" },
      { id: 5, meta_field: "short_name", meta_value: "SN" },
    ];
    const { content, warnings } = mergeSiteContent(fullDefaults(), null, rows);

    expect(content.brand.name).toBe("Low Id");
    expect(content.brand.shortName).toBe("SN");
    expect(warnings.some((warning) => warning.includes("duplicate"))).toBe(true);
  });

  it("derives business hours from firm keys and rejects invalid times", () => {
    const { content } = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "biz_days", meta_value: "Mon-Fri" },
      { id: 2, meta_field: "biz_open", meta_value: "09:30" },
      { id: 3, meta_field: "biz_close", meta_value: "18:00" },
    ]);
    expect(content.contact.businessHours).toBe("Mon-Fri · 9:30 AM – 6:00 PM");

    const { content: invalid } = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "biz_open", meta_value: "25:00" },
      { id: 2, meta_field: "biz_close", meta_value: "8pm" },
    ]);
    expect(invalid.contact.businessHours).toBe("Mon-Sat · 10:00 AM – 8:00 PM");
  });

  it("normalizes whatsapp URLs to digits and builds the wa.me link", () => {
    const { content } = mergeSiteContent(fullDefaults(), null, [
      {
        id: 1,
        meta_field: "whatsapp",
        meta_value: "https://wa.me/919999999999?text=hi",
      },
    ]);
    expect(content.contact.whatsapp).toBe("919999999999");
    expect(content.contact.whatsappHref).toBe("https://wa.me/919999999999");
  });
});

describe("mergeSiteContent validation", () => {
  it("keeps defaults when JSON strings are blank", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(defaults, { home: { heroTitle: "   " } }, []);
    expect(content.home.heroTitle).toBe(defaults.home.heroTitle);
  });

  it("caps long strings and list sizes", () => {
    const stats = Array.from({ length: 20 }, (_, index) => ({
      value: index,
      suffix: "+",
      label: `Stat ${index}`,
    }));
    const { content } = mergeSiteContent(
      fullDefaults(),
      {
        home: {
          heroSubtitle: "x".repeat(1000),
          stats,
        },
      },
      []
    );

    expect(content.home.heroSubtitle).toHaveLength(600);
    expect(content.home.stats).toHaveLength(8);
  });

  it("drops invalid list items and keeps valid ones", () => {
    const { content } = mergeSiteContent(
      fullDefaults(),
      {
        home: {
          why: [
            { icon: "clock", title: "Valid", desc: "Valid desc" },
            { icon: "evil" as never, title: "", desc: "No title" },
          ],
        },
      },
      []
    );

    expect(content.home.why).toHaveLength(1);
    expect(content.home.why[0]).toMatchObject({ icon: "clock", title: "Valid" });
  });

  it("falls back to defaults when a whole list is invalid", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(
      defaults,
      { home: { testimonials: [{ quote: "", name: "" }] } },
      []
    );
    expect(content.home.testimonials).toEqual(defaults.home.testimonials);
  });

  it("rejects unsafe URLs, unknown art kinds and unsupported images", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(
      defaults,
      {
        services: {
          industrial: {
            art: "not-a-real-art" as never,
            equipment: [
              {
                art: "also-fake" as never,
                name: "Badge item",
                detail: "Detail",
                image: "javascript:alert(1)",
              },
            ],
          },
        },
      },
      [
        { id: 1, meta_field: "logo", meta_value: "javascript:alert(1)" },
        { id: 2, meta_field: "map_url", meta_value: "//evil.example.com" },
      ]
    );

    expect(content.services.industrial.art).toBe(defaults.services.industrial.art);
    expect(content.services.industrial.equipment[0].art).toBe("pcb");
    expect(content.services.industrial.equipment[0].image).toBeUndefined();
    expect(content.brand.logoUrl).toBe(defaults.brand.logoUrl);
    expect(content.contact.mapUrl).toBe(defaults.contact.mapUrl);
  });

  it("reads office GPS from geofence rows and rejects invalid pairs", () => {
    const { content } = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "geofence_lat", meta_value: "23.167934" },
      { id: 2, meta_field: "geofence_lng", meta_value: "79.935528" },
    ]);
    expect(content.contact.latitude).toBe(23.167934);
    expect(content.contact.longitude).toBe(79.935528);

    const blank = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "geofence_lat", meta_value: "" },
      { id: 2, meta_field: "geofence_lng", meta_value: "79.935528" },
    ]);
    expect(blank.content.contact.latitude).toBeNull();
    expect(blank.content.contact.longitude).toBeNull();

    const outOfRange = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "geofence_lat", meta_value: "123" },
      { id: 2, meta_field: "geofence_lng", meta_value: "79.935528" },
    ]);
    expect(outOfRange.content.contact.latitude).toBeNull();
  });

  it("honors an explicit service disable while missing keys keep defaults", () => {
    const { content } = mergeSiteContent(
      fullDefaults(),
      { services: { "stage-lighting": { enabled: false } } },
      []
    );
    expect(content.services["stage-lighting"].enabled).toBe(false);
    expect(content.services["stage-lighting"].label).toBe("Stage Lighting");
  });

  it("resolves brand/contact tokens after firm-key overrides", () => {
    const { content } = mergeSiteContent(fullDefaults(), null, [
      { id: 1, meta_field: "name", meta_value: "Acme Electronics" },
      { id: 2, meta_field: "owner", meta_value: "Ravi" },
      { id: 3, meta_field: "established_year", meta_value: "2010" },
    ]);

    expect(content.about.badge).toBe("Since 2010");
    expect(content.about.story[0]).toContain("I'm Ravi");
    expect(content.about.title).toContain("Acme Electronics");
    expect(content.footer.copyrightText).toContain(String(new Date().getFullYear()));
  });

  it("merges FAQ copy and drops blank or oversized items", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(
      defaults,
      {
        faq: {
          badge: "Sawaal",
          title: "  Common questions  ",
          items: [
            { q: "Kitna time lagega?", a: "Parts par depend karta hai." },
            { q: "   ", a: "No question" },
            { q: "Answerless", a: "" },
          ],
        },
      },
      []
    );

    expect(content.faq.badge).toBe("Sawaal");
    expect(content.faq.title).toBe("Common questions");
    expect(content.faq.items).toEqual([
      { q: "Kitna time lagega?", a: "Parts par depend karta hai." },
    ]);
    expect(content.faq.subtitle).toBe(defaults.faq.subtitle);
  });

  it("keeps default FAQ items when the patch list is fully invalid", () => {
    const defaults = fullDefaults();
    const { content } = mergeSiteContent(defaults, { faq: { items: [{ q: "", a: "" }] } }, []);
    expect(content.faq.items.map((item) => item.q)).toEqual(
      defaults.faq.items.map((item) => item.q)
    );
  });

  it("keeps updatedAt from the single DB key and leaves it null when absent", () => {
    const withDate = mergeSiteContent(fullDefaults(), null, [
      {
        id: 1,
        meta_field: "site_content_updated_at",
        meta_value: "2026-11-08T10:00:00.000Z",
      },
    ]);
    expect(withDate.content.updatedAt).toBe("2026-11-08T10:00:00.000Z");
    expect(mergeSiteContent(fullDefaults(), null, []).content.updatedAt).toBeNull();
  });
});

describe("serializeSiteContentJson", () => {
  it("serializes valid JSON with version 1", () => {
    const result = serializeSiteContentJson({ home: { ctaTitle: "Hi" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.raw)).toMatchObject({ version: 1, home: { ctaTitle: "Hi" } });
    }
  });

  it("rejects payloads above the 200KB cap", () => {
    const result = serializeSiteContentJson({
      home: { heroSubtitle: "x".repeat(SITE_CONTENT_MAX_BYTES) },
    });
    expect(result.ok).toBe(false);
  });
});

describe("sanitizeSiteContentJson", () => {
  it("keeps only valid fields and drops unknown keys", () => {
    const result = sanitizeSiteContentJson({
      version: 1,
      home: {
        heroTitle: "  New hero  ",
        bogus: "drop me",
        stats: [{ value: 5, suffix: "+", label: "Repairs" }],
      },
      seo: { title: "", description: "Hello" },
      injected: { hack: true },
    });
    expect(result).toEqual({
      home: {
        heroTitle: "New hero",
        stats: [{ value: 5, suffix: "+", label: "Repairs" }],
      },
      seo: { description: "Hello" },
    });
  });

  it("rejects wrong versions and non-objects", () => {
    expect(sanitizeSiteContentJson({ version: 2, home: {} })).toBeNull();
    expect(sanitizeSiteContentJson("nope")).toBeNull();
    expect(sanitizeSiteContentJson(null)).toBeNull();
  });

  it("preserves section null (reset) and filters unsafe URLs", () => {
    const result = sanitizeSiteContentJson({
      version: 1,
      about: null,
      faq: {
        badge: "FAQ",
        items: [{ q: "Kya charge hai?", a: "Diagnosis free hai." }],
      },
      services: {
        "power-supply": {
          enabled: false,
          evHighlight: { title: "EV", body: "Body", images: ["javascript:alert(1)", "/ok.png"] },
        },
      },
      footer: {
        legalLinks: [
          { label: "Privacy", href: "/privacy" },
          { label: "Bad", href: "javascript:alert(1)" },
        ],
      },
    });
    expect(result?.about).toBeNull();
    expect(result?.faq).toEqual({
      badge: "FAQ",
      items: [{ q: "Kya charge hai?", a: "Diagnosis free hai." }],
    });
    expect(result?.services?.["power-supply"]?.enabled).toBe(false);
    expect(result?.services?.["power-supply"]?.evHighlight?.images).toEqual(["/ok.png"]);
    expect(result?.footer?.legalLinks).toEqual([{ label: "Privacy", href: "/privacy" }]);
  });

  it("does not freeze defaults — absent fields stay absent", () => {
    const result = sanitizeSiteContentJson({ version: 1, home: { ctaTitle: "Hello" } });
    expect(result).toEqual({ home: { ctaTitle: "Hello" } });
  });

  it("accepts faq null for reset and drops unknown faq fields", () => {
    expect(sanitizeSiteContentJson({ version: 1, faq: null })).toEqual({ faq: null });
    expect(
      sanitizeSiteContentJson({
        version: 1,
        faq: { title: " Help ", bogus: "x", items: [{ q: "Q", a: "A", evil: true }] },
      })
    ).toEqual({ faq: { title: "Help", items: [{ q: "Q", a: "A" }] } });
  });
});
