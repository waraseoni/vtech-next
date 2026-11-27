import { beforeEach, describe, expect, it, vi } from "vitest";

// AI job lookup contract: har naye searchable identifier ke saath AI prompt,
// tool schema aur tool executor — teeno update honi chahiye (golden rule).
const fx = vi.hoisted(() => ({
  ors: [] as string[],
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.or = vi.fn((s: string) => {
        fx.ors.push(s);
        return chain;
      });
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({
          data: table === "transaction_list" ? fx.rows : [],
          error: null,
        }).then(resolve, reject);
      return chain;
    },
  }),
}));

import { buildSystemPrompt, executeGeminiTool, geminiTools } from "./gemini-tools";

const brandRow = {
  id: 8,
  job_id: "28105",
  brand_job_no: "KMK#004",
  client_name: "42",
  item: "Laptop",
  fault: "No display",
  status: 0,
  amount: 1500,
  date_created: "2026-11-28T10:00:00Z",
};

beforeEach(() => {
  fx.ors.length = 0;
  fx.rows = [{ ...brandRow }];
});

describe("AI search awareness", () => {
  it("system prompt aur tool schema brand_job_no se aware hain", () => {
    const prompt = buildSystemPrompt("staff");
    const tool = geminiTools.find((t) => t.name === "get_job_details_by_id");

    expect(prompt).toContain("brand_job_no");
    expect(tool?.description).toContain("brand number");
    expect(tool?.parameters.properties.job_id.description).toContain("KMK#004");
  });

  it("brand number (KMK#004) se seedha job details deta hai", async () => {
    const out = await executeGeminiTool({
      name: "get_job_details_by_id",
      args: { job_id: "KMK#004" },
    });

    expect(fx.ors[0]).toContain("brand_job_no.ilike.%KMK#004%");
    expect(out.job_details).toMatchObject({
      job_id: "28105",
      brand_job_no: "KMK#004",
    });
  });

  it("text search me bhi brand_job_no clause hota hai", async () => {
    fx.rows = [];
    await executeGeminiTool({
      name: "get_job_details_by_id",
      args: { job_id: "Komaki" },
    });

    expect(fx.ors[0]).toContain("brand_job_no.ilike.%Komaki%");
    expect(fx.ors[0]).toContain("item.ilike.%Komaki%");
  });
});
