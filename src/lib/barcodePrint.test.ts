import { describe, it, expect } from "vitest";
import { DEFAULT_PRINT_OPTIONS, labelSheetCapacity, safeBarcode } from "./barcodePrint";

describe("safeBarcode", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(safeBarcode(null)).toBe("");
    expect(safeBarcode(undefined)).toBe("");
    expect(safeBarcode("")).toBe("");
  });

  it("strips non-printable and non-ASCII characters", () => {
    expect(safeBarcode("AB\x00C")).toBe("ABC");
    expect(safeBarcode("\u0915\u093E\u092B")).toBe(""); // pure Hindi → empty
    // Hindi chars inlined among ASCII → only ASCII preserved
    expect(safeBarcode("AB\u0915\u093EC")).toBe("ABC");
  });

  it("trims surrounding whitespace", () => {
    expect(safeBarcode("  12345  ")).toBe("12345");
  });

  it("caps length at 48 characters", () => {
    const long = "A".repeat(200);
    expect(safeBarcode(long).length).toBe(48);
  });

  it("permits printable ASCII range", () => {
    expect(safeBarcode("ABC-123_x7")).toBe("ABC-123_x7");
  });
});

describe("labelSheetCapacity", () => {
  it("returns positive cols, rows and perSheet", () => {
    const r = labelSheetCapacity();
    expect(r.cols).toBeGreaterThan(0);
    expect(r.rows).toBeGreaterThan(0);
    expect(r.perSheet).toBe(r.cols * r.rows);
  });

  it("medium portrait normal margin produces the expected sheet count", () => {
    // medium: 63.5x38.1mm, margin 8mm, A4 portrait 210x297
    const r = labelSheetCapacity({ size: "medium", orientation: "portrait", margin: "normal" });
    const cols = Math.floor((210 - 16 + 1.5) / (63.5 + 1.5));
    const rows = Math.floor((297 - 16 + 1.5) / (38.1 + 1.5));
    expect(r.cols).toBe(cols);
    expect(r.rows).toBe(rows);
    expect(r.perSheet).toBe(cols * rows);
  });

  it("wide margin fits fewer labels than narrow", () => {
    const narrow = labelSheetCapacity({
      size: "small",
      orientation: "landscape",
      margin: "narrow",
    });
    const wide = labelSheetCapacity({ size: "small", orientation: "landscape", margin: "wide" });
    expect(wide.perSheet).toBeLessThanOrEqual(narrow.perSheet);
  });

  it("compact size fits more labels per sheet than medium", () => {
    const compact = labelSheetCapacity({
      size: "compact",
      orientation: "portrait",
      margin: "normal",
    });
    const medium = labelSheetCapacity({
      size: "medium",
      orientation: "portrait",
      margin: "normal",
    });
    expect(compact.perSheet).toBeGreaterThan(medium.perSheet);
  });

  it("at least one per row/column when page is smaller than label", () => {
    // extreme options never return 0
    const r = labelSheetCapacity({ size: "medium", orientation: "landscape", margin: "wide" });
    expect(r.cols).toBeGreaterThanOrEqual(1);
    expect(r.rows).toBeGreaterThanOrEqual(1);
  });
});

describe("DEFAULT_PRINT_OPTIONS", () => {
  it("is medium portrait normal", () => {
    expect(DEFAULT_PRINT_OPTIONS).toEqual({
      size: "medium",
      orientation: "portrait",
      margin: "normal",
    });
  });
});
