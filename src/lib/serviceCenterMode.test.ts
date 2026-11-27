import { describe, expect, it } from "vitest";

import {
  brandNumberingEnabled,
  normalizeServiceCenterMode,
  serviceCenterModeLabel,
} from "./serviceCenterMode";

describe("service center mode", () => {
  it("unknown/missing/null = autonomous (fail closed)", () => {
    expect(normalizeServiceCenterMode()).toBe("autonomous");
    expect(normalizeServiceCenterMode(null)).toBe("autonomous");
    expect(normalizeServiceCenterMode("")).toBe("autonomous");
    expect(normalizeServiceCenterMode("something_else")).toBe("autonomous");
  });

  it("known modes normalize", () => {
    expect(normalizeServiceCenterMode("AUTONOMOUS")).toBe("autonomous");
    expect(normalizeServiceCenterMode(" Single_Brand ")).toBe("single_brand");
    expect(normalizeServiceCenterMode("multi_brand")).toBe("multi_brand");
  });

  it("brand numbering sirf single/multi me enabled", () => {
    expect(brandNumberingEnabled("autonomous")).toBe(false);
    expect(brandNumberingEnabled("single_brand")).toBe(true);
    expect(brandNumberingEnabled("multi_brand")).toBe(true);
    expect(brandNumberingEnabled()).toBe(false);
  });

  it("UI label safe default ke saath", () => {
    expect(serviceCenterModeLabel("single_brand")).toBe("Single Brand");
    expect(serviceCenterModeLabel("multi_brand")).toBe("Multi Brand");
    expect(serviceCenterModeLabel()).toBe("Autonomous");
    expect(serviceCenterModeLabel("unknown")).toBe("Autonomous");
  });
});
