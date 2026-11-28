import { beforeEach, describe, expect, it, vi } from "vitest";

// AI job lookup contract: har naye searchable identifier ke saath AI prompt,
// tool schema aur tool executor — teeno update honi chahiye (golden rule).
const fx = vi.hoisted(() => ({
  ors: [] as string[],
  eqs: [] as Array<[string, unknown]>,
  iss: [] as Array<[string, unknown]>,
  ins: [] as Array<[string, unknown]>,
  rows: [] as Record<string, unknown>[],
  brandRows: [] as Record<string, unknown>[],
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn((col: string, v: unknown) => {
        fx.eqs.push([col, v]);
        return chain;
      });
      chain.is = vi.fn((col: string, v: unknown) => {
        fx.iss.push([col, v]);
        return chain;
      });
      chain.or = vi.fn((s: string) => {
        fx.ors.push(s);
        return chain;
      });
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.in = vi.fn((col: string, v: unknown) => {
        fx.ins.push([col, v]);
        return chain;
      });
      chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({
          data: table === "transaction_list" ? fx.rows : table === "brands" ? fx.brandRows : [],
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
  fx.eqs.length = 0;
  fx.iss.length = 0;
  fx.ins.length = 0;
  fx.rows = [{ ...brandRow }];
  fx.brandRows = [];
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

// B2 — AI bhi brand filter se aware hona chahiye (AGENTS.md golden rule).
describe("AI brand filter awareness", () => {
  it("prompt aur get_recent_jobs schema brand filter batate hain", () => {
    const prompt = buildSystemPrompt("staff");
    const tool = geminiTools.find((t) => t.name === "get_recent_jobs");

    expect(prompt).toContain("/jobs?brand=");
    expect(prompt).toContain("untagged");
    expect(tool?.description).toContain("brand");
    expect(tool?.parameters.properties.brand.description).toContain("untagged");
  });

  it("brand id se us brand ke saare kaam laata hai", async () => {
    await executeGeminiTool({ name: "get_recent_jobs", args: { brand: "5", limit: 10 } });

    expect(fx.eqs).toContainEqual(["brand_id", 5]);
  });

  it("untagged legacy jobs ke liye brand_id IS NULL lagata hai", async () => {
    await executeGeminiTool({ name: "get_recent_jobs", args: { brand: "untagged" } });

    expect(fx.iss).toContainEqual(["brand_id", null]);
  });

  it("brand name/code pehle master se ID resolve hota hai", async () => {
    fx.brandRows = [{ id: 5 }];
    await executeGeminiTool({ name: "get_recent_jobs", args: { brand: "KMK" } });

    expect(fx.ors).toContainEqual("name.ilike.%kmk%,code.ilike.%kmk%");
    expect(fx.eqs).toContainEqual(["brand_id", 5]);
  });
});

// Backup/restore rule — AGENTS.md golden rule: AI ko nayi restore policy batani chahiye.
describe("AI backup/restore awareness", () => {
  it("prompt auth-linked skip aur Admin Restore route batata hai", () => {
    const prompt = buildSystemPrompt("admin");

    expect(prompt).toContain("/backup");
    expect(prompt).toContain("Admin Restore");
    expect(prompt).toContain("ai_providers");
    expect(prompt).toContain("removed-column");
  });
});
