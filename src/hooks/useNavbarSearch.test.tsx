import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNavbarSearch } from "./useNavbarSearch";

// Universal search ke 8 parallel queries ko fake supabase se drive karta hai.
// Goal: brand naam se bhi job results aaye (brand_id FK resolver), aur doosre
// identity fields ki tarah hi identifier/model clauses bhi query me hon.
const fx = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/supabase", () => {
  const chain = (table: string) => {
    const rec: { table: string; ors: string[]; ins: Array<[string, unknown]> } = {
      table,
      ors: [],
      ins: [],
    };
    const c: Record<string, unknown> = {};
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.ilike = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.or = vi.fn((s: string) => {
      rec.ors.push(s);
      return c;
    });
    c.in = vi.fn((col: string, val: unknown) => {
      rec.ins.push([col, val]);
      return c;
    });
    c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      let data: unknown[] = [];
      if (table === "brands") data = [{ id: 9, name: "Stan", code: "STA" }];
      if (table === "transaction_list") {
        // Brand-ID wali extra query se sirf ek custom-label job milta hai —
        // iska `item` me "Stan" nahi hai, isliye pehli query se match nahi hota.
        data = rec.ins.length
          ? [
              {
                id: 77,
                job_id: "90001",
                item: "Purana custom label",
                item_name: "Ceiling Fan",
                model: null,
                serial_no: null,
                fault: "dead",
                status: 0,
                date_created: "2026-11-26T00:00:00Z",
              },
            ]
          : [];
      }
      fx.calls.push(rec);
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return c;
  };
  return { supabase: { from: vi.fn((table: string) => chain(table)) } };
});

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/queryClient", () => ({
  getQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));
vi.mock("@/lib/queries/job-view", () => ({ jobViewOptions: vi.fn() }));
vi.mock("@/lib/queries/direct-sale", () => ({ directSaleOptions: vi.fn() }));
vi.mock("@/lib/queries/client-detail", () => ({ clientDetailOptions: vi.fn() }));

beforeEach(() => {
  fx.calls.length = 0;
});

describe("useNavbarSearch — device identity fields", () => {
  it("brand match par brand-ID wale jobs bhi results me aate hain", async () => {
    const { result } = renderHook(() => useNavbarSearch());

    await act(async () => {
      result.current.handleChange({
        target: { value: "Stan" },
      } as React.ChangeEvent<HTMLInputElement>);
      await new Promise((r) => setTimeout(r, 450));
    });

    await waitFor(() =>
      expect(result.current.results.some((r) => r.href === "/jobs/77/view")).toBe(true)
    );

    const brands = fx.calls.find((c) => c.table === "brands");
    expect(brands?.ors).toContain("name.ilike.%Stan%,code.ilike.%Stan%");

    const brandJobs = fx.calls.find(
      (c) => c.table === "transaction_list" && (c.ins as Array<[string, unknown]>).length > 0
    );
    expect(brandJobs?.ins).toContainEqual(["brand_id", [9]]);

    const jobs = fx.calls.find(
      (c) => c.table === "transaction_list" && !(c.ins as Array<[string, unknown]>).length
    );
    const jobsOr = (jobs?.ors as string[])[0] || "";
    expect(jobsOr).toContain("item_name.ilike.%Stan%");
    expect(jobsOr).toContain("model.ilike.%Stan%");
    expect(jobsOr).toContain("serial_no.ilike.%Stan%");
  });
});
