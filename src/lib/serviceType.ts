/**
 * Service Type — pure helpers (DB/Supabase import nahi).
 *
 * Design note (service_type_implementation_plan v2, D1/D2):
 * - `service_types.expects_fault NULL` = fault required (purana behaviour + naye
 *   admin-defined types ka safe default). Sirf `false` faultless mark karta hai.
 * - `transaction_list.fault` DB me `text NOT NULL` hai — ise kabhi nullable mat
 *   karo. Faultless type par `fault = ""` likha jata hai; asli fix label +
 *   requiredness ka badalna hai, column ka nahi.
 *
 * Structural type isliye local hai taaki `lib` layer `app/jobs/jobFormQueries`
 * par depend na kare. `JobFormServiceType` isme structurally fit hota hai.
 */

export type ServiceTypeOption = {
  id: number;
  name: string;
  sort_order?: number | null;
  expects_fault?: boolean | null;
  is_active?: boolean;
};

/** `false` sirf tab jab admin ne explicitly faultless mark kiya ho. */
export function expectsFault(
  type: Pick<ServiceTypeOption, "expects_fault"> | null | undefined
): boolean {
  return type?.expects_fault !== false;
}

/**
 * Naye job ka default type: explicit "Repair" ko priority (purana UX waisa hi),
 * warna sabse chhota `sort_order`. Inactive types skip. Koi active type na ho to null.
 */
export function defaultServiceTypeId(types: readonly ServiceTypeOption[]): number | null {
  const active = types.filter((t) => t.is_active !== false);
  if (active.length === 0) return null;

  const repair = active.find((t) => t.name.trim().toLowerCase() === "repair");
  if (repair) return repair.id;

  return active.reduce((best, t) => {
    const a = t.sort_order ?? Number.MAX_SAFE_INTEGER;
    const b = best.sort_order ?? Number.MAX_SAFE_INTEGER;
    return a < b ? t : best;
  }).id;
}

/** Poori label — `*` / `(optional)` marker isme hi hai, JSX me dobara mat lagao. */
export function faultFieldLabel(expects: boolean): string {
  return expects ? "Fault / Complaint *" : "Work Description / Scope (optional)";
}

/** Schema error message. Faultless type ke liye koi error nahi hota. */
export function faultRequiredMessage(expects: boolean): string {
  return expects ? "Fault description zaroori hai" : "";
}

/** Form me field ke neeche dikhaane wali chhoti hint (faultless type ke liye). */
export function faultHint(expects: boolean): string {
  return expects
    ? ""
    : "Installation me complaint nahi hoti — kaam ka scope likh sakte hain (optional).";
}

/**
 * SearchableSelect ke liye options. Active types + jo type abhi selected hai
 * (chahe deactivated ho) — warna purane job ka edit value chhup jayega.
 */
export function serviceTypeOptions(
  types: readonly ServiceTypeOption[],
  selectedId: number | null | undefined
): Array<{ id: number; label: string; sub?: string }> {
  return types
    .filter((t) => t.is_active !== false || t.id === selectedId)
    .map((t) => ({
      id: t.id,
      label: t.is_active === false ? `${t.name} (inactive)` : t.name,
      sub: expectsFault(t) ? undefined : "Fault optional",
    }));
}

/**
 * ID → naam lookup. Inactive type bhi milta hai — deactivated type wale purane
 * job ka edit form khali na dikhe (v2 critical catch #1).
 */
export function serviceTypeName(
  types: readonly ServiceTypeOption[],
  id: number | null | undefined
): string | null {
  if (id == null) return null;
  return types.find((t) => t.id === id)?.name ?? null;
}
