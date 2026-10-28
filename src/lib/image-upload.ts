// Magic-byte check for uploaded images. File name/MIME client se aata hai,
// isliye storage me likhne se pehle bytes se type decide karte hain (SVG/HTML
// ko image bol kar upload karna block hota hai). Extension bhi sniffed type se
// banti hai, client ke naam se nahi.

export const IMAGE_MAX_BYTES = 200 * 1024;
export const SIGNATURE_MAX_CHARS = 500_000;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";
export type ImageExtension = "jpg" | "png" | "webp";

const EXT_BY_MIME: Record<ImageMime, ImageExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function sniffImageMime(buffer: Buffer): ImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, i) => buffer[i] === byte)
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageCheck =
  { ok: true; mime: ImageMime; ext: ImageExtension } | { ok: false; error: string };

export function validateImageBuffer(buffer: Buffer, maxBytes = IMAGE_MAX_BYTES): ImageCheck {
  if (buffer.byteLength === 0) {
    return { ok: false, error: "File empty hai" };
  }
  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      error: `Image > ${Math.round(maxBytes / 1024)}KB — compress karke dobara try karein`,
    };
  }
  const mime = sniffImageMime(buffer);
  if (!mime) {
    return { ok: false, error: "Sirf JPEG, PNG ya WebP image allowed hai" };
  }
  return { ok: true, mime, ext: EXT_BY_MIME[mime] };
}

// Canvas signature `toDataURL("image/png")` se aata hai; SVG/HTML data URL
// DB me jaakar print pages par render hote hain, isliye sirf raster allowed.
export function isValidSignatureDataUrl(value: string): boolean {
  return (
    value.length <= SIGNATURE_MAX_CHARS &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(value)
  );
}
