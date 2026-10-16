import { renderHook, act, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJobList } from "./useJobList";
import type { JobsListSeed, Transaction } from "./jobListQueries";

// Phase 4 P2 perf follow-up: ye test seed-gate behaviour lock karta hai —
// mount-par seed valid ho to KOI client fetch nahi (RSC waterfall fix), aur
// mismatch/filter-change par client refetch. StrictMode case specially covered:
// dev me React effects do baar chalata hai (double-invoke) — purane "ek baar"
// skip-refs yahin toot jate the (doosri run phir fetch karti thi).
const fx = vi.hoisted(() => ({
  search: "",
  queryJobPage: vi.fn(),
  computeJobStats: vi.fn(),
  queryJobSpots: vi.fn(),
  enrichJobRows: vi.fn(),
  searchClientsForTerm: vi.fn(),
  fetchOpenPartCounts: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(fx.search),
}));

// Browser supabase is not exercised — jobListQueries calls are mocked below.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/requiredParts", () => ({
  fetchOpenPartCounts: fx.fetchOpenPartCounts,
}));

// Keep the real seedMatchesFilters (that's the logic under test); stub only the
// I/O-bound query functions so we can assert call counts.
vi.mock("./jobListQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jobListQueries")>();
  return {
    ...actual,
    queryJobPage: fx.queryJobPage,
    computeJobStats: fx.computeJobStats,
    queryJobSpots: fx.queryJobSpots,
    enrichJobRows: fx.enrichJobRows,
    searchClientsForTerm: fx.searchClientsForTerm,
  };
});

const seedTxn = (id: number): Transaction => ({
  id,
  job_id: String(id),
  code: null,
  client_name: 1,
  item: "Amp",
  fault: "dead",
  remark: null,
  uniq_id: null,
  amount: 100,
  status: 0,
  date_created: "2026-01-01T10:00:00+05:30",
  date_updated: "2026-01-01T10:00:00+05:30",
  date_completed: null,
  status_changed_at: null,
  del_status: 0,
});

const makeSeed = (hideDelivered = false): JobsListSeed => ({
  filterInputs: { search: "", dateFrom: "", dateTo: "", hideDelivered, status: "", spot: "" },
  transactions: [seedTxn(1)],
  totalRows: 1,
  stats: { total: 1, pending: 1, progress: 0, completed: 0, totalAmt: 100 },
  jobSpots: [{ id: 5, name: "Shelf A", count: 1 }],
  openPartCounts: [[1, 2]],
});

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  fx.search = "";
  document.cookie = "jobs_hide_delivered=; max-age=0; path=/";
  localStorage.clear();
  fx.queryJobPage.mockReset().mockResolvedValue({ rows: [], count: 0 });
  fx.computeJobStats
    .mockReset()
    .mockResolvedValue({ total: 0, pending: 0, progress: 0, completed: 0, totalAmt: 0 });
  fx.queryJobSpots.mockReset().mockResolvedValue([]);
  fx.enrichJobRows.mockReset().mockResolvedValue([]);
  fx.searchClientsForTerm.mockReset().mockResolvedValue("");
  fx.fetchOpenPartCounts.mockReset().mockResolvedValue(new Map());
});

describe("useJobList — RSC seed gate", () => {
  it("seed valid → mount par koi DB fetch nahi (stats/page/spots/openParts)", async () => {
    const seed = makeSeed();
    const { result } = renderHook(() => useJobList(seed));

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    await act(flush);

    expect(fx.queryJobPage).not.toHaveBeenCalled();
    expect(fx.computeJobStats).not.toHaveBeenCalled();
    expect(fx.queryJobSpots).not.toHaveBeenCalled();
    expect(fx.fetchOpenPartCounts).not.toHaveBeenCalled();
    // Seed data hi first paint hai
    expect(result.current.stats.total).toBe(1);
    expect(result.current.jobSpots).toHaveLength(1);
    expect(result.current.openPartCounts.get(1)).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it("StrictMode double-invoke me bhi seed mount-fetch nahi karta (dev regression guard)", async () => {
    const seed = makeSeed();
    const { result } = renderHook(() => useJobList(seed), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    await act(flush);

    expect(fx.queryJobPage).not.toHaveBeenCalled();
    expect(fx.computeJobStats).not.toHaveBeenCalled();
  });

  it("hide_delivered cookie=1 + seed hideDelivered=false → seed drop + client fetch", async () => {
    document.cookie = "jobs_hide_delivered=1; path=/";
    const seed = makeSeed(false);
    const { result } = renderHook(() => useJobList(seed));

    await waitFor(() => expect(fx.queryJobPage).toHaveBeenCalled());
    expect(result.current.hideDelivered).toBe(true);
  });

  it("seed ke baad filter change → client refetch (seed consumed)", async () => {
    const seed = makeSeed();
    const { result } = renderHook(() => useJobList(seed));

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    await act(flush);
    expect(fx.queryJobPage).not.toHaveBeenCalled();

    await act(async () => {
      result.current.setStatusFilter(2);
    });
    await waitFor(() => expect(fx.queryJobPage).toHaveBeenCalled());
  });

  it("hideDelivered: cookie se init + toggle par cookie mirror likhta hai", async () => {
    document.cookie = "jobs_hide_delivered=1; path=/";
    const { result } = renderHook(() => useJobList(null));

    expect(result.current.hideDelivered).toBe(true);

    await act(async () => {
      result.current.setHideDelivered(false);
    });
    expect(document.cookie).toContain("jobs_hide_delivered=0");
  });
});
