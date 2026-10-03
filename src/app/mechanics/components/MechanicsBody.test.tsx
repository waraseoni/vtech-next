import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import MechanicsBody from "./MechanicsBody";
import type { Mechanic } from "./helpers";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Staff ki ek hi row (Edit → duty section). dutyRows = staff_duty_schedule se
// aane wali history (append-only, effective_from ke saath).
const fx = vi.hoisted(() => ({
  dutyRows: [] as Record<string, unknown>[],
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

vi.mock("@/lib/supabase", () => {
  const METHODS = [
    "select",
    "eq",
    "neq",
    "in",
    "order",
    "insert",
    "update",
    "upsert",
    "delete",
    "single",
    "limit",
    "gte",
    "lte",
  ];

  const resultFor = (table: string, ops: string[]) => {
    if (table === "system_info") {
      return {
        data: [
          { meta_field: "biz_open", meta_value: "10:00" },
          { meta_field: "biz_close", meta_value: "19:00" },
        ],
        error: null,
      };
    }
    if (table === "staff_duty_schedule") {
      if (ops.includes("upsert")) return { data: null, error: null };
      return { data: fx.dutyRows, error: null };
    }
    if (table === "mechanic_list" && ops.includes("insert")) {
      return { data: { id: 42 }, error: null };
    }
    return { data: [], error: null };
  };

  const makeBuilder = (table: string) => {
    const ops: string[] = [];
    const b: Record<string, unknown> = {};
    for (const m of METHODS) {
      b[m] = (...args: unknown[]) => {
        ops.push(m);
        fx.calls.push({ table, method: m, args });
        return b;
      };
    }
    b.then = (onFulfilled: unknown, onRejected: unknown) =>
      Promise.resolve(resultFor(table, ops)).then(onFulfilled as never, onRejected as never);
    return b;
  };

  return { supabase: { from: (table: string) => makeBuilder(table) } };
});

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: unknown; alt?: string }) => (
    <span data-testid="next-img" data-src={String(src)} aria-label={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/activity", () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  default: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const MECHANIC: Mechanic = {
  id: 7,
  firstname: "Vikram",
  middlename: null,
  lastname: "Kumar",
  contact: "9876543210",
  designation: "Mechanic",
  daily_salary: 500,
  commission_percent: 0,
  status: 1,
  delete_flag: 0,
  image_path: null,
};

const HISTORY_ROW = {
  id: 1,
  mechanic_id: 7,
  duty_start: "10:00:00",
  duty_end: "19:00:00",
  break_minutes: 0,
  effective_from: "2000-01-01",
};

const renderBody = (userRole: string) =>
  render(<MechanicsBody mechanics={[MECHANIC]} userRole={userRole} />);

const clickEdit = () => fireEvent.click(screen.getByRole("button", { name: "Edit Vikram Kumar" }));

beforeEach(() => {
  fx.dutyRows = [];
  fx.calls = [];
});

describe("MechanicsBody — duty time (staff_duty_schedule)", () => {
  it("admin ko duty inputs + history timeline dikhta hai (current row loaded)", async () => {
    fx.dutyRows = [{ ...HISTORY_ROW, duty_start: "11:00:00", duty_end: "20:00:00" }];
    renderBody("admin");

    clickEdit();
    const from = (await screen.findByLabelText("Duty From")) as HTMLInputElement;
    const to = screen.getByLabelText("Duty To") as HTMLInputElement;

    // Current duty (schedule se) form me aa jati hai — PostgREST "HH:MM:SS" → "HH:MM"
    await waitFor(() => expect(from).toHaveValue("11:00"));
    expect(to).toHaveValue("20:00");
    expect(screen.getByText("9h")).toBeInTheDocument();

    // History timeline: entry + Current badge + duration + effective_from date
    expect(await screen.findByText("Duty History")).toBeInTheDocument();
    expect(screen.getByText("11:00 – 20:00")).toBeInTheDocument();
    const currentRow = screen.getByText("Current").closest("div");
    expect(currentRow).toHaveTextContent("11:00 – 20:00");
    expect(currentRow).toHaveTextContent(/\d{4}/);
  });

  it("staff ke liye duty read-only hai (inputs nahi, history dikhti hai)", async () => {
    fx.dutyRows = [HISTORY_ROW];
    renderBody("staff");

    clickEdit();
    expect(await screen.findByText("Sirf Admin duty badal sakta hai.")).toBeInTheDocument();

    // Read-only duty + history dono dikhte hain, par koi input control nahi
    expect(screen.queryByLabelText("Duty From")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Duty To")).not.toBeInTheDocument();
    expect(screen.getByText("Duty History")).toBeInTheDocument();
    expect(screen.getAllByText("10:00 – 19:00").length).toBeGreaterThan(0);
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("admin duty badal kar Update kare → staff_duty_schedule par UPSERT jata hai", async () => {
    const user = userEvent.setup();
    fx.dutyRows = [HISTORY_ROW];
    renderBody("admin");

    clickEdit();
    const from = (await screen.findByLabelText("Duty From")) as HTMLInputElement;
    await waitFor(() => expect(from).toHaveValue("10:00"));

    fireEvent.change(from, { target: { value: "09:30" } });
    fireEvent.change(screen.getByLabelText("Duty To"), { target: { value: "17:30" } });
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const upsert = fx.calls.find(
        (c) => c.table === "staff_duty_schedule" && c.method === "upsert"
      );
      expect(upsert).toBeTruthy();
      expect(upsert!.args[0]).toMatchObject({
        mechanic_id: 7,
        duty_start: "09:30",
        duty_end: "17:30",
        break_minutes: 0,
      });
      expect(String((upsert!.args[0] as { effective_from: string }).effective_from)).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );
    });

    // Modal band ho jata hai (save success)
    await waitFor(() => expect(screen.queryByLabelText("Duty From")).not.toBeInTheDocument());
  });

  it("bina duty badle Update → koi duty UPSERT nahi (salary-history pattern)", async () => {
    const user = userEvent.setup();
    fx.dutyRows = [HISTORY_ROW];
    renderBody("admin");

    clickEdit();
    const from = (await screen.findByLabelText("Duty From")) as HTMLInputElement;
    await waitFor(() => expect(from).toHaveValue("10:00"));

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(screen.queryByLabelText("Duty From")).not.toBeInTheDocument());
    expect(fx.calls.some((c) => c.table === "staff_duty_schedule" && c.method === "upsert")).toBe(
      false
    );
  });

  it("break input: break-only change bhi UPSERT jata hai (break_minutes 30)", async () => {
    const user = userEvent.setup();
    fx.dutyRows = [HISTORY_ROW];
    renderBody("admin");

    clickEdit();
    const from = (await screen.findByLabelText("Duty From")) as HTMLInputElement;
    await waitFor(() => expect(from).toHaveValue("10:00"));

    // Badge = net length (span − break): 9h → 8h 30m
    fireEvent.change(screen.getByLabelText("Break (min)"), { target: { value: "30" } });
    expect(screen.getByText("8h 30m")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => {
      const upsert = fx.calls.find(
        (c) => c.table === "staff_duty_schedule" && c.method === "upsert"
      );
      expect(upsert).toBeTruthy();
      expect(upsert!.args[0]).toMatchObject({
        mechanic_id: 7,
        duty_start: "10:00",
        duty_end: "19:00",
        break_minutes: 30,
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Duty From")).not.toBeInTheDocument());
  });
});
