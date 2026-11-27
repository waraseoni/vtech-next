import { describe, expect, it } from "vitest";

import { jobReference } from "./jobReference";

describe("jobReference", () => {
  it("legacy/unbranded job purana #id dikhata hai", () => {
    expect(jobReference(28101)).toBe("#28101");
    expect(jobReference("28101", null)).toBe("#28101");
    expect(jobReference("28101", "  ")).toBe("#28101");
  });

  it("branded job composite reference dikhata hai", () => {
    expect(jobReference(28101, "KMK#001")).toBe("KMK#001 (Ref 28101)");
    expect(jobReference("28101", "BR#012")).toBe("BR#012 (Ref 28101)");
  });

  it("brand number ho aur global id na ho to brand hi dikhata hai", () => {
    expect(jobReference(null, "KMK#001")).toBe("KMK#001");
  });

  it("dono na ho to empty placeholder", () => {
    expect(jobReference(null, null)).toBe("—");
  });
});
