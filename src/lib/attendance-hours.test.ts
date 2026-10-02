import { describe, it, expect } from "vitest";
import {
  AUTO_CLOSE_GRACE_MIN,
  computeDay,
  fmtMins,
  nowIST,
  type AttRow,
  type NowInfo,
} from "@/lib/attendance-hours";
import type { Duty } from "@/lib/duty";

const DAY_DUTY: Duty = { start: "10:00", end: "20:00", breakMinutes: 0 }; // 600 min
const NIGHT_DUTY: Duty = { start: "22:00", end: "06:00", breakMinutes: 0 }; // 480 min

const row = (over: Partial<AttRow> = {}): AttRow => ({
  curr_date: "2026-10-01",
  status: 1,
  time_in: "10:05:00",
  time_out: null,
  ...over,
});

const now = (date: string, hhmm: string): NowInfo => ({
  date,
  mins: Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)),
});

describe("computeDay — rule 1: real time_out hamesha jeetta hai", () => {
  it("real checkout: worked + OT (late out) + no auto", () => {
    const c = computeDay(row({ time_out: "21:30:00" }), DAY_DUTY, now("2026-10-02", "22:00"));
    expect(c.effOut).toBe("21:30");
    expect(c.isAutoClosed).toBe(false);
    expect(c.workedMin).toBe(685); // 10:05 → 21:30
    expect(c.dutyMin).toBe(600);
    expect(c.otMin).toBe(85); // actual late checkout par hi OT
    expect(c.earlyOutMin).toBe(0);
    expect(c.working).toBe(false);
  });

  it("early checkout → earlyOutMin, OT 0", () => {
    const c = computeDay(row({ time_out: "18:00:00" }), DAY_DUTY, now("2026-10-02", "22:00"));
    expect(c.workedMin).toBe(475);
    expect(c.otMin).toBe(0);
    expect(c.earlyOutMin).toBe(120); // 20:00 − 18:00
  });

  it("auto-checkout rule override NAHI karta chahe din kitna bhi purana ho", () => {
    const c = computeDay(row({ time_out: "12:00:00" }), DAY_DUTY, now("2026-12-31", "23:59"));
    expect(c.effOut).toBe("12:00");
    expect(c.isAutoClosed).toBe(false);
    expect(c.workedMin).toBe(115);
  });
});

describe("computeDay — rule 3: past day / duty end + grace → auto-checkout", () => {
  it("purana din, time_out nahi → duty_end auto, worked = duty, OT 0", () => {
    const c = computeDay(row({ time_in: "10:05:00" }), DAY_DUTY, now("2026-10-05", "12:00"));
    expect(c.effOut).toBe("20:00");
    expect(c.isAutoClosed).toBe(true);
    expect(c.workedMin).toBe(595); // 10:05 → 20:00
    expect(c.otMin).toBe(0); // auto = fake OT band
    expect(c.earlyOutMin).toBe(0);
    expect(c.working).toBe(false);
  });

  it("aaj hi, duty_end + grace ke baad → auto", () => {
    const grace = AUTO_CLOSE_GRACE_MIN;
    // duty end 20:00 → 20:14 (grace se pehle) abhi working
    const live = computeDay(row(), DAY_DUTY, now("2026-10-01", "20:14"));
    expect(live.effOut).toBeNull();
    expect(live.working).toBe(true);
    expect(live.isAutoClosed).toBe(false);
    expect(live.workedMin).toBe(609); // 10:05 → 20:14 (live)

    // 20:15 (grace boundary) → auto
    const done = computeDay(row(), DAY_DUTY, now("2026-10-01", "20:15"));
    expect(done.isAutoClosed).toBe(true);
    expect(done.effOut).toBe("20:00");
    expect(done.otMin).toBe(0);
    expect(grace).toBe(15);
  });

  it("duty ke beech me (kal ke date par, subah) → past-day auto hi rahega", () => {
    const c = computeDay(row({ time_in: "23:30:00" }), NIGHT_DUTY, now("2026-10-03", "09:00"));
    expect(c.isAutoClosed).toBe(true);
    expect(c.effOut).toBe("06:00");
    expect(c.workedMin).toBe(390); // 23:30 → 06:00 (wrap)
    expect(c.otMin).toBe(0);
  });
});

describe("computeDay — rule 4: abhi duty chal rahi hai → live", () => {
  it("aaj, duty khatam nahi hui → effOut null, working, live minutes", () => {
    const c = computeDay(row({ time_in: "10:00:00" }), DAY_DUTY, now("2026-10-01", "14:30"));
    expect(c.effOut).toBeNull();
    expect(c.working).toBe(true);
    expect(c.isAutoClosed).toBe(false);
    expect(c.workedMin).toBe(270);
    expect(c.otMin).toBe(0);
  });

  it("future date (kal) → kuch nahi (clamped 0)", () => {
    const c = computeDay(row({ time_in: "10:00:00" }), DAY_DUTY, now("2026-09-30", "12:00"));
    expect(c.workedMin).toBe(0);
    expect(c.effOut).toBeNull();
  });
});

describe("computeDay — rule 2: time_in hi nahi (manual status row)", () => {
  it("sab zero/null — status as-is rehta hai", () => {
    const c = computeDay(
      row({ time_in: null, time_out: null, status: 2 }),
      DAY_DUTY,
      now("2026-10-05", "12:00")
    );
    expect(c.hasTimeIn).toBe(false);
    expect(c.effOut).toBeNull();
    expect(c.workedMin).toBe(0);
    expect(c.isAutoClosed).toBe(false);
    expect(c.dutyMin).toBe(600); // dutyMin phir bhi milta hai (salary ke liye)
  });
});

describe("computeDay — overnight duty (22:00 → 06:00)", () => {
  it("real checkout next day → wrap + OT", () => {
    const c = computeDay(
      row({ time_in: "22:15:00", time_out: "06:30:00" }),
      NIGHT_DUTY,
      now("2026-10-03", "09:00")
    );
    expect(c.effOut).toBe("06:30");
    expect(c.workedMin).toBe(495); // 22:15 → 06:30
    expect(c.dutyMin).toBe(480);
    expect(c.otMin).toBe(15);
    expect(c.isAutoClosed).toBe(false);
  });

  it("purana din, checkout nahi → duty_end (06:00) auto", () => {
    const c = computeDay(row({ time_in: "22:15:00" }), NIGHT_DUTY, now("2026-10-05", "12:00"));
    expect(c.isAutoClosed).toBe(true);
    expect(c.effOut).toBe("06:00");
    expect(c.workedMin).toBe(465); // 22:15 → 06:00
    expect(c.otMin).toBe(0);
  });

  it("duty ke next-day subah tak live rehta hai (grace ke pehle)", () => {
    // duty end 06:00 (+1440 = 1800 offset) → 06:14 par abhi working
    const c = computeDay(row({ time_in: "22:15:00" }), NIGHT_DUTY, now("2026-10-02", "06:14"));
    expect(c.working).toBe(true);
    expect(c.effOut).toBeNull();
    expect(c.workedMin).toBe(479); // 22:15 → 06:14
  });
});

describe("fmtMins", () => {
  it("Xh Ym format + dash for zero/invalid", () => {
    expect(fmtMins(344)).toBe("5h 44m");
    expect(fmtMins(600)).toBe("10h 0m"); // hoursBetweenIST ke saath consistent
    expect(fmtMins(45)).toBe("0h 45m"); // hoursBetweenIST format exactly same
    expect(fmtMins(0)).toBe("—");
    expect(fmtMins(-5)).toBe("—");
    expect(fmtMins(NaN)).toBe("—");
  });
});

describe("nowIST", () => {
  it("aaj ka IST date + valid minutes deta hai", () => {
    const n = nowIST();
    expect(n.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.mins).toBeGreaterThanOrEqual(0);
    expect(n.mins).toBeLessThan(1440);
  });
});
