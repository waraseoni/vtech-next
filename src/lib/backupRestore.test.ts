import { describe, it, expect } from "vitest";
import {
  BACKUP_TABLES_ORDERED,
  normalizeTextFieldsForRestore,
  dedupeRowsByPk,
  classifyRestoreError,
  restoreErrorHint,
} from "./backupRestore";

const orderOf = (table: string) =>
  BACKUP_TABLES_ORDERED.findIndex((entry) => entry.table === table);

describe("BACKUP_TABLES_ORDERED", () => {
  it("restores FK parents before transaction_list", () => {
    const job = orderOf("transaction_list");
    expect(job).toBeGreaterThan(-1);
    for (const parent of [
      "brands",
      "service_types",
      "device_models",
      "device_identifiers",
      "brand_job_counters",
    ]) {
      expect(orderOf(parent)).toBeGreaterThan(-1);
      expect(orderOf(parent)).toBeLessThan(job);
    }
  });

  it("keeps brands before its children", () => {
    expect(orderOf("brands")).toBeLessThan(orderOf("brand_job_counters"));
    expect(orderOf("brands")).toBeLessThan(orderOf("device_models"));
  });

  it("restores supplier_payments before expense_list (supplier_payment_id FK)", () => {
    expect(orderOf("supplier_payments")).toBeLessThan(orderOf("expense_list"));
  });

  it("restores location hierarchy before locations (zone_id/rack_id FKs)", () => {
    const locations = orderOf("locations");
    for (const parent of ["location_zones", "location_racks", "location_bins", "location_boxes"]) {
      expect(orderOf(parent)).toBeLessThan(locations);
    }
  });

  it("includes identity/staff tables explicitly instead of auto-append", () => {
    for (const table of ["staff_duty_schedule", "staff_geofence_permit", "user_passkeys"]) {
      expect(orderOf(table)).toBeGreaterThan(-1);
    }
  });
});

describe("normalizeTextFieldsForRestore", () => {
  it("keeps NULL on nullable text columns (no '' unique collision)", () => {
    const row = { id: 5, code: null, name: "Money Light" };
    const out = normalizeTextFieldsForRestore(row, ["name"]);
    expect(out.code).toBeNull();
    expect(row.code).toBeNull(); // pure: input unchanged
  });

  it("falls back to '' only for NOT NULL text columns", () => {
    const out = normalizeTextFieldsForRestore({ name: null, code: null }, ["name"]);
    expect(out.name).toBe("");
    expect(out.code).toBeNull();
  });

  it("stringifies numeric values in text columns", () => {
    const out = normalizeTextFieldsForRestore({ item: 27287, code: 42 }, []);
    expect(out.item).toBe("27287");
    expect(out.code).toBe("42");
  });

  it("leaves unrelated columns and missing fields alone", () => {
    const row = { id: 7, zone: "", kind: "inventory" };
    const out = normalizeTextFieldsForRestore(row, []);
    expect(out).toEqual(row);
  });
});

describe("dedupeRowsByPk", () => {
  it("dedupes single PK rows inside a batch", () => {
    const rows = [
      { id: 1, v: "a" },
      { id: 1, v: "b" },
      { id: 2, v: "c" },
    ];
    const out = dedupeRowsByPk(rows, ["id"]);
    expect(out.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(out.skipped).toBe(1);
  });

  it("dedupes composite PK tuples", () => {
    const rows = [
      { product_id: 1, location_id: 10 },
      { product_id: 1, location_id: 10 },
      { product_id: 1, location_id: 11 },
    ];
    const out = dedupeRowsByPk(rows, ["product_id", "location_id"]);
    expect(out.rows).toHaveLength(2);
    expect(out.skipped).toBe(1);
  });

  it("keeps rows with a missing PK for the DB to report", () => {
    const rows = [{ id: null, v: "a" }, { id: null, v: "b" }, { id: 3 }];
    const out = dedupeRowsByPk(rows, ["id"]);
    expect(out.rows).toHaveLength(3);
    expect(out.skipped).toBe(0);
  });

  it("does nothing for tables without a PK", () => {
    const rows = [{ v: 1 }, { v: 1 }];
    expect(dedupeRowsByPk(rows, []).rows).toEqual(rows);
  });
});

describe("restore error classification", () => {
  it("classifies each failure group from the 26 Nov restore report", () => {
    expect(
      classifyRestoreError('new row violates row-level security policy for table "messages"')
    ).toBe("rls");
    expect(
      classifyRestoreError(
        'insert or update on table "locations" violates foreign key constraint "locations_zone_id_fkey"'
      )
    ).toBe("fk");
    expect(
      classifyRestoreError('duplicate key value violates unique constraint "brands_code_key"')
    ).toBe("unique");
    expect(classifyRestoreError('cannot insert a non-DEFAULT value into column "id"')).toBe(
      "identity"
    );
    expect(classifyRestoreError("something else")).toBe("other");
  });

  it("explains the cross-project auth limitation", () => {
    expect(restoreErrorHint("rls")).toMatch(/service-role/);
    expect(restoreErrorHint("other")).toBe("");
  });
});
