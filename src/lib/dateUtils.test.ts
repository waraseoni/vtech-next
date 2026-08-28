import { describe, it, expect } from "vitest";
import {
  todayIST,
  currentMonthIST,
  startOfMonthIST,
  endOfMonthIST,
  parseISTDate,
  dtLocalToIST,
  minsBetweenIST,
  hoursBetweenIST,
  deriveStatusFromTimes,
  fmtTimeIST,
} from "./dateUtils";

describe("dtLocalToIST", () => {
  it("adds +05:30 to a naive datetime-local (16 char)", () => {
    expect(dtLocalToIST("2026-08-20T18:30")).toBe("2026-08-20T18:30:00+05:30");
  });

  it("adds +05:30 to a value with seconds (19 char)", () => {
    expect(dtLocalToIST("2026-08-20T18:30:45")).toBe("2026-08-20T18:30:45+05:30");
  });

  it("returns empty string for empty input", () => {
    expect(dtLocalToIST("")).toBe("");
  });

  it("leaves an already-offset value untouched", () => {
    expect(dtLocalToIST("2026-08-20T18:30:00Z")).toBe("2026-08-20T18:30:00Z");
    expect(dtLocalToIST("2026-08-20T18:30:00+05:30")).toBe("2026-08-20T18:30:00+05:30");
  });
});

describe("minsBetweenIST", () => {
  it("computes positive difference", () => {
    expect(minsBetweenIST("09:00", "18:00")).toBe(540);
  });

  it("handles overnight shift", () => {
    expect(minsBetweenIST("22:00", "06:00")).toBe(480);
  });

  it("returns null when either is missing", () => {
    expect(minsBetweenIST(null, "06:00")).toBeNull();
    expect(minsBetweenIST("09:00", null)).toBeNull();
    expect(minsBetweenIST(null, null)).toBeNull();
  });

  it("handles seconds suffix", () => {
    expect(minsBetweenIST("09:00:00", "10:30:00")).toBe(90);
  });
});

describe("hoursBetweenIST", () => {
  it("formats hours and minutes", () => {
    expect(hoursBetweenIST("09:00", "18:45")).toBe("9h 45m");
  });

  it("returns em-dash for incomplete data", () => {
    expect(hoursBetweenIST(null, "18:45")).toBe("—");
    expect(hoursBetweenIST("09:00", null)).toBe("—");
  });
});

describe("deriveStatusFromTimes", () => {
  it("returns null when no check-in", () => {
    expect(deriveStatusFromTimes(null, "18:00")).toBeNull();
  });

  it("returns Present (1) when only check-in present", () => {
    expect(deriveStatusFromTimes("09:00", null)).toBe(1);
  });

  it("returns Half Day (3) when less than 6h", () => {
    expect(deriveStatusFromTimes("09:00", "13:00")).toBe(3);
  });

  it("returns Present (1) when 6h or more", () => {
    expect(deriveStatusFromTimes("09:00", "15:00")).toBe(1);
    expect(deriveStatusFromTimes("09:00", "18:00")).toBe(1);
  });

  it("returns Present (1) on exactly 6h boundary", () => {
    expect(deriveStatusFromTimes("09:00", "15:00:00")).toBe(1);
  });
});

describe("fmtTimeIST", () => {
  it("formats morning time", () => {
    expect(fmtTimeIST("09:05")).toBe("9:05 AM");
  });

  it("formats afternoon time", () => {
    expect(fmtTimeIST("14:30")).toBe("2:30 PM");
  });

  it("handles midnight as 12 AM", () => {
    expect(fmtTimeIST("00:15")).toBe("12:15 AM");
  });

  it("handles noon as 12 PM", () => {
    expect(fmtTimeIST("12:00")).toBe("12:00 PM");
  });

  it("returns --:-- for missing", () => {
    expect(fmtTimeIST(null)).toBe("--:--");
    expect(fmtTimeIST(undefined)).toBe("--:--");
    expect(fmtTimeIST("")).toBe("--:--");
  });
});

describe("parseISTDate", () => {
  it("parses YYYY-MM-DD", () => {
    const d = parseISTDate("2026-08-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-indexed August
    expect(d.getDate()).toBe(20);
  });
});

describe("startOfMonthIST / endOfMonthIST", () => {
  it("returns first day of month", () => {
    const jan = parseISTDate("2026-01-15");
    expect(startOfMonthIST(jan)).toBe("2026-01-01");
  });

  it("returns last day of a 28-day February", () => {
    const feb2026 = parseISTDate("2026-02-10");
    expect(endOfMonthIST(feb2026)).toBe("2026-02-28");
  });

  it("returns last day of a 31-day month", () => {
    const aug = parseISTDate("2026-08-10");
    expect(endOfMonthIST(aug)).toBe("2026-08-31");
  });

  it("handles leap year February", () => {
    const feb2028 = parseISTDate("2028-02-10");
    expect(endOfMonthIST(feb2028)).toBe("2028-02-29");
  });
});

describe("todayIST / currentMonthIST", () => {
  it("currentMonthIST is 7 chars (YYYY-MM)", () => {
    expect(currentMonthIST()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("todayIST is 10 chars (YYYY-MM-DD)", () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
