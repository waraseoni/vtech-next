import { describe, expect, it } from "vitest";
import { cameraErrorMessage, cameraUnsupportedReason, isCameraSupported } from "./cameraSupport";

/**
 * Barcode scanner ke error messages.
 *
 * `NotAllowedError` etc. par direct mapping pehle se thi. Naya case: fallback
 * engine (html5-qrcode) plain `Error` throw karta hai jisme asli DOMException
 * name message ke andar hota hai — tab bhi friendly Hindi text milna chahiye.
 */
describe("cameraErrorMessage", () => {
  it("NotAllowedError (permission denied) -> friendly message", () => {
    const err = new DOMException("Permission denied", "NotAllowedError");
    expect(cameraErrorMessage(err)).toContain("permission denied");
  });

  it("legacy PermissionDeniedError -> friendly message", () => {
    const err = new DOMException("denied", "PermissionDeniedError");
    expect(cameraErrorMessage(err)).toContain("permission denied");
  });

  it("NotFoundError -> camera nahi mili", () => {
    expect(cameraErrorMessage(new DOMException("no cam", "NotFoundError"))).toContain(
      "Camera nahi mili"
    );
  });

  it("NotReadableError -> already in use", () => {
    expect(cameraErrorMessage(new DOMException("busy", "NotReadableError"))).toContain(
      "already use ho raha hai"
    );
  });

  it("OverconstrainedError -> settings unsupported", () => {
    expect(cameraErrorMessage(new DOMException("bad", "OverconstrainedError"))).toContain(
      "settings support nahi karti"
    );
  });

  it("html5-qrcode ka raw Error bhi friendly banta hai (asli bug)", () => {
    const raw = new Error("Error getting userMedia, error = NotAllowedError: Permission denied");
    const msg = cameraErrorMessage(raw);
    expect(msg).toContain("permission denied");
    expect(msg).not.toContain("userMedia");
  });

  it("html5-qrcode ke baaki embedded names bhi map hote hain", () => {
    expect(
      cameraErrorMessage(new Error("Error getting userMedia, error = NotFoundError: x"))
    ).toContain("Camera nahi mili");
    expect(
      cameraErrorMessage(new Error("Error getting userMedia, error = NotReadableError: x"))
    ).toContain("already use ho raha hai");
  });

  it("ajana error ka message jaisa hai waisa rehta hai", () => {
    expect(cameraErrorMessage(new Error("Kuch aur hi gadbad"))).toBe("Kuch aur hi gadbad");
  });

  it("string input bhi handle hota hai (embedded name ke saath)", () => {
    expect(cameraErrorMessage("NotReadableError: Could not start video source")).toContain(
      "already use ho raha hai"
    );
    expect(cameraErrorMessage("plain text")).toBe("plain text");
  });

  it("mediaDevices missing -> unsupported reason", () => {
    expect(cameraErrorMessage("mediaDevices is undefined")).toContain("camera support nahi mila");
  });
});

describe("camera support detection", () => {
  it("jsdom me getUserMedia nahi hota -> isCameraSupported false", () => {
    expect(isCameraSupported()).toBe(false);
  });

  it("cameraUnsupportedReason khali nahi hota", () => {
    expect(cameraUnsupportedReason().length).toBeGreaterThan(20);
  });
});
