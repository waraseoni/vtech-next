import { getServerSupabase } from "@/lib/api-auth";

/**
 * Server-data layer for the Mechanics directory page (G3 migration).
 *
 * G3 gate rule: service-role NEVER for page reads. Ye sab queries cookie+RLS
 * server client (`getServerSupabase`) se hoti hain — bilkul wahi behaviour jo
 * pehle browser client (`@/lib/supabase`) page ke `useEffect` me karta tha,
 * par ab server par render-time par. Kabhi isse `getAdminSupabase()` na use
 * karein — RLS bypass = banned.
 */

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

type DbRow = { [key: string]: unknown };

export type MechanicsPageData = {
  mechanics: Mechanic[];
  userRole: string;
};

export async function fetchMechanicsPageData(): Promise<MechanicsPageData> {
  const supabase = await getServerSupabase();

  let userRole = "staff";
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      userRole = profile?.role ?? "staff";
    }
  } catch {
    /* session nahi to unauthorized — proxy already redirect karta hai */
  }

  const { data } = await supabase
    .from("mechanic_list")
    .select(
      "id, firstname, middlename, lastname, contact, designation, daily_salary, commission_percent, status, delete_flag, date_added, image_path"
    )
    .eq("delete_flag", 0)
    .order("firstname", { ascending: true });

  return {
    mechanics: ((data as DbRow[] | null) || []).map((r) => ({
      id: r.id as number,
      firstname: (r.firstname as string) ?? "",
      middlename: (r.middlename as string | null) ?? null,
      lastname: (r.lastname as string) ?? "",
      contact: (r.contact as string) ?? "",
      designation: (r.designation as string | null) ?? null,
      daily_salary: Number(r.daily_salary) || 0,
      commission_percent: Number(r.commission_percent) || 0,
      status: Number(r.status) || 0,
      delete_flag: Number(r.delete_flag) || 0,
      date_added: r.date_added as string | undefined,
      image_path: (r.image_path as string | null) ?? null,
    })),
    userRole,
  };
}
