import {
  AI_PROVIDER_IDS,
  isKnownAiProvider,
  providerLabel,
  type AiProviderId,
} from "./ai-provider-catalog";

/**
 * AI failover policy — kaunsa error dusre provider par retry karne layak hai.
 *
 * `gemini.ts` / `groq.ts` errors ko plain string me return karte hain (typed
 * result me refactor alag scope hai), isliye yahan **conservative** matching hai:
 *
 * 1. `isAiErrorResponse` sirf un messages ko error maanta hai jo known error
 *    signature se shuru hote hain (normal jawab me "quota"/"404" likha ho to
 *    wo error nahi hai).
 * 2. `isRetryableAiError` usme se bhi content-safety / invalid-request jaise
 *    non-retryable cases nikaal deta hai — kyunki dusra provider bhi wahi galat
 *    request bhejega, retry sirf paisa/time waste karega.
 */

/** Known error outputs (libs ke actual return strings se). */
const ERROR_SIGNATURES: RegExp[] = [
  /^ERROR:/i, // "ERROR: Gemini API Key missing…"
  /^API Error:/i, // "API Error: <raw>"
  /^Groq API Error:/i,
  /^Gemini system abhi busy hai/i, // rate limit
  /^Aapki Groq API request limit poori ho gayi hai/i,
  /^Data fetched successfully, but AI failed to generate final response/i,
  /^Gemini se koi text response nahi mila/i, // empty / blocked response
];

/** Retryable: key, quota, rate limit, model availability, network, 5xx. */
const RETRYABLE_PATTERNS: RegExp[] = [
  /api key missing/i,
  /api key not valid/i,
  /api_key_invalid/i,
  /invalid api key/i,
  /\b401\b/,
  /\b403\b/,
  /\b429\b/,
  /rate ?limit/i,
  /too many requests/i,
  /quota/i,
  /resource[_ ]exhausted/i,
  /limit poori ho gayi/i,
  /not found/i,
  /\b404\b/,
  /timed? ?out/i,
  /timeout/i,
  /\bECONNRESET\b|\bETIMEDOUT\b|\bENOTFOUND\b|\bEAI_AGAIN\b/,
  /\b5\d{2}\b/,
  /koi text response nahi mila/i,
  /failed to generate final response/i,
  /tool_use_failed/i,
  /failed to recover/i,
];

/** Non-retryable: request hi galat hai — dusra provider bhi fail karega. */
const NON_RETRYABLE_PATTERNS: RegExp[] = [
  /safety/i,
  /blocked/i,
  /content policy/i,
  /invalid argument/i,
  /malformed/i,
  // 400 with tool_use_failed is retryable on alternative provider, so exclude tool_use_failed
  /(?<!tool_use_failed.*)\b400\b(?!.*tool_use_failed)/,
];

/** Response known error signature se shuru hota hai? */
export function isAiErrorResponse(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return ERROR_SIGNATURES.some((re) => re.test(trimmed));
}

/** Dusre provider par retry karna chahiye? */
export function isRetryableAiError(text: string | null | undefined): boolean {
  if (!isAiErrorResponse(text)) return false;
  const trimmed = (text ?? "").trim();

  if (NON_RETRYABLE_PATTERNS.some((re) => re.test(trimmed))) return false;
  return RETRYABLE_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Primary ke baad kaun try kare. Sirf known providers, primary ko chhod ke.
 * Actual key availability route check karta hai (`getProviderSettings`).
 */
export function fallbackProviders(primary: string): AiProviderId[] {
  const normalized = isKnownAiProvider(primary) ? primary : "";
  return AI_PROVIDER_IDS.filter((id) => id !== normalized);
}

/** UI/log ke liye readable naam. */
export function providerDisplayName(provider: string): string {
  return providerLabel(provider);
}
