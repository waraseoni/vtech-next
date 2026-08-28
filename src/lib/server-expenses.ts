import { getServerSupabase } from "@/lib/api-auth";

/**
 * Server-data layer for the Pay outs / Expenses page (G3 migration).
 *
 * G3 gate rule: service-role NEVER for page reads. Ye sab queries cookie+RLS
 * server client (`getServerSupabase`) se hoti hain — bilkul wahi behaviour jo
 * pehle browser client (`@/lib/supabase`) page ke `useEffect` me karta tha,
 * par ab server par render-time par. Kabhi isse `getAdminSupabase()` na use
 * karein — RLS bypass = banned.
 */

export type Expense = {
  id: number;
  category: string;
  amount: number;
  remarks: string | null;
  date_created: string;
};

export type Mechanic = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  designation: string | null;
  status: number;
  delete_flag: number;
};

export type AdvancePayment = {
  id: number;
  mechanic_id: number;
  amount: number;
  date_paid: string;
  reason: string | null;
};

type DbRow = { [key: string]: unknown };

export type ExpensesPageData = {
  mechanics: Mechanic[];
  staffPayments: AdvancePayment[];
  shopExpenses: Expense[];
};

export async function fetchExpensesPageData(): Promise<ExpensesPageData> {
  const supabase = await getServerSupabase();

  const [{ data: mechanicData }, { data: staffData }, { data: expenseData }] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, designation, status, delete_flag")
      .eq("status", 1)
      .eq("delete_flag", 0)
      .order("firstname", { ascending: true }),
    supabase
      .from("advance_payments")
      .select("id, mechanic_id, amount, date_paid, reason")
      .order("date_paid", { ascending: false })
      .order("id", { ascending: false })
      .limit(500),
    supabase
      .from("expense_list")
      .select("id, category, amount, remarks, date_created")
      .order("date_created", { ascending: false })
      .limit(500),
  ]);

  const mechanics = ((mechanicData as DbRow[] | null) || []).map((r) => ({
    id: r.id as number,
    firstname: (r.firstname as string) ?? "",
    middlename: (r.middlename as string | null) ?? null,
    lastname: (r.lastname as string) ?? "",
    designation: (r.designation as string | null) ?? null,
    status: Number(r.status) || 0,
    delete_flag: Number(r.delete_flag) || 0,
  })) as Mechanic[];

  const staffPayments = ((staffData as DbRow[] | null) || []).map((r) => ({
    id: r.id as number,
    mechanic_id: r.mechanic_id as number,
    amount: Number(r.amount) || 0,
    date_paid: (r.date_paid as string) ?? "",
    reason: (r.reason as string | null) ?? null,
  })) as AdvancePayment[];

  const shopExpenses = ((expenseData as DbRow[] | null) || []).map((r) => ({
    id: r.id as number,
    category: (r.category as string) ?? "",
    amount: Number(r.amount) || 0,
    remarks: (r.remarks as string | null) ?? null,
    date_created: (r.date_created as string) ?? "",
  })) as Expense[];

  return { mechanics, staffPayments, shopExpenses };
}
