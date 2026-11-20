import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/nativeApp", () => ({ isNativeApp: vi.fn(() => false) }));
vi.mock("@simplewebauthn/browser", () => ({ browserSupportsWebAuthn: vi.fn(() => true) }));

import { detectPasskeySupport } from "./passkey-support";
import { isNativeApp } from "@/lib/nativeApp";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

const originalSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");

function stubPlatformAuthenticator(result: boolean | (() => Promise<boolean>)) {
  const fn = typeof result === "function" ? result : () => Promise.resolve(result);
  vi.stubGlobal("PublicKeyCredential", {
    isUserVerifyingPlatformAuthenticatorAvailable: fn,
  });
}

describe("detectPasskeySupport", () => {
  beforeEach(() => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(true);
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (originalSecure) Object.defineProperty(window, "isSecureContext", originalSecure);
  });

  it("ready when a platform authenticator is available over HTTPS", async () => {
    stubPlatformAuthenticator(true);
    await expect(detectPasskeySupport()).resolves.toEqual({
      ready: true,
      inNativeApp: false,
      insecureContext: false,
    });
  });

  it("disabled on insecure (LAN http) context without probing the API", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    stubPlatformAuthenticator(true);
    await expect(detectPasskeySupport()).resolves.toEqual({
      ready: false,
      inNativeApp: false,
      insecureContext: true,
    });
  });

  it("disabled inside the Capacitor WebView", async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    stubPlatformAuthenticator(true);
    await expect(detectPasskeySupport()).resolves.toEqual({
      ready: false,
      inNativeApp: true,
      insecureContext: false,
    });
  });

  it("disabled when WebAuthn API is missing", async () => {
    vi.mocked(browserSupportsWebAuthn).mockReturnValue(false);
    stubPlatformAuthenticator(true);
    const support = await detectPasskeySupport();
    expect(support.ready).toBe(false);
  });

  it("disabled when no platform authenticator is enrolled", async () => {
    stubPlatformAuthenticator(false);
    const support = await detectPasskeySupport();
    expect(support.ready).toBe(false);
  });

  it("disabled when the availability probe throws", async () => {
    stubPlatformAuthenticator(() => Promise.reject(new Error("blocked")));
    const support = await detectPasskeySupport();
    expect(support.ready).toBe(false);
  });
});
