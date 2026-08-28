/**
 * Normalize an image path for next/image.
 *
 * DB rows have a mix of:
 *   - Full Supabase storage URLs  → "https://xxx.supabase.co/storage/v1/object/public/..."
 *   - PHP-era bare relative paths → "uploads/products/16.png"  (no leading slash)
 *
 * Next.js <Image> requires absolute URLs (http/https) or root-relative (/...) paths.
 * Bare relative paths are normalized to root-relative here; if the file doesn't
 * exist it 404s and the component's onError handler hides the broken image
 * (rather than throwing the "not a valid URL" crash seen before this helper).
 */
export function safeImageSrc(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return src;
  return `/${src}`;
}
