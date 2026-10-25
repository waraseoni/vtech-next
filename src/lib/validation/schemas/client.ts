import { z } from "zod";

/**
 * Client create/edit form schema — `clients/new` page aur (aage) API route
 * dono isi ko use karenge. Form values sab string hain (inputs ke type se
 * match), trim yahin ho jaata hai.
 */

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MOBILE_RE = /^[0-9]{10}$/;

export const clientFormSchema = z.object({
  firstname: z.string().trim().min(1, "First name is required").max(120),
  middlename: z.string().trim().max(120),
  lastname: z.string().trim().min(1, "Last name is required").max(120),
  contact: z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) {
        ctx.addIssue({ code: "custom", message: "Contact number is required" });
      } else if (!MOBILE_RE.test(v)) {
        ctx.addIssue({ code: "custom", message: "Enter valid 10-digit number" });
      }
    }),
  // Optional: email ya secondary 10-digit mobile — dono accept hote hain.
  email: z
    .string()
    .trim()
    .max(160)
    .refine((v) => v === "" || EMAIL_RE.test(v) || MOBILE_RE.test(v), {
      message: "Enter valid email or 10-digit mobile",
    }),
  address: z.string().trim().min(1, "Address is required").max(500),
  // Legacy behaviour: blank/garbage → 0 (parseFloat || 0), isliye yahan sirf string.
  opening_balance: z.string().trim(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const emptyClientForm: ClientFormValues = {
  firstname: "",
  middlename: "",
  lastname: "",
  contact: "",
  email: "",
  address: "",
  opening_balance: "0.00",
};
