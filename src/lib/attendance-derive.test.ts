import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoClosePrevDays, autoClosePrevDaysFor } from "@/lib/attendance-derive";

// ── Fixtures ────────────────────────────────────────────────────────────────
// §4.3: naye check-in par purane OPEN din auto-close.
// Kal/parson ke open rows + ek closed + ek absent (no time_in) row.
const fx = vi.hoisted(() => {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const now = Date.now();
  return {
    yesterday: fmt(new Date(now - 86400000)),
    twoDaysAgo: fmt(new Date(now - 2 * 86400000)),
    attRows: [] as Record<string, unknown>[],
    dutyRows: [] as Record<string, unknown>[],
    calls: [] as { table: string; method: string; args: unknown[] }[],
  };
});

vi.mock("@/lib/supabase", () => {
  const METHODS = [
    "select",
    "eq",
    "neq",
    "not",
    "in",
    "lt",
    "lte",
    "is",
    "order",
    "update",
    "upsert",
    "insert",
  ];

  const resultFor = (table: string, ops: string[]) => {
    if (table === "attendance_list") {
      if (ops.includes("update")) return { data: null, error: null };
      return { data: fx.attRows, error: null };
    }
    if (table === "staff_duty_schedule") return { data: fx.dutyRows, error: null };
    if (table === "system_info") {
      return {
        data: [
          { meta_field: "biz_open", meta_value: "10:00" },
          { meta_field: "biz_close", meta_value: "20:00" },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  };

  const makeBuilder = (table: string) => {
    const ops: string[] = [];
    const b: Record<string, unknown> = {};
    for (const m of METHODS) {
      b[m] = (...args: unknown[]) => {
        ops.push(m);
        fx.calls.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (onFulfilled: unknown, onRejected: unknown) =>
      Promise.resolve(resultFor(table, ops)).then(onFulfilled as never, onRejected as never);
    return b;
  };

  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

beforeEach(() => {
  fx.calls = [];
  fx.attRows = [
    // id1: kal open — 10:05 in, out NULL → auto @ duty_end 19:00, worked 535
    {
      id: 1,
      mechanic_id: 7,
      curr_date: fx.yesterday,
      status: 1,
      time_in: "10:05:00",
      time_out: null,
    },
    // id2: parson open — 10:00 in → auto 19:00, worked 540
    {
      id: 2,
      mechanic_id: 7,
      curr_date: fx.twoDaysAgo,
      status: 1,
      time_in: "10:00:00",
      time_out: null,
    },
    // id3: checkout already hai → skip
    {
      id: 3,
      mechanic_id: 7,
      curr_date: fx.twoDaysAgo,
      status: 1,
      time_in: "09:00:00",
      time_out: "18:00:00",
    },
    // id4: time_in hi nahi (absent/manual) → skip
    { id: 4, mechanic_id: 7, curr_date: fx.twoDaysAgo, status: 2, time_in: null, time_out: null },
  ];
  fx.dutyRows = [
    {
      mechanic_id: 7,
      duty_start: "11:00:00",
      duty_end: "19:00:00",
      break_minutes: 0,
      effective_from: "2000-01-01",
    },
  ];
});

describe("autoClosePrevDays (§4.3)", () => {
  it("purane open din auto-close: time_out = duty_end + derived cols persist", async () => {
    const closed = await autoClosePrevDays(7);
    expect(closed).toBe(2);

    // Query: aaj se pehle + open rows
    expect(fx.calls.some((c) => c.table === "attendance_list" && c.method === "lt")).toBe(true);
    expect(fx.calls.some((c) => c.table === "attendance_list" && c.method === "is")).toBe(true);
    // Regression (2026-10-03): `time_out is null` alone matched 1055 rows → PostgREST
    // 1000-row cap ne asli target rows drop kar diye. `time_in not null` mandatory.
    expect(
      fx.calls.some(
        (c) => c.table === "attendance_list" && c.method === "not" && c.args[0] === "time_in"
      )
    ).toBe(true);

    const updates = fx.calls.filter((c) => c.table === "attendance_list" && c.method === "update");
    expect(updates).toHaveLength(2);

    // id1: 10:05 → 19:00 = 535m, auto = OT 0
    expect(updates[0].args[0]).toMatchObject({
      time_out: "19:00",
      worked_min: 535,
      ot_min: 0,
      duty_min: 480,
      is_auto_closed: true,
    });

    // id2: 10:00 → 19:00 = 540m
    expect(updates[1].args[0]).toMatchObject({
      time_out: "19:00",
      worked_min: 540,
      ot_min: 0,
      duty_min: 480,
      is_auto_closed: true,
    });

    // Update bilkul usi row par gaya (eq("id", ...)) — mock me eq alag call hai
    const eqs = fx.calls.filter(
      (c) => c.table === "attendance_list" && c.method === "eq" && c.args[0] === "id"
    );
    expect(eqs.map((c) => c.args[1])).toEqual([1, 2]);
  });

  it("closed/absent rows skip → 0 close, koi update nahi", async () => {
    fx.attRows = [
      {
        id: 3,
        mechanic_id: 7,
        curr_date: fx.twoDaysAgo,
        status: 1,
        time_in: "09:00:00",
        time_out: "18:00:00",
      },
      { id: 4, mechanic_id: 7, curr_date: fx.twoDaysAgo, status: 2, time_in: null, time_out: null },
    ];
    const closed = await autoClosePrevDays(7);
    expect(closed).toBe(0);
    expect(fx.calls.some((c) => c.table === "attendance_list" && c.method === "update")).toBe(
      false
    );
  });

  it("koi open row hi nahi → 0 (data/error par bhi non-fatal)", async () => {
    fx.attRows = [];
    expect(await autoClosePrevDays(7)).toBe(0);
  });

  it("batch variant: empty ids → 0, koi query nahi; wrapped single-id se same", async () => {
    expect(await autoClosePrevDaysFor([])).toBe(0);
    expect(fx.calls).toHaveLength(0);

    fx.attRows = [
      {
        id: 1,
        mechanic_id: 7,
        curr_date: fx.yesterday,
        status: 1,
        time_in: "10:05:00",
        time_out: null,
      },
    ];
    expect(await autoClosePrevDaysFor([7, 8])).toBe(1);
    // Page-load lazy close `.in` se dono staff ek hi query me maangta hai
    expect(fx.calls.some((c) => c.table === "attendance_list" && c.method === "in")).toBe(true);
    expect(fx.calls.filter((c) => c.method === "update")).toHaveLength(1);
  });
});
