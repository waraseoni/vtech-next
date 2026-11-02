import { describe, expect, it } from "vitest";
import { buildActiveLoans, computeClientBalance, type ActionLoanRow } from "./clientActionQueries";

describe("computeClientBalance", () => {
  it("opening + billed - paid + loan given - loan repaid", () => {
    expect(
      computeClientBalance({
        openingBalance: 500,
        repairBilled: 1200,
        directBilled: 300,
        totalPaid: 900,
        loanGiven: 2000,
        loanRepaid: 700,
      })
    ).toBe(2400);
  });
});

describe("buildActiveLoans", () => {
  const loan = (over: Partial<ActionLoanRow>): ActionLoanRow => ({
    id: 1,
    principal_amount: 1000,
    total_payable: 1200,
    emi_amount: 120,
    loan_date: "2026-01-01",
    status: 1,
    ...over,
  });

  it("computes paid (amount + discount) and keeps only positive balance", () => {
    const res = buildActiveLoans(
      [loan({ id: 1 }), loan({ id: 2, total_payable: 500 })],
      [
        { loan_id: 1, amount: 200, discount: 20 },
        { loan_id: 2, amount: 500, discount: 0 },
        { loan_id: null, amount: 999, discount: 0 },
      ]
    );

    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: 1, paid: 220, balance: 980 });
  });
});
