import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const post = (body: string, ip = "198.51.100.9") =>
  new Request("http://localhost/api/vitals", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body,
  });

const logged = (warn: ReturnType<typeof vi.spyOn>) =>
  warn.mock.calls.map((call: unknown[]) => String(call[1])).join("\n");

describe("POST /api/vitals", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("logs a core metric with pathname only (no query string)", async () => {
    const res = await POST(
      post(
        JSON.stringify({
          name: "LCP",
          value: 1234.5678,
          rating: "good",
          id: "v3-123",
          path: "/jobs",
          navigationType: "navigate",
        })
      )
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const line = logged(warn);
    expect(line).toContain("LCP");
    expect(line).toContain('"value":1235');
    expect(line).toContain("/jobs");
    expect(line).toContain("good");
  });

  it("ignores unknown metric names and non-numeric values", async () => {
    await POST(post(JSON.stringify({ name: "custom-metric", value: 10 })));
    await POST(post(JSON.stringify({ name: "LCP", value: "abc" })));
    await POST(post(JSON.stringify({ name: "FCP", value: -1 })));
    expect(warn).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON and oversized bodies", async () => {
    expect((await POST(post("{not json"))).status).toBe(204);
    const huge = JSON.stringify({ name: "LCP", value: 1, pad: "x".repeat(2000) });
    expect((await POST(post(huge))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps CLS (unitless) reports and normalizes unknown ratings", async () => {
    await POST(post(JSON.stringify({ name: "CLS", value: 0.0421, rating: "weird" })));
    const line = logged(warn);
    expect(line).toContain("CLS");
    expect(line).toContain("unknown");
  });

  it("drops implausible values (backgrounded-tab artifacts)", async () => {
    await POST(post(JSON.stringify({ name: "TTFB", value: 126001, rating: "poor" })));
    await POST(post(JSON.stringify({ name: "LCP", value: 63000, rating: "poor" })));
    await POST(post(JSON.stringify({ name: "CLS", value: 42 })));
    expect(warn).not.toHaveBeenCalled();
  });
});
