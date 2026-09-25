// ─── Sprint 4 #17 (SSR): direct-sales list server-rendered ─────────────────
// Filters URL se aate hain (?from/?to/?payment_mode) — Apply/Month/Reset
// router.push karte hain, server taza data bhejta hai. Pehla paint me data
// ke saath HTML aata hai (koi client waterfall / full-page loader nahi).
import { Suspense } from "react";
import { getServerSupabase } from "@/lib/api-auth";
import { startOfMonthIST, todayIST } from "@/lib/dateUtils";
import {
  DirectSalesClient,
  type DirectSale,
  type SaleStats,
} from "./DirectSalesClient";

interface SaleSearchParams {
  from?: string;
  to?: string;
  payment_mode?: string;
}

export default async function DirectSalesPage({
  searchParams,
}: {
  searchParams: Promise<SaleSearchParams>;
}) {
  const sp = await searchParams;
  const from = sp.from || startOfMonthIST();
  const to = sp.to || todayIST();
  const payment = sp.payment_mode || "all";

  const supabase = await getServerSupabase();

  let query = supabase
    .from("direct_sales")
    .select("*")
    .gte("date_created", `${from}T00:00:00+05:30`)
    .lte("date_created", `${to}T23:59:59+05:30`)
    .order("date_created", { ascending: false });
  if (payment !== "all") query = query.eq("payment_mode", payment);

  const [{ data: salesData }, { data: sysRows }] = await Promise.all([
    query,
    supabase.from("system_info").select("meta_field, meta_value"),
  ]);

  const sysInfo: Record<string, string> = {};
  (sysRows || []).forEach((r) => {
    sysInfo[r.meta_field] = r.meta_value;
  });

  let sales: DirectSale[] = [];
  let stats: SaleStats = {
    totalSales: 0,
    totalAmount: 0,
    avgAmount: 0,
    cashTotal: 0,
    upiTotal: 0,
  };

  if (salesData?.length) {
    const clientIds = [...new Set(salesData.map((s) => s.client_id).filter(Boolean))];
    const mechIds = [...new Set(salesData.map((s) => s.mechanic_id).filter(Boolean))];
    const editorIds = [
      ...new Set(salesData.map((s) => s.last_edited_by).filter((id) => id != null && id !== 0)),
    ];

    const [clientsRes, mechsRes, editorsRes, repRes, dirAllRes, payRes, loanRes] =
      await Promise.all([
        clientIds.length
          ? supabase
              .from("client_list")
              .select("id, firstname, middlename, lastname, contact, image_path, opening_balance")
              .in("id", clientIds)
          : Promise.resolve({ data: [] }),
        mechIds.length
          ? supabase.from("mechanic_list").select("id, firstname, lastname").in("id", mechIds)
          : Promise.resolve({ data: [] }),
        editorIds.length
          ? supabase.from("mechanic_list").select("id, firstname, lastname").in("id", editorIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? supabase
              .from("transaction_list")
              .select("client_name, amount")
              .eq("status", 5)
              .in("client_name", clientIds.map(String))
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? supabase
              .from("direct_sales")
              .select("client_id, total_amount")
              .in("client_id", clientIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? supabase
              .from("client_payments")
              .select("client_id, amount, discount")
              .in("client_id", clientIds)
          : Promise.resolve({ data: [] }),
        clientIds.length
          ? supabase
              .from("client_loans")
              .select("client_id, total_payable")
              .in("client_id", clientIds)
          : Promise.resolve({ data: [] }),
      ]);

    // Per-client outstanding due map (client formula mirror)
    const dueMap = new Map<number, number>();
    (clientsRes.data || []).forEach((c) => dueMap.set(c.id, Number(c.opening_balance) || 0));
    (repRes.data || []).forEach((r) => {
      const cid = parseInt(r.client_name ?? "", 10);
      if (!isNaN(cid)) dueMap.set(cid, (dueMap.get(cid) || 0) + (Number(r.amount) || 0));
    });
    (dirAllRes.data || []).forEach((d) => {
      if (d.client_id)
        dueMap.set(d.client_id, (dueMap.get(d.client_id) || 0) + (Number(d.total_amount) || 0));
    });
    (payRes.data || []).forEach((p) => {
      if (p.client_id)
        dueMap.set(
          p.client_id,
          (dueMap.get(p.client_id) || 0) - ((Number(p.amount) || 0) + (Number(p.discount) || 0))
        );
    });
    (loanRes.data || []).forEach((l) => {
      if (l.client_id)
        dueMap.set(l.client_id, (dueMap.get(l.client_id) || 0) + (Number(l.total_payable) || 0));
    });

    const cMap = new Map(
      (clientsRes.data || []).map((c) => [
        c.id,
        {
          name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" "),
          contact: c.contact,
          image_path: c.image_path,
        },
      ])
    );
    const mMap = new Map(
      (mechsRes.data || []).map((m) => [m.id, `${m.firstname} ${m.lastname}`])
    );
    const eMap = new Map(
      (editorsRes.data || []).map((e) => [e.id, `${e.firstname} ${e.lastname}`])
    );

    sales = salesData.map((s) => {
      const c = cMap.get(s.client_id);
      return {
        ...s,
        client_name: c?.name || null,
        client_contact: c?.contact || null,
        client_image: c?.image_path || null,
        client_due: s.client_id ? (dueMap.get(s.client_id) ?? null) : null,
        staff_name: mMap.get(s.mechanic_id) || "Admin",
        last_editor_name: s.last_edited_by === 0 ? "Admin" : eMap.get(s.last_edited_by) || null,
      };
    });

    const totalSales = sales.length;
    const totalAmount = sales.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const cashTotal = sales
      .filter((r) => r.payment_mode === "Cash")
      .reduce((sum, r) => sum + r.total_amount, 0);
    const upiTotal = sales
      .filter((r) => r.payment_mode === "UPI")
      .reduce((sum, r) => sum + r.total_amount, 0);
    stats = {
      totalSales,
      totalAmount,
      avgAmount: totalSales ? totalAmount / totalSales : 0,
      cashTotal,
      upiTotal,
    };
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <DirectSalesClient
        initialSales={sales}
        initialStats={stats}
        initialSysInfo={sysInfo}
        initialFrom={from}
        initialTo={to}
        initialPayment={payment}
      />
    </Suspense>
  );
}
