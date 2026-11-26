import { describe, it, expect } from "vitest";

import {
  bulkRowFaultRequired,
  validateBulkRows,
  validBulkRows,
  type BulkValidatableRow,
} from "./bulkJobValidation";
import type { ServiceTypeOption } from "./serviceType";

const types: ServiceTypeOption[] = [
  { id: 1, name: "Repair", sort_order: 0 },
  { id: 2, name: "New Installation", sort_order: 10, expects_fault: false },
];

const row = (patch: Partial<BulkValidatableRow> = {}): BulkValidatableRow => ({
  id: 1,
  itemLabel: "Fan · Samsung · ABC123",
  fault: "Not working",
  serviceTypeId: 1,
  mechanicId: "4",
  ...patch,
});

describe("bulkRowFaultRequired", () => {
  it("repair / legacy NULL required, installation optional", () => {
    expect(bulkRowFaultRequired(row(), types)).toBe(true);
    expect(bulkRowFaultRequired(row({ serviceTypeId: null }), types)).toBe(true);
    expect(bulkRowFaultRequired(row({ serviceTypeId: 2 }), types)).toBe(false);
  });
});

describe("validateBulkRows", () => {
  it("complete repair row pass", () => {
    expect(validateBulkRows([row()], types)).toEqual({});
  });

  it("faultless type par khali fault pass, mechanic ab bhi required", () => {
    expect(validateBulkRows([row({ serviceTypeId: 2, fault: "" })], types)).toEqual({});
    expect(validateBulkRows([row({ serviceTypeId: 2, fault: "", mechanicId: "" })], types)).toEqual(
      {
        1: ["Mechanic"],
      }
    );
  });

  it("repair par khali fault error (row save hi nahi hogi to mechanic error nahi)", () => {
    expect(validateBulkRows([row({ fault: "  " })], types)).toEqual({ 1: ["Fault Reported"] });
    expect(validateBulkRows([row({ fault: "", mechanicId: "" })], types)).toEqual({
      1: ["Fault Reported"],
    });
  });

  it("item missing sabse pehle", () => {
    expect(validateBulkRows([row({ itemLabel: "" })], types)[1][0]).toBe("Item / Model");
  });

  it("mixed rows me sirf adhuri rows error", () => {
    const errs = validateBulkRows(
      [row({ id: 1 }), row({ id: 2, serviceTypeId: 2, fault: "" }), row({ id: 3, fault: "" })],
      types
    );
    expect(Object.keys(errs)).toEqual(["3"]);
  });
});

describe("validBulkRows", () => {
  it("validation error na wali hi rows save hoti hain", () => {
    const rows = [
      row({ id: 1 }),
      row({ id: 2, fault: "" }),
      row({ id: 3, serviceTypeId: 2, fault: "" }),
    ];
    const errs = validateBulkRows(rows, types);
    expect(validBulkRows(rows, errs).map((r) => r.id)).toEqual([1, 3]);
  });
});
