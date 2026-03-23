import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const rupee = (n: number, decimals = 0) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") || from;

  const start = `${from}T00:00:00`;
  const end = `${to}T23:59:59`;

  const [
    { data: allClients },
    { data: allMechanics },
    { data: allProducts },
    repairJobsRaw,
    walkinRaw,
    clientSalesRaw,
    clientPaymentsRaw,
    attendance,
    advancesRaw,
    expensesRaw,
    loanPaymentsRaw,
  ] = await Promise.all([
    supabase.from('client_list').select('id, firstname, middlename, lastname'),
    supabase.from('mechanic_list').select('id, firstname, lastname, salary_per_day'),
    supabase.from('product_list').select('id, name, price'),
    supabase.from('transaction_list').select('id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id').eq('status', 5).eq('del_status', 0).gte('date_completed', start).lte('date_completed', end),
    supabase.from('direct_sales').select('id, sale_code, total_amount, date_created, client_id').or('client_id.is.null,client_id.eq.0').gte('date_created', start).lte('date_created', end),
    supabase.from('direct_sales').select('id, sale_code, total_amount, date_created, client_id').not('client_id', 'eq', 0).not('client_id', 'is', null).gte('date_created', start).lte('date_created', end),
    supabase.from('client_payments').select('id, client_id, amount, discount, payment_date').gte('payment_date', from).lte('payment_date', to),
    supabase.from('attendance_list').select('mechanic_id, curr_date, status').in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to),
    supabase.from('advance_payments').select('mechanic_id, amount, date_paid').gte('date_paid', from).lte('date_paid', to),
    supabase.from('expense_list').select('category, amount, date_created').gte('date_created', start).lte('date_created', end),
    supabase.from('loan_payments').select('lender_id, amount_paid, payment_date').gte('payment_date', from).lte('payment_date', to),
  ]);

  const clientMap: Record<number, string> = {};
  (allClients || []).forEach((c: any) => { clientMap[c.id] = `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.trim(); });

  const mechMap: Record<number, any> = {};
  (allMechanics || []).forEach((m: any) => { mechMap[m.id] = { name: `${m.firstname} ${m.lastname}`.trim(), salary: m.salary_per_day || 0 }; });

  const repairJobs = (repairJobsRaw.data || []).map((t: any) => ({
    job_id: t.job_id, date: t.date_completed, item: t.item, amount: t.amount, comm: t.mechanic_commission_amount,
    client: clientMap[t.client_name] || 'Unknown', mechanic: mechMap[t.mechanic_id]?.name || 'Unknown'
  }));

  const walkinSales = (walkinRaw.data || []).map((s: any) => ({ code: s.sale_code, date: s.date_created, amount: s.total_amount }));
  const clientSales = (clientSalesRaw.data || []).map((s: any) => ({ code: s.sale_code, date: s.date_created, amount: s.total_amount, client: clientMap[s.client_id] || 'Unknown' }));
  const payments = (clientPaymentsRaw.data || []).map((p: any) => ({ date: p.payment_date, client: clientMap[p.client_id] || 'Unknown', amount: p.amount, discount: p.discount }));

  const totalRepair = repairJobs.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  const totalWalkin = walkinSales.reduce((s: number, s_: any) => s + Number(s_.amount || 0), 0);
  const totalClientSales = clientSales.reduce((s: number, s_: any) => s + Number(s_.amount || 0), 0);
  const totalPayments = payments.reduce((s: number, p: any) => s + Number(p.amount || 0) + Number(p.discount || 0), 0);

  const totalComm = repairJobs.reduce((s: number, t: any) => s + Number(t.comm || 0), 0);
  const totalSalary = (attendance.data || []).reduce((s: number, a: any) => s + (mechMap[a.mechanic_id]?.salary || 0) * (a.status === 3 ? 0.5 : 1), 0);
  const totalAdvance = (advancesRaw.data || []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
  const totalExpenses = (expensesRaw.data || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalEmi = (loanPaymentsRaw.data || []).reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0);

  const totalIncome = totalRepair + totalWalkin + totalClientSales;
  const totalExpense = totalComm + totalSalary + totalAdvance + totalExpenses + totalEmi;
  const netProfit = totalIncome - totalExpense;

  const monthLabel = `${formatDate(from)} - ${formatDate(to)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Business Ledger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 20px; font-weight: 900; color: #1a1a2e; margin-top: 5px; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    h2 { font-size: 14px; font-weight: 700; margin: 25px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background: #f8f9fa; padding: 8px 6px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 6px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
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
    <h1>Business Ledger</h1>
    <div class="subtitle">${monthLabel} | Generated: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Net Revenue</div>
      <div class="summary-value positive">${rupee(totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value negative">${rupee(totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Cash Received</div>
      <div class="summary-value">${rupee(totalPayments)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</div>
      <div class="summary-value ${netProfit >= 0 ? 'positive' : 'negative'}">${rupee(netProfit)}</div>
    </div>
  </div>

  ${repairJobs.length > 0 ? `
  <h2>Repair Jobs (${repairJobs.length})</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Date</th><th>Job ID</th><th>Item</th><th>Customer</th><th>Mechanic</th><th class="text-right">Amount</th><th class="text-right">Comm</th></tr>
    </thead>
    <tbody>
      ${repairJobs.slice(0, 20).map((t, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${formatDate(t.date)}</td>
        <td>${t.job_id}</td>
        <td>${t.item || '-'}</td>
        <td>${t.client}</td>
        <td>${t.mechanic}</td>
        <td class="text-right">${rupee(Number(t.amount))}</td>
        <td class="text-right">${rupee(Number(t.comm))}</td>
      </tr>`).join("")}
      ${repairJobs.length > 20 ? `<tr><td colspan="8" class="text-center">... and ${repairJobs.length - 20} more</td></tr>` : ''}
    </tbody>
  </table>` : ""}

  ${payments.length > 0 ? `
  <h2>Client Payments (${payments.length})</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Date</th><th>Customer</th><th class="text-right">Amount</th><th class="text-right">Discount</th></tr>
    </thead>
    <tbody>
      ${payments.slice(0, 20).map((p, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${formatDate(p.date)}</td>
        <td>${p.client}</td>
        <td class="text-right">${rupee(Number(p.amount))}</td>
        <td class="text-right">${rupee(Number(p.discount))}</td>
      </tr>`).join("")}
      ${payments.length > 20 ? `<tr><td colspan="5" class="text-center">... and ${payments.length - 20} more</td></tr>` : ''}
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