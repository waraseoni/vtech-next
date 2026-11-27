import { describe, it, expect } from "vitest";

import {
  defaultServiceTypeId,
  expectsFault,
  faultFieldLabel,
  faultHint,
  faultRequiredMessage,
  serviceTypeName,
  serviceTypeOptions,
  type ServiceTypeOption,
} from "./serviceType";

const types: ServiceTypeOption[] = [
  { id: 1, name: "Repair", sort_order: 0 },
  { id: 2, name: "New Installation", sort_order: 10, expects_fault: false },
  { id: 3, name: "Warranty Claim", sort_order: 20 },
  { id: 4, name: "PDI / Delivery", sort_order: 40, expects_fault: false },
  { id: 5, name: "Archived Type", sort_order: 5, is_active: false },
];

describe("expectsFault", () => {
  it("NULL/undefined/missing = fault required (back-compat default)", () => {
    expect(expectsFault(null)).toBe(true);
    expect(expectsFault(undefined)).toBe(true);
    expect(expectsFault({})).toBe(true);
    expect(expectsFault({ expects_fault: null })).toBe(true);
    expect(expectsFault({ expects_fault: true })).toBe(true);
  });

  it("sirf explicit false faultless hai", () => {
    expect(expectsFault({ expects_fault: false })).toBe(false);
    expect(expectsFault(types[1])).toBe(false);
    expect(expectsFault(types[0])).toBe(true);
  });
});

describe("defaultServiceTypeId", () => {
  it("Repair ko priority, warna chhota sort_order", () => {
    expect(defaultServiceTypeId(types)).toBe(1);
    expect(defaultServiceTypeId(types.slice(1))).toBe(2);
  });

  it("Repair Service alias bhi canonical Repair jaisa default hai", () => {
    expect(
      defaultServiceTypeId([
        { id: 11, name: "Inspection", sort_order: 1 },
        { id: 12, name: "Repair Service", sort_order: 99 },
      ])
    ).toBe(12);
  });

  it("name match na ho to sort_order min", () => {
    expect(
      defaultServiceTypeId([
        { id: 8, name: "Inspection", sort_order: 1 },
        { id: 9, name: "AMC", sort_order: 30 },
      ])
    ).toBe(8);
  });

  it("inactive type skip; koi active na ho to null", () => {
    expect(defaultServiceTypeId([types[4], { id: 6, name: "X", sort_order: 99 }])).toBe(6);
    expect(defaultServiceTypeId([])).toBeNull();
    expect(defaultServiceTypeId([types[4]])).toBeNull();
  });

  it("sort_order NULL last", () => {
    expect(
      defaultServiceTypeId([
        { id: 7, name: "A", sort_order: null },
        { id: 8, name: "B", sort_order: 2 },
      ])
    ).toBe(8);
  });
});

describe("fault labels", () => {
  it("fault-required type par purana label + message", () => {
    expect(faultFieldLabel(true)).toBe("Fault / Complaint *");
    expect(faultRequiredMessage(true)).toBe("Fault description zaroori hai");
    expect(faultHint(true)).toBe("");
  });

  it("faultless type par optional label, koi error nahi", () => {
    expect(faultFieldLabel(false)).toBe("Work Description / Scope (optional)");
    expect(faultRequiredMessage(false)).toBe("");
    expect(faultHint(false)).toContain("optional");
  });
});

describe("serviceTypeOptions", () => {
  it("active types + selected inactive type dikhaata hai", () => {
    const options = serviceTypeOptions(types, 5);
    expect(options.map((o) => o.id)).toEqual([1, 2, 3, 4, 5]);
    expect(options.find((o) => o.id === 5)?.label).toBe("Archived Type (inactive)");
    expect(options.find((o) => o.id === 2)?.sub).toBe("Fault optional");
  });

  it("unselected inactive type chhupa rahega", () => {
    expect(serviceTypeOptions(types, null).map((o) => o.id)).toEqual([1, 2, 3, 4]);
  });
});

describe("serviceTypeName", () => {
  it("active + inactive dono se naam resolve, unknown/null par null", () => {
    expect(serviceTypeName(types, 2)).toBe("New Installation");
    expect(serviceTypeName(types, 5)).toBe("Archived Type");
    expect(serviceTypeName(types, 999)).toBeNull();
    expect(serviceTypeName(types, null)).toBeNull();
    expect(serviceTypeName(types, undefined)).toBeNull();
  });
});
