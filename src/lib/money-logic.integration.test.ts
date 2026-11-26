/**
 * E2 (P0-5) — money-logic integration tests.
 *
 * Fixture-based golden assertions. Har assertion PHP-era canonical formula se
 * aati hai (docs/DATA_MIGRATION_NOTES.md). "Dual-era" ka matlab: purana PHP
 * `Transactions` client ko `client_name` me ID string ke saath likhta tha,
 * nayi Next.js `transaction_list` / `job_id` client_id numeric rakhta hai.
 * Dono ek hi client ke liye same map me Jaane chahiye.
 *
 * Ye file un integration gaps ko band karti hai jo unit tests (client-due.test,
 * balance-sheet.test) alag-alag pakadte hain: yahan poora pipeline ek hi
 * fixture se chalaya jata hai.
 *
 * Important: `buildDueMaps` ko `loans` me sirf ACTIVE (status=1) rows pass
 * karne chahiye — filtering caller ka kaam hai. Isliye band loan 9 is fixture
 * me `loans` me hai hi nahi; uski repayment ignore hone ka proof neeche hai.
 */

import { describe, expect, it } from "vitest";
import {
  buildDueMaps,
  balanceFromMaps,
  dueLabel,
  isServicePayment,
  paymentCredit,
  type DueRowSets,
} from "./client-due";
import {
  buildBalanceSheet,
  computeCashFlow,
  previousPeriod,
  type CashFlowInput,
} from "./balance-sheet";

/**
 * Realistic dual-era fixture — client 101 (purana "101" string + naya 101),
 * client 202 (cross-contamination check), inactive loan 9 (ignore hona chahiye).
 */
const fixture: DueRowSets & { opening101: number } = {
  opening101: 500,
  repairs: [
    // PHP-era: client ID `client_name` me string ke roop me tha.
    { client_name: "101", amount: 1200 },
    { client_name: "101", amount: "800" }, // numeric string bhi aata tha
    { client_name: "202", amount: 100 }, // doosre client ka job — alag rahna chahiye
  ],
  repairsDone: [
    // Status 2 (Done) informational hai — netBalance me nahi jata.
    { client_name: "101", amount: 900 },
  ],
  directSales: [{ client_id: 101, total_amount: 350 }],
  payments: [
    // Service payment: amount + discount dono credit.
    { client_id: 101, loan_id: null, amount: 400, discount: 25 },
    // Active loan 7 ki repayment — balance kam karti hai.
    { client_id: 101, loan_id: 7, amount: 500, discount: 20 },
    // Band/close loan 9 ki repayment — PHP behaviour: ignore.
    { client_id: 101, loan_id: 9, amount: 1000, discount: 0 },
    // Doosre client ki payment — 101 ke hisse me nahi jani chahiye.
    { client_id: 202, loan_id: 0, amount: 75, discount: 5 },
  ],
  // Caller status=1 par filter karta hai — isliye sirf active loan 7 yahan hai.
  loans: [{ id: 7, client_id: 101, total_payable: 3000 }],
};

const maps = buildDueMaps(fixture);

describe("E2 — dual-era due pipeline (client 101)", () => {
  it("1. legacy string ID + numeric ID dono repair rows aik hi client me jode", () => {
    expect(maps.repairBilled[101]).toBe(2000);
  });

  it("2. repairDone (status 2) alag map me — billed nahi", () => {
    expect(maps.repairDone[101]).toBe(900);
  });

  it("3. direct sale numeric client_id se jude", () => {
    expect(maps.directSalesBilled[101]).toBe(350);
  });

  it("4. service payment = amount + discount", () => {
    expect(maps.servicePaid[101]).toBe(425);
    expect(paymentCredit({ amount: 400, discount: 25 })).toBe(425);
  });

  it("5. active loan (status=1) total payable jude — band loan 9 caller ne filter kiya", () => {
    expect(maps.activeLoanGiven[101]).toBe(3000);
  });

  it("6. sirf ACTIVE loan ki repayment credit — band loan 9 wali 1000 ignore", () => {
    expect(maps.loanRepaid[101]).toBe(520);
    expect(maps.loanRepaid[101]).not.toBe(1520); // red proof: 1000 galat tarah add ho jaye
  });

  it("7. cross-client contamination na ho", () => {
    expect(maps.repairBilled[202]).toBe(100);
    expect(maps.servicePaid[202]).toBe(80);
    expect(maps.repairDone[101]).not.toBe(maps.repairBilled[202] + maps.repairDone[101]);
  });

  it("8. netBalance golden value = opening + billed + direct − paid + loan − repaid", () => {
    // 500 + 2000 + 350 − 425 + 3000 − 520 = 4905
    expect(balanceFromMaps(maps, 101, fixture.opening101)).toBe(4905);
  });

  it("9. RED PROOF — Done job (900) ko billed me add karna galat hai", () => {
    const correct = balanceFromMaps(maps, 101, fixture.opening101);
    const wrong = correct + maps.repairDone[101]; // purana galat formula
    expect(wrong).toBe(5805);
    expect(correct).not.toBe(wrong);
    expect(correct).toBe(4905);
  });

  it("10. dueLabel positive = Due, negative = Advance, ~0 = Settled", () => {
    expect(dueLabel(balanceFromMaps(maps, 101, 0))).toEqual({
      amount: 4405,
      label: "Due",
      type: "due",
    });
    expect(dueLabel(-0.004)).toEqual({ amount: 0, label: "Settled", type: "settled" });
    expect(dueLabel(-75)).toEqual({ amount: 75, label: "Advance", type: "advance" });
  });

  it("11. loan_id 0/'0'/null/undefined service payment; 7 nahi", () => {
    expect([null, undefined, 0, "0"].every(isServicePayment)).toBe(true);
    expect(isServicePayment(7)).toBe(false);
  });
});

describe("E2 — balance sheet & cash flow golden totals", () => {
  it("12. assets − liabilities = capital identity (mixed signs)", () => {
    const s = buildBalanceSheet({
      customers: [{ current_balance: 5905 }, { current_balance: -200 }],
      mechanics: [{ balance_amount: 300 }, { balance_amount: -50 }],
      loans: [{ balance_amount: 1500 }],
      stock: [{ stock_value: 750.25 }],
      cash: 1250,
      clientLoans: [{ outstanding: 400 }],
    });
    expect(s.totalAssets).toBe(5905 + 750.25 + 400 + 50 + 1250);
    expect(s.totalLiabilities).toBe(200 + 300 + 1500);
    expect(s.capital).toBe(Math.round((s.totalAssets - s.totalLiabilities) * 100) / 100);
  });

  it("13. cash flow asOn se pehle ki rows hi ginti me aati hain", () => {
    const flow: CashFlowInput = {
      servicePayments: [
        { amount: 400, payment_date: "2026-11-01" },
        { amount: 9999, payment_date: "2026-12-01" }, // future — ignore
      ],
      clientLoanRepayments: [{ amount: 520, payment_date: "2026-11-10" }],
      directSales: [{ total_amount: 350, date_created: "2026-11-15" }],
      lenderLoans: [{ loan_amount: 2000, start_date: "2026-11-02" }],
      expenses: [{ amount: 120, date_created: "2026-11-05" }],
      lenderPayments: [{ amount_paid: 300, payment_date: "2026-11-06" }],
      mechanicAdvances: [{ amount: 50, date_paid: "2026-11-07" }],
      clientLoansGiven: [{ principal_amount: 100, loan_date: "2026-11-08" }],
      purchases: [{ total_amount: 80, received_date: "2026-11-09" }],
      asOn: "2026-11-30",
    };
    const f = computeCashFlow(flow);
    expect(f.inflow.find((r) => r.key === "service_payments")?.amount).toBe(400);
    expect(f.totalInflow).toBe(400 + 520 + 350 + 2000);
    expect(f.totalOutflow).toBe(120 + 300 + 50 + 100 + 80);
    expect(f.balance).toBe(f.totalInflow - f.totalOutflow);
  });

  it("14. asOn pehle ka cut-off strict — 1 din peeche ki row bhi bahar", () => {
    const f = computeCashFlow({
      servicePayments: [
        { amount: 100, payment_date: "2026-11-20" },
        { amount: 200, payment_date: "2026-11-21" },
      ],
      clientLoanRepayments: [],
      directSales: [],
      lenderLoans: [],
      expenses: [],
      lenderPayments: [],
      mechanicAdvances: [],
      clientLoansGiven: [],
      purchases: [],
      asOn: "2026-11-20",
    });
    expect(f.totalInflow).toBe(100);
    expect(f.balance).toBe(100);
  });

  it("15. previousPeriod mas/month/days boundaries sahi", () => {
    expect(previousPeriod("2026-01-01", "2026-12-31")).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(previousPeriod("2026-11-01", "2026-11-30")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(previousPeriod("2026-11-10", "2026-11-16")).toEqual({
      from: "2026-11-03",
      to: "2026-11-09",
    });
    expect(previousPeriod("2026-11-20", "2026-11-10")).toBeNull();
  });
});
