/**
 * Normalize an image path for next/image.
 *
 * DB rows have a mix of:
 *   - Full Supabase storage URLs  → "https://xxx.supabase.co/storage/v1/object/public/..."
 *   - Root-relative paths         → "/uploads/products/16.png"
 *   - PHP-era bare relative paths → "uploads/products/16.png"  (no leading slash)
 *
 * Next.js <Image> requires absolute URLs (http/https) or root-relative (/...) paths.
 * PHP-era bare paths don't exist as static files in Next.js, so returning them
 * as "/" would 404. Instead, return "" so the component can show a fallback.
 */
export function safeImageSrc(src: string | null | undefined): string {
  if (!src) return "";
  // Already absolute or root-relative — pass through
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return src;
  // PHP-era bare relative path (e.g. "uploads/products/16.png") — no matching
  // static file in Next.js, would 404. Return empty so caller shows fallback.
  return "";
}
