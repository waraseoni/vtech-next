import { describe, expect, it } from "vitest";
import {
  buildDirectionsLink,
  buildLocationShareText,
  buildLocationWhatsAppLink,
  buildMapLink,
  buildWhatsAppShareLink,
  formatCoordinates,
  getBusinessOpenState,
  getCityLabel,
  getDefaultSiteContent,
  normalizeWhatsAppRecipient,
  parseBusinessDays,
} from "./public-site-defaults";

const content = getDefaultSiteContent("full");

describe("business hours helpers", () => {
  it("parses ranges, lists and daily", () => {
    expect([...parseBusinessDays("Mon-Sat")!]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...parseBusinessDays("Mon, Wed, Fri")!]).toEqual([1, 3, 5]);
    expect(parseBusinessDays("Daily")!.size).toBe(7);
    expect(parseBusinessDays("Weekends")).toBeNull();
  });

  it("is open during shop hours on a working day", () => {
    const tuesdayNoon = new Date(2026, 10, 10, 12, 0); // Tue
    expect(getBusinessOpenState(content, tuesdayNoon)).toEqual({
      known: true,
      open: true,
      label: "Open now",
    });
  });

  it("is closed after hours and on Sunday", () => {
    const tuesdayNight = new Date(2026, 10, 10, 21, 0);
    expect(getBusinessOpenState(content, tuesdayNight).open).toBe(false);
    const sundayNoon = new Date(2026, 10, 15, 12, 0);
    expect(getBusinessOpenState(content, sundayNoon).open).toBe(false);
  });

  it("handles overnight hours", () => {
    const overnight = {
      ...content,
      contact: { ...content.contact, openTime: "20:00", closeTime: "02:00" },
    };
    const tuesdayLate = new Date(2026, 10, 10, 23, 0);
    expect(getBusinessOpenState(overnight, tuesdayLate).open).toBe(true);
    const tuesdayNoon = new Date(2026, 10, 10, 12, 0);
    expect(getBusinessOpenState(overnight, tuesdayNoon).open).toBe(false);
  });

  it("hides the badge when hours are unparseable", () => {
    const broken = {
      ...content,
      contact: { ...content.contact, businessDays: "Weekends" },
    };
    expect(getBusinessOpenState(broken).known).toBe(false);
  });
});

describe("location helpers", () => {
  it("derives the city from the configured address", () => {
    expect(getCityLabel(content.contact.address)).toBe("Jabalpur");
    expect(getCityLabel("")).toBe("");
  });

  it("uses configured map URL, then a maps search fallback", () => {
    expect(
      buildMapLink({
        ...content,
        contact: { ...content.contact, mapUrl: "https://maps.example/x" },
      })
    ).toBe("https://maps.example/x");
    const fallback = buildMapLink({ ...content, contact: { ...content.contact, mapUrl: "" } });
    expect(fallback).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(decodeURIComponent(fallback)).toContain("Jabalpur");
    expect(
      buildMapLink({ ...content, contact: { ...content.contact, mapUrl: "", address: "" } })
    ).toBe("");
  });

  it("prefers office GPS coordinates over the address, but not over map_url", () => {
    const withGps = {
      ...content,
      contact: {
        ...content.contact,
        mapUrl: "",
        latitude: 23.167934,
        longitude: 79.935528,
      },
    };
    expect(formatCoordinates(withGps)).toBe("23.167934, 79.935528");
    expect(decodeURIComponent(buildMapLink(withGps))).toContain("23.167934, 79.935528");
    expect(decodeURIComponent(buildDirectionsLink(withGps))).toContain(
      "destination=23.167934, 79.935528"
    );
    expect(
      buildMapLink({
        ...withGps,
        contact: { ...withGps.contact, mapUrl: "https://maps.example/x" },
      })
    ).toBe("https://maps.example/x");
    expect(formatCoordinates({ ...content, contact: { ...content.contact, latitude: null } })).toBe(
      ""
    );
  });

  it("falls back to the address for directions", () => {
    const directions = buildDirectionsLink({
      ...content,
      contact: { ...content.contact, mapUrl: "", latitude: null, longitude: null },
    });
    expect(directions).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(decodeURIComponent(directions)).toContain("Jabalpur");
  });
});

describe("location sharing helpers", () => {
  const withGps = {
    ...content,
    contact: { ...content.contact, latitude: 23.167934, longitude: 79.935528 },
  };

  it("includes brand, address, GPS, map and phone in share text", () => {
    const text = buildLocationShareText(withGps);
    expect(text).toContain(content.brand.name);
    expect(text).toContain(content.contact.address);
    expect(text).toContain("GPS: 23.167934, 79.935528");
    expect(text).toContain("Map: https://www.google.com/maps/search/");
    expect(text).toContain("Phone:");
  });

  it("normalizes typed recipient numbers for wa.me", () => {
    expect(normalizeWhatsAppRecipient("98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppRecipient("+91 98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppRecipient("09987654321")).toBe("919987654321");
    expect(normalizeWhatsAppRecipient("")).toBe("");
    expect(normalizeWhatsAppRecipient("12345")).toBe("");
  });

  it("builds a WhatsApp link with or without a recipient", () => {
    expect(buildWhatsAppShareLink("hello", "9876543210")).toBe(
      "https://wa.me/919876543210?text=hello"
    );
    expect(buildWhatsAppShareLink("hello world")).toBe("https://wa.me/?text=hello%20world");
    const link = buildLocationWhatsAppLink(withGps, "9876543210");
    expect(link).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(link)).toContain("GPS: 23.167934, 79.935528");
    expect(buildLocationWhatsAppLink(withGps)).toContain("https://wa.me/?text=");
  });
});
