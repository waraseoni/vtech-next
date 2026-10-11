import { afterEach, describe, expect, it, vi } from "vitest";
import { sourceMime } from "./imageCropper";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(contentType: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      headers: new Headers(contentType ? { "content-type": contentType } : {}),
    })
  );
}

describe("sourceMime", () => {
  it("PNG source ko image/png deta hai (alpha preserve)", async () => {
    stubFetch("image/png");
    await expect(sourceMime("blob:x")).resolves.toBe("image/png");
  });

  it("JPEG source ko image/jpeg deta hai", async () => {
    stubFetch("image/jpeg");
    await expect(sourceMime("blob:y")).resolves.toBe("image/jpeg");
  });

  it("missing content-type par jpeg fallback (purana behavior)", async () => {
    stubFetch(null);
    await expect(sourceMime("data:,")).resolves.toBe("image/jpeg");
  });

  it("fetch failure par jpeg fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("cors")));
    await expect(sourceMime("https://remote/x")).resolves.toBe("image/jpeg");
  });
});
