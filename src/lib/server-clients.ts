import { getServerSupabase } from "@/lib/api-auth";
import {
  buildDueMaps,
  computeClientDue,
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

type RpcFinancialRow = {
  client_id: number;
  repair_billed: number;
  direct_sales_billed: number;
  service_paid: number;
  active_loan_given: number;
  loan_repaid: number;
  last_txn_date: string | null;
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

export type FetchClientsPageOptions = {
  /** Pass from requireStaffWithRole() to skip a duplicate auth+profile round-trip. */
  userRole?: string;
};

function buildClientRow(c: ClientRow, fin: RpcFinancialRow | undefined): Client {
  const ob = toNum(c.opening_balance);
  const rep = fin ? toNum(fin.repair_billed) : 0;
  const dir = fin ? toNum(fin.direct_sales_billed) : 0;
  const svcPaid = fin ? toNum(fin.service_paid) : 0;
  const loan = fin ? toNum(fin.active_loan_given) : 0;
  const loanPaid = fin ? toNum(fin.loan_repaid) : 0;
  const due = computeClientDue({
    openingBalance: ob,
    repairBilled: rep,
    directSalesBilled: dir,
    servicePaid: svcPaid,
    activeLoanGiven: loan,
    loanRepaid: loanPaid,
  });
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
    balance: due.netBalance,
    last_txn_date: fin?.last_txn_date ? String(fin.last_txn_date) : null,
    image_path: c.image_path || undefined,
    login_allowed: !!c.login_allowed,
  };
}

/** Fast path: one RPC aggregates all financial rows in PostgreSQL (see migration). */
async function fetchFinancialsViaRpc(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>
): Promise<Map<number, RpcFinancialRow> | null> {
  const { data, error } = await supabase.rpc("get_clients_page_financials");
  if (error) return null;
  const map = new Map<number, RpcFinancialRow>();
  for (const row of (data as RpcFinancialRow[] | null) || []) {
    const id = toNum(row.client_id);
    if (id) map.set(id, row);
  }
  return map;
}

/** Slow fallback when RPC migration not yet applied — row-by-row fetch + JS aggregate. */
async function fetchFinancialsLegacy(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  ids: number[]
): Promise<Map<number, RpcFinancialRow>> {
  const inBatches = (arr: number[], size = 400): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

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

  const map = new Map<number, RpcFinancialRow>();
  for (const id of ids) {
    map.set(id, {
      client_id: id,
      repair_billed: m.repairBilled[id] ?? 0,
      direct_sales_billed: m.directSalesBilled[id] ?? 0,
      service_paid: m.servicePaid[id] ?? 0,
      active_loan_given: m.activeLoanGiven[id] ?? 0,
      loan_repaid: m.loanRepaid[id] ?? 0,
      last_txn_date: lastTxnMap[id] || null,
    });
  }
  return map;
}

/** meta_field keys the /clients page actually needs (firm vars + WA templates). */
const FIRM_INFO_KEYS = [
  "name",
  "contact",
  "address",
  "owner",
  "whatsapp_welcome",
  "whatsapp_reminder",
  "whatsapp_followup",
  "whatsapp_offer",
  "whatsapp_greeting",
  "wp_default_whatsapp_welcome",
  "wp_default_whatsapp_reminder",
  "wp_default_whatsapp_followup",
  "wp_default_whatsapp_offer",
  "wp_default_whatsapp_greeting",
];

export async function fetchClientsPageData(
  options: FetchClientsPageOptions = {}
): Promise<ClientsPageData> {
  const supabase = await getServerSupabase();

  const finPromise = fetchFinancialsViaRpc(supabase).catch(() => null);

  const [userRole, sysResult, clsResult, finResult] = await Promise.all([
    options.userRole
      ? Promise.resolve(options.userRole)
      : (async () => {
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

    supabase
      .from("system_info")
      .select("meta_field, meta_value")
      .in("meta_field", FIRM_INFO_KEYS),

    supabase
      .from("client_list")
      .select(
        "id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance, image_path, login_allowed"
      )
      .eq("delete_flag", 0),

    finPromise,
  ]);

  const firmInfo: Record<string, string> = {};
  ((sysResult.data as DbRow[] | null) || []).forEach((r) => {
    firmInfo[String(r.meta_field)] = String(r.meta_value ?? "");
  });

  const cls = clsResult.data;
  if (!cls?.length) {
    return { clients: [], firmInfo, userRole };
  }

  const clientRows = cls as ClientRow[];
  const ids = clientRows.map((c) => c.id);

  const finMap = finResult ?? (await fetchFinancialsLegacy(supabase, ids));

  const built = clientRows.map((c) => buildClientRow(c, finMap.get(c.id)));
  built.sort((a, b) => b.balance - a.balance);

  return { clients: built, firmInfo, userRole };
}
