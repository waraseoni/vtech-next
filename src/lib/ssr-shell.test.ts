import { afterEach, describe, expect, it, vi } from "vitest";

async function load(flag: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SSR_SHELL", flag);
  return await import("./ssr-shell");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ssr-shell flag", () => {
  it("defaults to off", async () => {
    const m = await load("");
    expect(m.isSsrShellEnabled()).toBe(false);
    expect(m.isSsrShellRoute("/jobs")).toBe(false);
  });

  it("treats 'off' case-insensitively as disabled", async () => {
    const m = await load("OFF");
    expect(m.isSsrShellEnabled()).toBe(false);
    expect(m.isSsrShellRoute("/jobs")).toBe(false);
  });

  it("'all' enables every route", async () => {
    const m = await load("all");
    expect(m.isSsrShellEnabled()).toBe(true);
    expect(m.isSsrShellRoute("/jobs")).toBe(true);
    expect(m.isSsrShellRoute("/dashboard")).toBe(true);
  });

  it("comma-separated prefixes match exact route and children only", async () => {
    const m = await load("/jobs, /dashboard");
    expect(m.isSsrShellRoute("/jobs")).toBe(true);
    expect(m.isSsrShellRoute("/jobs/123")).toBe(true);
    expect(m.isSsrShellRoute("/dashboard")).toBe(true);
    expect(m.isSsrShellRoute("/clients")).toBe(false);
    expect(m.isSsrShellRoute("/jobs-old")).toBe(false);
  });
});
