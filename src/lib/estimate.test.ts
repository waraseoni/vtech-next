import { describe, expect, it } from "vitest";
import {
  ESTIMATE_DRAFT_TTL_MS,
  addDaysToDateStr,
  computeEstimateTotals,
  createDefaultEstimateForm,
  lineAmount,
  parseEstimateDraft,
  serializeEstimateDraft,
  suggestEstimateReference,
} from "./estimate";
import { numberToWords } from "./numberToWords";

const base = {
  gstEnabled: false,
  gstRate: 18,
  discountType: "amount" as const,
  discountValue: 0,
};

describe("lineAmount", () => {
  it("multiplies decimal qty and rounds to paise", () => {
    expect(lineAmount({ qty: 2, rate: 99.99 })).toBe(199.98);
    expect(lineAmount({ qty: 1.5, rate: 10 })).toBe(15);
  });

  it("guards negative and non-finite values", () => {
    expect(lineAmount({ qty: -2, rate: 100 })).toBe(0);
    expect(lineAmount({ qty: NaN, rate: 100 })).toBe(0);
    expect(lineAmount({ qty: 1, rate: Infinity })).toBe(0);
  });
});

describe("computeEstimateTotals", () => {
  it("returns zeros for empty lines", () => {
    expect(computeEstimateTotals([], base)).toEqual({
      subtotal: 0,
      discountAmount: 0,
      taxable: 0,
      gstAmount: 0,
      cgst: 0,
      sgst: 0,
      roundOff: 0,
      grandTotal: 0,
    });
  });

  it("sums lines without discount or GST", () => {
    const t = computeEstimateTotals(
      [
        { qty: 1, rate: 100 },
        { qty: 2, rate: 50.5 },
      ],
      base
    );
    expect(t.subtotal).toBe(201);
    expect(t.taxable).toBe(201);
    expect(t.gstAmount).toBe(0);
    expect(t.grandTotal).toBe(201);
  });

  it("applies percent discount before GST", () => {
    const t = computeEstimateTotals([{ qty: 1, rate: 1000 }], {
      ...base,
      gstEnabled: true,
      discountType: "percent",
      discountValue: 10,
    });
    expect(t.discountAmount).toBe(100);
    expect(t.taxable).toBe(900);
    expect(t.gstAmount).toBe(162);
    expect(t.cgst).toBe(81);
    expect(t.sgst).toBe(81);
    expect(t.grandTotal).toBe(1062);
  });

  it("clamps amount discount to subtotal (never negative total)", () => {
    const t = computeEstimateTotals([{ qty: 1, rate: 100 }], {
      ...base,
      discountValue: 250,
      gstEnabled: true,
    });
    expect(t.discountAmount).toBe(100);
    expect(t.taxable).toBe(0);
    expect(t.gstAmount).toBe(0);
    expect(t.grandTotal).toBe(0);
  });

  it("ignores gstRate when GST is off", () => {
    const t = computeEstimateTotals([{ qty: 1, rate: 500 }], { ...base, gstRate: 18 });
    expect(t.gstAmount).toBe(0);
    expect(t.grandTotal).toBe(500);
  });

  it("splits GST across CGST/SGST without losing paise", () => {
    const t = computeEstimateTotals([{ qty: 1, rate: 999.99 }], { ...base, gstEnabled: true });
    expect(t.gstAmount).toBe(180);
    expect(t.cgst + t.sgst).toBeCloseTo(t.gstAmount, 2);
  });

  it("computes round-off for both signs", () => {
    const down = computeEstimateTotals([{ qty: 1, rate: 100.4 }], { ...base, gstEnabled: true });
    expect(down.roundOff).toBe(-0.47);
    expect(down.grandTotal).toBe(118);

    const up = computeEstimateTotals([{ qty: 1, rate: 100.6 }], { ...base, gstEnabled: true });
    expect(up.roundOff).toBe(0.29);
    expect(up.grandTotal).toBe(119);
  });

  it("never propagates NaN or Infinity", () => {
    const t = computeEstimateTotals([{ qty: NaN, rate: Infinity }], base);
    expect(t.subtotal).toBe(0);
    expect(t.grandTotal).toBe(0);
    expect(Number.isFinite(t.roundOff)).toBe(true);
  });
});

describe("numberToWords", () => {
  it("converts Indian-system amounts", () => {
    expect(numberToWords(0)).toBe("Zero Rupees Only");
    expect(numberToWords(5)).toBe("Five Rupees Only");
    expect(numberToWords(1234)).toBe("One Thousand Two Hundred Thirty Four Rupees Only");
    expect(numberToWords(100000)).toBe("One Lakh Rupees Only");
    expect(numberToWords(10000000)).toBe("One Crore Rupees Only");
  });

  it("guards non-finite values", () => {
    expect(numberToWords(NaN)).toBe("Zero Rupees Only");
    expect(numberToWords(Infinity)).toBe("Zero Rupees Only");
  });
});

describe("estimate draft", () => {
  it("round-trips a form and preserves lines", () => {
    const form = createDefaultEstimateForm("2026-10-31");
    form.lines = [
      {
        id: "a",
        kind: "inventory",
        product_id: 7,
        service_id: null,
        name: "SMPS",
        hsn: "8504",
        qty: 2,
        rate: 1500,
      },
    ];
    const parsed = parseEstimateDraft(serializeEstimateDraft(form, 1_000), 1_000);
    expect(parsed).not.toBeNull();
    expect(parsed?.lines).toHaveLength(1);
    expect(parsed?.lines[0]).toMatchObject({ name: "SMPS", qty: 2, rate: 1500, product_id: 7 });
  });

  it("rejects expired, malformed and unknown-version drafts", () => {
    const form = createDefaultEstimateForm("2026-10-31");
    const raw = serializeEstimateDraft(form, 1_000);
    expect(parseEstimateDraft(raw, 1_000 + ESTIMATE_DRAFT_TTL_MS + 1)).toBeNull();
    expect(parseEstimateDraft("{oops", 1_000)).toBeNull();
    expect(
      parseEstimateDraft(JSON.stringify({ version: 99, savedAt: 1_000, form }), 1_000)
    ).toBeNull();
  });
});

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDaysToDateStr("2026-10-31", 15)).toBe("2026-11-15");
    expect(addDaysToDateStr("2026-01-20", 15)).toBe("2026-02-04");
  });

  it("builds a YYYYMMDD-XXX reference without estimate prefix", () => {
    expect(suggestEstimateReference("2026-10-31")).toMatch(/^20261031-\d{3}$/);
  });
});
