import { describe, it, expect } from "vitest";
import {
  parseOpenApiToSchema,
  GENERATED_COLUMNS,
  countPkViolations,
  parseBackupVersion,
  buildSchemaSnapshot,
} from "./backupSchema";

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

  it("marks generated identity ids so restore strips them", () => {
    expect(GENERATED_COLUMNS.staff_duty_schedule).toContain("id");
    expect(GENERATED_COLUMNS.staff_geofence_permit).toContain("id");
    const sds = parseOpenApiToSchema({
      definitions: {
        staff_duty_schedule: {
          required: ["id"],
          properties: { id: { description: "Primary Key.<pk/>" } },
        },
      },
    });
    expect(sds[0].generated).toEqual(["id"]);
  });

  describe("parseBackupVersion", () => {
    it("accepts 4.0 without warning", () => {
      expect(parseBackupVersion({ version: "4.0" })).toEqual({
        version: "4.0",
        major: 4,
        isLegacy: false,
        warning: null,
      });
    });

    it("accepts future versions without warning", () => {
      expect(parseBackupVersion({ version: "5.1" })?.isLegacy).toBe(false);
    });

    it("warns (but does not block) legacy 3.0", () => {
      const info = parseBackupVersion({ version: "3.0" });
      expect(info?.isLegacy).toBe(true);
      expect(info?.warning).toContain("Legacy backup format 3.0");
    });

    it("warns for unparseable versions", () => {
      expect(parseBackupVersion({ version: "unknown" })?.isLegacy).toBe(true);
      expect(parseBackupVersion({ version: "unknown" })?.warning).toContain("samajh nahi aaya");
    });

    it("returns null when version missing", () => {
      expect(parseBackupVersion({})).toBeNull();
      expect(parseBackupVersion(null)).toBeNull();
    });
  });

  describe("buildSchemaSnapshot", () => {
    it("captures cols/pk/notNull/generated with migration IDs", () => {
      const tables = parseOpenApiToSchema(spec);
      const snap = buildSchemaSnapshot(
        tables,
        ["20260101000000_a", "20260102000000_b"],
        "2026-11-28T00:00:00.000Z"
      );
      expect(snap.captured_at).toBe("2026-11-28T00:00:00.000Z");
      expect(snap.migration_ids).toEqual(["20260101000000_a", "20260102000000_b"]);
      expect(snap.tables.transaction_products).toEqual({
        cols: ["transaction_id", "product_id", "qty", "price", "id"],
        pk: ["id"],
        notNull: ["transaction_id", "qty", "price", "id"],
        generated: [],
      });
      expect(snap.tables.client_payments.generated).toEqual(["net_amount"]);
    });

    it("does not alias source table arrays", () => {
      const tables = parseOpenApiToSchema(spec);
      const snap = buildSchemaSnapshot(tables, []);
      tables[0].cols.push("extra");
      expect(snap.tables[tables[0].name].cols).not.toContain("extra");
    });
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
