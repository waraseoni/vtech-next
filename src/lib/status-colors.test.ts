import { describe, it, expect } from "vitest";
import {
  JOB_STATUS,
  SERVICE_STATUS,
  PENDING_JOB_STATUS,
  PO_STATUS,
  ENTITY_STATUS,
  JOB_STATUS_INLINE,
} from "./status-colors";

describe("JOB_STATUS", () => {
  it("has all job statuses 0-5", () => {
    expect(
      Object.keys(JOB_STATUS)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("has expected labels", () => {
    expect(JOB_STATUS[0].label).toBe("Pending");
    expect(JOB_STATUS[1].label).toBe("In Progress");
    expect(JOB_STATUS[2].label).toBe("Done");
    expect(JOB_STATUS[3].label).toBe("Paid");
    expect(JOB_STATUS[4].label).toBe("Cancelled");
    expect(JOB_STATUS[5].label).toBe("Delivered");
  });

  it("each status has all required style fields", () => {
    for (const s of Object.values(JOB_STATUS)) {
      expect(s.label).toBeTruthy();
      expect(s.cls).toContain("bg-");
      expect(s.cls).toContain("text-");
      expect(s.cls).toContain("border-");
      expect(s.color).toContain("text-");
      expect(s.bg).toContain("bg-");
      expect(s.bar).toContain("bg-");
    }
  });

  it("colors are distinct across statuses", () => {
    const colors = Object.values(JOB_STATUS).map((s) => s.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("SERVICE_STATUS", () => {
  it("overrides labels for service context", () => {
    expect(SERVICE_STATUS[1].label).toBe("Accepted");
    expect(SERVICE_STATUS[2].label).toBe("In Progress");
    expect(SERVICE_STATUS[3].label).toBe("Ready");
  });

  it("inherits styling from JOB_STATUS", () => {
    expect(SERVICE_STATUS[0].cls).toBe(JOB_STATUS[0].cls);
    expect(SERVICE_STATUS[5].cls).toBe(JOB_STATUS[5].cls);
  });
});

describe("PENDING_JOB_STATUS", () => {
  it("only covers statuses 0-3", () => {
    expect(
      Object.keys(PENDING_JOB_STATUS)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([0, 1, 2, 3]);
  });
});

describe("PO_STATUS", () => {
  it("has all PO statuses 0-3", () => {
    expect(
      Object.keys(PO_STATUS)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([0, 1, 2, 3]);
  });

  it("has expected labels", () => {
    expect(PO_STATUS[0].label).toBe("Pending");
    expect(PO_STATUS[1].label).toBe("Partial");
    expect(PO_STATUS[2].label).toBe("Received");
    expect(PO_STATUS[3].label).toBe("Cancelled");
  });
});

describe("ENTITY_STATUS", () => {
  it("has active and inactive states", () => {
    expect(ENTITY_STATUS.active.label).toBe("Active");
    expect(ENTITY_STATUS.inactive.label).toBe("Inactive");
  });
});

describe("JOB_STATUS_INLINE", () => {
  it("provides inline CSS colors for all job statuses", () => {
    for (const key of ["0", "1", "2", "3", "4", "5"]) {
      const s = JOB_STATUS_INLINE[Number(key)];
      expect(s.label).toBeTruthy();
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.bg).toContain("rgba(");
    }
  });
});
