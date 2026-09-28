import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

// viewOnly.tsx module-level par @/lib/supabase import karta hai (env vars
// test me nahi hote) — mock karo, jaise viewOnly.test.ts karta hai.
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  getCachedUser: vi.fn(),
}));

// Geofence notifier capture karo — yehi ek single entry-point hai.
const notify = vi.fn();
vi.mock("@/lib/writeGuard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/writeGuard")>("@/lib/writeGuard");
  return { ...actual, notifyWriteBlocked: (msg?: string) => notify(msg) };
});

import { CanWrite, ViewOnlyContext, type ViewOnlyState } from "./viewOnly";

const state = (viewOnly: boolean): ViewOnlyState => ({
  viewOnly,
  status: viewOnly ? "outside" : "inside",
  distanceM: viewOnly ? 120 : null,
  needsConfig: false,
  permit: null,
  checkedAt: Date.now(),
  checking: false,
  refresh: () => {},
});

function renderGuarded(viewOnly: boolean, message?: string) {
  return render(
    <ViewOnlyContext.Provider value={state(viewOnly)}>
      <CanWrite message={message}>
        <button type="button">Save</button>
      </CanWrite>
    </ViewOnlyContext.Provider>
  );
}

beforeEach(() => notify.mockClear());

describe("CanWrite — single toast per action", () => {
  it("viewOnly me click → EXACTLY ek notify (throttle + dedup ka source)", () => {
    const { getByText } = renderGuarded(true);
    fireEvent.click(getByText("Save"));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("default message pass nahi hota (canonical message use ho — taaki sab sources collapse)", () => {
    const { getByText } = renderGuarded(true);
    fireEvent.click(getByText("Save"));
    // `undefined` jaata hai → notifyWriteBlocked() apna writeBlockedMessage()
    // use karta hai → CanWrite/useWriteGuard/gate/call-sites sab SAME text.
    expect(notify).toHaveBeenCalledWith(undefined);
  });

  it("custom message forward hota hai (jab reason genuinely alag ho)", () => {
    const { getByText } = renderGuarded(true, "Date change sirf office ke andar se possible hai.");
    fireEvent.click(getByText("Save"));
    expect(notify).toHaveBeenCalledWith("Date change sirf office ke andar se possible hai.");
  });

  it("click ka default action block hota hai (form submit nahi hona chahiye)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { getByText } = render(
      <ViewOnlyContext.Provider value={state(true)}>
        <CanWrite>
          <form onSubmit={onSubmit}>
            <button type="submit">Save</button>
          </form>
        </CanWrite>
      </ViewOnlyContext.Provider>
    );
    fireEvent.click(getByText("Save"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("viewOnly false → kuch block nahi, koi toast nahi", () => {
    const { getByText } = renderGuarded(false);
    fireEvent.click(getByText("Save"));
    expect(notify).not.toHaveBeenCalled();
  });

  it("viewOnly me children render rehte hain (display:contents — layout safe)", () => {
    const { container } = renderGuarded(true);
    expect(container.textContent).toContain("Save");
  });
});
