import { describe, expect, it } from "vitest";
import {
  buildMonthlyDetailRows,
  computeMonthlyProfit,
  fetchMonthlyProfitData,
  fetchMonthlyProfitRawData,
  monthlyDetailTitle,
  type MonthlyProfitRows,
  type MonthlyRawData,
} from "./monthly-profit-data";

type Row = Record<string, unknown>;
type Filter = { op: "eq" | "gte" | "lte"; col: string; val: unknown };

function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Filter[] = [];
      const matches = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every((f) => {
            const v = r[f.col];
            if (f.op === "eq") return v === f.val;
            if (f.op === "gte") return String(v ?? "") >= String(f.val);
            return String(v ?? "") <= String(f.val);
          })
        );
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => (filters.push({ op: "eq", col, val }), builder),
        gte: (col: string, val: unknown) => (filters.push({ op: "gte", col, val }), builder),
        lte: (col: string, val: unknown) => (filters.push({ op: "lte", col, val }), builder),
        range: (start: number, end: number) =>
          Promise.resolve({ data: matches().slice(start, end + 1), error: null }),
      };
      return builder;
    },
  };
}

const TS = "T10:00:00+05:30";
const MAR = "2026-03";

function tables(): Record<string, Row[]> {
  return {
    transaction_list: [
      {
        id: 1,
        code: "J1",
        client_name: 2,
        amount: 1000,
        mechanic_commission_amount: 100,
        status: 5,
        date_completed: `${MAR}-15${TS}`,
      },
      // IST month boundary: UTC me 28 Feb, par IST me 1 March.
      {
        id: 2,
        code: "J2",
        client_name: "Walk-in",
        amount: 300,
        mechanic_commission_amount: 0,
        status: 5,
        date_completed: "2026-03-01T00:30:00+05:30",
      },
      // Out of year (query filter isko hata deta hai).
      {
        id: 3,
        code: "J0",
        client_name: 2,
        amount: 9999,
        mechanic_commission_amount: 0,
        status: 5,
        date_completed: `2025-05-15${TS}`,
      },
    ],
    direct_sales: [
      {
        id: 1,
        sale_code: "W1",
        client_id: null,
        total_amount: 500,
        date_created: `${MAR}-04${TS}`,
      },
      { id: 2, sale_code: "C1", client_id: 2, total_amount: 700, date_created: `${MAR}-05${TS}` },
    ],
    client_payments: [
      {
        id: 1,
        client_id: 2,
        amount: 100,
        discount: 20,
        remarks: "disc",
        created_at: `${MAR}-06${TS}`,
      },
    ],
    expense_list: [
      { id: 1, amount: 50, category: "Rent", remarks: "shop", date_created: `${MAR}-05T09:00:00` },
    ],
    loan_payments: [
      { id: 1, lender_id: 1, amount_paid: 30, remarks: "emi", payment_date: `${MAR}-07${TS}` },
    ],
    attendance_list: [
      { mechanic_id: 1, curr_date: `${MAR}-01`, status: 1 },
      { mechanic_id: 1, curr_date: `${MAR}-02`, status: 3 },
      { mechanic_id: 99, curr_date: `${MAR}-02`, status: 1 }, // unknown mechanic → rate 0
    ],
    mechanic_list: [
      { id: 1, firstname: "Ram", middlename: "", lastname: "Yadav", daily_salary: 300 },
    ],
    client_list: [{ id: 2, firstname: "Sita", middlename: "", lastname: "Devi" }],
    lender_list: [{ id: 1, fullname: "HDFC" }],
  };
}

function rows(): MonthlyProfitRows {
  // Out-of-year row `tables()` me hai (query filter ke liye); compute helper
  // sirf same-year rows maanta hai — isliye yahan pehli do rows hi.
  return {
    transactions: tables().transaction_list.slice(0, 2) as Row[],
    directSales: tables().direct_sales as Row[],
    clientPayments: tables().client_payments as Row[],
    expenses: tables().expense_list as Row[],
    loanPayments: tables().loan_payments as Row[],
    attendance: tables().attendance_list as Row[],
    mechanics: tables().mechanic_list as Row[],
    clients: tables().client_list as Row[],
    lenders: tables().lender_list as Row[],
  };
}

describe("computeMonthlyProfit", () => {
  const data = computeMonthlyProfit(rows(), 2026);
  const march = data[2];

  it("returns 12 calendar months in order", () => {
    expect(data).toHaveLength(12);
    expect(data[0].month).toBe("January");
    expect(data[11].month).toBe("December");
    expect(data.map((m) => m.monthNum)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("buckets by IST month and excludes out-of-year rows", () => {
    // March: J1 (1000) + boundary J2 (300), 2025 row filter se bahar.
    expect(march.repair).toBe(1300);
    expect(data.reduce((s, m) => s + m.repair, 0)).toBe(1300);
  });

  it("splits walk-in vs registered-client direct sales", () => {
    expect(march.walkin).toBe(500);
    expect(march.clientSales).toBe(700);
    expect(march.revenue).toBe(2500); // 1300 + 500 + 700
  });

  it("computes salaries from full/half attendance at mechanic rate", () => {
    expect(march.salaries).toBe(450); // 300 full + 150 half
  });

  it("computes expenses, EMI, discounts, totals and margin", () => {
    expect(march.expenses).toBe(50);
    expect(march.emi).toBe(30);
    expect(march.discounts).toBe(20);
    expect(march.commission).toBe(100);
    expect(march.totalExp).toBe(650);
    expect(march.profit).toBe(1850);
    expect(march.margin).toBeCloseTo((1850 / 2500) * 100, 5);
  });

  it("keeps other months empty", () => {
    expect(data[0].revenue).toBe(0);
    expect(data[0].margin).toBe(0);
  });
});

describe("fetchMonthlyProfitData", () => {
  it("returns only monthly buckets (raw rows payload se bahar)", async () => {
    const payload = await fetchMonthlyProfitData(fakeSupabase(tables()), 2026);
    expect(payload.data).toHaveLength(12);
    expect(payload.data[2].profit).toBe(1850);
    expect(payload).not.toHaveProperty("rawData");
  });

  it("fetchMonthlyProfitRawData still returns the drill-down rows", async () => {
    const raw = await fetchMonthlyProfitRawData(fakeSupabase(tables()), 2026);
    expect(raw.transactions).toHaveLength(2); // 2025 row filtered out
    expect(raw.clients).toHaveLength(1);
    expect(raw.lenders).toHaveLength(1);
  });
});

describe("buildMonthlyDetailRows", () => {
  const raw: MonthlyRawData = { ...rows() };

  it("repair jobs: IST month filter + client name resolution", () => {
    const out = buildMonthlyDetailRows(raw, "repair_jobs", 2026, 3);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.id)).toEqual([1, 2]);
    expect(out[0].client_name).toBe("Sita Devi");
    expect(out[1].client_name).toBe("Walk-in");
  });

  it("commission: sirf commission > 0 rows", () => {
    const out = buildMonthlyDetailRows(raw, "commission", 2026, 3);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  it("walk-in vs client sales split", () => {
    expect(buildMonthlyDetailRows(raw, "walkin_sales", 2026, 3)).toHaveLength(1);
    const clientSales = buildMonthlyDetailRows(raw, "client_sales", 2026, 3);
    expect(clientSales).toHaveLength(1);
    expect(clientSales[0].client_name).toBe("Sita Devi");
  });

  it("expenses filter by date prefix", () => {
    expect(buildMonthlyDetailRows(raw, "expenses", 2026, 3)).toHaveLength(1);
    expect(buildMonthlyDetailRows(raw, "expenses", 2026, 4)).toHaveLength(0);
  });

  it("salaries aggregates full/half days per mechanic", () => {
    const out = buildMonthlyDetailRows(raw, "salaries", 2026, 3);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "Ram Yadav", full: 1, half: 1, rate: 300 });
  });

  it("emi resolves lender name; discounts filter positive discount", () => {
    const emi = buildMonthlyDetailRows(raw, "emi", 2026, 3);
    expect(emi).toHaveLength(1);
    expect(emi[0].lender_name).toBe("HDFC");

    const discounts = buildMonthlyDetailRows(raw, "discounts", 2026, 3);
    expect(discounts).toHaveLength(1);
    expect(discounts[0].client_name).toBe("Sita Devi");
  });

  it("title helper keeps the legacy format", () => {
    expect(monthlyDetailTitle("repair_jobs", "March", 2026)).toBe(
      "Repair Jobs (Delivered) - March 2026"
    );
    expect(monthlyDetailTitle("emi", "March", 2026)).toBe("Loan EMI Payments - March 2026");
  });
});
