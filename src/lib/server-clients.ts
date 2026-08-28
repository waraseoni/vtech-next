import { getServerSupabase } from "@/lib/api-auth";
import {
  buildDueMaps,
  balanceFromMaps,
  JOB_STATUS_DELIVERED,
  LOAN_STATUS_ACTIVE,
} from "@/lib/client-due";

/**
 * Server-data layer for the Clients registry page (G3 pilot).
 *
 * G3 gate rule: service-role NEVER for page reads. Ye sab queries cookie+RLS
 * server client (`getServerSupabase`) se hoti hain — bilkul wahi behaviour jo
 * pehle browser client (`@/lib/supabase`) page ke `useEffect` me karta tha,
 * par ab server par render-time par. Kabhi isse `getAdminSupabase()` na use
 * karein — RLS bypass = banned.
 */

export type Client = {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  date_created: string;
  opening_balance: number;
  repair_billed: number;
  direct_sales_billed: number;
  total_loan_given: number;
  total_paid: number;
  balance: number;
  last_txn_date: string | null;
  image_path?: string;
  login_allowed: boolean;
};

type DbRow = { [key: string]: unknown };
type ClientRow = {
  id: number;
  firstname: string | null;
  middlename: string | null;
  lastname: string | null;
  contact: string | null;
  email: string | null;
  address: string | null;
  date_created: string | null;
  opening_balance: number | null;
  image_path: string | null;
  login_allowed: boolean | null;
};
const toNum = (v: unknown): number => {
  const x = Number(v);
  return Number.isNaN(x) ? 0 : x;
};

export type ClientsPageData = {
  clients: Client[];
  firmInfo: Record<string, string>;
  userRole: string;
};

export async function fetchClientsPageData(): Promise<ClientsPageData> {
  const supabase = await getServerSupabase();

  // ─── Batch 1: Parallel — auth/role + firmInfo + client list ──────────────
  // Teen independent queries ek saath chalao — pehle sequential tha (~600ms),
  // ab sab parallel (~200ms max).
  const [roleResult, sysResult, clsResult] = await Promise.all([
    // 1a. User role (2 chained queries — getUser → profile)
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return "staff";
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        return profile?.role ?? "staff";
      } catch {
        return "staff";
      }
    })(),

    // 1b. system_info — firm vars for WhatsApp templates
    supabase.from("system_info").select("meta_field, meta_value"),

    // 1c. client_list — all active clients
    supabase
      .from("client_list")
      .select(
        "id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance, image_path, login_allowed"
      )
      .eq("delete_flag", 0),
  ]);

  const userRole = roleResult as string;

  const firmInfo: Record<string, string> = {};
  ((sysResult.data as DbRow[] | null) || []).forEach((r) => {
    firmInfo[String(r.meta_field)] = String(r.meta_value ?? "");
  });

  const cls = clsResult.data;
  if (!cls?.length) {
    return { clients: [], firmInfo, userRole };
  }

  const ids = (cls as ClientRow[]).map((c) => c.id);

  const inBatches = (arr: number[], size = 400): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // Loose paginated query helper — same pattern as src/lib/client-due.ts
  // (structural Postgrest `any`). Generic types yahan fight karte hain; ye pure
  // data-layer helper hai, isliye any acceptable.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const selectIn = async (
    table: string,
    select: string,
    field: string,
    values: (number | string)[],
    extra: (q: any) => any = (q) => q
  ): Promise<DbRow[]> => {
    const list: DbRow[] = [];
    for (const batch of inBatches(values as number[])) {
      let page = 0;
      while (true) {
        let q: any = supabase.from(table).select(select).in(field, batch);
        q = extra(q);
        const { data } = await q.range(page * 1000, (page + 1) * 1000 - 1);
        if (data) list.push(...(data as DbRow[]));
        if (!data || data.length < 1000) break;
        page++;
      }
    }
    return list;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ─── Batch 2: Parallel — all 5 financial queries ─────────────────────────
  // Pehle ye sequential chalti thi (~1500ms+). Ab sab ek saath (~300ms max).
  const [repairs, dirSales, payments, loans, lastTxns] = await Promise.all([
    selectIn(
      "transaction_list",
      "client_name, amount",
      "client_name",
      ids.map(String),
      (q) => q.eq("status", JOB_STATUS_DELIVERED)
    ),
    selectIn("direct_sales", "client_id, total_amount", "client_id", ids),
    selectIn("client_payments", "client_id, amount, discount, loan_id", "client_id", ids),
    selectIn(
      "client_loans",
      "id, client_id, total_payable",
      "client_id",
      ids,
      (q) => q.eq("status", LOAN_STATUS_ACTIVE)
    ),
    selectIn("transaction_list", "client_name, date_created", "client_name", ids.map(String)),
  ]);

  const m = buildDueMaps({ repairs, directSales: dirSales, payments, loans });

  const lastTxnMap: Record<number, string> = {};
  lastTxns.forEach((t) => {
    const cid = parseInt(String(t.client_name ?? ""), 10);
    if (
      !Number.isNaN(cid) &&
      t.date_created &&
      (!lastTxnMap[cid] || String(t.date_created) > String(lastTxnMap[cid]))
    )
      lastTxnMap[cid] = String(t.date_created);
  });

  const built: Client[] = (cls as ClientRow[]).map((c) => {
    const ob = toNum(c.opening_balance);
    const rep = m.repairBilled[c.id] ?? 0,
      dir = m.directSalesBilled[c.id] ?? 0,
      svcPaid = m.servicePaid[c.id] ?? 0,
      loan = m.activeLoanGiven[c.id] ?? 0,
      loanPaid = m.loanRepaid[c.id] ?? 0;
    return {
      id: c.id,
      name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
      contact: c.contact || "",
      email: c.email || "",
      address: c.address || "",
      date_created: c.date_created || "",
      opening_balance: ob,
      repair_billed: rep,
      direct_sales_billed: dir,
      total_loan_given: loan,
      total_paid: svcPaid + loanPaid,
      balance: balanceFromMaps(m, c.id, ob),
      last_txn_date: lastTxnMap[c.id] || null,
      image_path: c.image_path || undefined,
      login_allowed: !!c.login_allowed,
    };
  });

  built.sort((a, b) => b.balance - a.balance);

  return { clients: built, firmInfo, userRole };
}
