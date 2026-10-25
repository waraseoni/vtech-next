import { describe, it, expect } from "vitest";
import { z } from "zod";

import { badRequest, fieldErrors, parseBody, parseData } from "./index";
import { bomTemplateUpdateSchema, toBomItemRow } from "./schemas/bomTemplate";
import { geofencePermitDeleteQuerySchema } from "./schemas/geofencePermit";

/** Chhota request helper — real route jaisa JSON body. */
function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const demoSchema = z.object({
  name: z.string().trim().min(1, "naam chahiye"),
  qty: z.number().int().min(1),
  note: z.string().max(10).optional(),
});

describe("parseBody", () => {
  it("valid body → typed data (trim bhi apply hota hai)", async () => {
    const res = await parseBody(demoSchema, jsonRequest({ name: "  bolt ", qty: 2 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ name: "bolt", qty: 2 });
  });

  it("missing field → 400 + field-wise issues + purana `error` key", async () => {
    const res = await parseBody(demoSchema, jsonRequest({ qty: 2 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;

    expect(res.response.status).toBe(400);
    const payload = (await res.response.json()) as {
      error: string;
      issues: Record<string, string[]>;
    };
    expect(payload.error).toBeTruthy();
    // Missing field par Zod ka type-error message aata hai (custom min message
    // tab aata hai jab value present ho par blank ho).
    expect(payload.issues.name).toBeTruthy();
    expect(payload.issues.name.length).toBeGreaterThan(0);
  });

  it("blank string → schema ka apna Hindi message", async () => {
    const res = await parseBody(demoSchema, jsonRequest({ name: "   ", qty: 2 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const payload = (await res.response.json()) as { issues: Record<string, string[]> };
    expect(payload.issues.name).toContain("naam chahiye");
  });

  it("wrong type → 400 (runtime check, type-assertion nahi)", async () => {
    const res = await parseBody(demoSchema, jsonRequest({ name: "x", qty: "2" }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const payload = (await res.response.json()) as { issues: Record<string, string[]> };
    expect(payload.issues.qty).toBeTruthy();
  });

  it("invalid JSON → 400 with JSON message", async () => {
    const res = await parseBody(demoSchema, jsonRequest("{not-json"));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const payload = (await res.response.json()) as { error: string };
    expect(payload.error).toMatch(/JSON/);
  });

  it("unknown keys strip ho jaate hain (DB me junk nahi jaata)", async () => {
    const res = await parseBody(
      demoSchema,
      jsonRequest({ name: "x", qty: 1, is_admin: true, role: "admin" })
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).not.toHaveProperty("is_admin");
    expect(res.data).not.toHaveProperty("role");
  });
});

describe("parseData + badRequest", () => {
  it("parseData direct value par kaam karta hai (forms ke liye)", () => {
    const res = parseData(demoSchema, { name: "a", qty: 3 });
    expect(res.ok).toBe(true);
  });

  it("issues nahi hone par response me `issues` key nahi aati", async () => {
    const res = badRequest("sirf message");
    expect(res.status).toBe(400);
    const payload = (await res.json()) as Record<string, unknown>;
    expect(payload).toEqual({ error: "sirf message" });
  });

  it("fieldErrors cross-field refine ko `_form` me daalta hai", () => {
    const parsed = bomTemplateUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const issues = fieldErrors(parsed.error);
    expect(issues._form).toContain("Kuch update karne ko nahi hai");
  });
});

describe("schemas", () => {
  it("BOM item blank notes drop karta hai, null product_id allow karta hai", () => {
    const row = toBomItemRow({
      product_id: null,
      name: "Wire",
      qty: 2,
      notes: "   ",
    });
    expect(row).toEqual({ product_id: null, name: "Wire", qty: 2 });
  });

  it("BOM update: partial payload valid (sirf description)", () => {
    const res = parseData(bomTemplateUpdateSchema, { description: "naya" });
    expect(res.ok).toBe(true);
  });

  it("geofence permit delete query: id string → number coerce", () => {
    const res = parseData(geofencePermitDeleteQuerySchema, { id: "42" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe(42);
  });
});
