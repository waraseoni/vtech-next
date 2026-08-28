// Shared pure helpers + type for the Mechanics directory.
// Client-side safe (no server/browser globals) — used by MechanicsBody.tsx.

export type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string;
  designation: string | null;
  daily_salary: number;
  commission_percent: number;
  status: number;
  delete_flag: number;
  date_added?: string;
  image_path?: string | null;
};

export const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
