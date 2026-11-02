import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/jobs/old` (new legacy entry) aur `/jobs/[id]/old` (edit) ka neutral server
 * seed — client ke `fetchMaster()` / `fetchJob()` ka read-only mirror.
 * Caller cookie+RLS client pass karta hai; yahan koi write kabhi nahi.
 * Dono runtimes safe (koi next/headers import nahi).
 */

export type JobsOldClient = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
};
export type JobsOldMechanic = {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  designation: string;
  commission_percent: number;
};
export type JobsOldService = { id: number; name: string; price: number };
export type JobsOldProduct = { id: number; name: string; price: number };
export type JobsOldSelService = { service_id: number; service_name: string; price: number };
export type JobsOldSelProduct = {
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
};

export type JobsOldMasters = {
  clients: JobsOldClient[];
  mechanics: JobsOldMechanic[];
  services: JobsOldService[];
  products: JobsOldProduct[];
  // `fetchMaster()` ka profile part — Assign Technician panel isi par depend
  // karta hai, isliye pehla paint bhi isse seed hota hai (warna admin ko
  // panel hi nahi dikhega).
  userRole: string;
  userMechId: number | null;
};

/** `transaction_list.select("*")` ka wahi subset jo form padhta hai. */
export type JobsOldJobRow = {
  client_name: number;
  job_id: string | null;
  date_created: string | null;
  item: string | null;
  fault: string | null;
  uniq_id: string | null;
  remark: string | null;
  mechanic_id: number | null;
  mechanic_amount: number | null;
};

export type JobsOldJob = {
  job: JobsOldJobRow;
  services: JobsOldSelService[];
  products: JobsOldSelProduct[];
};

/** Edit page ka seed — `job: null` ka matlab row nahi mili (client redirect karega). */
export type JobsOldEditSeed = { masters: JobsOldMasters; job: JobsOldJob | null };

/** Wahi 4 master selects + profile role (filters/order bilkul client jaise). */
export async function fetchJobsOldMasters(supabase: SupabaseClient): Promise<JobsOldMasters> {
  const [userRes, cRes, mRes, sRes, pRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
      .order("firstname"),
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, designation, commission_percent")
      .eq("status", 1)
      .order("firstname"),
    supabase
      .from("service_list")
      .select("id, name, price")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name"),
    supabase
      .from("product_list")
      .select("id, name, price")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name"),
  ]);

  if (cRes.error) throw cRes.error;
  if (mRes.error) throw mRes.error;
  if (sRes.error) throw sRes.error;
  if (pRes.error) throw pRes.error;

  let userRole = "staff";
  let userMechId: number | null = null;
  const user = userRes.data?.user;
  if (user) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, mechanic_id")
      .eq("id", user.id)
      .single();
    userRole = p?.role || "staff";
    userMechId = p?.mechanic_id || null;
  }

  return {
    clients: (cRes.data || []) as JobsOldClient[],
    mechanics: (mRes.data || []) as JobsOldMechanic[],
    services: (sRes.data || []) as JobsOldService[],
    products: (pRes.data || []) as JobsOldProduct[],
    userRole,
    userMechId,
  };
}

/** Job row + uske services/products — missing row par `null` (koi throw nahi). */
export async function fetchJobsOldJob(
  supabase: SupabaseClient,
  id: number
): Promise<JobsOldJob | null> {
  const { data: job, error } = await supabase
    .from("transaction_list")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !job) return null;

  const [svcRes, prodRes] = await Promise.all([
    supabase
      .from("transaction_services")
      .select("service_id, service_name, price")
      .eq("transaction_id", id),
    supabase
      .from("transaction_products")
      .select("product_id, product_name, qty, price")
      .eq("transaction_id", id),
  ]);

  return {
    job: job as JobsOldJobRow,
    services: (svcRes.data || []) as JobsOldSelService[],
    products: (prodRes.data || []) as JobsOldSelProduct[],
  };
}

/** Edit page loader: masters + job ek saath; job na mile to `null`. */
export async function fetchJobsOldEditSeed(
  supabase: SupabaseClient,
  id: number
): Promise<JobsOldEditSeed | null> {
  const [masters, job] = await Promise.all([
    fetchJobsOldMasters(supabase),
    fetchJobsOldJob(supabase, id),
  ]);
  if (!job) return null;
  return { masters, job };
}
