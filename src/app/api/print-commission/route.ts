import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const mechanicId = searchParams.get("mechanic_id") || "all";

  const from = `${month}-01T00:00:00`;
  const toDate = new Date(month + "-01");
  toDate.setMonth(toDate.getMonth() + 1);
  const to = toDate.toISOString().split("T")[0] + "T23:59:59";

  const { data: mechData } = await supabase
    .from("mechanic_list").select("id, firstname, middlename, lastname")
    .eq("delete_flag", 0).order("firstname");

  let q = supabase
    .from("transaction_list").select("id, job_id, code, date_created, mechanic_id, mechanic_commission_amount")
    .gte("date_created", from).lte("date_created", to);
  if (mechanicId !== "all") q = q.eq("mechanic_id", parseInt(mechanicId));
  const { data: txns } = await q;

  const enriched: { id: number; job_id: string; code: string | null; date_created: string; m_name: string; service_amount: number; mechanic_commission_amount: number; }[] = [];

  for (const t of txns || []) {
    const mech = (mechData || []).find((m: { id: number }) => m.id === t.mechanic_id);
    const mechName = mech ? [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ") : "Unknown";
    const { data: svcTotal } = await supabase.from("transaction_services").select("price").eq("transaction_id", t.id);
    const svcAmt = svcTotal?.reduce((s: number, r: { price: number }) => s + (r.price || 0), 0) || 0;
    enriched.push({
      id: t.id,
      job_id: t.job_id || String(t.id),
      code: t.code,
      date_created: t.date_created,
      m_name: mechName,
      service_amount: svcAmt,
      mechanic_commission_amount: t.mechanic_commission_amount || 0,
    });
  }

  enriched.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

  const totalComm = enriched.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0);
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Commission Report - ${monthLabel}</title>
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
    <h1>Mechanic Commission Report</h1>
    <div class="subtitle">${monthLabel} | Date: ${formatDate(new Date().toISOString())}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Job ID / Code</th>
        <th>Staff</th>
        <th style="text-align:right">Service Amount</th>
        <th style="text-align:right">Commission</th>
      </tr>
    </thead>
    <tbody>
      ${enriched.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${formatDate(r.date_created)}</td>
        <td><strong>${r.job_id}</strong>${r.code ? "<br><span style='color:#666;font-size:10px'>" + r.code + "</span>" : ""}</td>
        <td>${r.m_name}</td>
        <td style="text-align:right">${inr(r.service_amount)}</td>
        <td style="text-align:right;color:#059669">${inr(r.mechanic_commission_amount)}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="text-align:right">Total Commission:</td>
        <td></td>
        <td style="text-align:right;color:#059669">${inr(totalComm)}</td>
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