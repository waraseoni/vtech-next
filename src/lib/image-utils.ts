/**
 * Normalize an image path for next/image.
 *
 * DB rows have a mix of:
 *   - Full Supabase storage URLs  → "https://xxx.supabase.co/storage/v1/object/public/..."
 *   - Root-relative paths         → "/uploads/products/16.png"
 *   - PHP-era bare relative paths → "uploads/products/16.png"  (no leading slash)
 *
 * Next.js <Image> requires absolute URLs (http/https) or root-relative (/...) paths.
 * Components must render <Image> only when this returns a truthy value (callers are
 * expected to gate on the result). PHP-era bare relative paths have no matching
 * static file in Next.js, so this returns "" and the caller shows its fallback
 * instead of issuing a 404 request.
 */
export function safeImageSrc(src: string | null | undefined): string {
  if (!src) return "";
  // Already absolute or root-relative — pass through
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return src;
  // PHP-era bare relative path (e.g. "uploads/products/16.png") — no static file
  // in Next.js. Return "" so caller shows fallback (avoid 404 request).
  return "";
}
