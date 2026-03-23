import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr = (v: number, sign = true) => `${sign && v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
}

const STATUS_MAP: Record<number, string> = { 0: "Pending", 1: "On-Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered" };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("id");

  if (!clientId) {
    return NextResponse.json({ error: "Missing client id" }, { status: 400 });
  }

  const { data: client, error } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname, contact, email, address, opening_balance, date_created")
    .eq("id", parseInt(clientId))
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");

  const [{ data: repairs }, { data: payments }, { data: loans }, { data: directSales }] = await Promise.all([
    supabase.from("transaction_list").select("id, job_id, code, item, fault, remark, amount, status, date_created").eq("client_name", parseInt(clientId)).order("date_created", { ascending: false }),
    supabase.from("client_payments").select("id, amount, discount, payment_date, payment_mode, remarks, job_id, loan_id, created_at").eq("client_id", parseInt(clientId)).order("payment_date", { ascending: false }),
    supabase.from("client_loans").select("id, principal_amount, interest_rate, loan_period, total_payable, emi_amount, loan_date, status, created_at").eq("client_id", parseInt(clientId)).order("loan_date", { ascending: false }),
    supabase.from("direct_sales").select("id, sale_code, total_amount, payment_mode, remarks, date_created").eq("client_id", parseInt(clientId)).order("date_created", { ascending: false }),
  ]);

  const repairsList = repairs || [];
  const paymentsList = payments || [];
  const loansList = loans || [];
  const directSalesList = directSales || [];

  const totalBilled = repairsList.reduce((s, r) => s + toNum(r.amount), 0);
  const totalPaid = paymentsList.reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
  const netBalance = (client.opening_balance || 0) + totalBilled + directSalesList.reduce((s, d) => s + toNum(d.total_amount), 0) - totalPaid;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ledger - ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: white; color: #1a1a2e; padding: 40px; font-size: 13px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #001f3f; padding-bottom: 15px; }
    .shop-name { font-size: 24px; font-weight: 900; color: #001f3f; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    h1 { font-size: 18px; font-weight: 700; margin-top: 15px; color: #001f3f; }
    .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .summary { background: #f8f9fa; padding: 12px; border: 1px solid #ddd; margin: 15px 0; border-radius: 8px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .summary-label { font-weight: 600; }
    .summary-value { font-weight: 700; }
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    h2 { font-size: 14px; font-weight: 700; margin: 25px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; color: #001f3f; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #001f3f; color: #fff; padding: 8px 6px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    td { border: 1px solid #333; padding: 6px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .btn-group { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; }
    button { padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .btn-print { background: #001f3f; color: white; }
    .btn-close { background: #e5e7eb; color: #374151; }
    @media print { body { padding: 20px; } .btn-group { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="shop-name">V-Technologies</div>
    <div class="shop-address">F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002 | Ph: 9179105875</div>
    <h1>Client Ledger: ${name}</h1>
    <div class="subtitle">Client ID: #${clientId} | Print Date: ${fmtDate(new Date().toISOString())}</div>
  </div>

  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">Opening Balance:</span>
      <span class="summary-value">${inr(toNum(client.opening_balance))}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Billed:</span>
      <span class="summary-value negative">${inr(totalBilled)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Direct Sales:</span>
      <span class="summary-value negative">${inr(directSalesList.reduce((s, d) => s + toNum(d.total_amount), 0))}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Total Paid:</span>
      <span class="summary-value positive">${inr(totalPaid)}</span>
    </div>
    <div class="summary-row" style="border-top: 2px solid #ddd; margin-top: 5px; padding-top: 8px;">
      <span class="summary-label"><strong>Net Balance:</strong></span>
      <span class="summary-value ${netBalance >= 0 ? 'negative' : 'positive'}"><strong>${inr(netBalance)}</strong></span>
    </div>
  </div>

  ${repairsList.length > 0 ? `
  <h2>Repair History (${repairsList.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Job ID</th>
        <th>Code</th>
        <th>Item</th>
        <th>Status</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${repairsList.map(r => `
      <tr>
        <td>${fmtDate(r.date_created)}</td>
        <td>${r.job_id}</td>
        <td>${r.code || '-'}</td>
        <td>${r.item || '-'}</td>
        <td>${STATUS_MAP[r.status] || '-'}</td>
        <td class="text-right negative">${inr(toNum(r.amount))}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${directSalesList.length > 0 ? `
  <h2>Direct Sales (${directSalesList.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Sale Code</th>
        <th class="text-right">Amount</th>
        <th>Payment Mode</th>
      </tr>
    </thead>
    <tbody>
      ${directSalesList.map(s => `
      <tr>
        <td>${fmtDate(s.date_created)}</td>
        <td>${s.sale_code}</td>
        <td class="text-right negative">${inr(toNum(s.total_amount))}</td>
        <td>${s.payment_mode || '-'}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${paymentsList.length > 0 ? `
  <h2>Payments Received (${paymentsList.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Ref</th>
        <th class="text-right">Amount</th>
        <th class="text-right">Discount</th>
        <th class="text-right">Net</th>
        <th>Mode</th>
      </tr>
    </thead>
    <tbody>
      ${paymentsList.map(p => `
      <tr>
        <td>${fmtDate(p.payment_date)}</td>
        <td>${p.job_id || "Direct"}</td>
        <td class="text-right positive">${inr(toNum(p.amount))}</td>
        <td class="text-right">${inr(toNum(p.discount))}</td>
        <td class="text-right positive">${inr(toNum(p.amount) + toNum(p.discount))}</td>
        <td>${p.payment_mode}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${loansList.length > 0 ? `
  <h2>Loans (${loansList.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th class="text-right">Principal</th>
        <th class="text-right">Interest %</th>
        <th class="text-right">Total</th>
        <th class="text-right">EMI</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${loansList.map(l => `
      <tr>
        <td>${fmtDate(l.loan_date)}</td>
        <td class="text-right">${inr(toNum(l.principal_amount))}</td>
        <td class="text-right">${l.interest_rate}%</td>
        <td class="text-right">${inr(toNum(l.total_payable))}</td>
        <td class="text-right">${inr(toNum(l.emi_amount))}</td>
        <td>${l.status === 1 ? "Active" : "Closed"}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

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