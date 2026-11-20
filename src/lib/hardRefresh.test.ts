import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { clearMock } = vi.hoisted(() => ({ clearMock: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ getQueryClient: () => ({ clear: clearMock }) }));

import { clearAppCache } from "./hardRefresh";

const originalCaches = Object.getOwnPropertyDescriptor(window, "caches");
const originalSW = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function define(target: object, key: string, value: unknown) {
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}

function restore(target: object, key: string, original: PropertyDescriptor | undefined) {
  if (original) Object.defineProperty(target, key, original);
  else delete (target as Record<string, unknown>)[key];
}

describe("clearAppCache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearMock.mockReset();
  });

  afterEach(() => {
    restore(window, "caches", originalCaches);
    restore(navigator, "serviceWorker", originalSW);
    vi.clearAllMocks();
  });

  it("wipes SW caches, React Query and stale logo but preserves user settings", async () => {
    const del = vi.fn(async () => true);
    define(window, "caches", {
      keys: vi.fn(async () => ["next-static-js-assets", "static-image-assets"]),
      delete: del,
    });
    const unregister = vi.fn(async () => {});
    const update = vi.fn(() => Promise.resolve());
    define(navigator, "serviceWorker", {
      getRegistrations: vi.fn(async () => [{ update, unregister }]),
    });

    window.localStorage.setItem("vtech_brand_logo", "old-logo");
    window.localStorage.setItem("vtech_brand_logo_at", "1");
    window.localStorage.setItem("vtech_theme", "light");
    window.localStorage.setItem("vtech_email", "staff@vtech.com");

    await clearAppCache();

    expect(del).toHaveBeenCalledWith("next-static-js-assets");
    expect(del).toHaveBeenCalledWith("static-image-assets");
    expect(unregister).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(clearMock).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("vtech_brand_logo")).toBeNull();
    expect(window.localStorage.getItem("vtech_brand_logo_at")).toBeNull();
    expect(window.localStorage.getItem("vtech_theme")).toBe("light");
    expect(window.localStorage.getItem("vtech_email")).toBe("staff@vtech.com");
  });

  it("resolves even when cache APIs are unavailable or blocked", async () => {
    define(window, "caches", {
      keys: vi.fn(async () => {
        throw new Error("blocked");
      }),
      delete: vi.fn(),
    });
    define(navigator, "serviceWorker", undefined);

    await expect(clearAppCache()).resolves.toBeUndefined();
    expect(clearMock).toHaveBeenCalledOnce();
  });
});
