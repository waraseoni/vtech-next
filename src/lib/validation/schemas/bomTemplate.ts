import { z } from "zod";

/**
 * BOM template payloads. `items` array pehle `normalizeItems()` me manually
 * validate hota tha — ab wahi rules schema me hain (route aur form share karte
 * hain). Blank `notes` DB me nahi jaata, isliye route `notes ? { notes } : {}`
 * normalize karta hai.
 */

export const bomTemplateItemSchema = z.object({
  product_id: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1, "Har line ka component naam chahiye").max(160),
  qty: z.number().int().min(1, "Har line ki qty positive integer chahiye"),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type BomTemplateItemPayload = z.infer<typeof bomTemplateItemSchema>;

export const bomTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "Template ka naam chahiye").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  items: z.array(bomTemplateItemSchema).min(1, "Koi component line nahi hai"),
});
export type BomTemplateCreatePayload = z.infer<typeof bomTemplateCreateSchema>;

/** PUT = partial update; kam se kam ek field chahiye (warna 400). */
export const bomTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Template ka naam chahiye").max(120).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    items: z.array(bomTemplateItemSchema).min(1, "Koi component line nahi hai").optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.items !== undefined, {
    message: "Kuch update karne ko nahi hai",
  });
export type BomTemplateUpdatePayload = z.infer<typeof bomTemplateUpdateSchema>;

/** DB me jaane wala normalized item row (blank notes drop). */
export function toBomItemRow(item: BomTemplateItemPayload) {
  const notes = item.notes?.trim();
  return {
    product_id: item.product_id ?? null,
    name: item.name,
    qty: item.qty,
    ...(notes ? { notes } : {}),
  };
}
