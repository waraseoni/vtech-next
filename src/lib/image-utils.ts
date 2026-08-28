/**
 * Normalize an image path for next/image.
 *
 * Some DB rows store relative paths like "uploads/clients/client00338.jpg"
 * without a leading slash. Next.js <Image> requires absolute URLs (http/https)
 * or root-relative paths (/uploads/...). This helper ensures correctness.
 */
export function safeImageSrc(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) return src;
  return `/${src}`;
}
