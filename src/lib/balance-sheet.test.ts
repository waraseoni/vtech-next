import { describe, expect, it } from "vitest";
import {
  buildBalanceSheet,
  computeCashFlow,
  previousPeriod,
  type BalanceSheetInput,
} from "./balance-sheet";

const input = (over: Partial<BalanceSheetInput> = {}): BalanceSheetInput => ({
  customers: [],
  mechanics: [],
  loans: [],
  stock: [],
  ...over,
});

describe("buildBalanceSheet", () => {
  it("sign ke hisaab se assets aur liabilities split karta hai", () => {
    const s = buildBalanceSheet(
      input({
        cash: 250,
        customers: [{ current_balance: 500 }, { current_balance: -100 }, { current_balance: 0 }],
        clientLoans: [{ outstanding: 100 }],
        mechanics: [{ balance_amount: 200 }, { balance_amount: -50 }],
        loans: [{ balance_amount: 1000 }, { balance_amount: -25 }],
        stock: [{ stock_value: 300 }],
      })
    );

    expect(s.assets.map((r) => [r.key, r.amount])).toEqual([
      ["cash", 250],
      ["stock", 300],
      ["receivable", 500],
      ["client_loan", 100],
      ["staff_advance", 50],
      ["lender_advance", 25],
    ]);
    expect(s.liabilities.map((r) => [r.key, r.amount])).toEqual([
      ["client_advance", 100],
      ["staff_payable", 200],
      ["lender_loan", 1000],
    ]);
    expect(s.totalAssets).toBe(1225);
    expect(s.totalLiabilities).toBe(1300);
    expect(s.capital).toBe(-75);
  });

  it("total identity: assets − liabilities = capital", () => {
    const s = buildBalanceSheet(
      input({
        cash: 100,
        customers: [{ current_balance: 1200.5 }],
        mechanics: [{ balance_amount: 300.25 }],
        loans: [{ balance_amount: 900 }],
        stock: [{ stock_value: 400.75 }],
      })
    );
    expect(s.totalAssets).toBe(1701.25);
    expect(s.totalLiabilities).toBe(1200.25);
    expect(s.capital).toBe(501);
    expect(Math.round((s.totalAssets - s.totalLiabilities - s.capital) * 100) / 100).toBe(0);
  });

  it("counts sirf usi sign ki rows ginta hai", () => {
    const s = buildBalanceSheet(
      input({
        customers: [
          { current_balance: 100 },
          { current_balance: 0 },
          { current_balance: -10 },
          { current_balance: 50 },
        ],
        stock: [{ stock_value: 10 }, { stock_value: 20 }],
      })
    );
    expect(s.assets.find((r) => r.key === "cash")?.count).toBe(0);
    expect(s.assets.find((r) => r.key === "receivable")?.count).toBe(2);
    expect(s.liabilities.find((r) => r.key === "client_advance")?.count).toBe(1);
    expect(s.assets.find((r) => r.key === "stock")?.count).toBe(2);
  });

  it("zero par optional rows hide hote hain, core rows rehte hain", () => {
    const s = buildBalanceSheet(input());
    expect(s.assets.map((r) => r.key)).toEqual(["cash", "stock", "receivable"]);
    expect(s.liabilities.map((r) => r.key)).toEqual(["staff_payable", "lender_loan"]);
    expect(s.totalAssets).toBe(0);
    expect(s.totalLiabilities).toBe(0);
    expect(s.capital).toBe(0);
  });

  it("client loan zero par row hide hoti hai", () => {
    const s = buildBalanceSheet(input({ clientLoans: [{ outstanding: 0 }] }));
    expect(s.assets.find((r) => r.key === "client_loan")).toBeUndefined();
  });

  it("negative cash liability (overdraft) ban jata hai", () => {
    const s = buildBalanceSheet(input({ cash: -150.5, stock: [{ stock_value: 100 }] }));
    expect(s.assets.map((r) => r.key)).toEqual(["stock", "receivable"]);
    expect(s.liabilities.map((r) => [r.key, r.amount])).toEqual([
      ["cash_overdraft", 150.5],
      ["staff_payable", 0],
      ["lender_loan", 0],
    ]);
    expect(s.liabilities.find((r) => r.key === "cash_overdraft")?.tab).toBe("cash");
  });

  it("negative stock value ignore hoti hai aur decimals round hote hain", () => {
    const s = buildBalanceSheet(
      input({
        stock: [{ stock_value: -100 }, { stock_value: 10.006 }],
        customers: [{ current_balance: 0.1 }, { current_balance: 0.2 }],
      })
    );
    expect(s.assets.find((r) => r.key === "stock")?.amount).toBe(10.01);
    expect(s.assets.find((r) => r.key === "receivable")?.amount).toBe(0.3);
  });

  it("NaN / invalid numbers safe hain", () => {
    const s = buildBalanceSheet(
      input({
        cash: Number.NaN,
        customers: [{ current_balance: Number.NaN }],
        mechanics: [{ balance_amount: Number.POSITIVE_INFINITY }],
        loans: [{ balance_amount: 500 }],
      })
    );
    expect(s.assets.find((r) => r.key === "cash")?.amount).toBe(0);
    expect(s.assets.find((r) => r.key === "receivable")?.amount).toBe(0);
    expect(s.liabilities.find((r) => r.key === "staff_payable")?.amount).toBe(0);
    expect(s.liabilities.find((r) => r.key === "lender_loan")?.amount).toBe(500);
  });

  it("row tab drill-down mapping sahi hai", () => {
    const s = buildBalanceSheet(
      input({
        cash: 10,
        customers: [{ current_balance: 10 }, { current_balance: -5 }],
        clientLoans: [{ outstanding: 7 }],
        mechanics: [{ balance_amount: 20 }, { balance_amount: -2 }],
        loans: [{ balance_amount: 30 }],
        stock: [{ stock_value: 40 }],
      })
    );
    const byKey = Object.fromEntries([...s.assets, ...s.liabilities].map((r) => [r.key, r.tab]));
    expect(byKey).toEqual({
      cash: "cash",
      stock: "inventory",
      receivable: "customer",
      client_loan: "client_loan",
      staff_advance: "mechanic",
      client_advance: "customer",
      staff_payable: "mechanic",
      lender_loan: "loan",
    });
  });
});

describe("previousPeriod", () => {
  it("poora mahina ho to pichla calendar month deta hai", () => {
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("March ka pichla month February hote hue bhi sahi aata hai", () => {
    expect(previousPeriod("2026-03-01", "2026-03-31")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("poora saal ho to pichla saal deta hai", () => {
    expect(previousPeriod("2026-01-01", "2026-12-31")).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("custom range par same length ka pichla window", () => {
    expect(previousPeriod("2026-10-05", "2026-10-20")).toEqual({
      from: "2026-09-19",
      to: "2026-10-04",
    });
  });

  it("invalid ya ulta range par null", () => {
    expect(previousPeriod("2026-10-31", "2026-10-01")).toBeNull();
    expect(previousPeriod("", "")).toBeNull();
  });
});

describe("computeCashFlow", () => {
  const base = {
    servicePayments: [],
    clientLoanRepayments: [],
    directSales: [],
    lenderLoans: [],
    expenses: [],
    lenderPayments: [],
    mechanicAdvances: [],
    clientLoansGiven: [],
    purchases: [],
  };

  it("as-on date ke baad ki entries ignore karta hai", () => {
    const flow = computeCashFlow({
      ...base,
      asOn: "2026-10-31",
      servicePayments: [
        { amount: 1000, payment_date: "2026-10-01" },
        { amount: 500, payment_date: "2026-11-02" },
      ],
      directSales: [{ total_amount: 700, date_created: "2026-10-15T12:00:00" }],
      expenses: [{ amount: 400, date_created: "2026-10-20T09:00:00" }],
      purchases: [{ total_amount: 300, received_date: "2026-10-25" }],
      mechanicAdvances: [
        { amount: 200, date_paid: "2026-10-05" },
        { amount: 999, date_paid: "2026-11-01" },
      ],
    });

    expect(flow.totalInflow).toBe(1700);
    expect(flow.totalOutflow).toBe(900);
    expect(flow.balance).toBe(800);
    expect(flow.inflow.map((r) => r.amount)).toEqual([1000, 0, 700, 0]);
    expect(flow.outflow.map((r) => r.amount)).toEqual([400, 0, 200, 0, 300]);
  });

  it("khali data par balance zero", () => {
    const flow = computeCashFlow({ ...base, asOn: "2026-10-31" });
    expect(flow.totalInflow).toBe(0);
    expect(flow.totalOutflow).toBe(0);
    expect(flow.balance).toBe(0);
  });

  it("lender loan inflow aur client loan outflow count hote hain", () => {
    const flow = computeCashFlow({
      ...base,
      asOn: "2026-10-31",
      lenderLoans: [{ loan_amount: 5000, start_date: "2026-09-01" }],
      clientLoansGiven: [{ principal_amount: 2000, loan_date: "2026-10-01" }],
      lenderPayments: [{ amount_paid: 500, payment_date: "2026-10-10" }],
      clientLoanRepayments: [{ amount: 250, payment_date: "2026-10-20" }],
    });
    expect(flow.totalInflow).toBe(5250);
    expect(flow.totalOutflow).toBe(2500);
    expect(flow.balance).toBe(2750);
  });
});
