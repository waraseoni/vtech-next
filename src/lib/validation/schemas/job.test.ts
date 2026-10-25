import { describe, it, expect } from "vitest";

import { emptyJobForm, jobFormSchema, type JobFormValues } from "./job";

/** Valid base — har test sirf apna field badalta hai. */
const base: JobFormValues = {
  ...emptyJobForm,
  client_id: 7,
  mechanic_id: "3",
  fault: "Screen broken",
};

function errorsFor(patch: Partial<JobFormValues>) {
  const res = jobFormSchema.safeParse({ ...base, ...patch });
  if (res.success) return null;
  return res.error.flatten().fieldErrors;
}

describe("jobFormSchema", () => {
  it("minimal valid job pass hota hai", () => {
    expect(jobFormSchema.safeParse(base).success).toBe(true);
  });

  it("client / mechanic / fault required hain (step-1 gate)", () => {
    expect(errorsFor({ client_id: null })?.client_id).toContain("Client select karo");
    expect(errorsFor({ mechanic_id: "" })?.mechanic_id).toContain("Mechanic select karo");
    expect(errorsFor({ fault: "   " })?.fault).toContain("Fault description zaroori hai");
  });

  it("item optional hai (purana handleSave ise validate nahi karta tha)", () => {
    expect(jobFormSchema.safeParse({ ...base, item: "" }).success).toBe(true);
  });

  it("legacy uniq_id / location fields optional hain", () => {
    expect(
      jobFormSchema.safeParse({
        ...base,
        location_id: 12,
        location_name: "Rack B / Bin 3",
        legacy_uniq_id: "OLD-99",
      }).success
    ).toBe(true);
  });

  it("values trim ho jaate hain", () => {
    const res = jobFormSchema.safeParse({
      ...base,
      item: "  iPhone 15 ",
      fault: "  No charging  ",
      remark: "  handle carefully  ",
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.item).toBe("iPhone 15");
    expect(res.data.fault).toBe("No charging");
    expect(res.data.remark).toBe("handle carefully");
  });

  it("commission_amount sirf string pass-through hai (parseFloat hook me)", () => {
    expect(jobFormSchema.safeParse({ ...base, commission_amount: "" }).success).toBe(true);
    expect(jobFormSchema.safeParse({ ...base, commission_amount: "125.50" }).success).toBe(true);
  });
});
