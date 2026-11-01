import { describe, expect, it } from "vitest";
import { buildAvailableStock } from "./jobFormQueries";

const products = [
  { id: 1, name: "Charger", price: 100 },
  { id: 2, name: "Battery", price: 500 },
  { id: 3, name: "Screen", price: 900 },
];

describe("buildAvailableStock", () => {
  it("stock-in minus non-cancelled job sales minus direct sales", () => {
    const stock = buildAvailableStock(
      products,
      [
        { product_id: 1, quantity: 10 },
        { product_id: 1, quantity: 5 },
        { product_id: 2, quantity: 4 },
      ],
      [
        { product_id: 1, qty: 2, transaction_id: 10 },
        { product_id: 1, qty: 1, transaction_id: 11 }, // cancelled — count nahi
        { product_id: 2, qty: 3, transaction_id: 10 },
        { product_id: 3, qty: 1, transaction_id: 10 },
      ],
      [
        { product_id: 1, qty: 4 },
        { product_id: 3, qty: 2 },
      ],
      new Set([11])
    );

    expect(stock).toEqual([
      { id: 1, name: "Charger", price: 100, available_stock: 9 },
      { id: 2, name: "Battery", price: 500, available_stock: 1 },
      { id: 3, name: "Screen", price: 900, available_stock: -3 },
    ]);
  });

  it("null quantities ko 0 maanta hai (old inline formula jaisa)", () => {
    const stock = buildAvailableStock(
      [{ id: 9, name: "Cable", price: 50 }],
      [{ product_id: 9, quantity: null }],
      [{ product_id: 9, qty: null, transaction_id: 1 }],
      [{ product_id: 9, qty: null }],
      new Set()
    );
    expect(stock[0].available_stock).toBe(0);
  });
});
