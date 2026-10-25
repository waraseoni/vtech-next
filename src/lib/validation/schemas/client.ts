import { z } from "zod";

/**
 * Client form schemas — `clients/new` page aur `jobs/new` ka quick-add modal
 * dono inhe use karte hain. Form values sab string hain (inputs ke type se
 * match), trim yahin ho jaata hai.
 */

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MOBILE_RE = /^[0-9]{10}$/;

// Dono schemas ke liye same rules — message text test me assert hota hai.
const firstnameField = z.string().trim().min(1, "First name is required").max(120);
const middlenameField = z.string().trim().max(120);
const lastnameField = z.string().trim().min(1, "Last name is required").max(120);
const contactField = z
  .string()
  .trim()
  .superRefine((v, ctx) => {
    if (!v) {
      ctx.addIssue({ code: "custom", message: "Contact number is required" });
    } else if (!MOBILE_RE.test(v)) {
      ctx.addIssue({ code: "custom", message: "Enter valid 10-digit number" });
    }
  });
// Optional: email ya secondary 10-digit mobile — dono accept hote hain.
const emailField = z
  .string()
  .trim()
  .max(160)
  .refine((v) => v === "" || EMAIL_RE.test(v) || MOBILE_RE.test(v), {
    message: "Enter valid email or 10-digit mobile",
  });

/** `clients/new` — address required, opening balance bhi form me. */
export const clientFormSchema = z.object({
  firstname: firstnameField,
  middlename: middlenameField,
  lastname: lastnameField,
  contact: contactField,
  email: emailField,
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

/**
 * `jobs/new` ka "Add New Client" modal — job ke saath quick add.
 *
 * Address yahan optional hai (purana behaviour: `address.trim() || ""`),
 * opening balance modal me poocha hi nahi jaata (0 hi jaata hai).
 */
export const quickClientFormSchema = z.object({
  firstname: firstnameField,
  middlename: middlenameField,
  lastname: lastnameField,
  contact: contactField,
  email: emailField,
  address: z.string().trim().max(500),
});

export type QuickClientFormValues = z.infer<typeof quickClientFormSchema>;

export const emptyQuickClientForm: QuickClientFormValues = {
  firstname: "",
  middlename: "",
  lastname: "",
  contact: "",
  email: "",
  address: "",
};
