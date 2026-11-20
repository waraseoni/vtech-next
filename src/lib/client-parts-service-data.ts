/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Parts vs Service (Client) report — single source of truth.
 *
 * `/reports/client-parts-service` ka RSC first paint aur client refetch dono
 * yehi helpers use karte hain. Supabase client caller deta hai (server par
 * cookie+RLS client, browser par anon-authed client) — service-role NEVER.
 *
 * Query logic pehle page.tsx me inline thi; yahan pure move hua hai, koi
 * filter/behaviour change nahi.
 */

type SupabaseLike = { from: (table: string) => any };

export type ClientOption = { id: number; name: string };

export type MechanicOption = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
};

export type JobRow = {
  id: number;
  job_id: string | null;
  code: string | null;
  item: string | null;
  client_name: string;
  mechanic_id: number | null;
  status: number;
  amount: number;
  date_created: string;
  date_completed: string | null;
  date_updated: string | null;
};

export type ProductLine = {
  transaction_id: number;
  product_name: string | null;
  qty: number | null;
  price: number | null;
};

export type ServiceLine = {
  transaction_id: number;
  service_name: string | null;
  price: number | null;
};

export type ClientPartsServiceReport = {
  jobs: JobRow[];
  products: ProductLine[];
  services: ServiceLine[];
};

export type ClientPartsServiceFilters = {
  clientId: string;
  from: string;
  to: string;
  status: string;
};

/** RSC first-paint seed — `/reports/client-parts-service` server page deta hai. */
export type ClientPartsServiceSeed = {
  clients: ClientOption[];
  mechanics: MechanicOption[];
  report: ClientPartsServiceReport;
  filters: ClientPartsServiceFilters;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function fetchClientsList(supabase: SupabaseLike): Promise<ClientOption[]> {
  const { data, error } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0)
    .order("firstname", { ascending: true });
  if (error) throw error;
  return (data || []).map((c: any) => {
    const row = c as {
      id: number;
      firstname: string | null;
      middlename: string | null;
      lastname: string | null;
    };
    return {
      id: row.id,
      name:
        [row.firstname, row.middlename, row.lastname].filter(Boolean).join(" ").trim() ||
        `Client #${row.id}`,
    };
  });
}

export async function fetchMechanicsList(supabase: SupabaseLike): Promise<MechanicOption[]> {
  const { data, error } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0);
  if (error) throw error;
  return (data || []) as MechanicOption[];
}

export async function fetchClientPartsServiceReport(
  supabase: SupabaseLike,
  params: ClientPartsServiceFilters
): Promise<ClientPartsServiceReport> {
  let q = supabase
    .from("transaction_list")
    .select(
      "id, job_id, code, item, client_name, mechanic_id, status, amount, date_created, date_completed, date_updated"
    )
    .eq("del_status", 0)
    .order("date_created", { ascending: false });

  if (params.clientId) q = q.eq("client_name", params.clientId);
  if (params.from) q = q.gte("date_created", `${params.from}T00:00:00+05:30`);
  if (params.to) q = q.lte("date_created", `${params.to}T23:59:59+05:30`);
  if (params.status && params.status !== "all") q = q.eq("status", Number(params.status));

  const { data: jobs, error: je } = await q.limit(2000);
  if (je) throw je;
  const jobRows = (jobs || []) as JobRow[];
  const ids = jobRows.map((j) => j.id);
  if (ids.length === 0) return { jobs: jobRows, products: [], services: [] };

  const prodChunks = chunk(ids, 200);
  const svcChunks = chunk(ids, 200);

  const [prodRes, svcRes] = await Promise.all([
    Promise.all(
      prodChunks.map((c) =>
        supabase
          .from("transaction_products")
          .select("transaction_id, product_name, qty, price")
          .in("transaction_id", c)
      )
    ),
    Promise.all(
      svcChunks.map((c) =>
        supabase
          .from("transaction_services")
          .select("transaction_id, service_name, price")
          .in("transaction_id", c)
      )
    ),
  ]);

  const products: ProductLine[] = [];
  for (const r of prodRes) {
    if (r.error) throw r.error;
    products.push(...((r.data || []) as ProductLine[]));
  }
  const services: ServiceLine[] = [];
  for (const r of svcRes) {
    if (r.error) throw r.error;
    services.push(...((r.data || []) as ServiceLine[]));
  }
  return { jobs: jobRows, products, services };
}
