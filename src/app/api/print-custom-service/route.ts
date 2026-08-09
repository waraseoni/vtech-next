import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const fromTs = `${from}T00:00:00+05:30`;
  const toTs = `${to}T23:59:59+05:30`;

  const tsData = await fetchAll(
    supabase
      .from("transaction_services").select("service_id, price, date_updated, transaction_id")
      .gte("date_updated", fromTs).lte("date_updated", toTs)
  );

  const txnIds = [...new Set(tsData?.map((t: { transaction_id: number }) => t.transaction_id) || [])];
  const txns = [];
  for (let i = 0; i < txnIds.length; i += 500) {
    txns.push(...(await fetchAll(
      supabase.from("transaction_list").select("id, code, client_name, status, date_updated")
        .in("id", txnIds.slice(i, i + 500)).in("status", [1, 2, 3, 5])
    )));
  }

  const clients = await fetchAll(supabase.from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0));
  const services = await fetchAll(supabase.from("service_list").select("id, name, description").eq("delete_flag", 0));

  const serviceRows: { date_updated: string; code: string | null; client_name: string; service_name: string; description: string | null; price: number; }[] = [];

  for (const ts of tsData || []) {
    const txn = (txns || []).find((t: { id: number }) => t.id === ts.transaction_id);
    if (!txn) continue;
    const client = (clients || []).find((c: { id: number }) => c.id === txn.client_name);
    const service = (services || []).find((s: { id: number }) => s.id === ts.service_id);
    serviceRows.push({
      date_updated: ts.date_updated || txn.date_updated,
      code: txn.code,
      client_name: client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : "Walk-in",
      service_name: service?.name || "Unknown",
      description: service?.description || null,
      price: ts.price || 0,
    });
  }

  serviceRows.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

  const total = serviceRows.reduce((s, r) => s + r.price, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Custom Service Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f8f9fa; padding: 12px 8px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    tfoot td { border-top: 2px solid #ddd; background: #f8f9fa; font-weight: 700; }
    .total-row td { font-size: 14px; }
    .btn-group { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; }
    button { padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .btn-print { background: #1a1a2e; color: white; }
    .btn-close { background: #e5e7eb; color: #374151; }
    @media print { body { padding: 20px; } .btn-group { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="shop-name">V-Technologies</div>
    <div class="shop-address">F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002</div>
    <div class="shop-contact">Mobile: 9179105875</div>
    <h1>Custom Service Report (Labor Charges)</h1>
    <div class="subtitle">${formatDate(from + "T00:00:00+05:30")} — ${formatDate(to + "T23:59:59+05:30")} | Date: ${formatDate(new Date().toISOString())}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Code</th>
        <th>Client</th>
        <th>Service Name</th>
        <th>Description</th>
        <th style="text-align:right">Price</th>
      </tr>
    </thead>
    <tbody>
      ${serviceRows.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${formatDate(r.date_updated)}</td>
        <td>${r.code || "—"}</td>
        <td>${r.client_name}</td>
        <td>${r.service_name}</td>
        <td>${r.description || "—"}</td>
        <td style="text-align:right;color:#059669">${inr(r.price)}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" style="text-align:right">Total Service Charges:</td>
        <td style="text-align:right;color:#059669">${inr(total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="btn-group">
    <button class="btn-close" onclick="window.close()">Close</button>
    <button class="btn-print" onclick="window.print()">Print (Ctrl+P)</button>
  </div>
  <script>
    document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "p") { e.preventDefault(); window.print(); } });
  </script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}