import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DeferredMount from "./DeferredMount";

let lastCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds = [];
  constructor(cb: IntersectionObserverCallback) {
    lastCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalIO = globalThis.IntersectionObserver;

beforeEach(() => {
  lastCallback = null;
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = originalIO;
  vi.useRealTimers();
});

describe("DeferredMount", () => {
  it("defers children until the wrapper intersects, keeping reserved height", () => {
    const { container } = render(
      <DeferredMount minHeightClassName="min-h-[200px]">
        <p>chart</p>
      </DeferredMount>
    );

    expect(screen.queryByText("chart")).toBeNull();
    expect(container.firstElementChild?.className).toContain("min-h-[200px]");

    act(() => {
      lastCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toContain("min-h-[200px]");
  });

  it("mounts anyway after the fallback timeout (observer never fires)", () => {
    vi.useFakeTimers();
    render(
      <DeferredMount fallbackMs={2500}>
        <p>chart</p>
      </DeferredMount>
    );
    expect(screen.queryByText("chart")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByText("chart")).toBeInTheDocument();
  });

  it("mounts immediately when IntersectionObserver is unavailable", () => {
    // @ts-expect-error — deliberate removal for the legacy-browser path
    globalThis.IntersectionObserver = undefined;
    render(
      <DeferredMount>
        <p>chart</p>
      </DeferredMount>
    );
    expect(screen.getByText("chart")).toBeInTheDocument();
  });
});
