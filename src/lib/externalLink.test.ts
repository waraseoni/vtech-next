import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isNativeApp } = vi.hoisted(() => ({ isNativeApp: vi.fn(() => false) }));
vi.mock("@/lib/nativeApp", () => ({ isNativeApp }));

import { openExternalLink } from "./externalLink";

function fakeWindow() {
  return {
    location: { href: "http://localhost/login", assign: vi.fn() },
    open: vi.fn(),
  };
}

describe("openExternalLink", () => {
  let w: ReturnType<typeof fakeWindow>;

  beforeEach(() => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    w = fakeWindow();
    vi.stubGlobal("window", w);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("opens a new tab in the browser", () => {
    const url = "https://wa.me/919179105875?text=reset";
    openExternalLink(url);
    expect(w.open).toHaveBeenCalledWith(url, "_blank", "noopener,noreferrer");
    expect(w.location.assign).not.toHaveBeenCalled();
  });

  it("uses external navigation inside the Capacitor WebView", () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    const url = "https://wa.me/919179105875?text=reset";

    openExternalLink(url);

    expect(w.location.assign).toHaveBeenCalledWith(url);
    expect(w.open).not.toHaveBeenCalled();
  });

  it("ignores non-http(s) URLs", () => {
    openExternalLink("javascript:alert(1)");
    expect(w.open).not.toHaveBeenCalled();
    expect(w.location.assign).not.toHaveBeenCalled();
  });
});
