import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LiveClock from "./LiveClock";

// Regression lock (mobile Chrome flicker): fixed clock pill par har second
// seconds text + `animate-pulse` repaint karte the, jisse Android Chrome
// compositor neeche ka content stale paint kar deta tha. Minute mode me
// seconds nahi hone chahiye aur pulse dot bhi nahi.
describe("LiveClock — mobile fixed pill modes", () => {
  it("default mode: seconds + pulse dot dikhte hain", () => {
    const { container } = render(<LiveClock />);
    expect(container.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("minute mode (showSeconds=false, pulse=false): seconds/pulse nahi", () => {
    const { container } = render(<LiveClock showSeconds={false} pulse={false} />);
    expect(container.textContent).toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);
    expect(container.textContent).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
