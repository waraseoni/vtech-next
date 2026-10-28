import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { signTrackingToken } from "@/lib/tracking-token";

const db = vi.hoisted(() => ({
  txnRow: null as Record<string, unknown> | null,
  txnError: null as { message: string } | null,
  clientRow: null as { contact: string | null } | null,
}));

vi.mock("@/lib/admin-supabase", () => ({
  getAdminSupabase: () => ({
    from: (table: string) => {
      const result = () => {
        if (table === "client_list") return { data: db.clientRow, error: null };
        if (table === "transaction_list")
          return { data: db.txnRow ? [db.txnRow] : [], error: db.txnError };
        return { data: [], error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "limit", "in", "order"]) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = async () => result();
      chain.then = (resolve: (value: unknown) => unknown) => resolve(result());
      return chain;
    },
  }),
}));

import { GET } from "./route";

const SECRET = "test-tracking-secret";
const ORIGINAL_SECRET = process.env.PUBLIC_TRACKING_SECRET;
const ORIGINAL_ENFORCE = process.env.PUBLIC_TRACKING_ENFORCE;

const txn = {
  id: 7,
  job_id: 28201,
  code: "2026032001",
  client_name: "42",
  item: "Laptop",
  fault: "No display",
  remark: "internal note",
  status: 3,
  amount: 4500,
  date_created: "2026-10-20",
};

const get = (qs: string, ip: string) =>
  GET(
    new NextRequest(`http://localhost/api/public/job-status?${qs}`, {
      headers: { "x-forwarded-for": ip },
    })
  );

describe("GET /api/public/job-status", () => {
  beforeEach(() => {
    process.env.PUBLIC_TRACKING_SECRET = SECRET;
    process.env.PUBLIC_TRACKING_ENFORCE = "1";
    db.txnRow = { ...txn };
    db.txnError = null;
    db.clientRow = { contact: "+91 98765-43210" };
  });

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.PUBLIC_TRACKING_SECRET;
    else process.env.PUBLIC_TRACKING_SECRET = ORIGINAL_SECRET;
    if (ORIGINAL_ENFORCE === undefined) delete process.env.PUBLIC_TRACKING_ENFORCE;
    else process.env.PUBLIC_TRACKING_ENFORCE = ORIGINAL_ENFORCE;
  });

  it("enforced + no token → limited view without amount/remark/client id", async () => {
    const res = await get("job_id=28201&code=2026032001", "203.0.113.21");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.limited).toBe(true);
    expect(body.job.amount).toBeUndefined();
    expect(body.job.remark).toBeUndefined();
    expect(body.job.client_name).toBeUndefined();
    expect(body.job.status).toBe(3);
  });

  it("enforced + valid token → full view, internal client id still hidden", async () => {
    const token = signTrackingToken(txn.job_id, txn.code);
    const res = await get(
      `job_id=28201&code=2026032001&token=${encodeURIComponent(token!)}`,
      "203.0.113.22"
    );
    const body = await res.json();
    expect(body.limited).toBe(false);
    expect(body.job.amount).toBe(4500);
    expect(body.job.remark).toBe("internal note");
    expect(body.job.client_name).toBeUndefined();
  });

  it("enforced + matching phone last 4 → full view (legacy slip escape hatch)", async () => {
    const res = await get("job_id=28201&phone=3210", "203.0.113.23");
    const body = await res.json();
    expect(body.limited).toBe(false);
    expect(body.job.amount).toBe(4500);
  });

  it("enforced + wrong phone → limited view", async () => {
    const res = await get("job_id=28201&phone=0000", "203.0.113.24");
    const body = await res.json();
    expect(body.limited).toBe(true);
    expect(body.job.amount).toBeUndefined();
  });

  it("rejects malformed phone digits", async () => {
    const res = await get("job_id=28201&phone=321", "203.0.113.25");
    expect(res.status).toBe(400);
  });

  it("not enforced → full view without any proof (current rollout state)", async () => {
    delete process.env.PUBLIC_TRACKING_ENFORCE;
    const res = await get("job_id=28201", "203.0.113.26");
    const body = await res.json();
    expect(body.limited).toBe(false);
    expect(body.job.amount).toBe(4500);
  });

  it("never returns the raw client id even in the limited subset", async () => {
    const res = await get("job_id=28201", "203.0.113.27");
    expect(JSON.stringify(await res.json())).not.toContain('"client_name"');
  });
});
