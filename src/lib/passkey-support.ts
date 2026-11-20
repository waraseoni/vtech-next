import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { isNativeApp } from "@/lib/nativeApp";

export type PasskeySupport = {
  /** Passkey button dikhane ke liye safa — HTTPS + real platform authenticator. */
  ready: boolean;
  /** Capacitor WebView — yahan platform authenticator wired nahi hota. */
  inNativeApp: boolean;
  /** HTTP/LAN — WebAuthn secure-context me hi chalta hai. */
  insecureContext: boolean;
};

/**
 * Client-side passkey capability detection.
 *
 * `browserSupportsWebAuthn()` sirf `PublicKeyCredential` ki presence check karta
 * hai — PC par bina biometric device ke bhi true milta hai. Isliye actual
 * platform authenticator (Fingerprint / Face / Hello / device PIN) ka availability
 * bhi poocha jata hai. Errors ko gracefully `ready: false` me badal dete hain.
 *
 * SSR safe: `window` na ho to sab false.
 */
export async function detectPasskeySupport(): Promise<PasskeySupport> {
  if (typeof window === "undefined") {
    return { ready: false, inNativeApp: false, insecureContext: false };
  }

  const native = isNativeApp();
  const insecure = window.isSecureContext === false;
  const base: PasskeySupport = {
    ready: false,
    inNativeApp: native,
    insecureContext: insecure,
  };

  if (native || insecure || !browserSupportsWebAuthn()) return base;

  try {
    const available =
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
        ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        : false;
    return { ...base, ready: available };
  } catch {
    // Permission policy / API block — gracefully password-only.
    return base;
  }
}
