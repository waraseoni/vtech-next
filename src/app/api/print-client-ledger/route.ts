import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { pageAll } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const inr = (v: number, sign = true) => `${sign && v < 0 ? "−" : ""}₹${Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function fmtDate(d: string | null) {
  return d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)) : "N/A";
}

const STATUS_MAP: Record<number, string> = { 0: "Pending", 1: "On-Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered" };

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
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
    pageAll(supabase.from("transaction_list").select("id, job_id, code, item, fault, remark, amount, status, date_created").eq("client_name", parseInt(clientId)).order("date_created", { ascending: false })),
    pageAll(supabase.from("client_payments").select("id, amount, discount, payment_date, payment_mode, remarks, job_id, loan_id, created_at").eq("client_id", parseInt(clientId)).order("payment_date", { ascending: false })),
    pageAll(supabase.from("client_loans").select("id, principal_amount, interest_rate, loan_period, total_payable, emi_amount, loan_date, status, created_at").eq("client_id", parseInt(clientId)).order("loan_date", { ascending: false })),
    pageAll(supabase.from("direct_sales").select("id, sale_code, total_amount, payment_mode, remarks, date_created").eq("client_id", parseInt(clientId)).order("date_created", { ascending: false })),
  ]);

  const repairsList = repairs || [];
  const paymentsList = payments || [];
  const loansList = loans || [];
  const directSalesList = directSales || [];

  const totalBilled = repairsList.reduce((s, r) => s + toNum(r.amount), 0);
  const totalPaid = paymentsList.reduce((s, p) => s + toNum(p.amount) + toNum(p.discount), 0);
  const directSalesTotal = directSalesList.reduce((s, d) => s + toNum(d.total_amount), 0);
  const netBalance = (client.opening_balance || 0) + totalBilled + directSalesTotal - totalPaid;

  const repairRows = repairsList.length > 0 ? repairsList.map((r, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(r.date_created)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${r.job_id}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${r.code || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${r.item || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${STATUS_MAP[r.status] || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:#c0392b">${inr(toNum(r.amount))}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#666">No repairs</td></tr>';

  const salesRows = directSalesList.length > 0 ? directSalesList.map((s, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(s.date_created)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${s.sale_code}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:#c0392b">${inr(toNum(s.total_amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${s.payment_mode || '-'}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#666">No direct sales</td></tr>';

  const paymentRows = paymentsList.length > 0 ? paymentsList.map((p, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(p.payment_date)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${p.job_id || "Direct"}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:#28a745">${inr(toNum(p.amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(toNum(p.discount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:#28a745">${inr(toNum(p.amount) + toNum(p.discount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${p.payment_mode || '-'}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#666">No payments</td></tr>';

  const loanRows = loansList.length > 0 ? loansList.map((l, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(l.loan_date)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(toNum(l.principal_amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${l.interest_rate}%</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(toNum(l.total_payable))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(toNum(l.emi_amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${l.status === 1 ? "Active" : "Closed"}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#666">No loans</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Client Ledger — ${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:900px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;flex-wrap:wrap}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;flex:1;min-width:100px}
    .stat-num{font-size:20px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
    .client-info{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:12px 20px;margin:14px 20px}
    .client-name{font-size:16px;font-weight:700;color:#001f3f}
    .client-detail{font-size:12px;color:#666;margin-top:4px}
    h2{font-size:14px;font-weight:700;color:#001f3f;padding:12px 20px 8px;border-bottom:2px solid #001f3f;background:#f8f9fa}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#001f3f}
    th{padding:10px 8px;color:#fff;font-size:11px;font-weight:700;text-align:left}
    .actions{text-align:center;padding:16px;background:#f8f9fa;border-top:1px solid #dee2e6}
    .btn{padding:10px 22px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;margin:4px;display:inline-flex;align-items:center;gap:6px}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .footer{text-align:center;color:#666;font-size:11px;padding:10px}
    @media print{
      @page{margin:.8cm;size:A4 portrait}
      body{background:#fff;padding:0}
      .actions{display:none!important}
      .card{box-shadow:none;border:1px solid #ddd}
      .hdr{background:#001f3f!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      thead tr{background:#001f3f!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <h1>📋 ${SHOP.name} — Client Ledger</h1>
      <p>Client: ${name} | ID: #${clientId} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="client-info">
      <div class="client-name">${name}</div>
      <div class="client-detail">Contact: ${client.contact || '-'} | Email: ${client.email || '-'} | Address: ${client.address || '-'}</div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${inr(toNum(client.opening_balance))}</div>
        <div class="stat-label">Opening</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalBilled)}</div>
        <div class="stat-label">Total Billed</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(directSalesTotal)}</div>
        <div class="stat-label">Direct Sales</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(totalPaid)}</div>
        <div class="stat-label">Total Paid</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:${netBalance >= 0 ? '#c0392b' : '#28a745'}">${inr(netBalance)}</div>
        <div class="stat-label">Net Balance</div>
      </div>
    </div>
  </div>

  ${repairsList.length > 0 ? `
  <div class="card">
    <h2>Repair History (${repairsList.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:15%">Date</th>
          <th style="width:12%">Job ID</th>
          <th style="width:10%">Code</th>
          <th style="width:23%">Item</th>
          <th style="width:15%">Status</th>
          <th style="width:25%">Amount</th>
        </tr>
      </thead>
      <tbody>${repairRows}</tbody>
    </table>
  </div>` : ''}

  ${directSalesList.length > 0 ? `
  <div class="card">
    <h2>Direct Sales (${directSalesList.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:20%">Date</th>
          <th style="width:20%">Sale Code</th>
          <th style="width:25%">Amount</th>
          <th style="width:35%">Payment Mode</th>
        </tr>
      </thead>
      <tbody>${salesRows}</tbody>
    </table>
  </div>` : ''}

  ${paymentsList.length > 0 ? `
  <div class="card">
    <h2>Payments Received (${paymentsList.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:15%">Date</th>
          <th style="width:12%">Ref</th>
          <th style="width:15%;text-align:right">Amount</th>
          <th style="width:13%;text-align:right">Discount</th>
          <th style="width:15%;text-align:right">Net</th>
          <th style="width:30%">Mode</th>
        </tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>
  </div>` : ''}

  ${loansList.length > 0 ? `
  <div class="card">
    <h2>Loans (${loansList.length})</h2>
    <table>
      <thead>
        <tr>
          <th style="width:15%">Date</th>
          <th style="width:18%;text-align:right">Principal</th>
          <th style="width:12%;text-align:right">Interest %</th>
          <th style="width:18%;text-align:right">Total</th>
          <th style="width:17%;text-align:right">EMI</th>
          <th style="width:20%">Status</th>
        </tr>
      </thead>
      <tbody>${loanRows}</tbody>
    </table>
  </div>` : ''}

  <div class="card">
    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">🖨 Print</button>
      <button onclick="window.close()" class="btn btn-close">✕ Close</button>
    </div>
  </div>
  <div class="footer">${SHOP.name} | ${SHOP.address} | ${SHOP.mobile}</div>
</div>
<script>
document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "p") { e.preventDefault(); window.print(); }
  if (e.key === "Escape") window.close();
});
</script>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
