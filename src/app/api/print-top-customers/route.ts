import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const filterType = searchParams.get("filterType") || "yearly";
  const selYear = parseInt(searchParams.get("selYear") || new Date().getFullYear().toString());
  const selMonth = parseInt(searchParams.get("selMonth") || new Date().getMonth().toString());

  let from: string, to: string;
  if (filterType === "monthly") {
    const d = new Date(selYear, selMonth - 1, 1);
    from = d.toISOString().slice(0, 10) + "T00:00:00+05:30";
    const lastDay = new Date(selYear, selMonth, 0).toISOString().slice(0, 10);
    to = lastDay + "T23:59:59+05:30";
  } else if (filterType === "yearly") {
    from = `${selYear}-01-01T00:00:00+05:30`;
    to = `${selYear}-12-31T23:59:59+05:30`;
  } else {
    from = "2000-01-01T00:00:00+05:30";
    to = new Date().toISOString();
  }

  const clients = await fetchAll(
    supabase
      .from("client_list").select("id, firstname, middlename, lastname, contact")
      .eq("delete_flag", 0)
  );

  const topRows: { client_id: number; customer_name: string; contact: string | null; total_jobs: number; total_amount: number; total_payment: number; current_balance: number; }[] = [];

  for (const c of clients || []) {
    const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");

    const txns = await fetchAll(
      supabase
        .from("transaction_list").select("id, amount, date_created")
        .eq("client_name", c.id).in("status", [3, 5])
        .gte("date_created", from).lte("date_created", to)
    );

    const pmts = await fetchAll(
      supabase
        .from("client_payments").select("amount, discount, payment_date")
        .eq("client_id", c.id)
        .gte("payment_date", from.split("T")[0]).lte("payment_date", to.split("T")[0])
    );

    const totalAmt = txns?.reduce((s: number, t: { amount: number }) => s + (t.amount || 0), 0) || 0;
    const totalPmt = pmts?.reduce((s: number, p: { amount: number; discount: number }) => s + (p.amount || 0) + (p.discount || 0), 0) || 0;

    if (totalAmt > 0 || totalPmt > 0) {
      topRows.push({
        client_id: c.id,
        customer_name: name,
        contact: c.contact,
        total_jobs: txns?.length || 0,
        total_amount: totalAmt,
        total_payment: totalPmt,
        current_balance: totalAmt - totalPmt,
      });
    }
  }

  topRows.sort((a, b) => b.total_amount - a.total_amount);
  const rows = topRows.slice(0, 20);

  const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0);
  const grandPayment = rows.reduce((s, r) => s + r.total_payment, 0);
  const grandBalance = rows.reduce((s, r) => s + r.current_balance, 0);

  const filterLabel = filterType === "monthly"
    ? new Date(selYear, selMonth - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })
    : filterType === "yearly" ? `${selYear}` : "All Time";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Top Customers - ${filterLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-box { flex: 1; padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
    .summary-label { font-size: 11px; text-transform: uppercase; color: #666; font-weight: 600; }
    .summary-value { font-size: 20px; font-weight: 800; margin-top: 4px; }
    .summary-value.green { color: #059669; }
    .summary-value.teal { color: #0d9488; }
    .summary-value.blue { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f8f9fa; padding: 12px 8px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    td.num { text-align: right; font-weight: 600; }
    .rank { text-align: center; font-size: 16px; }
    .rank-1 { color: #f59e0b; }
    .rank-2 { color: #9ca3af; }
    .rank-3 { color: #b45309; }
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
    <h1>Top Customers Report</h1>
    <div class="subtitle">Period: ${filterLabel} | Date: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary">
    <div class="summary-box">
      <div class="summary-label">Total Revenue</div>
      <div class="summary-value green">${inr(grandTotal)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Total Collected</div>
      <div class="summary-value teal">${inr(grandPayment)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Outstanding</div>
      <div class="summary-value blue">${inr(grandBalance)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Customer</th>
        <th>Contact</th>
        <th>Jobs</th>
        <th style="text-align:right">Total Amount</th>
        <th style="text-align:right">Payment</th>
        <th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r, i) => `
      <tr>
        <td class="rank">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
        <td>${r.customer_name}</td>
        <td>${r.contact || "—"}</td>
        <td style="text-align:center">${r.total_jobs}</td>
        <td class="num" style="color:#059669">${inr(r.total_amount)}</td>
        <td class="num" style="color:#0d9488">${inr(r.total_payment)}</td>
        <td class="num" style="color:${r.current_balance >= 0 ? "#2563eb" : "#dc2626"}">${inr(Math.abs(r.current_balance))}</td>
      </tr>`).join("")}
    </tbody>
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