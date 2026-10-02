import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import DailyAttendance from "./DailyAttendance";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Vikram: custom duty schedule row (11:00–19:00). Ravi: koi row nahi →
// system_info biz hours fallback (09:30–18:30). Dono ke naam ke neeche duty.
const db = vi.hoisted(() => ({
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
    attendance_list: [],
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
}));

vi.mock("@/lib/supabase", () => {
  const makeQuery = (rows: unknown[]) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    ["select", "eq", "gte", "lte", "order", "in", "update", "upsert", "insert"].forEach((m) => {
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
  useSearchParams: () => new URLSearchParams(),
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
});
