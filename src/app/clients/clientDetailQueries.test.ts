import { describe, expect, it } from "vitest";
import { buildLoanAggregates, type Loan, type LoanPaymentRow } from "./clientDetailQueries";

const loan = (over: Partial<Loan>): Loan => ({
  id: 1,
  client_id: 7,
  principal_amount: 1000,
  interest_rate: 0,
  loan_period: 10,
  total_payable: 1200,
  emi_amount: 120,
  loan_date: "2026-01-01",
  status: 1,
  ...over,
});

describe("buildLoanAggregates", () => {
  it("per-loan paid = amount + discount, balance = total_payable - paid", () => {
    const loans = [loan({ id: 1, total_payable: 1200 }), loan({ id: 2, total_payable: 600 })];
    const payments: LoanPaymentRow[] = [
      { loan_id: 1, amount: 200, discount: 25 },
      { loan_id: 1, amount: 100, discount: null },
      { loan_id: 2, amount: 600, discount: 0 },
      { loan_id: null, amount: 999, discount: 0 },
    ];

    const res = buildLoanAggregates(loans, payments);

    expect(res.loans.find((l) => l.id === 1)).toMatchObject({ paid: 325, balance: 875 });
    expect(res.loans.find((l) => l.id === 2)).toMatchObject({ paid: 600, balance: 0 });
    // null loan_id ka payment kisi loan me count nahi hota
    expect(res.loanGiven).toBe(1800);
    expect(res.loanRepaid).toBe(925);
  });

  it("only active loans (status=1) are counted in totals", () => {
    const loans = [
      loan({ id: 1, status: 1, total_payable: 1200 }),
      loan({ id: 2, status: 0, total_payable: 5000 }),
    ];
    const payments: LoanPaymentRow[] = [
      { loan_id: 1, amount: 1200, discount: 0 },
      { loan_id: 2, amount: 5000, discount: 0 },
    ];

    const res = buildLoanAggregates(loans, payments);

    expect(res.loanGiven).toBe(1200);
    expect(res.loanRepaid).toBe(1200);
    // closed loan ke paid/balance history ke liye compute hote hain
    expect(res.loans.find((l) => l.id === 2)).toMatchObject({ paid: 5000, balance: 0 });
  });

  it("monthly EMI is capped at remaining balance", () => {
    const loans = [
      loan({ id: 1, total_payable: 1200, emi_amount: 120 }),
      loan({ id: 2, total_payable: 500, emi_amount: 100 }),
      loan({ id: 3, total_payable: 400, emi_amount: 100 }),
    ];
    const payments: LoanPaymentRow[] = [
      { loan_id: 1, amount: 250, discount: 0 },
      { loan_id: 2, amount: 450, discount: 0 },
      { loan_id: 3, amount: 400, discount: 0 },
    ];

    const res = buildLoanAggregates(loans, payments);

    // loan 1: min(120, 950) = 120; loan 2: min(100, 50) = 50; loan 3: paid off = 0
    expect(res.monthlyEMI).toBe(170);
  });
});
