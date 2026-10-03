import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import MonthlyReport from "./MonthlyReport";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Month fixed = 2026-10. Day 1 = Present (with times), day 3 = Absent (no times).
const db = vi.hoisted(() => ({
  tables: {
    mechanic_list: [{ id: 7, firstname: "Vikram", lastname: "Kumar", image_path: null, status: 1 }],
    attendance_list: [
      {
        id: 11,
        mechanic_id: 7,
        curr_date: "2026-10-01",
        status: 1,
        time_in: "12:16:00",
        time_out: "18:00:00",
      },
      { id: 13, mechanic_id: 7, curr_date: "2026-10-03", status: 2, time_in: null, time_out: null },
      // P3: purana din + check-in + checkout nahi → "Close pending" button ka fixture
      {
        id: 14,
        mechanic_id: 7,
        curr_date: "2026-10-04",
        status: 1,
        time_in: "10:05:00",
        time_out: null,
      },
    ],
    staff_duty_schedule: [] as Array<{
      mechanic_id: number;
      duty_start: string;
      duty_end: string;
      break_minutes: number;
      effective_from: string;
    }>,
    system_info: [],
  },
}));

vi.mock("@/lib/supabase", () => {
  const makeQuery = (rows: unknown[]) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    ["select", "eq", "gte", "lte", "order", "in", "update", "lt", "is", "not"].forEach((m) => {
      q[m] = chain;
    });
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

vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams("view=report&month=2026-10"),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) => (
    <span data-testid="next-img" data-src={String(src)} aria-label={alt} />
  ),
}));

vi.mock("./AttendanceModal", () => ({
  default: ({ mechanicName, date }: { mechanicName: string; date: string }) => (
    <div data-testid="edit-modal">
      {mechanicName} {date}
    </div>
  ),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const mobileRoot = () => document.querySelector("div.md\\:hidden") as HTMLElement;
const cell = (name: RegExp) => within(mobileRoot()).getByRole("button", { name });
// Desktop + mobile dono same aria-label rakhte hain → hamesha mobile scope me
// query karo (warna "found multiple elements").
const findCell = (name: RegExp) =>
  waitFor(() => within(mobileRoot()).getByRole("button", { name }));

const renderReport = (userRole: "admin" | "staff" | "developer") =>
  render(<MonthlyReport userRole={userRole} mechanicId={7} />);

describe("MonthlyReport compact cells + detail tooltip", () => {
  // Clock lock: warna status (future/past) real date par depend karta.
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-05T12:00:00+05:30"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("cell me date kabhi hide nahi hota — saath me hours ya status letter", async () => {
    renderReport("admin");

    // Day 1 (Present + dono time) → date + WORKED HOURS (salary-relevant)
    const present = await findCell(/^1 Present/);
    expect(present).toHaveTextContent("5h44m");

    // Day 3 (Absent, koi time nahi) → date + status letter
    const absent = cell(/^3 Absent/);
    expect(absent).toHaveTextContent("3A");

    // Upcoming (status 0) → sirf date, koi letter/hours nahi
    const upcoming = cell(/^31 Upcoming/);
    expect(upcoming).toHaveTextContent("31");
    expect(upcoming).not.toHaveTextContent(/[PHA]$/);

    // Naam ke sath duty time (desktop row + mobile card dono me render hote hain)
    expect(screen.getAllByText(/Duty 10:00 – 20:00/).length).toBeGreaterThan(0);
  });

  it("hover se tooltip khulta hai — date, status, In, Out, Total", async () => {
    renderReport("admin");

    const present = await findCell(/^1 Present/);
    fireEvent.mouseOver(present);

    const tip = screen.getByTestId("day-tip");
    expect(tip).toHaveTextContent(/01 Oct, 2026/);
    expect(tip).toHaveTextContent("Present");
    expect(tip).toHaveTextContent("12:16 PM");
    expect(tip).toHaveTextContent("6:00 PM");
    expect(tip).toHaveTextContent("5h 44m");
    // Tooltip me Duty TIME (range) + lambai
    expect(tip).toHaveTextContent("10:00 – 20:00");

    // mouse-leave = band (hover-tip unpinned hota hai)
    fireEvent.mouseOut(present);
    await waitFor(() => expect(screen.queryByTestId("day-tip")).not.toBeInTheDocument());
  });

  it("click = pinned tooltip; admin ko Edit milta hai jo modal kholta hai", async () => {
    renderReport("admin");

    const present = await findCell(/^1 Present/);
    fireEvent.click(present);

    const tip = screen.getByTestId("day-tip");
    expect(within(tip).getByRole("button", { name: /Edit/ })).toBeInTheDocument();
    // Abhi tak modal nahi khula
    expect(screen.queryByTestId("edit-modal")).not.toBeInTheDocument();

    fireEvent.click(within(tip).getByRole("button", { name: /Edit/ }));
    expect(screen.getByTestId("edit-modal")).toHaveTextContent("Vikram Kumar 2026-10-01");
  });

  it("staff ke liye Edit nahi, par tap/hover se detail dikhta hai", async () => {
    renderReport("staff");

    const present = await findCell(/^1 Present/);
    fireEvent.click(present);

    const tip = screen.getByTestId("day-tip");
    expect(tip).toHaveTextContent(/01 Oct, 2026/);
    expect(tip).toHaveTextContent("12:16 PM");
    expect(within(tip).queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-modal")).not.toBeInTheDocument();
  });

  it("pinned tooltip Esc se band hota hai", async () => {
    renderReport("admin");

    const present = await findCell(/^1 Present/);
    fireEvent.click(present);
    expect(screen.getByTestId("day-tip")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("day-tip")).not.toBeInTheDocument();
  });

  it("purane pending din par admin ko 'Close pending' button milta hai — confirm ke baad close", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { toast } = await import("@/lib/toast");
    renderReport("admin");

    const btn = await screen.findByRole("button", { name: /Close 1 pending/i });
    fireEvent.click(btn);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("1 pending day(s) closed"))
    );
    confirmSpy.mockRestore();
  });

  it("staff ko 'Close pending' button dikh hi nahi", async () => {
    renderReport("staff");
    await findCell(/^1 Present/);
    expect(screen.queryByRole("button", { name: /Close \d+ pending/i })).not.toBeInTheDocument();
  });

  it("§9: tooltip Duty = current/DB duty + 'us din' note jab day purani duty par ho", async () => {
    // Mid-month change (eff Oct 3): day1 purani duty (DEFAULT) par,
    // label/tooltip aaj (fake clock = Oct 5) basis par → DB/modal match.
    db.tables.staff_duty_schedule.push({
      mechanic_id: 7,
      duty_start: "11:00:00",
      duty_end: "19:00:00",
      break_minutes: 0,
      effective_from: "2026-10-03",
    });
    try {
      renderReport("admin");
      const day1 = await findCell(/^1 Present/);
      fireEvent.click(day1);

      const tip = screen.getByTestId("day-tip");
      // Current duty (labelBasis) hi tooltip me dikhti hai — DB se match
      expect(tip).toHaveTextContent("11:00 – 19:00");
      // Us din ki purani duty sirf note me
      expect(tip).toHaveTextContent("us din 10:00 – 20:00");
      // Naam ke neeche label bhi wahi (donom me parity)
      expect(screen.getAllByText(/Duty 11:00 – 19:00/).length).toBeGreaterThan(0);
    } finally {
      db.tables.staff_duty_schedule.pop();
    }
  });

  it("naam ke neeche mahine ka Total working hours (MTD minutes) dikhta hai", async () => {
    renderReport("admin");
    await findCell(/^1 Present/);

    // Day1: 12:16→18:00 = 344m · Day4: 10:05→auto 20:00 = 595m → 939m = 15h 39m
    const totals = await screen.findAllByTitle(/Mahine ki total working hours/);
    expect(totals.length).toBeGreaterThan(0);
    totals.forEach((t) => {
      expect(t).toHaveTextContent("Total 15h 39m");
      expect(t.getAttribute("title")).toContain("939 min");
    });
  });
});
