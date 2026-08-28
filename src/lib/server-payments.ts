import { getServerSupabase } from "@/lib/api-auth";

/**
 * Server-data layer for the Payments page (G3 migration).
 *
 * G3 gate rule: service-role NEVER for page reads. Ye sab queries cookie+RLS
 * server client (`getServerSupabase`) se hoti hain — bilkul wahi behaviour jo
 * pehle browser client (`@/lib/supabase`) page ke `useEffect` me karta tha,
 * par ab server par render-time par. Kabhi isse `getAdminSupabase()` na use
 * karein — RLS bypass = banned.
 */

export type Client = {
  id: number;
  firstname: string;
  middlename: string | null;
  lastname: string;
  contact: string | null;
};

export type PaymentRow = {
  id: number;
  client_id: number;
  payment_date: string;
  amount: number;
  discount: number | null;
  payment_mode: string;
  remarks: string | null;
};

type DbRow = { [key: string]: unknown };

export type PaymentsPageData = {
  clients: Client[];
  payments: PaymentRow[];
};

export async function fetchPaymentsPageData(): Promise<PaymentsPageData> {
  const supabase = await getServerSupabase();

  const [{ data: cData }, { data: pData }] = await Promise.all([
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("client_payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000),
  ]);

  const clients = ((cData as DbRow[] | null) || []).map((r) => ({
    id: r.id as number,
    firstname: (r.firstname as string) ?? "",
    middlename: (r.middlename as string | null) ?? null,
    lastname: (r.lastname as string) ?? "",
    contact: (r.contact as string | null) ?? null,
  })) as Client[];

  const payments = ((pData as DbRow[] | null) || []).map((r) => ({
    id: r.id as number,
    client_id: r.client_id as number,
    payment_date: (r.payment_date as string) ?? "",
    amount: Number(r.amount) || 0,
    discount: r.discount == null ? null : Number(r.discount),
    payment_mode: (r.payment_mode as string) ?? "",
    remarks: (r.remarks as string | null) ?? null,
  })) as PaymentRow[];

  return { clients, payments };
}
