import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationShare } from "./location-share";

const shareText = [
  "V-Technologies",
  "F4 Hotel Plaza, Marhatal, Jabalpur",
  "GPS: 23.167934, 79.935528",
  "Map: https://www.google.com/maps/search/?api=1&query=23.167934%2C%2079.935528",
].join("\n");

const props = {
  shareText,
  directionsHref: "https://www.google.com/maps/dir/?api=1&destination=23.167934%2C%2079.935528",
  mapHref: "https://www.google.com/maps/search/?api=1&query=23.167934%2C%2079.935528",
};

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
});

describe("LocationShare", () => {
  it("asks the recipient and sends to a typed WhatsApp number", async () => {
    const user = userEvent.setup();
    render(<LocationShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Location share karein");
    expect(dialog).toHaveTextContent("Saved contact par bhejein");

    const send = screen.getByRole("button", { name: /WhatsApp par bhejein/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/WhatsApp number/i), "9876543210");
    expect(send).toBeEnabled();
    await user.click(send);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/919876543210?text="),
      "_blank",
      "noopener,noreferrer"
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the send button disabled for an invalid number", async () => {
    const user = userEvent.setup();
    render(<LocationShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.type(screen.getByLabelText(/WhatsApp number/i), "12345");

    expect(screen.getByRole("button", { name: /WhatsApp par bhejein/i })).toBeDisabled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("uses the native share sheet for saved contacts", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: shareMock });
    const user = userEvent.setup();
    render(<LocationShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: /Saved contact par bhejein/i }));

    await waitFor(() =>
      expect(shareMock).toHaveBeenCalledWith({ title: "Office location", text: shareText })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to the WhatsApp chooser when native share is unavailable", async () => {
    const user = userEvent.setup();
    render(<LocationShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: /Saved contact par bhejein/i }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/?text="),
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("copies the full location text and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<LocationShare {...props} />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: /^Copy$/i }));
    expect(await navigator.clipboard.readText()).toBe(shareText);
    expect(await screen.findByRole("button", { name: /Copied/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
