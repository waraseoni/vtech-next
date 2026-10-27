import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_IDS,
  defaultModel,
  isKnownAiProvider,
  providerLabel,
  providerModels,
  providerShortLabel,
} from "./ai-provider-catalog";

/**
 * Provider catalog — client (Settings UI) aur server (ai-settings) dono isi se
 * model list lete hain, isliye unknown provider par bhi crash nahi hona chahiye.
 */
describe("ai provider catalog", () => {
  it("dono known providers listed hain", () => {
    expect(AI_PROVIDER_IDS).toEqual(["groq", "gemini"]);
  });

  it("known provider ka default model", () => {
    expect(defaultModel("groq")).toBe("openai/gpt-oss-120b");
    expect(defaultModel("gemini")).toBe("gemini-2.5-flash");
  });

  it("unknown provider par katmandoo default (crash nahi)", () => {
    expect(defaultModel("openai")).toBe("gemini-2.5-flash");
    expect(providerLabel("openai")).toBe("openai");
    expect(providerModels("openai")).toEqual(["gemini-2.5-flash"]);
  });

  it("har provider ke models me uska default bhi hota hai", () => {
    for (const id of AI_PROVIDER_IDS) {
      expect(providerModels(id)).toContain(defaultModel(id));
    }
  });

  it("isKnownAiProvider sirf known ids par true", () => {
    expect(isKnownAiProvider("groq")).toBe(true);
    expect(isKnownAiProvider("gemini")).toBe(true);
    expect(isKnownAiProvider("GROQ")).toBe(false);
    expect(isKnownAiProvider("")).toBe(false);
  });

  it("short label header chip me fit hone wala chhota naam deta hai", () => {
    expect(providerShortLabel("groq")).toBe("Groq");
    expect(providerShortLabel("gemini")).toBe("Gemini");
    expect(providerShortLabel("openai")).toBe("openai");
    // short label kabhi full label se lamba na ho
    for (const id of AI_PROVIDER_IDS) {
      expect(providerShortLabel(id).length).toBeLessThan(providerLabel(id).length);
    }
  });
});
