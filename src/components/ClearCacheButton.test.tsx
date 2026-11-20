import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { hardReload } = vi.hoisted(() => ({ hardReload: vi.fn(async () => {}) }));
vi.mock("@/lib/hardRefresh", () => ({ hardReload }));
vi.mock("@/lib/toast", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

import ClearCacheButton from "./ClearCacheButton";

describe("ClearCacheButton", () => {
  afterEach(() => vi.clearAllMocks());

  it("asks for confirmation before touching the cache", () => {
    const onBeforeClear = vi.fn();
    render(<ClearCacheButton onBeforeClear={onBeforeClear} />);

    fireEvent.click(screen.getByRole("button", { name: /clear cache/i }));

    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(hardReload).not.toHaveBeenCalled();
    expect(onBeforeClear).not.toHaveBeenCalled();
  });

  it("Cancel aborts without reload", () => {
    render(<ClearCacheButton compact />);

    fireEvent.click(screen.getByRole("button", { name: /clear cache/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /clear cache/i })).toBeInTheDocument();
    expect(hardReload).not.toHaveBeenCalled();
  });

  it("Confirm clears cache and reloads", async () => {
    const onBeforeClear = vi.fn();
    render(<ClearCacheButton compact onBeforeClear={onBeforeClear} />);

    fireEvent.click(screen.getByRole("button", { name: /clear cache/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(hardReload).toHaveBeenCalledOnce());
    expect(onBeforeClear).toHaveBeenCalledOnce();
  });
});
