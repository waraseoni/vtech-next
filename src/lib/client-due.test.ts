import { describe, it, expect } from "vitest";
import {
  toNum,
  computeClientDue,
  isServicePayment,
  paymentCredit,
  buildDueMaps,
  balanceFromMaps,
  dueLabel,
  JOB_STATUS_DELIVERED,
  LOAN_STATUS_ACTIVE,
} from "./client-due";

describe("toNum", () => {
  it("converts numeric strings", () => {
    expect(toNum("123")).toBe(123);
    expect(toNum("12.5")).toBe(12.5);
  });

  it("returns 0 for NaN / null / undefined / empty", () => {
    expect(toNum("abc")).toBe(0);
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum("")).toBe(0);
    expect(toNum(NaN)).toBe(0);
  });

  it("passes through numbers", () => {
    expect(toNum(42)).toBe(42);
    expect(toNum(-7.5)).toBe(-7.5);
  });
});

describe("computeClientDue", () => {
  it("computes net = opening + repair + direct − servicePaid + loan − repaid", () => {
    const r = computeClientDue({
      openingBalance: 100,
      repairBilled: 500,
      directSalesBilled: 200,
      servicePaid: 300,
      activeLoanGiven: 1000,
      loanRepaid: 400,
    });
    expect(r.netBalance).toBe(100 + 500 + 200 - 300 + 1000 - 400); // 1100
    expect(r.openingBalance).toBe(100);
  });

  it("treats missing / invalid parts as 0", () => {
    const r = computeClientDue({});
    expect(r.netBalance).toBe(0);
    expect(r.repairBilled).toBe(0);
  });

  it("handles undefined individual fields as 0", () => {
    const r = computeClientDue({ openingBalance: 50, servicePaid: undefined });
    expect(r.netBalance).toBe(50);
  });
});

describe("isServicePayment", () => {
  it("true for null / undefined / 0", () => {
    expect(isServicePayment(null)).toBe(true);
    expect(isServicePayment(undefined)).toBe(true);
    expect(isServicePayment(0)).toBe(true);
    expect(isServicePayment("0")).toBe(true);
  });

  it("false for a real loan id", () => {
    expect(isServicePayment(12)).toBe(false);
    expect(isServicePayment("12")).toBe(false);
  });
});

describe("paymentCredit", () => {
  it("sums amount + discount", () => {
    expect(paymentCredit({ amount: 500, discount: 20 })).toBe(520);
  });

  it("tolerates missing fields and invalid values", () => {
    expect(paymentCredit({})).toBe(0);
    expect(paymentCredit({ amount: "abc", discount: null })).toBe(0);
  });
});

const baseMaps = () => ({
  repairBilled: {},
  directSalesBilled: {},
  servicePaid: {},
  activeLoanGiven: {},
  loanRepaid: {},
});

describe("buildDueMaps", () => {
  it("returns empty maps for empty input", () => {
    expect(buildDueMaps({})).toEqual(baseMaps());
  });

  it("aggregates repair billed keyed by numeric client_name", () => {
    const m = buildDueMaps({
      repairs: [
        { client_name: "7", amount: 100 },
        { client_name: "7", amount: 50 },
        { client_name: "abc", amount: "999" },
      ],
    });
    expect(m.repairBilled[7]).toBe(150); // non-numeric "abc" row ignored
  });

  it("aggregates direct sales by client_id", () => {
    const m = buildDueMaps({ directSales: [{ client_id: 3, total_amount: 250 }] });
    expect(m.directSalesBilled[3]).toBe(250);
  });

  it("partitions service payments vs active-loan repayments", () => {
    const m = buildDueMaps({
      payments: [
        { client_id: 1, loan_id: null, amount: 100, discount: 0 }, // service
        { client_id: 1, loan_id: 0, amount: 50, discount: 0 }, // service too
        { client_id: 1, loan_id: 10, amount: 75, discount: 5 }, // active loan repayment
      ],
      loans: [{ id: 10, client_id: 1, total_payable: 1000 }],
    });
    expect(m.servicePaid[1]).toBe(150);
    expect(m.loanRepaid[1]).toBe(80);
  });

  it("ignores repayments against closed/inactive loans", () => {
    const m = buildDueMaps({
      payments: [{ client_id: 2, loan_id: 99, amount: 50, discount: 0 }],
      loans: [], // loan 99 not active
    });
    expect(m.loanRepaid[2]).toBeUndefined();
    expect(m.servicePaid[2]).toBeUndefined();
  });

  it("sums active loan given (total_payable)", () => {
    const m = buildDueMaps({
      loans: [
        { id: 1, client_id: 5, total_payable: 500 },
        { id: 2, client_id: 5, total_payable: 300 },
      ],
    });
    expect(m.activeLoanGiven[5]).toBe(800);
  });
});

describe("balanceFromMaps", () => {
  it("combines maps into a net balance for one client", () => {
    const maps = {
      repairBilled: { 4: 1000 },
      directSalesBilled: { 4: 200 },
      servicePaid: { 4: 300 },
      activeLoanGiven: { 4: 500 },
      loanRepaid: { 4: 100 },
    };
    expect(balanceFromMaps(maps, 4, 50)).toBe(50 + 1000 + 200 - 300 + 500 - 100); // 1350
  });

  it("returns 0 balance for a client with no rows", () => {
    expect(balanceFromMaps(baseMaps(), 999)).toBe(0);
  });
});

describe("dueLabel", () => {
  it("labels positive balance as Due", () => {
    expect(dueLabel(100)).toEqual({ amount: 100, label: "Due", type: "due" });
  });

  it("labels negative as Advance (absolute value)", () => {
    expect(dueLabel(-50)).toEqual({ amount: 50, label: "Advance", type: "advance" });
  });

  it("labels near-zero as Settled within ±0.005 tolerance", () => {
    expect(dueLabel(0)).toEqual({ amount: 0, label: "Settled", type: "settled" });
    expect(dueLabel(0.004)).toEqual({ amount: 0, label: "Settled", type: "settled" });
    expect(dueLabel(-0.004)).toEqual({ amount: 0, label: "Settled", type: "settled" });
  });

  it("treats values beyond tolerance as real", () => {
    expect(dueLabel(0.006).label).toBe("Due");
    expect(dueLabel(-0.006).label).toBe("Advance");
  });
});

describe("constants", () => {
  it("delivered status is 5 and active loan status is 1", () => {
    expect(JOB_STATUS_DELIVERED).toBe(5);
    expect(LOAN_STATUS_ACTIVE).toBe(1);
  });
});
