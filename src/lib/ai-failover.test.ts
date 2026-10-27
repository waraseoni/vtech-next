import { describe, expect, it } from "vitest";
import {
  fallbackProviders,
  isAiErrorResponse,
  isRetryableAiError,
  providerDisplayName,
} from "./ai-failover";

/**
 * Failover policy tests.
 *
 * Sabse important: normal AI jawab ko error na samjho (warna failover galat
 * trigger hoga aur valid reply replace ho jayega), aur content-safety error par
 * retry na karo (waste + galat provider).
 */
describe("isAiErrorResponse", () => {
  it("known error signatures detect karta hai", () => {
    expect(isAiErrorResponse("ERROR: Gemini API Key missing. Settings page se...")).toBe(true);
    expect(isAiErrorResponse("ERROR: Groq API Key missing.")).toBe(true);
    expect(isAiErrorResponse("API Error: 429 RESOURCE_EXHAUSTED")).toBe(true);
    expect(isAiErrorResponse("Groq API Error: 401 invalid_api_key")).toBe(true);
    expect(isAiErrorResponse("Gemini system abhi busy hai (Rate Limit).")).toBe(true);
    expect(isAiErrorResponse("Aapki Groq API request limit poori ho gayi hai.")).toBe(true);
    expect(isAiErrorResponse("Gemini se koi text response nahi mila.")).toBe(true);
  });

  it("normal jawab ko error nahi maanta (chahe usme 404/quota likha ho)", () => {
    expect(isAiErrorResponse("Aapke 404 jobs pending hain.")).toBe(false);
    expect(isAiErrorResponse("Quota ka matlab hota hai allocated limit.")).toBe(false);
    expect(isAiErrorResponse("Rate limit kaise badhayein, ye batata hoon.")).toBe(false);
    expect(isAiErrorResponse("OK")).toBe(false);
    expect(isAiErrorResponse("")).toBe(false);
    expect(isAiErrorResponse(null)).toBe(false);
    expect(isAiErrorResponse(undefined)).toBe(false);
  });
});

describe("isRetryableAiError", () => {
  it("key / quota / model / network errors retryable hain", () => {
    expect(isRetryableAiError("ERROR: Gemini API Key missing.")).toBe(true);
    expect(isRetryableAiError("API Error: API key not valid. Please pass a valid API key.")).toBe(
      true
    );
    expect(isRetryableAiError("API Error: 429 Too Many Requests")).toBe(true);
    expect(isRetryableAiError("Groq API Error: 401 Unauthorized")).toBe(true);
    expect(isRetryableAiError("Gemini system abhi busy hai (Rate Limit).")).toBe(true);
    expect(isRetryableAiError("Aapki Groq API request limit poori ho gayi hai.")).toBe(true);
    expect(isRetryableAiError("API Error: models/gemini-9 not found")).toBe(true);
    expect(isRetryableAiError("API Error: 503 Service Unavailable")).toBe(true);
    expect(isRetryableAiError("API Error: request timed out")).toBe(true);
  });

  it("content safety / invalid request retryable NAHI", () => {
    expect(isRetryableAiError("API Error: 400 INVALID_ARGUMENT")).toBe(false);
    expect(isRetryableAiError("API Error: response blocked by safety filters")).toBe(false);
    expect(isRetryableAiError("API Error: content policy violation")).toBe(false);
  });

  it("normal jawab retryable nahi (failover trigger na ho)", () => {
    expect(isRetryableAiError("Aapke 404 jobs pending hain, quota 50 hai.")).toBe(false);
    expect(isRetryableAiError("OK")).toBe(false);
    expect(isRetryableAiError("")).toBe(false);
  });

  it("empty Gemini response retryable hai (dusra provider jawab de sakta hai)", () => {
    expect(isRetryableAiError("Gemini se koi text response nahi mila. Dobara try karein.")).toBe(
      true
    );
  });
});

describe("fallbackProviders", () => {
  it("primary ko chhod ke baaki known providers deta hai", () => {
    expect(fallbackProviders("groq")).toEqual(["gemini"]);
    expect(fallbackProviders("gemini")).toEqual(["groq"]);
  });

  it("unknown primary par saare providers (crash nahi)", () => {
    expect(fallbackProviders("openai")).toEqual(["groq", "gemini"]);
    expect(fallbackProviders("")).toEqual(["groq", "gemini"]);
  });
});

describe("providerDisplayName", () => {
  it("known provider ka label, unknown ka as-is", () => {
    expect(providerDisplayName("groq")).toBe("Groq (Free)");
    expect(providerDisplayName("gemini")).toBe("Google Gemini");
    expect(providerDisplayName("openai")).toBe("openai");
  });
});
