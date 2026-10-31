import { z } from "zod";

/**
 * `POST /api/print-estimate` payload. Client totals trust nahi hote —
 * route lines se totals dobara compute karta hai.
 */

export const estimatePrintLineSchema = z.object({
  name: z.string().trim().min(1, "Har item ka naam chahiye").max(200),
  hsn: z.string().trim().max(40).optional().nullable(),
  qty: z.number().min(0).max(10_000_000),
  rate: z.number().min(0).max(1_000_000_000),
});

export const estimatePrintClientSchema = z
  .object({
    name: z.string().trim().max(200).optional().default(""),
    mobile: z.string().trim().max(40).optional().default(""),
    email: z.string().trim().max(200).optional().default(""),
    address: z.string().trim().max(500).optional().default(""),
  })
  .optional()
  .nullable();

export const estimatePrintOptionsSchema = z
  .object({
    showTitle: z.boolean().optional().default(false),
    title: z.string().trim().max(60).optional().default(""),
    showDisclaimer: z.boolean().optional().default(false),
    disclaimer: z.string().trim().max(300).optional().default(""),
  })
  .optional()
  .default({ showTitle: false, title: "", showDisclaimer: false, disclaimer: "" });

export const estimatePrintSchema = z.object({
  reference: z.string().trim().max(60).optional().default(""),
  date: z.string().trim().max(10).optional().default(""),
  validTill: z.string().trim().max(10).optional().default(""),
  client: estimatePrintClientSchema,
  lines: z
    .array(estimatePrintLineSchema)
    .min(1, "Kam se kam ek item chahiye")
    .max(100, "Ek estimate me max 100 items"),
  gstEnabled: z.boolean().optional().default(false),
  gstRate: z.number().min(0).max(100).optional().default(18),
  discountType: z.enum(["amount", "percent"]).optional().default("amount"),
  discountValue: z.number().min(0).max(1_000_000_000).optional().default(0),
  remarks: z.string().trim().max(1000).optional().default(""),
  printOptions: estimatePrintOptionsSchema,
});

export type EstimatePrintSchema = z.infer<typeof estimatePrintSchema>;
