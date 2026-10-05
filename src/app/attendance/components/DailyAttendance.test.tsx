import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import DailyAttendance from "./DailyAttendance";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Vikram: custom duty schedule row (11:00–19:00). Ravi: koi row nahi →
// system_info biz hours fallback (09:30–18:30). Dono ke naam ke neeche duty.
// Kal ka din: check-in hai par checkout NAHI (§9 gap — auto hours/out).
//
// Clock FIX: staff view hamesha selectedDate = today leta hai, aur §9 ka
// auto-close tab lagta hai jab now >= duty_end + grace (19:15). Real clock se
// ye suite sirf 19:15–24:00 IST ke beech pass hota tha — midnight ke baad fail
// (now 00:xx → Rule 4 live, auto nahi). Isliye dateUtils ka todayIST/nowISTTime
// mock karke clock fix rakha: today = 2026-10-05, abhi = 22:00 (duty_end ke baad).
const db = vi.hoisted(() => {
  const yesterday = "2026-10-04"; // fixed today (2026-10-05) se ek din pehle
  return {
    yesterday,
    tables: {
      mechanic_list: [
        {
          id: 7,
          firstname: "Vikram",
          lastname: "Kumar",
          designation: "Senior",
          image_path: null,
          status: 1,
        },
        {
          id: 8,
          firstname: "Ravi",
          lastname: "Sharma",
          designation: "Junior",
          image_path: null,
          status: 1,
        },
      ],
      attendance_list: [
        // Kal open din: in 10:05, out NULL → engine auto @ duty_end 19:00
        {
          mechanic_id: 7,
          curr_date: yesterday,
          status: 1,
          time_in: "10:05:00",
          time_out: null,
        },
      ],
      staff_duty_schedule: [
        {
          mechanic_id: 7,
          duty_start: "11:00:00",
          duty_end: "19:00:00",
          break_minutes: 0,
          effective_from: "2026-01-01",
        },
      ],
      system_info: [
        { meta_field: "biz_open", meta_value: "09:30" },
        { meta_field: "biz_close", meta_value: "18:30" },
      ],
    },
  };
});

// Fixed clock (upar comment dekho) — baaki exports dateUtils ke as-is.
vi.mock("@/lib/dateUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dateUtils")>();
  return { ...actual, todayIST: () => "2026-10-05", nowISTTime: () => "22:00:00" };
});

vi.mock("@/lib/supabase", () => {
  const makeQuery = (rows: unknown[]) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    [
      "select",
      "eq",
      "gte",
      "lte",
      "order",
      "in",
      "update",
      "upsert",
      "insert",
      "lt",
      "is",
      "not",
    ].forEach((m) => {
      q[m] = chain;
    });
    q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    q.then = (onFulfilled: unknown, onRejected: unknown) =>
      Promise.resolve({ data: rows, error: null }).then(onFulfilled as never, onRejected as never);
    return q;
  };
  return {
    supabase: {
      from: (table: string) => makeQuery((db.tables as Record<string, unknown[]>)[table] ?? []),
    },
  };
});

vi.mock("next/navigation", () => ({
  // Selected date = kal (open checkout fixture wahi din hai)
  useSearchParams: () => new URLSearchParams(`date=${db.yesterday}`),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) => (
    <span data-testid="next-img" data-src={String(src)} aria-label={alt} />
  ),
}));

vi.mock("@/lib/viewOnly", () => ({
  useViewOnly: () => ({ viewOnly: false }),
  CanWrite: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/geofence", () => ({
  verifyAttendanceLocation: vi.fn(async () => ({
    ok: true,
    reason: "ok" as const,
    distanceM: 10,
    coords: { lat: 0, lng: 0 },
  })),
  geoErrorMessage: () => "",
}));

describe("DailyAttendance — staff naam ke sath duty time", () => {
  it("custom schedule wale staff ki duty aur fallback (biz hours) duty dono dikhti hai", async () => {
    render(<DailyAttendance userRole="admin" mechanicId={null} />);

    // Vikram — staff_duty_schedule se 11:00–19:00 (desktop row + mobile card = 2 jagah)
    expect(await screen.findAllByText(/Duty 11:00 – 19:00/)).not.toHaveLength(0);
    // Ravi — koi row nahi → system_info biz hours 09:30–18:30 fallback
    expect(screen.getAllByText(/Duty 09:30 – 18:30/).length).toBeGreaterThan(0);
  });

  it("§9 gap: checkout nahi (kal) → Hours auto-derived + Out '(auto)' — dono views", async () => {
    render(<DailyAttendance userRole="staff" mechanicId={null} />);

    // Vikram: duty 11:00–19:00, in 10:05, kal ka din → auto out 19:00,
    // worked = 10:05 → 19:00 = 535m = "8h 55m" (desktop table + mobile card)
    expect(await screen.findAllByText("8h 55m")).not.toHaveLength(0);
    // Out: DB NULL → engine ka auto-checkout time + (auto) marker
    expect(screen.getAllByText(/7:00 PM \(auto\)/).length).toBeGreaterThan(0);
    // Ravi: koi attendance row hi nahi → "—" (as-is)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("naam ke neeche mahine ka Total working hours (MTD) dikhta hai", async () => {
    render(<DailyAttendance userRole="staff" mechanicId={null} />);

    // MTD range = selected month → aaj: sirf kal ka row (10:05 → auto 19:00 = 535m)
    const totals = await screen.findAllByTitle(/Mahine ki total working hours/);
    expect(totals.length).toBeGreaterThan(0);
    totals.forEach((t) => {
      expect(t).toHaveTextContent("Total 8h 55m");
      expect(t.getAttribute("title")).toContain("535 min");
    });
  });
});
