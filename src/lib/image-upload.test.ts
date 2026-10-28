import { describe, expect, it } from "vitest";

import {
  IMAGE_MAX_BYTES,
  isValidSignatureDataUrl,
  sniffImageMime,
  validateImageBuffer,
} from "./image-upload";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);

describe("sniffImageMime", () => {
  it("detects JPEG magic bytes", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
  });

  it("detects PNG signature", () => {
    expect(sniffImageMime(PNG)).toBe("image/png");
  });

  it("detects WebP RIFF/WEBP container", () => {
    expect(sniffImageMime(WEBP)).toBe("image/webp");
  });

  it("rejects SVG disguised as an image", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImageMime(svg)).toBeNull();
  });

  it("rejects HTML and empty buffers", () => {
    expect(sniffImageMime(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });

  it("rejects a RIFF container that is not WebP", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WAVEfmt "),
    ]);
    expect(sniffImageMime(wav)).toBeNull();
  });
});

describe("validateImageBuffer", () => {
  it("returns sniffed mime and extension", () => {
    expect(validateImageBuffer(JPEG)).toEqual({ ok: true, mime: "image/jpeg", ext: "jpg" });
    expect(validateImageBuffer(PNG)).toEqual({ ok: true, mime: "image/png", ext: "png" });
    expect(validateImageBuffer(WEBP)).toEqual({ ok: true, mime: "image/webp", ext: "webp" });
  });

  it("accepts a file at exactly the size limit", () => {
    const padded = Buffer.concat([JPEG, Buffer.alloc(IMAGE_MAX_BYTES - JPEG.length)]);
    expect(validateImageBuffer(padded).ok).toBe(true);
  });

  it("rejects a file one byte over the size limit", () => {
    const tooBig = Buffer.concat([JPEG, Buffer.alloc(IMAGE_MAX_BYTES - JPEG.length + 1)]);
    const result = validateImageBuffer(tooBig);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("200KB");
  });

  it("honours a custom size limit", () => {
    const result = validateImageBuffer(PNG, 4);
    expect(result.ok).toBe(false);
  });

  it("rejects empty and non-image payloads", () => {
    expect(validateImageBuffer(Buffer.alloc(0))).toMatchObject({ ok: false });
    expect(validateImageBuffer(Buffer.from("not an image"))).toMatchObject({ ok: false });
  });
});

describe("isValidSignatureDataUrl", () => {
  it("accepts canvas PNG data URLs", () => {
    expect(isValidSignatureDataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBe(true);
  });

  it("accepts JPEG and WebP data URLs with line breaks", () => {
    expect(isValidSignatureDataUrl("data:image/jpeg;base64,/9j/4AAQ\nSkZJRg==")).toBe(true);
    expect(isValidSignatureDataUrl("data:image/webp;base64,UklGRg==")).toBe(true);
  });

  it("rejects SVG, HTML and other schemes", () => {
    expect(isValidSignatureDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isValidSignatureDataUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isValidSignatureDataUrl("javascript:alert(1)")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/png;base64,")).toBe(false);
  });

  it("rejects oversized signature payloads", () => {
    const huge = "data:image/png;base64," + "A".repeat(500_001);
    expect(isValidSignatureDataUrl(huge)).toBe(false);
  });
});
