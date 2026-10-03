import { describe, it, expect } from "vitest";
import {
  DEFAULT_DUTY,
  bizDutyFromMeta,
  dutyEqual,
  dutyFor,
  dutyLengthLabel,
  dutyMinutes,
  fmtDuty,
  isValidDuty,
  normTime,
  rowToDuty,
  sortDutyDesc,
  toMins,
  currentSchedule,
  type Duty,
  type DutyScheduleRow,
} from "@/lib/duty";

const row = (
  effective_from: string,
  duty_start: string,
  duty_end: string,
  break_minutes = 0
): DutyScheduleRow => ({
  mechanic_id: 7,
  duty_start,
  duty_end,
  break_minutes,
  effective_from,
});

describe("normTime", () => {
  it("normalises PostgREST HH:MM:SS and input HH:MM to HH:MM", () => {
    expect(normTime("10:00:00")).toBe("10:00");
    expect(normTime("9:05")).toBe("09:05");
    expect(normTime("09:05:33")).toBe("09:05");
    expect(normTime(" 19:00 ")).toBe("19:00");
  });

  it("rejects invalid values", () => {
    expect(normTime("")).toBe("");
    expect(normTime(null)).toBe("");
    expect(normTime(undefined)).toBe("");
    expect(normTime("25:00")).toBe("");
    expect(normTime("10:60")).toBe("");
    expect(normTime("abc")).toBe("");
    expect(normTime("10:0")).toBe(""); // minutes must be 2 digits
  });
});

describe("toMins", () => {
  it("converts to minutes since midnight", () => {
    expect(toMins("10:00")).toBe(600);
    expect(toMins("00:00")).toBe(0);
    expect(toMins("23:59")).toBe(1439);
  });

  it("returns NaN for invalid", () => {
    expect(toMins("bad")).toBeNaN();
    expect(toMins("")).toBeNaN();
  });
});

describe("dutyMinutes", () => {
  it("computes plain and break-adjusted duration", () => {
    expect(dutyMinutes({ start: "10:00", end: "19:00", breakMinutes: 0 })).toBe(540);
    expect(dutyMinutes({ start: "10:00", end: "19:00", breakMinutes: 30 })).toBe(510);
  });

  it("supports overnight duty", () => {
    expect(dutyMinutes({ start: "22:00", end: "06:00", breakMinutes: 0 })).toBe(480);
  });

  it("zero / invalid edge cases", () => {
    expect(dutyMinutes({ start: "10:00", end: "10:00", breakMinutes: 0 })).toBe(0);
    expect(dutyMinutes({ start: "", end: "19:00", breakMinutes: 0 })).toBe(0);
    expect(dutyMinutes({ start: "10:00", end: "10:30", breakMinutes: 60 })).toBe(0);
  });
});

describe("isValidDuty", () => {
  it("accepts valid, rejects incomplete/equal times", () => {
    expect(isValidDuty({ start: "10:00", end: "19:00", breakMinutes: 0 })).toBe(true);
    expect(isValidDuty({ start: "22:00", end: "06:00", breakMinutes: 0 })).toBe(true);
    expect(isValidDuty({ start: "", end: "19:00", breakMinutes: 0 })).toBe(false);
    expect(isValidDuty({ start: "10:00", end: "10:00", breakMinutes: 0 })).toBe(false);
    expect(isValidDuty({ start: "10:00", end: "xx", breakMinutes: 0 })).toBe(false);
  });
});

describe("rowToDuty", () => {
  it("normalises DB time strings", () => {
    const d = rowToDuty(row("2026-10-01", "10:00:00", "19:00:00", 15));
    expect(d).toEqual({ start: "10:00", end: "19:00", breakMinutes: 15 });
  });

  it("null and invalid rows → null", () => {
    expect(rowToDuty(null)).toBeNull();
    expect(rowToDuty(row("2026-10-01", "10:00", "10:00"))).toBeNull();
  });
});

describe("sortDutyDesc / currentSchedule", () => {
  const rows = [
    row("2026-01-01", "10:00", "19:00"),
    row("2026-10-15", "11:00", "20:00"),
    row("2026-06-01", "09:30", "18:30"),
  ];

  it("sorts newest first without mutating input", () => {
    const out = sortDutyDesc(rows);
    expect(out.map((r) => r.effective_from)).toEqual(["2026-10-15", "2026-06-01", "2026-01-01"]);
    expect(rows[0].effective_from).toBe("2026-01-01");
    expect(sortDutyDesc([])).toEqual([]);
    expect(sortDutyDesc(null)).toEqual([]);
  });

  it("picks latest row with effective_from <= date", () => {
    expect(currentSchedule(rows, "2026-12-31")?.effective_from).toBe("2026-10-15");
    expect(currentSchedule(rows, "2026-10-15")?.effective_from).toBe("2026-10-15");
    expect(currentSchedule(rows, "2026-10-14")?.effective_from).toBe("2026-06-01");
    expect(currentSchedule(rows, "2025-12-31")).toBeNull();
  });

  it("ignores future and malformed rows", () => {
    expect(currentSchedule([row("2099-01-01", "10:00", "19:00")], "2026-10-01")).toBeNull();
    expect(currentSchedule([row("bad-date", "10:00", "19:00")], "2026-10-01")).toBeNull();
  });
});

describe("dutyFor", () => {
  const fallback: Duty = { start: "09:00", end: "19:00", breakMinutes: 0 };

  it("uses schedule when available", () => {
    const d = dutyFor([row("2026-01-01", "11:00:00", "20:00:00")], "2026-10-01");
    expect(d).toEqual({ start: "11:00", end: "20:00", breakMinutes: 0 });
  });

  it("falls back to provided fallback when no row covers the date", () => {
    expect(dutyFor([], "2026-10-01", fallback)).toEqual(fallback);
    expect(dutyFor(null, "2026-10-01", fallback)).toEqual(fallback);
    expect(dutyFor([row("2099-01-01", "10:00", "19:00")], "2026-10-01", fallback)).toEqual(
      fallback
    );
  });

  it("falls back to DEFAULT_DUTY when nothing given", () => {
    expect(dutyFor([], "2026-10-01")).toEqual(DEFAULT_DUTY);
  });
});

describe("dutyEqual / fmtDuty / dutyLengthLabel", () => {
  it("compares normalised values", () => {
    // Same times + same break (PostgREST "HH:MM:SS" normalise hokar equal)
    expect(
      dutyEqual(
        { start: "10:00", end: "19:00", breakMinutes: 0 },
        { start: "10:00:00", end: "19:00", breakMinutes: 0 }
      )
    ).toBe(true);
    // Break alag = duty alag (break-only change bhi save hone chahiye)
    expect(
      dutyEqual(
        { start: "10:00", end: "19:00", breakMinutes: 0 },
        { start: "10:00:00", end: "19:00", breakMinutes: 30 }
      )
    ).toBe(false);
    expect(
      dutyEqual(
        { start: "10:00", end: "19:00", breakMinutes: 0 },
        { start: "10:30", end: "19:00", breakMinutes: 0 }
      )
    ).toBe(false);
    expect(dutyEqual(null, null)).toBe(true);
    expect(dutyEqual(null, { start: "10:00", end: "19:00", breakMinutes: 0 })).toBe(false);
  });

  it("formats range and length", () => {
    const d: Duty = { start: "10:00", end: "19:00", breakMinutes: 0 };
    expect(fmtDuty(d)).toBe("10:00 – 19:00");
    expect(dutyLengthLabel(d)).toBe("9h");
    expect(dutyLengthLabel({ start: "10:00", end: "18:30", breakMinutes: 0 })).toBe("8h 30m");
    expect(dutyLengthLabel({ start: "10:00", end: "10:30", breakMinutes: 0 })).toBe("30m");
    expect(fmtDuty(null)).toBe("—");
    expect(dutyLengthLabel(null)).toBe("");
  });
});

describe("bizDutyFromMeta", () => {
  it("valid biz_open/biz_close → shop fallback duty", () => {
    expect(
      bizDutyFromMeta([
        { meta_field: "biz_open", meta_value: "09:30" },
        { meta_field: "biz_close", meta_value: "18:30" },
      ])
    ).toEqual({ start: "09:30", end: "18:30", breakMinutes: 0 });
  });

  it("missing / invalid / identical hours → DEFAULT_DUTY", () => {
    expect(bizDutyFromMeta(null)).toEqual(DEFAULT_DUTY);
    expect(bizDutyFromMeta([])).toEqual(DEFAULT_DUTY);
    expect(
      bizDutyFromMeta([
        { meta_field: "biz_open", meta_value: "25:00" },
        { meta_field: "biz_close", meta_value: "18:00" },
      ])
    ).toEqual(DEFAULT_DUTY);
    expect(
      bizDutyFromMeta([
        { meta_field: "biz_open", meta_value: "10:00" },
        { meta_field: "biz_close", meta_value: "10:00" },
      ])
    ).toEqual(DEFAULT_DUTY);
  });
});
