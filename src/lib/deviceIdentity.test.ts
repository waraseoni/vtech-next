import { describe, expect, it } from "vitest";
import {
  DEVICE_SEPARATOR,
  MAX_ITEM_LENGTH,
  clampJobItemLabel,
  composeJobItemLabel,
  formatDeviceIdentity,
  labelShrinks,
  normalizeIdentifier,
  resolveDeviceItem,
  emptyDeviceFields,
} from "./deviceIdentity";

describe("composeJobItemLabel", () => {
  it("legacy row — koi structured field nahi to purana item waisa hi", () => {
    expect(composeJobItemLabel({ legacyItem: "Komaki XGT scooter" })).toBe("Komaki XGT scooter");
    expect(composeJobItemLabel({})).toBe("");
  });

  it("full compose — fixed order Brand · Model · Identifier", () => {
    expect(
      composeJobItemLabel({
        brand: " Komaki ",
        model: "XGT",
        identifier: "KMK123456789",
        legacyItem: "purana text",
      })
    ).toBe(`Komaki${DEVICE_SEPARATOR}XGT${DEVICE_SEPARATOR}KMK123456789`);
  });

  it("partial compose — khali part chhup jayega, '—'/'undefined' nahi", () => {
    expect(composeJobItemLabel({ brand: "Komaki", identifier: "KMK1" })).toBe(
      `Komaki${DEVICE_SEPARATOR}KMK1`
    );
    expect(composeJobItemLabel({ model: "XGT" })).toBe("XGT");
  });

  it("customItem sab ko override karta hai", () => {
    expect(
      composeJobItemLabel({
        brand: "Komaki",
        model: "XGT",
        legacyItem: "purana",
        customItem: "Customer ne likha",
      })
    ).toBe("Customer ne likha");
  });

  it("shrink warning — sirf tab jab composed purane se chhota ho", () => {
    expect(labelShrinks({ brand: "K", legacyItem: "bahut lamba purana item text" })).toBe(true);
    expect(
      labelShrinks({
        brand: "Komaki",
        model: "XGT",
        identifier: "KMK123456789",
        legacyItem: "short",
      })
    ).toBe(false);
    expect(labelShrinks({ legacyItem: "legacy" })).toBe(false);
  });
});

describe("formatDeviceIdentity", () => {
  it("legacy row isLegacy=true aur raw item", () => {
    const out = formatDeviceIdentity({ item: "Samsung S24 ultra" });
    expect(out).toEqual({ label: "Samsung S24 ultra", isLegacy: true });
  });

  it("DB columns (serial_no / brand_name) map ho kar structured label banate hain", () => {
    const out = formatDeviceIdentity({
      item: "purana",
      brand_name: "Komaki",
      model: "XGT",
      serial_no: "kmk123",
    });
    expect(out.isLegacy).toBe(false);
    expect(out.label).toBe(`Komaki${DEVICE_SEPARATOR}XGT${DEVICE_SEPARATOR}kmk123`);
    expect(out.identifier).toBe("kmk123");
  });
});

describe("helpers", () => {
  it("identifier normalize — trim + upper + andar ke spaces compress", () => {
    expect(normalizeIdentifier("  kmk 123  ")).toBe("KMK 123");
    expect(normalizeIdentifier(null)).toBe("");
  });

  it("300 char guard", () => {
    expect(clampJobItemLabel("a".repeat(400))).toHaveLength(MAX_ITEM_LENGTH);
  });

  it("resolveDeviceItem — custom > composed > legacy, sab forms ke liye ek hi rule", () => {
    expect(resolveDeviceItem(emptyDeviceFields)).toBe("");
    expect(
      resolveDeviceItem({
        ...emptyDeviceFields,
        brandName: "Komaki",
        model: "XGT",
        serial: "KMK1",
        item: "purana",
      })
    ).toBe(`Komaki${DEVICE_SEPARATOR}XGT${DEVICE_SEPARATOR}KMK1`);
    expect(
      resolveDeviceItem({
        ...emptyDeviceFields,
        brandName: "Komaki",
        item: "purana",
        customMode: true,
      })
    ).toBe("purana");
    expect(resolveDeviceItem({ ...emptyDeviceFields, item: "legacy only" })).toBe("legacy only");
  });
});
