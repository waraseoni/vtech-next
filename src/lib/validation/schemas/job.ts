import { z } from "zod";

/**
 * `jobs/new` (create + edit) ka form schema.
 *
 * Scope note: service/product rows is schema me nahi hain — woh local state
 * (`ServiceRow[]` / `ProductRow[]`) hi rehte hain kyunki unka apna tempId +
 * duplicate-prevention flow hai (useFieldArray me convert karne ka koi
 * behaviour-fayda nahi tha). Yahan sirf woh fields hain jo `transaction_list`
 * row me jaate hain.
 *
 * Purana behaviour preserve:
 * - `item` label par * hai par handleSave use validate nahi karta tha → yahan
 *   bhi optional (sirf trim + max).
 * - `fault` / client / mechanic required (wahi 3 checks jo validateStep1 +
 *   handleSave dono karte the).
 * - `uniq_id` legacy free-text fallback: location select ho to spot ka naam,
 *   warna purana `uniq_id` value (edit mode me DB se aata hai).
 */

export const jobFormSchema = z.object({
  client_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .refine((v) => v !== null && v > 0, "Client select karo"),
  mechanic_id: z.string().min(1, "Mechanic select karo"),
  item: z.string().trim().max(200),
  fault: z.string().trim().min(1, "Fault description zaroori hai").max(1000),
  location_id: z.number().int().positive().nullable(),
  location_name: z.string().trim().max(200),
  legacy_uniq_id: z.string().trim().max(200),
  remark: z.string().trim().max(1000),
  // Commission admin/developer ke liye free-text number input hai.
  commission_amount: z.string().trim(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

export const emptyJobForm: JobFormValues = {
  client_id: null,
  mechanic_id: "",
  item: "",
  fault: "",
  location_id: null,
  location_name: "",
  legacy_uniq_id: "",
  remark: "",
  commission_amount: "0",
};
