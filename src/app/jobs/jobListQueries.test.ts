import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyBrandFilter,
  jobSearchFilter,
  normalizeBrandFilter,
  queryJobStats,
  searchBrandsForTerm,
  type JobListFilters,
} from "./jobListQueries";

// Device identity search — jobs list (RSC + client) ka single source. Universal
// navbar search alag path hai, par usme bhi yahi 4 fields cover hone chahiye.
describe("jobSearchFilter — device identity fields", () => {
  it("Item, Brand, Model aur Identifier sabko explicitly search karta hai", () => {
    const filter = jobSearchFilter("komaki", "5,6", "7,8");

    expect(filter).toContain("job_id.ilike.%komaki%");
    expect(filter).toContain("brand_job_no.ilike.%komaki%");
    expect(filter).toContain("item.ilike.%komaki%");
    expect(filter).toContain("item_name.ilike.%komaki%");
    expect(filter).toContain("brand_id.in.(7,8)");
    expect(filter).toContain("model.ilike.%komaki%");
    expect(filter).toContain("serial_no.ilike.%komaki%");
    expect(filter).toContain("client_name.in.(5,6)");
  });

  it("brand number (KMK#004) seedhe job_id ki tarah match karta hai", () => {
    const filter = jobSearchFilter("KMK#004", "-1", "-1");
    expect(filter).toContain("brand_job_no.ilike.%KMK#004%");
  });

  it("brand/client match na ho to sentinel '-1' — khaali .in.() nahi banta", () => {
    const filter = jobSearchFilter("xyz", "-1", "-1");
    expect(filter).toContain("brand_id.in.(-1)");
    expect(filter).toContain("client_name.in.(-1)");
    expect(filter).not.toContain(".in.()");
  });
});

describe("searchBrandsForTerm", () => {
  const fakeClient = (rows: Array<{ id: number }> | null) => {
    const or = vi.fn().mockResolvedValue({ data: rows });
    const select = vi.fn(() => ({ or }));
    const from = vi.fn(() => ({ select }));
    return { or, from, client: { from } as unknown as SupabaseClient };
  };

  it("brand name/code par matching IDs CSV deta hai", async () => {
    const { or, client } = fakeClient([{ id: 7 }, { id: 8 }]);

    await expect(searchBrandsForTerm(client, "Komaki")).resolves.toBe("7,8");
    expect(or).toHaveBeenCalledWith("name.ilike.%Komaki%,code.ilike.%Komaki%");
  });

  it("match na ho to '-1', khaali term par khaali string", async () => {
    const { client } = fakeClient(null);

    await expect(searchBrandsForTerm(client, "nope")).resolves.toBe("-1");
    await expect(searchBrandsForTerm(client, "")).resolves.toBe("");
  });
});

// B2 — brand switcher: RSC seed, client fetch, list query aur RPC stats ek hi
// normalized value use karte hain. Drift = list aur Quick Stats alag dikhte hain.
describe("brand filter — single source", () => {
  it("URL value safe normalize hota hai", () => {
    expect(normalizeBrandFilter("5")).toBe("5");
    expect(normalizeBrandFilter(" 05 ")).toBe("5");
    expect(normalizeBrandFilter("UNTAGGED")).toBe("untagged");
    expect(normalizeBrandFilter("kmk")).toBe("");
    expect(normalizeBrandFilter(null)).toBe("");
  });

  it("list query me brand_id gate lagta hai (All = no-op)", () => {
    const eq = vi.fn();
    const is = vi.fn();
    const q = { eq, is };
    applyBrandFilter(q, "5");
    expect(eq).toHaveBeenCalledWith("brand_id", 5);
    expect(is).not.toHaveBeenCalled();

    applyBrandFilter(q, "untagged");
    expect(is).toHaveBeenCalledWith("brand_id", null);

    eq.mockClear();
    is.mockClear();
    applyBrandFilter(q, "");
    expect(eq).not.toHaveBeenCalled();
    expect(is).not.toHaveBeenCalled();
  });

  it("Quick Stats RPC ko bhi p_brand milta hai", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { total: 4, pending: 1, progress: 0, completed: 3, totalAmt: 500 },
      error: null,
    });
    const client = { rpc } as unknown as SupabaseClient;
    const filters: JobListFilters = {
      term: "",
      dateFrom: "",
      dateTo: "",
      hideDelivered: false,
      status: "",
      spot: "",
      brand: "untagged",
    };

    await queryJobStats(
      client,
      filters,
      async () => "",
      async () => ""
    );
    expect(rpc).toHaveBeenCalledWith(
      "get_jobs_stats",
      expect.objectContaining({ p_brand: "untagged" })
    );
  });
});
