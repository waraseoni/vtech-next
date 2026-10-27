/**
 * AI provider catalog — client-safe (koi node/server import nahi).
 *
 * Settings page isse model lists render karta hai; `src/lib/ai-settings.ts`
 * (server) bhi yahi catalog use karta hai — single source of truth.
 *
 * Naya provider add karna: yahan entry + `aiProviderIdSchema` me enum value +
 * `src/lib/gemini.ts`/`groq.ts` jaisa caller. Baaki UI/API automatic pick
 * kar leta hai.
 */

export type AiProviderId = "groq" | "gemini";

export type AiProviderCatalogEntry = {
  label: string;
  /** Chhoti jagah (header chip, mobile) ke liye — `label` wahan truncate ho jata tha. */
  shortLabel: string;
  model: string;
  models: string[];
};

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderCatalogEntry> = {
  groq: {
    label: "Groq (Free)",
    shortLabel: "Groq",
    model: "openai/gpt-oss-120b",
    // Groq ne purane llama-3.3/mixtral models retire kar diye
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"],
  },
  gemini: {
    label: "Google Gemini",
    shortLabel: "Gemini",
    model: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
  },
};

export const AI_PROVIDER_IDS: AiProviderId[] = ["groq", "gemini"];

/** Kuch configured na ho to purana default (behaviour change na ho). */
export const AI_DEFAULT_PROVIDER: AiProviderId = "gemini";

export function isKnownAiProvider(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as string[]).includes(value);
}

export function defaultModel(provider: string): string {
  return isKnownAiProvider(provider)
    ? AI_PROVIDER_CATALOG[provider].model
    : AI_PROVIDER_CATALOG[AI_DEFAULT_PROVIDER].model;
}

export function providerLabel(provider: string): string {
  return isKnownAiProvider(provider) ? AI_PROVIDER_CATALOG[provider].label : provider;
}

/** Compact label — header chip / mobile jaisi tight jagah ke liye. */
export function providerShortLabel(provider: string): string {
  return isKnownAiProvider(provider) ? AI_PROVIDER_CATALOG[provider].shortLabel : provider;
}

export function providerModels(provider: string): string[] {
  return isKnownAiProvider(provider)
    ? AI_PROVIDER_CATALOG[provider].models
    : [defaultModel(provider)];
}
