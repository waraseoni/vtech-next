import { describe, it, expect } from "vitest";

import { clientFormSchema, emptyClientForm, quickClientFormSchema } from "./client";

/** Valid base — har test sirf apna field badalta hai. */
const base = {
  ...emptyClientForm,
  firstname: "Ramesh",
  lastname: "Kumar",
  contact: "9876543210",
  address: "Main Road, Jodhpur",
};

function errorsFor(patch: Partial<typeof base>) {
  const res = clientFormSchema.safeParse({ ...base, ...patch });
  if (res.success) return null;
  return res.error.flatten().fieldErrors;
}

describe("clientFormSchema", () => {
  it("minimal valid client pass hota hai", () => {
    expect(clientFormSchema.safeParse(base).success).toBe(true);
  });

  it("firstname / lastname / address required hain", () => {
    expect(errorsFor({ firstname: "  " })?.firstname).toContain("First name is required");
    expect(errorsFor({ lastname: "" })?.lastname).toContain("Last name is required");
    expect(errorsFor({ address: " " })?.address).toContain("Address is required");
  });

  it("blank contact → required message (sirf ek message, dono nahi)", () => {
    const contact = errorsFor({ contact: "" })?.contact ?? [];
    expect(contact).toEqual(["Contact number is required"]);
  });

  it("9-digit / non-digit contact reject hota hai", () => {
    expect(errorsFor({ contact: "98765" })?.contact).toContain("Enter valid 10-digit number");
    expect(errorsFor({ contact: "98765abcde" })?.contact).toContain("Enter valid 10-digit number");
  });

  it("email optional hai — blank allowed, valid email/mobile allowed", () => {
    expect(clientFormSchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...base, email: "a@b.com" }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...base, email: "9876543210" }).success).toBe(true);
  });

  it("invalid email reject hota hai", () => {
    expect(errorsFor({ email: "not-an-email" })?.email).toContain(
      "Enter valid email or 10-digit mobile"
    );
  });

  it("values trim ho jaate hain (payload same rehta hai)", () => {
    const res = clientFormSchema.safeParse({
      ...base,
      firstname: "  Ramesh ",
      address: "  Main Road  ",
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.firstname).toBe("Ramesh");
    expect(res.data.address).toBe("Main Road");
  });

  it("opening_balance sirf string pass-through hai (legacy parseFloat || 0)", () => {
    expect(clientFormSchema.safeParse({ ...base, opening_balance: "" }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...base, opening_balance: "-500.50" }).success).toBe(true);
  });
});

describe("quickClientFormSchema (jobs/new modal)", () => {
  const quickBase = {
    firstname: "Ramesh",
    middlename: "",
    lastname: "Kumar",
    contact: "9876543210",
    email: "",
    address: "",
  };

  it("address optional hai (purana modal blank allow karta tha)", () => {
    expect(quickClientFormSchema.safeParse({ ...quickBase, address: "" }).success).toBe(true);
  });

  it("firstname / lastname / contact required hain", () => {
    const res = quickClientFormSchema.safeParse({
      ...quickBase,
      firstname: "",
      contact: "",
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const errs = res.error.flatten().fieldErrors;
    expect(errs.firstname).toContain("First name is required");
    expect(errs.contact).toContain("Contact number is required");
  });

  it("email rule client form se shared hai", () => {
    expect(quickClientFormSchema.safeParse({ ...quickBase, email: "a@b.com" }).success).toBe(true);
    expect(quickClientFormSchema.safeParse({ ...quickBase, email: "bad" }).success).toBe(false);
  });
});
