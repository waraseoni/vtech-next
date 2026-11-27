// K8/B1 — composite job reference.
// Brand wale naye jobs: `KMK#001 (Ref 28101)`.
// Legacy / unbranded jobs: purana `#28101` exactly same rehta hai.
// Global `job_id` hamesha lookup key aur "Ref" me preserved hai.
export function jobReference(
  jobId: number | string | null | undefined,
  brandJobNo?: string | null
): string {
  const ref = String(jobId ?? "").trim();
  const brand = String(brandJobNo ?? "").trim();
  if (brand && ref) return `${brand} (Ref ${ref})`;
  if (brand) return brand;
  return ref ? `#${ref}` : "—";
}
