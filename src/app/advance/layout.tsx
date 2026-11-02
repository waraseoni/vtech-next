import { loadStaffSeed } from "@/lib/server-seed";
import { ServerSeedProvider } from "@/app/components/ServerSeed";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type MechanicRow = { id: number; firstname: string; middlename: string | null; lastname: string };
type AdvanceSeedRow = {
  id: number;
  mechanic_id: number;
  name: string;
  amount: number;
  date_paid: string;
  reason: string | null;
};
type AdvanceSeed = {
  from: string;
  to: string;
  mechanics: MechanicRow[];
  rows: AdvanceSeedRow[];
};

async function fetchAdvanceSeed(supabase: SupabaseClient): Promise<AdvanceSeed> {
  const from = startOfMonthIST();
  const to = todayIST();

  const [{ data: mechData }, { data }] = await Promise.all([
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .eq("status", 1)
      .eq("delete_flag", 0),
    supabase
      .from("advance_payments")
      .select("id, mechanic_id, amount, date_paid, reason")
      .gte("date_paid", from)
      .lte("date_paid", to)
      .order("date_paid", { ascending: false }),
  ]);

  const mechanics = (mechData || []) as MechanicRow[];
  const rows = (data || []).map((r) => {
    const mech = mechanics.find((m) => m.id === r.mechanic_id);
    return {
      ...r,
      name: mech
        ? [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ")
        : "Unknown",
    } as AdvanceSeedRow;
  });

  return { from, to, mechanics, rows };
}

export default async function AdvanceLayout({ children }: { children: React.ReactNode }) {
  const seed = await loadStaffSeed("Advance ledger", fetchAdvanceSeed);
  return (
    <ServerSeedProvider seedKey="advance" data={seed}>
      {children}
    </ServerSeedProvider>
  );
}
