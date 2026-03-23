import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
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
    periodPaymentsRes,
    allAttendanceRes,
    periodAttendanceRes,
    allAdvancesRes,
    periodAdvancesRes,
    inventoryRes,
    directSalesRes,
    allExpensesRes,
    periodExpensesRes,
    loanPaymentsRes,
  ] = await Promise.all([
    supabase.from('client_list').select('id, firstname, middlename, lastname, contact, opening_balance').eq('delete_flag', 0),
    supabase.from('mechanic_list').select('id, firstname, middlename, lastname, salary_per_day, commission_percent').eq('delete_flag', 0),
    supabase.from('product_list').select('id, name, description, price').eq('delete_flag', 0),
    supabase.from('lender_list').select('*').eq('delete_flag', 0),
    supabase.from('transaction_list').select('id, client_name, amount, date_created, status'),
    supabase.from('transaction_list').select('id, client_name, amount, date_created, status').in('status', [3, 5]).gte('date_created', `${from}T00:00:00`).lte('date_created', `${to}T23:59:59`),
    supabase.from('client_payments').select('id, client_id, amount, discount, payment_date'),
    supabase.from('client_payments').select('id, client_id, amount, discount, payment_date').gte('payment_date', from).lte('payment_date', to),
    supabase.from('attendance_list').select('mechanic_id, curr_date, status'),
    supabase.from('attendance_list').select('mechanic_id, curr_date, status').in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to),
    supabase.from('advance_payments').select('mechanic_id, amount, date_paid'),
    supabase.from('advance_payments').select('mechanic_id, amount, date_paid').gte('date_paid', from).lte('date_paid', to),
    supabase.from('inventory_list').select('product_id, quantity'),
    supabase.from('direct_sales').select('id, total_amount, date_created'),
    supabase.from('expense_list').select('category, amount, date_created'),
    supabase.from('expense_list').select('category, amount, date_created').gte('date_created', `${from}T00:00:00`).lte('date_created', `${to}T23:59:59`),
    supabase.from('loan_payments').select('lender_id, amount_paid, payment_date'),
  ]);

  const allTxns = allTxnsRes.data || [];
  const periodTxns = periodTxnsRes.data || [];
  const allPayments = allPaymentsRes.data || [];
  const periodPayments = periodPaymentsRes.data || [];
  const allAttendance = allAttendanceRes.data || [];
  const periodAttendance = periodAttendanceRes.data || [];
  const allAdvances = allAdvancesRes.data || [];
  const periodAdvances = periodAdvancesRes.data || [];
  const inventory = inventoryRes.data || [];
  const directSales = directSalesRes.data || [];
  const allExpenses = allExpensesRes.data || [];
  const periodExpenses = periodExpensesRes.data || [];
  const loanPayments = loanPaymentsRes.data || [];

  const clientMap: Record<number, any> = {};
  (clients || []).forEach((c: any) => {
    clientMap[c.id] = {
      name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.trim(),
      contact: c.contact,
      ob: c.opening_balance || 0,
    };
  });

  const mechMap: Record<number, any> = {};
  (mechanics || []).forEach((m: any) => {
    mechMap[m.id] = {
      name: `${m.firstname} ${m.middlename || ''} ${m.lastname || ''}`.trim(),
      salary: m.salary_per_day || 0,
      comm: m.commission_percent || 0,
    };
  });

  const prodMap: Record<number, any> = {};
  (products || []).forEach((p: any) => {
    prodMap[p.id] = { name: p.name, price: p.price || 0 };
  });

  const lenderMap: Record<number, any> = {};
  (lenders || []).forEach((l: any) => {
    lenderMap[l.id] = { name: l.lender_name, amount: l.loan_amount || 0, rate: l.interest_rate || 0 };
  });

  const invMap: Record<number, number> = {};
  (inventory || []).forEach((i: any) => { invMap[i.product_id] = i.quantity || 0; });

  const totalIncome = periodTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0) + (directSalesRes.data || []).filter((d: any) => d.date_created >= `${from}T00:00:00` && d.date_created <= `${to}T23:59:59`).reduce((s: number, d: any) => s + (d.total_amount || 0), 0);
  const totalExpenses = periodExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const totalStockValue = (products || []).reduce((s: number, p: any) => s + ((prodMap[p.id]?.price || 0) * (invMap[p.id] || 0)), 0);

  let totalMechBalance = 0;
  const mechBalances: { name: string; balance: number }[] = [];
  for (const m of mechanics || []) {
    const worked = (allAttendance || []).filter((a: any) => a.mechanic_id === m.id).length;
    const daysWorked = (periodAttendance || []).filter((a: any) => a.mechanic_id === m.id).length;
    const salary = (m.salary_per_day || 0) * (worked + daysWorked * 0.5);
    const comm = (allTxns || []).filter((t: any) => t.mechanic_id === m.id).reduce((s: number, t: any) => s + (t.mechanic_commission_amount || 0), 0);
    const adv = (allAdvances || []).filter((a: any) => a.mechanic_id === m.id).reduce((s: number, a: any) => s + (a.amount || 0), 0);
    const balance = salary + comm - adv;
    totalMechBalance += balance;
    if (balance !== 0) mechBalances.push({ name: mechMap[m.id]?.name || 'Unknown', balance });
  }

  let totalLoanBalance = 0;
  const loanData: { name: string; amount: number; paid: number; balance: number }[] = [];
  for (const l of lenders || []) {
    const paid = (loanPayments || []).filter((p: any) => p.lender_id === l.id).reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
    const balance = (l.loan_amount || 0) - paid;
    totalLoanBalance += balance;
    if (balance !== 0) loanData.push({ name: l.lender_name, amount: l.loan_amount || 0, paid, balance });
  }

  const customerLedger: { name: string; ob: number; repair: number; payment: number; balance: number }[] = [];
  for (const c of clients || []) {
    const repair = (allTxns || []).filter((t: any) => t.client_name === c.id).reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const payment = (allPayments || []).filter((p: any) => p.client_id === c.id).reduce((s: number, p: any) => s + (p.amount || 0) + (p.discount || 0), 0);
    const balance = (c.opening_balance || 0) + repair - payment;
    if (balance !== 0) customerLedger.push({ name: clientMap[c.id]?.name || 'Unknown', ob: c.opening_balance || 0, repair, payment, balance });
  }

  const expenseByCategory = periodExpenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category || 'Other'] = (acc[e.category || 'Other'] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Balance Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 24px; font-weight: 900; color: #1a1a2e; margin-top: 5px; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    h2 { font-size: 16px; font-weight: 700; margin: 25px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background: #f8f9fa; padding: 8px 6px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 6px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
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
    <h1>Balance Sheet</h1>
    <div class="subtitle">${formatDate(from)} - ${formatDate(to)} | Generated: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Income</div>
      <div class="summary-value positive">${inr(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value negative">${inr(totalExpenses)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Net Profit</div>
      <div class="summary-value ${netProfit >= 0 ? 'positive' : 'negative'}">${inr(netProfit)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Stock Value</div>
      <div class="summary-value">${inr(totalStockValue)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Mechanic Balance</div>
      <div class="summary-value">${inr(totalMechBalance)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Loan Balance</div>
      <div class="summary-value">${inr(totalLoanBalance)}</div>
    </div>
  </div>

  ${customerLedger.length > 0 ? `
  <h2>Customer Ledger</h2>
  <table>
    <thead>
      <tr>
        <th>Customer</th>
        <th class="text-right">Opening</th>
        <th class="text-right">Repair</th>
        <th class="text-right">Payment</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${customerLedger.map(c => `
      <tr>
        <td>${c.name}</td>
        <td class="text-right">${inr(c.ob)}</td>
        <td class="text-right">${inr(c.repair)}</td>
        <td class="text-right">${inr(c.payment)}</td>
        <td class="text-right ${c.balance >= 0 ? '' : 'negative'}">${inr(c.balance)}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${mechBalances.length > 0 ? `
  <h2>Mechanic Balance</h2>
  <table>
    <thead>
      <tr>
        <th>Mechanic</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${mechBalances.map(m => `
      <tr>
        <td>${m.name}</td>
        <td class="text-right ${m.balance >= 0 ? '' : 'negative'}">${inr(m.balance)}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${loanData.length > 0 ? `
  <h2>Loan Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Lender</th>
        <th class="text-right">Amount</th>
        <th class="text-right">Paid</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${loanData.map(l => `
      <tr>
        <td>${l.name}</td>
        <td class="text-right">${inr(l.amount)}</td>
        <td class="text-right">${inr(l.paid)}</td>
        <td class="text-right">${inr(l.balance)}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${Object.keys(expenseByCategory).length > 0 ? `
  <h2>Expenses by Category</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(expenseByCategory).map(([cat, amt]) => `
      <tr>
        <td>${cat}</td>
        <td class="text-right">${inr(amt as number)}</td>
      </tr>`).join("")}
      <tr style="font-weight:700">
        <td>Total</td>
        <td class="text-right">${inr(totalExpenses)}</td>
      </tr>
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