import { describe, expect, it } from "vitest";
import { fetchAccountingDashboardData } from "./accounting-dashboard-data";

type Row = Record<string, unknown>;
type Filter = { op: "eq" | "gte" | "lte" | "in"; col: string; val: unknown };

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
            if (f.op === "lte") return String(v ?? "") <= String(f.val);
            return (f.val as unknown[]).includes(v);
          })
        );
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => (filters.push({ op: "eq", col, val }), builder),
        gte: (col: string, val: unknown) => (filters.push({ op: "gte", col, val }), builder),
        lte: (col: string, val: unknown) => (filters.push({ op: "lte", col, val }), builder),
        in: (col: string, val: unknown[]) => (filters.push({ op: "in", col, val }), builder),
        range: (start: number, end: number) =>
          Promise.resolve({ data: matches().slice(start, end + 1), error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({ data: matches(), error: null }).then(resolve, reject),
      };
      return builder;
    },
  };
}

const TS = "T10:00:00+05:30";
const DAY = "2026-11-01";

function baseTables(): Record<string, Row[]> {
  return {
    transaction_list: [
      {
        amount: 1000,
        mechanic_commission_amount: 100,
        client_name: "1",
        status: 5,
        date_completed: DAY + TS,
      },
    ],
    direct_sales: [
      { total_amount: 500, client_id: null, date_created: DAY + TS },
      { total_amount: 700, client_id: 2, date_created: DAY + TS },
    ],
    attendance_list: [{ mechanic_id: 1, curr_date: DAY, status: 1 }],
    mechanic_list: [{ id: 1, daily_salary: 300 }],
    mechanic_salary_history: [
      { mechanic_id: 1, salary: 400, effective_date: "2026-10-01" },
    ],
    client_payments: [{ amount: 200, discount: 20, payment_date: DAY + TS }],
    expense_list: [{ amount: 50, category: "Rent", date_created: DAY + TS }],
    advance_payments: [{ amount: 30, mechanic_id: 1, date_paid: DAY + TS }],
    loan_payments: [
      { amount_paid: 40, payment_date: DAY + TS },
      { amount_paid: 100, payment_date: "2026-12-01T00:00:00+05:30" },
    ],
    client_list: [
      { id: 1, firstname: "A", lastname: "B", opening_balance: 100, delete_flag: 0 },
      { id: 2, firstname: "C", lastname: "D", opening_balance: 999, delete_flag: 1 },
    ],
    inventory_list: [{ quantity: 2, product_id: 9, stock_date: DAY + TS }],
    product_list: [{ id: 9, price: 10, name: "P" }],
    client_loans: [{ total_payable: 60, status: 1, loan_date: DAY + TS }],
    lender_list: [{ loan_amount: 500, status: 1 }],
  };
}

describe("fetchAccountingDashboardData", () => {
  it("aggregates period metrics, salary history override and as-of balances", async () => {
    const supabase = fakeSupabase(baseTables());
    const data = await fetchAccountingDashboardData(supabase as never, {
      from: DAY,
      to: DAY,
    });

    expect(data.serviceRevenue).toBe(1000);
    expect(data.salesRevenue).toBe(1200);
    expect(data.walkinSales).toBe(500);
    expect(data.totalRevenue).toBe(2200);
    expect(data.commission).toBe(100);
    expect(data.salaryEarned).toBe(400);

    expect(data.collections).toBe(200);
    expect(data.discounts).toBe(20);
    expect(data.shopExpenses).toBe(50);
    expect(data.staffAdvances).toBe(30);
    expect(data.loanEmis).toBe(40);
    expect(data.totalExpenses).toBe(610);
    expect(data.grossProfit).toBe(2100);
    expect(data.netProfit).toBe(1590);
    expect(data.cashInflow).toBe(700);
    expect(data.cashOutflow).toBe(120);

    expect(data.expenseCategories).toEqual([{ category: "Rent", total: 50 }]);
    expect(data.topCustomers).toEqual([{ name: "A B", total: 1000 }]);

    expect(data.cashOnHand).toBe(580);
    expect(data.inventoryValue).toBe(20);
    expect(data.accountsReceivable).toBe(2140);
    expect(data.loansPayable).toBe(360);
    expect(data.stockItems).toEqual([{ name: "P", qty: 2, price: 10, value: 20 }]);
  });

  it("excludes future loan payments from cashOnHand but keeps them in loansPayable", async () => {
    const tables = baseTables();
    tables.loan_payments = [{ amount_paid: 100, payment_date: "2026-12-01T00:00:00+05:30" }];
    const supabase = fakeSupabase(tables);
    const data = await fetchAccountingDashboardData(supabase as never, {
      from: DAY,
      to: DAY,
    });

    expect(data.loanEmis).toBe(0);
    expect(data.cashOnHand).toBe(620);
    expect(data.loansPayable).toBe(400);
  });
});
