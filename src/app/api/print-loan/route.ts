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
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const lastDay = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const loans = await fetchAll(
    supabase
      .from("client_loans").select("id, client_id, loan_date, principal_amount, interest_rate, total_payable, emi_amount, status")
      .lte("loan_date", monthEnd)
      .gte("status", 0)
  );

  const clients = await fetchAll(
    supabase.from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0)
  );

  const payments = await fetchAll(
    supabase
      .from("client_payments").select("loan_id, amount, discount, payment_date")
      .not("loan_id", "is", null)
      .lte("payment_date", monthEnd)
  );

  const loanRows: { id: number; client_name: string; principal_amount: number; interest_rate: number; total_payable: number; emi_amount: number; received: number; pending: number; status: number; }[] = [];

  for (const l of loans || []) {
    const client = (clients || []).find((c: { id: number }) => c.id === l.client_id);
    if (!client) continue;
    const name = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ");
    const loanPmts = payments?.filter((p: { loan_id: number }) => p.loan_id === l.id) || [];
    const received = loanPmts.reduce((s: number, p: { amount: number; discount: number }) => s + (p.amount || 0) + (p.discount || 0), 0);
    const targetEmi = l.emi_amount || 0;
    const pending = Math.max(0, targetEmi - received);

    loanRows.push({
      id: l.id,
      client_name: name,
      principal_amount: l.principal_amount || 0,
      interest_rate: l.interest_rate || 0,
      total_payable: l.total_payable || 0,
      emi_amount: targetEmi,
      received,
      pending,
      status: l.status || 0,
    });
  }

  const tPrincipal = loanRows.reduce((s, r) => s + r.principal_amount, 0);
  const tInterest = loanRows.reduce((s, r) => s + (r.total_payable - r.principal_amount), 0);
  const tTarget = loanRows.reduce((s, r) => s + r.emi_amount, 0);
  const tReceived = loanRows.reduce((s, r) => s + r.received, 0);
  const tPending = loanRows.reduce((s, r) => s + r.pending, 0);

  const monthLabel = new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Loan Report - ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary { display: flex; gap: 15px; margin: 20px 0; }
    .summary-box { flex: 1; padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
    .summary-label { font-size: 11px; text-transform: uppercase; color: #666; font-weight: 600; }
    .summary-value { font-size: 18px; font-weight: 800; margin-top: 4px; }
    .summary-value.blue { color: #2563eb; }
    .summary-value.green { color: #059669; }
    .summary-value.slate { color: #475569; }
    .summary-value.teal { color: #0d9488; }
    .summary-value.red { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f8f9fa; padding: 12px 8px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    td.num { text-align: right; }
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
    <h1>Loan Report</h1>
    <div class="subtitle">Month: ${monthLabel} | Date: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary">
    <div class="summary-box">
      <div class="summary-label">Principal</div>
      <div class="summary-value blue">${inr(tPrincipal)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Interest</div>
      <div class="summary-value green">${inr(tInterest)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Target EMI</div>
      <div class="summary-value slate">${inr(tTarget)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Received</div>
      <div class="summary-value teal">${inr(tReceived)}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Pending</div>
      <div class="summary-value red">${inr(tPending)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Client</th>
        <th style="text-align:right">Principal</th>
        <th style="text-align:center">Interest Rate</th>
        <th style="text-align:right">Interest Value</th>
        <th style="text-align:right">EMI</th>
        <th style="text-align:right">Received</th>
        <th style="text-align:right">Pending</th>
      </tr>
    </thead>
    <tbody>
      ${loanRows.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.client_name}</td>
        <td class="num">${inr(r.principal_amount)}</td>
        <td style="text-align:center">${r.interest_rate}%</td>
        <td class="num" style="color:#059669">${inr(r.total_payable - r.principal_amount)}</td>
        <td class="num">${inr(r.emi_amount)}</td>
        <td class="num" style="color:#0d9488">${inr(r.received)}</td>
        <td class="num" style="color:#dc2626">${inr(r.pending)}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right">Total:</td>
        <td class="num" style="color:#2563eb">${inr(tPrincipal)}</td>
        <td></td>
        <td class="num" style="color:#059669">${inr(tInterest)}</td>
        <td class="num">${inr(tTarget)}</td>
        <td class="num" style="color:#0d9488">${inr(tReceived)}</td>
        <td class="num" style="color:#dc2626">${inr(tPending)}</td>
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