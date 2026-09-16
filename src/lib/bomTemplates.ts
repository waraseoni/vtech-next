/**
 * BOM Checker — SAVED TEMPLATES (2026-09-16, provenance
 * `supabase/migrations/20260922_bom_templates.sql`, bom_checker_plan.md Phase 3).
 *
 * Pure types + helpers — no DB access. Server routes validate independently
 * (`src/app/api/bom-templates/route.ts`), client uses these for shape + quick checks.
 */

export type BomTemplateItem = {
  /** null jab template-save waqt product match nahi mila tha (raw text rehta hai). */
  product_id: number | null;
  name: string;
  qty: number;
  notes?: string;
};

export type BomTemplate = {
  id: number;
  name: string;
  description: string;
  items: BomTemplateItem[];
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** items ko text lines me wapas: "NE555 Timer IC - 2" (Check Stock ke liye). */
export function itemsToLines(items: BomTemplateItem[]): string {
  return items.map((it) => `${it.name} - ${it.qty}`).join("\n");
}