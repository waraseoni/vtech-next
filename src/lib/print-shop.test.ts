import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ meta_field: string; meta_value: string | null }>,
}));

vi.mock("@/lib/admin-supabase", () => ({
  getAdminSupabase: () => ({
    from: () => ({
      select: async () => ({ data: state.rows }),
    }),
  }),
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SITE_NAME",
  "NEXT_PUBLIC_SITE_TAGLINE",
  "NEXT_PUBLIC_SITE_ADDRESS",
  "NEXT_PUBLIC_SITE_PHONE",
  "NEXT_PUBLIC_SITE_EMAIL",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

async function load() {
  vi.resetModules();
  return import("./print-shop");
}

beforeEach(() => {
  state.rows = [];
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("getPrintShop", () => {
  it("maps system_info branding", async () => {
    state.rows = [
      { meta_field: "name", meta_value: "Acme Power" },
      { meta_field: "tagline", meta_value: "Repairs done right" },
      { meta_field: "address", meta_value: "12 Main Road" },
      { meta_field: "contact", meta_value: "9999999999" },
      { meta_field: "email", meta_value: "shop@example.com" },
      { meta_field: "gst_no", meta_value: "22AAAAA0000A1Z5" },
      { meta_field: "upi_id", meta_value: "acme@upi" },
      { meta_field: "signature", meta_value: "sig.png" },
      { meta_field: "logo", meta_value: "logo.png" },
      { meta_field: "ignored", meta_value: null },
    ];

    const { getPrintShop } = await load();
    await expect(getPrintShop()).resolves.toEqual({
      name: "Acme Power",
      tagline: "Repairs done right",
      address: "12 Main Road",
      mobile: "9999999999",
      email: "shop@example.com",
      gstin: "22AAAAA0000A1Z5",
      upiId: "acme@upi",
      signature: "sig.png",
      logo: "logo.png",
    });
  });

  it("falls back to NEXT_PUBLIC_SITE_* env values", async () => {
    process.env.NEXT_PUBLIC_SITE_NAME = "Env Shop";
    process.env.NEXT_PUBLIC_SITE_TAGLINE = "Env tagline";
    process.env.NEXT_PUBLIC_SITE_ADDRESS = "Env address";
    process.env.NEXT_PUBLIC_SITE_PHONE = "8888888888";
    process.env.NEXT_PUBLIC_SITE_EMAIL = "env@example.com";

    const { getPrintShop } = await load();
    const shop = await getPrintShop();
    expect(shop).toMatchObject({
      name: "Env Shop",
      tagline: "Env tagline",
      address: "Env address",
      mobile: "8888888888",
      email: "env@example.com",
      gstin: "",
      upiId: "",
    });
  });

  it("uses neutral defaults when nothing is configured", async () => {
    const { getPrintShop } = await load();
    const shop = await getPrintShop();
    expect(shop.name).toBe("Your Shop");
    expect(shop.tagline).toBe("Repair & Service Solutions");
    expect(shop.address).toBe("");
    expect(shop.mobile).toBe("");
  });

  it("caches for 60 seconds and refreshes after the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-28T00:00:00Z"));
    state.rows = [{ meta_field: "name", meta_value: "First Name" }];

    const { getPrintShop } = await load();
    expect((await getPrintShop()).name).toBe("First Name");

    state.rows = [{ meta_field: "name", meta_value: "Second Name" }];
    expect((await getPrintShop()).name).toBe("First Name");

    vi.advanceTimersByTime(60_001);
    expect((await getPrintShop()).name).toBe("Second Name");
  });
});

describe("getSiteBaseUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips a trailing slash", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://shop.example.com/";
    const { getSiteBaseUrl } = await load();
    expect(getSiteBaseUrl()).toBe("https://shop.example.com");
  });

  it("falls back to the request origin", async () => {
    const { getSiteBaseUrl } = await load();
    expect(getSiteBaseUrl("https://api.example.com/api/print-bill?job_id=1")).toBe(
      "https://api.example.com"
    );
  });

  it("returns an empty string when no base is available", async () => {
    const { getSiteBaseUrl } = await load();
    expect(getSiteBaseUrl()).toBe("");
    expect(getSiteBaseUrl("not a url")).toBe("");
  });
});

describe("qrDataUrl", () => {
  it("generates an inline PNG data URL", async () => {
    const { qrDataUrl } = await load();
    const url = await qrDataUrl("https://shop.example.com/job-status?job_id=1");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });
});
