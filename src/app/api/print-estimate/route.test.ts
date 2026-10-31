import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({ role: null as string | null }));

vi.mock("@/lib/api-auth", () => ({
  requireStaffWithRole: vi.fn(async () =>
    auth.role ? { user: { id: "user-1" }, role: auth.role } : null
  ),
}));

const SHOP = {
  name: "Test Shop",
  tagline: "Repairs",
  address: "Jabalpur",
  mobile: "9876543210",
  email: "shop@example.com",
  gstin: "22AAAAA0000A1Z5",
  upiId: "",
  signature: "",
  logo: "",
};

vi.mock("@/lib/print-shop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/print-shop")>();
  return { ...actual, getPrintShop: vi.fn(async () => SHOP) };
});

import { POST } from "./route";

const makePayload = (over: Record<string, unknown> = {}) => ({
  reference: "20261031-123",
  date: "2026-10-31",
  validTill: "2026-11-15",
  client: { name: "Ravi", mobile: "9876543210", email: "", address: "Jabalpur" },
  lines: [{ name: "SMPS", hsn: null, qty: 2, rate: 100 }],
  gstEnabled: false,
  gstRate: 18,
  discountType: "amount",
  discountValue: 0,
  remarks: "",
  printOptions: {
    showTitle: false,
    title: "ESTIMATE",
    showDisclaimer: false,
    disclaimer: "Ye estimate hai",
  },
  ...over,
});

const postJson = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/print-estimate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/print-estimate", () => {
  beforeEach(() => {
    auth.role = "admin";
  });

  it("rejects anonymous requests with 401", async () => {
    auth.role = null;
    const res = await postJson(makePayload());
    expect(res.status).toBe(401);
  });

  it("rejects staff with 403", async () => {
    auth.role = "staff";
    const res = await postJson(makePayload());
    expect(res.status).toBe(403);
  });

  it("allows developer and returns no-store HTML", async () => {
    auth.role = "developer";
    const res = await postJson(makePayload());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-security-policy")).toContain("nonce-");
  });

  it("default print has no estimate/quotation indication", async () => {
    const res = await postJson(makePayload());
    const html = await res.text();
    expect(html).not.toMatch(/estimate|quotation|\bquote\b/i);
    expect(html).not.toContain("watermark");
    expect(html).not.toContain("Ye estimate hai");
  });

  it("prints title and disclaimer only when toggled on", async () => {
    const res = await postJson(
      makePayload({
        printOptions: {
          showTitle: true,
          title: "QUOTATION",
          showDisclaimer: true,
          disclaimer: "Rates valid for 15 days.",
        },
      })
    );
    const html = await res.text();
    expect(html).toContain("QUOTATION");
    expect(html).toContain("Rates valid for 15 days.");
  });

  it("recomputes totals on the server and ignores client-supplied totals", async () => {
    const res = await postJson(makePayload({ grandTotal: 999999 }));
    const html = await res.text();
    expect(html).toContain("₹200.00");
    expect(html).not.toContain("9,99,999.00");
  });

  it("escapes hostile item and client text", async () => {
    const res = await postJson(
      makePayload({
        lines: [{ name: '<img src=x onerror="alert(1)">', hsn: null, qty: 1, rate: 5 }],
        client: { name: "<script>alert(1)</script>", mobile: "", email: "", address: "" },
      })
    );
    const html = await res.text();
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
  });

  it("rejects more than 100 lines", async () => {
    const lines = Array.from({ length: 101 }, (_, i) => ({
      name: `Item ${i}`,
      hsn: null,
      qty: 1,
      rate: 1,
    }));
    const res = await postJson(makePayload({ lines }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/print-estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{oops",
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts the hidden-form payload field", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/print-estimate", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ payload: JSON.stringify(makePayload()) }).toString(),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("₹200.00");
  });
});
