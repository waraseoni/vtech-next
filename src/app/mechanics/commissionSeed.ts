import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthIST } from "@/lib/dateUtils";

/**
 * `/mechanics/commission` statement tab ka neutral server query — default
 * (current month, all staff) ke liye. Caller cookie+RLS client pass karta hai.
 * Master tab seed nahi hota; woh client-side fetch hi rehta hai.
 */

export type CommissionRow = {
  id: number;
  job_id: string;
  code: string | null;
  item: string;
  client_name: string;
  date_created: string;
  date_completed: string | null;
  mechanic_id: number;
  m_name: string;
  m_image: string | null;
  rate: number;
  service_amount: number;
  mechanic_commission_amount: number;
};

export type CommissionSeed = {
  month: string;
  rows: CommissionRow[];
  mechanics: { id: number; name: string }[];
};

export async function fetchCommissionSeed(
  supabase: SupabaseClient
): Promise<CommissionSeed | null> {
  const month = currentMonthIST();
  const from = `${month}-01T00:00:00+05:30`;
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;

  const [mechRes, txnRes] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, commission_percent, delete_flag, image_path")
      .order("firstname"),
    supabase
      .from("transaction_list")
      .select(
        "id, job_id, code, item, client_name, date_created, date_completed, mechanic_id, mechanic_commission_amount"
      )
      .eq("status", 5)
      .gte("date_completed", from)
      .lte("date_completed", to),
  ]);

  if (mechRes.error) throw mechRes.error;
  if (txnRes.error) throw txnRes.error;

  const mechData = mechRes.data || [];
  const txns = txnRes.data || [];

  const mechanics = mechData
    .filter((mech) => mech.delete_flag === 0)
    .map((mech) => ({
      id: mech.id,
      name: [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" "),
    }));

  const mechMap = new Map(
    mechData.map((mech) => [
      mech.id,
      {
        name: [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" "),
        image: mech.image_path || null,
        rate: mech.commission_percent || 0,
      },
    ])
  );

  const txnIds = txns.map((t) => t.id);
  const svcMap: Record<number, number> = {};
  if (txnIds.length > 0) {
    const { data: svcs } = await supabase
      .from("transaction_services")
      .select("transaction_id, price")
      .in("transaction_id", txnIds);
    svcs?.forEach((s) => {
      svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0);
    });
  }

  const clientIds = [...new Set(txns.map((t) => Number(t.client_name)).filter(Boolean))];
  const clientMap = new Map<number, string>();
  if (clientIds.length > 0) {
    const { data: clRows } = await supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname")
      .in("id", clientIds);
    (clRows || []).forEach((c) =>
      clientMap.set(c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "))
    );
  }

  const mechIds = [...new Set(txns.map((t) => t.mechanic_id))];
  const histByMech: Record<
    number,
    { effective_date: string; id: number; commission_percent: number }[]
  > = {};
  if (mechIds.length > 0) {
    const { data: histRows } = await supabase
      .from("mechanic_commission_history")
      .select("id, mechanic_id, commission_percent, effective_date")
      .in("mechanic_id", mechIds);
    (histRows || []).forEach((h) => {
      if (!histByMech[h.mechanic_id]) histByMech[h.mechanic_id] = [];
      histByMech[h.mechanic_id].push({
        effective_date: h.effective_date,
        id: h.id,
        commission_percent: h.commission_percent,
      });
    });
    Object.values(histByMech).forEach((arr) =>
      arr.sort((a, b) =>
        a.effective_date < b.effective_date
          ? 1
          : a.effective_date > b.effective_date
            ? -1
            : b.id - a.id
      )
    );
  }
  const effRateFor = (mechId: number, onDate: string, fallback: number): number => {
    const on = (onDate || "").slice(0, 10);
    const hist = histByMech[mechId] || [];
    for (const h of hist) {
      if (h.effective_date <= on) return h.commission_percent;
    }
    return fallback;
  };

  const rows: CommissionRow[] = txns.map((t) => {
    const mech = mechMap.get(t.mechanic_id);
    return {
      id: t.id,
      job_id: t.job_id || String(t.id),
      code: t.code || null,
      item: t.item || "",
      client_name: clientMap.get(Number(t.client_name)) || "",
      date_created: t.date_created,
      date_completed: t.date_completed,
      mechanic_id: t.mechanic_id,
      m_name: mech?.name || "Unknown",
      m_image: mech?.image || null,
      rate: effRateFor(t.mechanic_id, t.date_created, mech?.rate || 0),
      service_amount: svcMap[t.id] || 0,
      mechanic_commission_amount: t.mechanic_commission_amount || 0,
    };
  });

  rows.sort(
    (a, b) =>
      new Date(b.date_completed || b.date_created).getTime() -
      new Date(a.date_completed || a.date_created).getTime()
  );

  return { month, rows, mechanics };
}
