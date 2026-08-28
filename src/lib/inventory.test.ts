import { describe, it, expect } from "vitest";
import {
  DEFAULT_ALERT_QTY,
  alertThreshold,
  stockStatus,
  stockStatusStyle,
  stockBarColor,
  aggregateStock,
  stockValue,
} from "./inventory";

describe("alertThreshold", () => {
  it("defaults to DEFAULT_ALERT_QTY when none/invalid", () => {
    expect(alertThreshold()).toBe(DEFAULT_ALERT_QTY);
    expect(alertThreshold(null)).toBe(DEFAULT_ALERT_QTY);
    expect(alertThreshold(undefined)).toBe(DEFAULT_ALERT_QTY);
    expect(alertThreshold(0)).toBe(DEFAULT_ALERT_QTY); // 0 is falsy → falls back to default (5)
  });

  it("uses the per-product threshold when valid", () => {
    expect(alertThreshold(8)).toBe(8);
    expect(alertThreshold(2)).toBe(2);
  });
});

describe("stockStatus", () => {
  it("returns 'out' when available <= 0", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(-5)).toBe("out");
  });

  it("returns 'low' when at or below threshold", () => {
    expect(stockStatus(3, 5)).toBe("low");
    expect(stockStatus(5, 5)).toBe("low");
  });

  it("returns 'ok' when above threshold or no threshold", () => {
    expect(stockStatus(6, 5)).toBe("ok");
    expect(stockStatus(20)).toBe("ok");
    expect(stockStatus(1)).toBe("low"); // default threshold 5
  });
});

describe("stockStatusStyle", () => {
  it("maps out/low/ok to distinct labels", () => {
    expect(stockStatusStyle(0).label).toBe("Out of Stock");
    expect(stockStatusStyle(3, 5).label).toBe("Low Stock");
    expect(stockStatusStyle(20).label).toBe("In Stock");
  });

  it("labels match short codes", () => {
    expect(stockStatusStyle(0).short).toBe("OUT");
    expect(stockStatusStyle(3, 5).short).toBe("LOW");
    expect(stockStatusStyle(20).short).toBe("OK");
  });
});

describe("stockBarColor", () => {
  it("returns red/amber/emerald per status", () => {
    expect(stockBarColor(0)).toBe("bg-red-500");
    expect(stockBarColor(3, 5)).toBe("bg-amber-400");
    expect(stockBarColor(20)).toBe("bg-emerald-500");
  });
});

describe("aggregateStock", () => {
  it("computes available = in − jobSold − saleSold", () => {
    const rows = aggregateStock(
      [{ product_id: 1, quantity: 100 }],
      [{ product_id: 1, qty: 30 }],
      [{ product_id: 1, qty: 20 }]
    );
    const r = rows[0];
    expect(r.available).toBe(50);
    expect(r.total_in).toBe(100);
    expect(r.total_sold).toBe(50);
  });

  it("sums multiple rows for the same product", () => {
    const rows = aggregateStock(
      [
        { product_id: 2, quantity: 10 },
        { product_id: 2, quantity: 15 },
      ],
      [{ product_id: 2, qty: 5 }],
      []
    );
    const r = rows.find((x) => x.product_id === 2)!;
    expect(r.total_in).toBe(25);
    expect(r.available).toBe(20);
  });

  it("tracks place from first stock row that has one", () => {
    const rows = aggregateStock(
      [
        { product_id: 3, quantity: 5, place: null },
        { product_id: 3, quantity: 5, place: "Shelf A" },
      ],
      [],
      []
    );
    expect(rows.find((x) => x.product_id === 3)!.place).toBe("Shelf A");
  });

  it("reports oversold when sales exceed incoming stock", () => {
    const rows = aggregateStock(
      [{ product_id: 4, quantity: 10 }],
      [{ product_id: 4, qty: 15 }],
      []
    );
    const r = rows.find((x) => x.product_id === 4)!;
    expect(r.available).toBe(-5);
    expect(r.oversold).toBe(5);
  });

  it("returns empty array for no rows", () => {
    expect(aggregateStock([], [], [])).toEqual([]);
  });

  it("tolerates missing optional fields", () => {
    const rows = aggregateStock(
      [{ product_id: 5, quantity: undefined as unknown as number }],
      [{ product_id: 5, qty: undefined as unknown as number }],
      []
    );
    // all zero → available 0 (quantity treated as 0)
    expect(rows.find((x) => x.product_id === 5)!.available).toBe(0);
  });
});

describe("stockValue", () => {
  it("multiplies available by price when positive", () => {
    expect(stockValue(10, 50)).toBe(500);
  });

  it("returns 0 when none available even if price given", () => {
    expect(stockValue(0, 50)).toBe(0);
    expect(stockValue(-3, 50)).toBe(0);
  });

  it("returns 0 when price missing/null", () => {
    expect(stockValue(10, null)).toBe(0);
    expect(stockValue(10, undefined)).toBe(0);
  });

  it("handles decimal prices", () => {
    expect(stockValue(4, 12.5)).toBe(50);
  });
});
