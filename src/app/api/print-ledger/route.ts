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

const rupee = (n: number, decimals = 0) => "â‚¹" + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

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

  const start = `${from}T00:00:00+05:30`;
  const end = `${to}T23:59:59+05:30`;

  const [
    { data: allClients },
    { data: allMechanics },
    { data: salaryHistory },
    repairJobsRaw,
    walkinRaw,
    clientSalesRaw,
    clientPaymentsRaw,
    attendance,
    expensesRaw,
    loanPaymentsRaw,
  ] = await Promise.all([
    pageAll(supabase.from('client_list').select('id, firstname, middlename, lastname')),
    pageAll(supabase.from('mechanic_list').select('id, firstname, lastname, daily_salary')),
    pageAll(supabase.from('mechanic_salary_history').select('mechanic_id, effective_date, salary')),
    pageAll(supabase.from('transaction_list').select('id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id').eq('status', 5).gte('date_completed', start).lte('date_completed', end)),
    pageAll(supabase.from('direct_sales').select('id, sale_code, total_amount, date_created, client_id').or('client_id.is.null,client_id.eq.0').gte('date_created', start).lte('date_created', end)),
    pageAll(supabase.from('direct_sales').select('id, sale_code, total_amount, date_created, client_id').not('client_id', 'eq', 0).not('client_id', 'is', null).gte('date_created', start).lte('date_created', end)),
    pageAll(supabase.from('client_payments').select('id, client_id, amount, discount, payment_date').gte('payment_date', from).lte('payment_date', to)),
    pageAll(supabase.from('attendance_list').select('mechanic_id, curr_date, status').in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to)),
    pageAll(supabase.from('expense_list').select('category, amount, date_created').gte('date_created', start).lte('date_created', end)),
    pageAll(supabase.from('loan_payments').select('lender_id, amount_paid, payment_date').gte('payment_date', from).lte('payment_date', to)),
  ]);

  const clientMap: Record<number, string> = {};
  (allClients || []).forEach((c) => { clientMap[c.id] = `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.trim(); });

  const mechMap: Record<number, { name: string; daily: number }> = {};
  (allMechanics || []).forEach((m) => { mechMap[m.id] = { name: `${m.firstname} ${m.lastname}`.trim(), daily: Number(m.daily_salary) || 0 }; });

  const salaryHistoryMap: Record<number, { effective_date: string; salary: number }[]> = {};
  (salaryHistory || []).forEach((h) => {
    if (!salaryHistoryMap[h.mechanic_id]) salaryHistoryMap[h.mechanic_id] = [];
    salaryHistoryMap[h.mechanic_id].push({ effective_date: h.effective_date, salary: Number(h.salary) || 0 });
  });
  Object.values(salaryHistoryMap).forEach(arr => arr.sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()));
  const historyRateFor = (mechId: number, onDate: string): number | null => {
    const hist = salaryHistoryMap[mechId];
    if (!hist || !onDate) return null;
    const on = new Date(onDate).getTime();
    let rate: number | null = null;
    for (const h of hist) {
      if (new Date(h.effective_date).getTime() <= on) rate = h.salary;
      else break;
    }
    return rate;
  };

  const repairJobs = (repairJobsRaw.data || []).map((t) => ({
    job_id: t.job_id, date: t.date_completed, item: t.item, amount: t.amount, comm: t.mechanic_commission_amount,
    client: clientMap[t.client_name] || 'Unknown', mechanic: mechMap[t.mechanic_id]?.name || 'Unknown'
  }));

  const walkinSales = (walkinRaw.data || []).map((s) => ({ code: s.sale_code, date: s.date_created, amount: s.total_amount }));
  const clientSales = (clientSalesRaw.data || []).map((s) => ({ code: s.sale_code, date: s.date_created, amount: s.total_amount, client: clientMap[s.client_id] || 'Unknown' }));
  const payments = (clientPaymentsRaw.data || []).map((p) => ({ date: p.payment_date, client: clientMap[p.client_id] || 'Unknown', amount: p.amount, discount: p.discount }));

  const totalRepair = repairJobs.reduce((s: number, t) => s + Number(t.amount || 0), 0);
  const totalWalkin = walkinSales.reduce((s: number, s_) => s + Number(s_.amount || 0), 0);
  const totalClientSales = clientSales.reduce((s: number, s_) => s + Number(s_.amount || 0), 0);
  const totalPayments = payments.reduce((s: number, p) => s + Number(p.amount || 0), 0);

  const totalComm = repairJobs.reduce((s: number, t) => s + Number(t.comm || 0), 0);
  const totalSalary = (attendance.data || []).reduce((s: number, a) => {
    const rate = historyRateFor(a.mechanic_id, a.curr_date) ?? (mechMap[a.mechanic_id]?.daily || 0);
    return s + (a.status === 3 ? rate / 2 : rate);
  }, 0);
  const totalExpenses = (expensesRaw.data || []).reduce((s: number, e) => s + Number(e.amount || 0), 0);
  const totalEmi = (loanPaymentsRaw.data || []).reduce((s: number, p) => s + Number(p.amount_paid || 0), 0);
  const totalDiscount = payments.reduce((s: number, p) => s + Number(p.discount || 0), 0);

  const totalIncome = totalRepair + totalWalkin + totalClientSales;
  const totalExpense = totalComm + totalSalary + totalExpenses + totalEmi + totalDiscount;
  const netProfit = totalIncome - totalExpense;

  const monthLabel = `${fmtDate(from)} - ${fmtDate(to)}`;

  const repairRows = repairJobs.length > 0 ? repairJobs.slice(0, 20).map((t, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(t.date)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.job_id}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.item || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.client}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.mechanic}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${rupee(Number(t.amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${rupee(Number(t.comm))}</td>
    </tr>`;
  }).join("") + (repairJobs.length > 20 ? `<tr><td colspan="8" style="padding:8px;border:1px solid #dee2e6;text-align:center;font-size:12px;color:#666">... and ${repairJobs.length - 20} more</td></tr>` : '') : '<tr><td colspan="8" style="padding:16px;text-align:center;color:#666">No repair jobs</td></tr>';

  const paymentRows = payments.length > 0 ? payments.slice(0, 20).map((p, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(p.date)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${p.client}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${rupee(Number(p.amount))}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px">${rupee(Number(p.discount))}</td>
    </tr>`;
  }).join("") + (payments.length > 20 ? `<tr><td colspan="5" style="padding:8px;border:1px solid #dee2e6;text-align:center;font-size:12px;color:#666">... and ${payments.length - 20} more</td></tr>` : '') : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#666">No payments</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Business Ledger â€” ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:1000px;margin:0 auto}
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
      <h1>ðŸ“’ ${SHOP.name} â€” Business Ledger</h1>
      <p>Period: ${monthLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${rupee(totalIncome)}</div>
        <div class="stat-label">Net Revenue</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${rupee(totalExpense)}</div>
        <div class="stat-label">Total Expenses</div>
      </div>
      <div class="stat">
        <div class="stat-num">${rupee(totalPayments)}</div>
        <div class="stat-label">Cash Received</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:${netProfit >= 0 ? '#28a745' : '#c0392b'}">${rupee(netProfit)}</div>
        <div class="stat-label">${netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</div>
      </div>
    </div>
  </div>

  ${repairJobs.length > 0 ? `
  <div class="card">
    <h2>Repair Jobs (${repairJobs.length})</h2>
    <table>
      <thead>
        <tr><th style="width:4%">#</th><th style="width:12%">Date</th><th style="width:10%">Job ID</th><th style="width:22%">Item</th><th style="width:22%">Customer</th><th style="width:18%">Mechanic</th><th style="width:8%;text-align:right">Amount</th><th style="width:8%;text-align:right">Comm</th></tr>
      </thead>
      <tbody>${repairRows}</tbody>
    </table>
  </div>` : ''}

  ${payments.length > 0 ? `
  <div class="card">
    <h2>Client Payments (${payments.length})</h2>
    <table>
      <thead>
        <tr><th style="width:4%">#</th><th style="width:15%">Date</th><th style="width:40%">Customer</th><th style="width:20%;text-align:right">Amount</th><th style="width:21%;text-align:right">Discount</th></tr>
      </thead>
      <tbody>${paymentRows}</tbody>
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
