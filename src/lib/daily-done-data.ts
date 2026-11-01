/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Daily-done report data — single source of truth for `/reports/daily-done`
 * ka server first paint aur client refetch.
 *
 * Dual-era status logs (docs/DATA_MIGRATION_NOTES.md): legacy PHP
 * `Transactions / Transaction Status Changed` aur modern
 * `Jobs / Updated Job Status` dono se "→ Done" transition nikalti hai.
 */

type SupabaseLike = { from: (table: string) => any };

export type DailyDoneItem = {
  id: string;
  done_at: string;
  transaction_id: string;
  job_id: string;
  code: string;
  item: string;
  amount: number;
  remark: string;
  status: number;
  delivered_at: string | null;
  client_id: string;
  client_name: string;
  client_contact: string;
  client_image: string | null;
  mechanic_name: string;
  mechanic_image: string | null;
};

export type DailyDoneMechanic = {
  id: string;
  name: string;
  image: string | null;
};

type TxnRow = {
  id: number | string;
  job_id?: string | number | null;
  client_name?: string | number | null;
  mechanic_id?: number | string | null;
  code?: string | null;
  item?: string | null;
  amount?: number | string | null;
  remark?: string | null;
  status: number;
  date_completed?: string | null;
};

const DONE_LABELS = new Set(["done", "ready"]);
const STATUS_LABEL_RE = /(?:→|->)\s*(done|ready|on-progress|pending|paid|cancelled|delivered)/i;

export const parseDoneTransition = (details?: string | null): boolean => {
  if (!details) return false;
  const direct = details.match(/Status changed to:\s*([A-Za-z][A-Za-z\s-]*)/i);
  if (direct) return DONE_LABELS.has(direct[1].trim().toLowerCase());
  const arrowMatch = details.match(STATUS_LABEL_RE);
  if (arrowMatch) return DONE_LABELS.has(arrowMatch[1].toLowerCase());
  return false;
};

export async function fetchDailyDoneFirmInfo(
  supabase: SupabaseLike
): Promise<Record<string, string>> {
  const { data: sys } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  (sys || []).forEach((r: Record<string, any>) => {
    info[r.meta_field] = r.meta_value;
  });
  return info;
}

export async function fetchDailyDoneMechanics(
  supabase: SupabaseLike
): Promise<DailyDoneMechanic[]> {
  const { data, error } = await supabase
    .from("mechanic_list")
    .select("id, firstname, lastname, image_path")
    .eq("status", 1)
    .order("firstname");
  if (error) throw error;
  return (data || []).map((m: Record<string, any>) => ({
    id: m.id.toString(),
    name: `${m.firstname} ${m.lastname}`.trim(),
    image: m.image_path || null,
  }));
}

export async function fetchDailyDoneItems(
  supabase: SupabaseLike,
  date: string,
  selectedMechanic: string
): Promise<DailyDoneItem[]> {
  const dayStart = date + "T00:00:00+05:30";
  const dayEnd = date + "T23:59:59+05:30";

  // 1) Dono yug ke status-change logs is din ke — done = "→ Done" transition.
  //    (meta_id: legacy → transaction_list.id, modern → id/job_id)
  const eraConfigs = [
    { module: "Transactions", action: "Transaction Status Changed" },
    { module: "Jobs", action: "Updated Job Status" },
  ];
  const doneLogs: Array<{ meta_id: string; date_created: string }> = [];
  for (const era of eraConfigs) {
    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("meta_id, details, date_created")
      .eq("module", era.module)
      .eq("action", era.action)
      .gte("date_created", dayStart)
      .lte("date_created", dayEnd);
    if (error) throw error;
    for (const log of logs || []) {
      if (parseDoneTransition(log.details) && log.meta_id) {
        doneLogs.push({ meta_id: String(log.meta_id), date_created: log.date_created });
      }
    }
  }
  if (doneLogs.length === 0) return [];

  // meta_id → us din ka earliest done-log time
  const doneTimeByMeta = new Map<string, string>();
  for (const log of doneLogs) {
    const cur = doneTimeByMeta.get(log.meta_id);
    if (!cur || log.date_created < cur) doneTimeByMeta.set(log.meta_id, log.date_created);
  }

  // 2) Meta ids ko transaction_list par resolve karo — id pehla, job_id fallback.
  const metaIds = [...doneTimeByMeta.keys()];
  const txnById = await supabase
    .from("transaction_list")
    .select("*")
    .in("status", [2, 3, 5])
    .in("id", metaIds);
  if (txnById.error) throw txnById.error;
  const txnByJob = await supabase
    .from("transaction_list")
    .select("*")
    .in("status", [2, 3, 5])
    .in("job_id", metaIds);
  if (txnByJob.error) throw txnByJob.error;

  const seen = new Set<string>();
  const doneMap = new Map<string, { txn: TxnRow; doneAt: string }>();
  const rows = [...(txnById.data || []), ...(txnByJob.data || [])] as TxnRow[];
  for (const row of rows) {
    const key = String(row.id);
    if (seen.has(key)) continue;
    seen.add(key);
    // Lookup pehle txn.id (canonical), phir txn.job_id
    const doneAt = doneTimeByMeta.get(String(row.id)) || doneTimeByMeta.get(String(row.job_id));
    if (!doneAt) continue;
    doneMap.set(key, { txn: row, doneAt });
  }

  let uniqueTransactions = [...doneMap.values()];
  if (selectedMechanic !== "all") {
    uniqueTransactions = uniqueTransactions.filter(
      (e) => String(e.txn.mechanic_id) === selectedMechanic
    );
  }
  uniqueTransactions.sort((a, b) => a.doneAt.localeCompare(b.doneAt));

  if (uniqueTransactions.length === 0) return [];

  const clientIds = [...new Set(uniqueTransactions.map((e) => e.txn.client_name).filter(Boolean))];
  const { data: clientData } = await supabase
    .from("client_list")
    .select("id, firstname, lastname, image_path, contact")
    .in("id", clientIds);
  const clientMap = new Map<string, Record<string, any>>(
    clientData?.map((c: Record<string, any>) => [c.id.toString(), c]) || []
  );

  const mechIds = [...new Set(uniqueTransactions.map((e) => e.txn.mechanic_id).filter(Boolean))];
  const { data: mechData } = await supabase
    .from("mechanic_list")
    .select("id, firstname, lastname, image_path")
    .in("id", mechIds);
  const mechMap = new Map<string, Record<string, any>>(
    mechData?.map((m: Record<string, any>) => [m.id.toString(), m]) || []
  );

  return uniqueTransactions.map(({ txn: tx, doneAt }) => {
    const client = clientMap.get(tx.client_name?.toString() || "");
    const mech = mechMap.get(tx.mechanic_id?.toString() || "");
    return {
      id: tx.id.toString(),
      done_at: doneAt,
      transaction_id: tx.id.toString(),
      job_id: tx.job_id ? String(tx.job_id) : "-",
      code: tx.code || "-",
      item: tx.item || "-",
      amount: Number(tx.amount) || 0,
      remark: tx.remark || "",
      status: tx.status,
      delivered_at: tx.date_completed || null,
      client_id: client?.id?.toString() || "",
      client_name: client ? `${client.firstname} ${client.lastname}`.trim() : "Unknown",
      client_contact: client?.contact || "",
      client_image: client?.image_path || null,
      mechanic_name: mech ? `${mech.firstname} ${mech.lastname}`.trim() : "Not Assigned",
      mechanic_image: mech?.image_path || null,
    };
  });
}
