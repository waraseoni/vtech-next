import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = { id: number; meta_field: string; meta_value: string | null };

const h = vi.hoisted(() => ({
  rows: [] as Row[],
  admin: true,
  nextId: 100,
  failField: null as string | null,
  revalidated: [] as string[],
}));

vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => {
    h.revalidated.push(`tag:${tag}`);
  },
  revalidatePath: (path: string) => {
    h.revalidated.push(`path:${path}`);
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/public-site-content", () => ({
  PUBLIC_SITE_CONTENT_TAG: "site-content",
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    h.admin ? { user: { id: "admin-1" }, profile: { role: "admin" } } : null
  ),
}));

vi.mock("@/lib/admin-supabase", () => ({
  getAdminSupabase: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let limit: number | null = null;
      let selectCols = "";
      let op: { type: "update" | "insert"; value: Record<string, unknown> } | null = null;

      const result = () => {
        if (table === "system_info") {
          if (op) {
            const value = op.value as { meta_field?: string; meta_value?: string };
            if (value.meta_field && value.meta_field === h.failField) {
              return { data: null, error: { message: "boom", code: "XX000" } };
            }
            if (op.type === "insert") {
              h.rows.push({
                id: h.nextId++,
                meta_field: String(value.meta_field),
                meta_value: value.meta_value ?? "",
              });
              return { data: null, error: null };
            }
            for (const row of h.rows) {
              if (Object.entries(filters).every(([k, v]) => (row as never)[k] === v)) {
                Object.assign(row, op.value);
              }
            }
            return { data: null, error: null };
          }
          let data = h.rows
            .filter((row) => Object.entries(filters).every(([k, v]) => (row as never)[k] === v))
            .sort((a, b) => a.id - b.id);
          if (limit != null) data = data.slice(0, limit);
          if (selectCols === "id")
            return { data: data.map((row) => ({ id: row.id })), error: null };
          return {
            data: data.map((row) => ({
              id: row.id,
              meta_field: row.meta_field,
              meta_value: row.meta_value,
            })),
            error: null,
          };
        }
        if (table === "profiles") return { data: { mechanic_id: 7 }, error: null };
        return { data: null, error: null };
      };

      const query = {
        select(cols = "") {
          selectCols = cols;
          return query;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        order() {
          return query;
        },
        limit(n: number) {
          limit = n;
          return query;
        },
        async maybeSingle() {
          const res = result();
          const data = res.data;
          return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
        },
        update(value: Record<string, unknown>) {
          op = { type: "update", value };
          return query;
        },
        async insert(value: Record<string, unknown>) {
          op = { type: "insert", value };
          return result();
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { GET, POST } from "./route";

const post = (payload: unknown) =>
  new NextRequest("http://localhost/api/settings/site-content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

const seed = (rows: Omit<Row, "id">[]) => {
  h.rows = rows.map((row, index) => ({ id: index + 1, ...row }));
};

describe("/api/settings/site-content", () => {
  beforeEach(() => {
    h.admin = true;
    h.nextId = 100;
    h.failField = null;
    h.revalidated = [];
    seed([]);
  });

  it("blocks non-admin users", async () => {
    h.admin = false;
    const res = await POST(post({ expectedUpdatedAt: null, firm: { name: "X" } }));
    expect(res.status).toBe(403);
    expect(h.rows).toHaveLength(0);
  });

  it("requires expectedUpdatedAt for concurrency safety", async () => {
    const res = await POST(post({ firm: { name: "X" } }));
    expect(res.status).toBe(400);
    expect(h.rows).toHaveLength(0);
  });

  it("rejects invalid firm fields before writing anything", async () => {
    const res = await POST(
      post({ expectedUpdatedAt: null, firm: { biz_open: "25:99", name: "X" } })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors.join(" ")).toContain("biz_open");
    expect(h.rows).toHaveLength(0);
  });

  it("returns 409 when another save already changed the content", async () => {
    seed([{ meta_field: "site_content_updated_at", meta_value: "2026-11-01T10:00:00.000Z" }]);
    const res = await POST(
      post({ expectedUpdatedAt: "2026-10-01T10:00:00.000Z", firm: { name: "X" } })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.currentUpdatedAt).toBe("2026-11-01T10:00:00.000Z");
  });

  it("sanitizes and persists firm keys + section patch, then revalidates", async () => {
    const res = await POST(
      post({
        expectedUpdatedAt: null,
        firm: { tagline: "  Naya Tagline  " },
        patch: { home: { heroTitle: "  Naya Hero  ", bogus: "drop" } },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.updatedAt).toBe("string");

    const tagline = h.rows.find((row) => row.meta_field === "tagline");
    expect(tagline?.meta_value).toBe("Naya Tagline");

    const raw = h.rows.find((row) => row.meta_field === "site_content")?.meta_value ?? "";
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.home).toEqual({ heroTitle: "Naya Hero" });

    expect(h.rows.some((row) => row.meta_field === "site_content_updated_at")).toBe(true);
    expect(h.revalidated).toContain("tag:site-content");
    expect(h.revalidated).toContain("path:/");
  });

  it("reports partial firm failures and skips the JSON write", async () => {
    h.failField = "tagline";
    const res = await POST(
      post({
        expectedUpdatedAt: null,
        firm: { tagline: "X" },
        patch: { home: { heroTitle: "Hero" } },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.failed[0].field).toBe("tagline");
    expect(h.rows.some((row) => row.meta_field === "site_content")).toBe(false);
  });

  it("deep-merges a partial section patch and keeps saved overrides", async () => {
    seed([
      {
        meta_field: "site_content",
        meta_value: JSON.stringify({
          version: 1,
          home: { heroTitle: "Saved Hero", ctaTitle: "Saved CTA" },
          services: { industrial: { label: "Saved Label", title: "Saved Title" } },
        }),
      },
    ]);
    const res = await POST(
      post({
        expectedUpdatedAt: null,
        patch: {
          home: { ctaTitle: "New CTA" },
          services: { industrial: { title: "New Title" } },
        },
      })
    );
    expect(res.status).toBe(200);

    const raw = h.rows.find((row) => row.meta_field === "site_content")?.meta_value ?? "";
    const parsed = JSON.parse(raw);
    expect(parsed.home).toEqual({ heroTitle: "Saved Hero", ctaTitle: "New CTA" });
    expect(parsed.services.industrial).toEqual({
      label: "Saved Label",
      title: "New Title",
    });
  });

  it("GET returns effective content plus raw firm values", async () => {
    seed([
      { meta_field: "name", meta_value: "Acme Electronics" },
      { meta_field: "site_content", meta_value: JSON.stringify({ home: { ctaTitle: "Hi" } }) },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firm.name).toBe("Acme Electronics");
    expect(body.content.brand.name).toBe("Acme Electronics");
    expect(body.content.home.ctaTitle).toBe("Hi");
  });
});
