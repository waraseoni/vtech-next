# Free AI Providers Expansion Plan (OpenRouter & Cerebras)

**Document Date:** 28 October 2026  
**Status:** Planned (To be implemented later)  
**Target Goal:** V-Tech software ke AI Assistant me **OpenRouter** aur **Cerebras** ko add karna taaki bina credit card ya quota exhaustion (Gemini 20 RPD jaisi limits) ke hamesha 100% Free AI access available rahe.

---

## 1. Background & Problem Statement
- **Gemini Free Tier:** Google Gemini ka daily free limit sirf 20-50 requests per day (RPD) hai, jo heavy testing ya daily active usage me jaldi exhaust ho jata hai (`HTTP 429 RESOURCE_EXHAUSTED`).
- **Groq:** Kaafi tez aur generous hai (~14,400 RPD), par backup provider ka strong hona zaroori hai.
- **Requirement:** User ke paas do aur high-quality 100% Free providers ke options hone chahiye:
  1. **OpenRouter:** Access to multiple free models (`:free` tagged models like Llama 3.3 70B, DeepSeek R1/V3, Qwen 2.5 72B).
  2. **Cerebras Cloud:** Lightning-fast inference (~2000 tokens/sec) with ~1,000,000 tokens/day free tier.

---

## 2. Architecture & Design

V-Tech frontend ka AI layer already modular hai:
- `src/lib/ai-provider-catalog.ts` -> Provider registry, model lists, and display metadata.
- `src/lib/ai-settings.ts` -> Provider selection, API key resolution from DB (`system_info`) & `.env.local`.
- `src/lib/ai-failover.ts` -> Automatic failover logic jab primary fail ho.
- `src/app/api/chat/route.ts` -> Central chat execution endpoint.

Dono naye providers (OpenRouter aur Cerebras) **OpenAI-compatible API standard** use karte hain:
- **OpenRouter Base URL:** `https://openrouter.ai/api/v1`
- **Cerebras Base URL:** `https://api.cerebras.ai/v1`

---

## 3. Step-by-Step Implementation Plan

### Step 1: Update Provider Catalog (`src/lib/ai-provider-catalog.ts`)
Add `openrouter` and `cerebras` to `AiProviderId`:
```typescript
export type AiProviderId = "groq" | "gemini" | "openrouter" | "cerebras";

export const AI_PROVIDER_CATALOG: Record<AiProviderId, AiProviderCatalogEntry> = {
  groq: { ... },
  gemini: { ... },
  openrouter: {
    label: "OpenRouter (Free Models)",
    shortLabel: "OpenRouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
      "deepseek/deepseek-r1:free",
      "qwen/qwen-2.5-72b-instruct:free"
    ],
  },
  cerebras: {
    label: "Cerebras Cloud (Ultra Fast Free)",
    shortLabel: "Cerebras",
    model: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama3.1-8b"],
  },
};
```

### Step 2: Client Callers (`src/lib/openrouter.ts` & `src/lib/cerebras.ts`)
Create lightweight helper wrappers using the standard OpenAI client or `fetch`:
- Multi-turn tool calling loop using `geminiTools` & `executeGeminiTool`.
- Error resilience matching `src/lib/groq.ts`.
- Proper error handling for rate limits and invalid tokens.

### Step 3: Settings & API Integration
- `src/lib/ai-settings.ts`:
  - Add schema validation for `openrouter` and `cerebras`.
  - Add environment fallback: `OPENROUTER_API_KEY` and `CEREBRAS_API_KEY`.
- `src/app/api/chat/route.ts`:
  - Map `openrouter` and `cerebras` calls to their respective handlers.
- `src/lib/ai-failover.ts`:
  - Include both providers in failover rotation. If Groq hits rate limit -> fallback to OpenRouter -> fallback to Cerebras -> fallback to Gemini.

### Step 4: UI Updates (`src/app/settings/ai/page.tsx` or Settings Component)
- Ensure the settings provider dropdown automatically renders the new options from `AI_PROVIDER_CATALOG`.
- Add links to get free API keys:
  - OpenRouter: `https://openrouter.ai/keys`
  - Cerebras: `https://cloud.cerebras.ai`

---

## 4. Verification & Testing Checklist
- [ ] Test OpenRouter free model with database tool calling (`get_recent_jobs`, `get_attendance_report`).
- [ ] Test Cerebras model response time and accuracy.
- [ ] Test failover flow: Intentional invalid key on primary -> seamless auto-switch to fallback.
- [ ] Run test suite (`npm test`).
