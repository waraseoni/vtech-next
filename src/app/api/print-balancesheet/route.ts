import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { pageAll } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur â€“ 482002",
  mobile: "9179105875",
};

const inr = (n: number) => "â‚¹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") || from;

  const [
    { data: clients },
    { data: mechanics },
    { data: products },
    { data: lenders },
    allTxnsRes,
    periodTxnsRes,
    allPaymentsRes,
    ,
    allAttendanceRes,
    periodAttendanceRes,
    allAdvancesRes,
    ,
    inventoryRes,
    directSalesRes,
    ,
    periodExpensesRes,
    loanPaymentsRes,
  ] = await Promise.all([
    pageAll(supabase.from('client_list').select('id, firstname, middlename, lastname, contact, opening_balance').eq('delete_flag', 0)),
    pageAll(supabase.from('mechanic_list').select('id, firstname, middlename, lastname, daily_salary, commission_percent').eq('delete_flag', 0)),
    pageAll(supabase.from('product_list').select('id, name, description, price').eq('delete_flag', 0)),
    pageAll(supabase.from('lender_list').select('*').eq('delete_flag', 0)),
    pageAll(supabase.from('transaction_list').select('id, client_name, amount, date_completed, status, mechanic_id, mechanic_commission_amount').eq('status', 5)),
    pageAll(supabase.from('transaction_list').select('id, client_name, amount, date_completed, status, mechanic_id, mechanic_commission_amount').eq('status', 5).eq('del_status', 0).gte('date_completed', `${from} 00:00:00`).lte('date_completed', `${to} 23:59:59`)),
    pageAll(supabase.from('client_payments').select('id, client_id, amount, discount, payment_date')),
    pageAll(supabase.from('client_payments').select('id, client_id, amount, discount, payment_date').gte('payment_date', from).lte('payment_date', to)),
    pageAll(supabase.from('attendance_list').select('mechanic_id, curr_date, status')),
    pageAll(supabase.from('attendance_list').select('mechanic_id, curr_date, status').in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to)),
    pageAll(supabase.from('advance_payments').select('mechanic_id, amount, date_paid')),
    pageAll(supabase.from('advance_payments').select('mechanic_id, amount, date_paid').gte('date_paid', from).lte('date_paid', to)),
    pageAll(supabase.from('inventory_list').select('product_id, quantity')),
    pageAll(supabase.from('direct_sales').select('id, total_amount, date_created')),
    pageAll(supabase.from('expense_list').select('category, amount, date_created')),
    pageAll(supabase.from('expense_list').select('category, amount, date_created').gte('date_created', `${from} 00:00:00`).lte('date_created', `${to} 23:59:59`)),
    pageAll(supabase.from('loan_payments').select('lender_id, amount_paid, payment_date')),
  ]);

  const allTxns = allTxnsRes.data || [];
  const periodTxns = periodTxnsRes.data || [];
  const allPayments = allPaymentsRes.data || [];
  const allAttendance = allAttendanceRes.data || [];
  const periodAttendance = periodAttendanceRes.data || [];
  const allAdvances = allAdvancesRes.data || [];
  const inventory = inventoryRes.data || [];
  const periodExpenses = periodExpensesRes.data || [];
  const loanPayments = loanPaymentsRes.data || [];

  const clientMap: Record<number, { name: string; contact: string; ob: number }> = {};
  (clients || []).forEach((c) => {
    clientMap[c.id] = {
      name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.trim(),
      contact: c.contact,
      ob: c.opening_balance || 0,
    };
  });

  const mechMap: Record<number, { name: string; salary: number; comm: number }> = {};
  (mechanics || []).forEach((m) => {
    mechMap[m.id] = {
      name: `${m.firstname} ${m.middlename || ''} ${m.lastname || ''}`.trim(),
      salary: m.daily_salary || 0,
      comm: m.commission_percent || 0,
    };
  });

  const prodMap: Record<number, { name: string; price: number }> = {};
  (products || []).forEach((p) => {
    prodMap[p.id] = { name: p.name, price: p.price || 0 };
  });

  const lenderMap: Record<number, { name: string; amount: number; rate: number }> = {};
  (lenders || []).forEach((l) => {
    lenderMap[l.id] = { name: l.lender_name, amount: l.loan_amount || 0, rate: l.interest_rate || 0 };
  });

  const invMap: Record<number, number> = {};
  (inventory || []).forEach((i) => { invMap[i.product_id] = i.quantity || 0; });

  const totalIncome = periodTxns.reduce((s: number, t) => s + (t.amount || 0), 0) + (directSalesRes.data || []).filter((d) => d.date_created >= `${from}T00:00:00` && d.date_created <= `${to}T23:59:59`).reduce((s: number, d) => s + (d.total_amount || 0), 0);
  const totalExpenses = periodExpenses.reduce((s: number, e) => s + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const totalStockValue = (products || []).reduce((s: number, p) => s + ((prodMap[p.id]?.price || 0) * (invMap[p.id] || 0)), 0);

  let totalMechBalance = 0;
  const mechBalances: { name: string; balance: number }[] = [];
  for (const m of mechanics || []) {
    const worked = (allAttendance || []).filter((a) => a.mechanic_id === m.id).length;
    const daysWorked = (periodAttendance || []).filter((a) => a.mechanic_id === m.id).length;
    const salary = (m.daily_salary || 0) * (worked + daysWorked * 0.5);
    const comm = (allTxns || []).filter((t) => t.mechanic_id === m.id).reduce((s: number, t) => s + (t.mechanic_commission_amount || 0), 0);
    const adv = (allAdvances || []).filter((a) => a.mechanic_id === m.id).reduce((s: number, a) => s + (a.amount || 0), 0);
    const balance = salary + comm - adv;
    totalMechBalance += balance;
    if (balance !== 0) mechBalances.push({ name: mechMap[m.id]?.name || 'Unknown', balance });
  }

  let totalLoanBalance = 0;
  const loanData: { name: string; amount: number; paid: number; balance: number }[] = [];
  for (const l of lenders || []) {
    const paid = (loanPayments || []).filter((p) => p.lender_id === l.id).reduce((s: number, p) => s + (p.amount_paid || 0), 0);
    const balance = (l.loan_amount || 0) - paid;
    totalLoanBalance += balance;
    if (balance !== 0) loanData.push({ name: l.lender_name, amount: l.loan_amount || 0, paid, balance });
  }

  const customerLedger: { name: string; ob: number; repair: number; payment: number; balance: number }[] = [];
  for (const c of clients || []) {
    const repair = (allTxns || []).filter((t) => t.client_name === c.id).reduce((s: number, t) => s + (t.amount || 0), 0);
    const payment = (allPayments || []).filter((p) => p.client_id === c.id).reduce((s: number, p) => s + (p.amount || 0) + (p.discount || 0), 0);
    const balance = (c.opening_balance || 0) + repair - payment;
    if (balance !== 0) customerLedger.push({ name: clientMap[c.id]?.name || 'Unknown', ob: c.opening_balance || 0, repair, payment, balance });
  }

  const expenseByCategory = periodExpenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category || 'Other'] = (acc[e.category || 'Other'] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const dateRangeLabel = `${fmtDate(from)} - ${fmtDate(to)}`;

  const customerRows = customerLedger.length > 0 ? customerLedger.map((c, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${c.name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(c.ob)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(c.repair)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(c.payment)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:${c.balance >= 0 ? '#c0392b' : '#28a745'}">${inr(c.balance)}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#666">No customer balances</td></tr>';

  const mechRows = mechBalances.length > 0 ? mechBalances.map((m, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${m.name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:${m.balance >= 0 ? '#c0392b' : '#28a745'}">${inr(m.balance)}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="2" style="padding:16px;text-align:center;color:#666">No mechanic balances</td></tr>';

  const loanRows = loanData.length > 0 ? loanData.map((l, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${l.name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(l.amount)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(l.paid)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(l.balance)}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#666">No loans</td></tr>';

  const expenseRows = Object.keys(expenseByCategory).length > 0 ? Object.entries(expenseByCategory).map(([cat, amt], i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${cat}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(amt as number)}</td>
    </tr>`;
  }).join("") + `<tr style="background:#f0f4ff;font-weight:700">
    <td style="padding:8px;border:1px solid #dee2e6;font-size:12px;text-align:right" colspan="1">Total:</td>
    <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${inr(totalExpenses)}</td>
  </tr>` : '<tr><td colspan="2" style="padding:16px;text-align:center;color:#666">No expenses</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Balance Sheet â€” ${dateRangeLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:900px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;flex-wrap:wrap}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;flex:1;min-width:120px}
    .stat-num{font-size:20px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
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
      <h1>ðŸ“Š ${SHOP.name} â€” Balance Sheet</h1>
      <p>Period: ${dateRangeLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(totalIncome)}</div>
        <div class="stat-label">Total Income</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalExpenses)}</div>
        <div class="stat-label">Total Expenses</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:${netProfit >= 0 ? '#28a745' : '#c0392b'}">${inr(netProfit)}</div>
        <div class="stat-label">Net ${netProfit >= 0 ? 'Profit' : 'Loss'}</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(totalStockValue)}</div>
        <div class="stat-label">Stock Value</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(totalMechBalance)}</div>
        <div class="stat-label">Mech Balance</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(totalLoanBalance)}</div>
        <div class="stat-label">Loan Balance</div>
      </div>
    </div>
  </div>

  ${customerLedger.length > 0 ? `
  <div class="card">
    <h2>Customer Ledger</h2>
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th style="text-align:right">Opening</th>
          <th style="text-align:right">Repair</th>
          <th style="text-align:right">Payment</th>
          <th style="text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>${customerRows}</tbody>
    </table>
  </div>` : ''}

  ${mechBalances.length > 0 ? `
  <div class="card">
    <h2>Mechanic Balance</h2>
    <table>
      <thead>
        <tr>
          <th>Mechanic</th>
          <th style="text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>${mechRows}</tbody>
    </table>
  </div>` : ''}

  ${loanData.length > 0 ? `
  <div class="card">
    <h2>Loan Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Lender</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">Paid</th>
          <th style="text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>${loanRows}</tbody>
    </table>
  </div>` : ''}

  ${Object.keys(expenseByCategory).length > 0 ? `
  <div class="card">
    <h2>Expenses by Category</h2>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${expenseRows}</tbody>
    </table>
  </div>` : ''}

  <div class="card">
    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">ðŸ–¨ Print</button>
      <button onclick="window.close()" class="btn btn-close">âœ• Close</button>
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
