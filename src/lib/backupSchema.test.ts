import { describe, it, expect } from "vitest";
import { parseOpenApiToSchema, GENERATED_COLUMNS, countPkViolations } from "./backupSchema";

const spec = {
  definitions: {
    transaction_products: {
      required: ["transaction_id", "qty", "price", "id"],
      properties: {
        transaction_id: { description: "" },
        product_id: { description: "" },
        qty: { description: "" },
        price: { description: "" },
        id: { description: "Note:\nThis is a Primary Key.<pk/>" },
      },
    },
    spare_supplier: {
      required: ["spare_id", "supplier_id"],
      properties: {
        spare_id: { description: "Primary key column.<pk/>" },
        supplier_id: { description: "Primary key column.<pk/>" },
      },
    },
    client_payments: {
      required: ["client_id", "payment_date", "amount"],
      properties: {
        id: { description: "This is a Primary Key.<pk/>" },
        client_id: { description: "" },
        net_amount: { description: "" },
      },
    },
    no_pk_table: {
      required: ["value"],
      properties: { value: { description: "" } },
    },
  },
};

describe("parseOpenApiToSchema", () => {
  it("extracts columns in definition order", () => {
    const tables = parseOpenApiToSchema(spec);
    const tp = tables.find((t) => t.name === "transaction_products");
    expect(tp?.cols).toEqual(["transaction_id", "product_id", "qty", "price", "id"]);
  });

  it("marks pk via <pk/> description marker", () => {
    const tables = parseOpenApiToSchema(spec);
    const tp = tables.find((t) => t.name === "transaction_products");
    expect(tp?.pk).toEqual(["id"]);
  });

  it("keeps composite pk arrays intact", () => {
    const tables = parseOpenApiToSchema(spec);
    const ss = tables.find((t) => t.name === "spare_supplier");
    expect(ss?.pk).toEqual(["spare_id", "supplier_id"]);
  });

  it("attaches known generated columns only", () => {
    const tables = parseOpenApiToSchema(spec);
    const cp = tables.find((t) => t.name === "client_payments");
    expect(cp?.generated).toEqual(["net_amount"]);
    const tp = tables.find((t) => t.name === "transaction_products");
    expect(tp?.generated).toEqual([]);
  });

  it("captures NOT NULL (required) columns for dry-run", () => {
    const tables = parseOpenApiToSchema(spec);
    const tp = tables.find((t) => t.name === "transaction_products");
    expect(tp?.notNull).toEqual(["transaction_id", "qty", "price", "id"]);
  });

  it("handles tables without pk", () => {
    const tables = parseOpenApiToSchema(spec);
    const no = tables.find((t) => t.name === "no_pk_table");
    expect(no?.pk).toEqual([]);
  });

  it("works with empty spec and missing definitions", () => {
    expect(parseOpenApiToSchema({})).toEqual([]);
    expect(parseOpenApiToSchema({ definitions: {} })).toEqual([]);
  });

  it("exposes GENERATED_COLUMNS shared map", () => {
    expect(GENERATED_COLUMNS.client_payments).toContain("net_amount");
  });

  describe("countPkViolations", () => {
    it("returns 0 for unique composite pk combos (no ragged key bug)", () => {
      const rows = [
        { spare_id: 1, supplier_id: 10 },
        { spare_id: 1, supplier_id: 11 },
        { spare_id: 2, supplier_id: 10 },
      ];
      expect(countPkViolations(rows, ["spare_id", "supplier_id"])).toBe(0);
    });

    it("counts duplicate composite combos", () => {
      const rows = [
        { a: 1, b: 2 },
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ];
      expect(countPkViolations(rows, ["a", "b"])).toBe(1);
    });

    it("counts rows with missing pk values", () => {
      const rows = [
        { a: 1, b: null },
        { a: 2, b: 3 },
      ];
      expect(countPkViolations(rows, ["a", "b"])).toBe(1);
    });

    it("handles empty rows and empty pk", () => {
      expect(countPkViolations([], ["id"])).toBe(0);
      expect(countPkViolations([{}, {}], [])).toBe(0);
    });

    it("treats undefined as missing", () => {
      expect(countPkViolations([{ id: 1 }, { id: 2, name: "x" }], ["id"])).toBe(0);
      expect(countPkViolations([{ name: "no-id" }], ["id"])).toBe(1);
    });
  });
});