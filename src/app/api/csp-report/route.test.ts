import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const post = (body: string, ip = "198.51.100.7", contentType = "application/csp-report") =>
  new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": contentType, "x-forwarded-for": ip },
    body,
  });

describe("POST /api/csp-report", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("logs legacy csp-report with query strings stripped", async () => {
    const res = await POST(
      post(
        JSON.stringify({
          "csp-report": {
            "document-uri":
              "https://vtech-next.vercel.app/job-status?job=12&code=4321&token=v1.abc",
            "violated-directive": "script-src-elem",
            "blocked-uri": "https://evil.example.com/x.js",
            disposition: "report",
          },
        })
      )
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const logged = warn.mock.calls.map((call: unknown[]) => String(call[1])).join("\n");
    expect(logged).toContain("script-src-elem");
    expect(logged).toContain("https://evil.example.com");
    expect(logged).toContain("/job-status");
    expect(logged).not.toContain("token=");
    expect(logged).not.toContain("code=4321");
    expect(logged).not.toContain("/x.js");
  });

  it("accepts Reporting API csp-violation payloads", async () => {
    const res = await POST(
      post(
        JSON.stringify([
          {
            type: "csp-violation",
            body: {
              documentURL: "https://vtech-next.vercel.app/dashboard?secret=1",
              blockedURL: "data:text/html;base64,PHNjcmlwdD4=",
              effectiveDirective: "img-src",
              disposition: "report",
            },
          },
        ]),
        "198.51.100.8",
        "application/reports+json"
      )
    );

    expect(res.status).toBe(204);
    const logged = warn.mock.calls.map((call: unknown[]) => String(call[1])).join("\n");
    expect(logged).toContain("img-src");
    expect(logged).toContain("data:");
    expect(logged).not.toContain("PHNjcmlwdD4");
    expect(logged).not.toContain("secret=1");
  });

  it("ignores malformed and unrelated payloads without failing", async () => {
    expect((await POST(post("{not json", "198.51.100.9"))).status).toBe(204);
    expect(
      (await POST(post(JSON.stringify([{ type: "deprecation" }]), "198.51.100.10"))).status
    ).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("drops oversized bodies", async () => {
    const huge = JSON.stringify({
      "csp-report": {
        "document-uri": "/x",
        "violated-directive": "script-src",
        pad: "a".repeat(9000),
      },
    });
    const res = await POST(post(huge, "198.51.100.11"));
    expect(res.status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });

  it("rate-limits per IP", async () => {
    const ip = "198.51.100.12";
    for (let i = 0; i < 60; i++) {
      await POST(post("{bad", ip));
    }
    await POST(
      post(
        JSON.stringify({
          "csp-report": { "document-uri": "/", "violated-directive": "script-src" },
        }),
        ip
      )
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
