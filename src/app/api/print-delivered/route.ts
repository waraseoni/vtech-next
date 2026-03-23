import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function formatIST(iso: string, opts?: any) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || new Date().toISOString().split("T")[0];
  const to = searchParams.get("to") || from;
  const clientId = searchParams.get("client_id") || "all";

  const startDate = `${from}T00:00:00`;
  const endDate = `${to}T23:59:59`;

  let query = supabase
    .from('transaction_list')
    .select('id, job_id, date_completed, item, amount, client_name')
    .eq('status', 5)
    .eq('del_status', 0)
    .gte('date_completed', startDate)
    .lte('date_completed', endDate)
    .order('date_completed', { ascending: false });

  if (clientId !== 'all') {
    query = query.eq('client_name', parseInt(clientId));
  }

  const { data: txData } = await query;

  if (!txData || txData.length === 0) {
    return new NextResponse("<html><body><h1>No delivered items found</h1></body></html>", { headers: { "Content-Type": "text/html" } });
  }

  const clientIds = [...new Set(txData.map(t => t.client_name).filter(id => id != null))];

  const [{ data: clientsData }, { data: clientNamesData }] = await Promise.all([
    clientIds.length > 0 ? supabase.from('client_list').select('id, firstname, middlename, lastname').in('id', clientIds) : Promise.resolve({ data: [] }),
    clientIds.length > 0 ? supabase.from('client_list').select('id, firstname, middlename, lastname, contact').in('id', clientIds) : Promise.resolve({ data: [] })
  ]);

  const clientMap: Record<number, any> = {};
  (clientNamesData || []).forEach((c: any) => {
    clientMap[c.id] = {
      name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
      contact: c.contact || '',
    };
  });

  const transactions = txData.map((t: any) => ({
    id: t.id,
    job_id: t.job_id,
    date_completed: t.date_completed,
    item: t.item,
    amount: t.amount,
    client_id: t.client_name,
    client_name: clientMap[t.client_name]?.name || 'Unknown',
    client_contact: clientMap[t.client_name]?.contact || '',
  }));

  const count = transactions.length;
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const unique = new Set(transactions.map(t => t.client_id)).size;
  const avg = count > 0 ? total / count : 0;

  const dateRangeLabel = from === to
    ? formatIST(from, { day: '2-digit', month: 'short', year: 'numeric' })
    : `${formatIST(from, { day: '2-digit', month: 'short' })} - ${formatIST(to, { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Delivered Items Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-cards { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { flex: 1; background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 20px; font-weight: 900; color: #1a1a2e; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
    th { background: #f8f9fa; padding: 10px 6px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 8px 6px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
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
    <h1>Delivered Items Report</h1>
    <div class="subtitle">${dateRangeLabel} | Date: ${formatIST(new Date().toISOString(), { day: '2-digit', month: 'short', year: 'numeric' })}</div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-label">Delivered Items</div>
      <div class="summary-value">${count}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Amount</div>
      <div class="summary-value">${inr(total)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Unique Clients</div>
      <div class="summary-value">${unique}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Average Bill</div>
      <div class="summary-value">${inr(avg)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Job ID</th>
        <th>Item</th>
        <th>Customer</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.map((t, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${formatIST(t.date_completed, { day: '2-digit', month: 'short' })}</td>
        <td><strong>${t.job_id}</strong></td>
        <td>${t.item || '-'}</td>
        <td>${t.client_name}</td>
        <td class="text-right"><strong>${inr(t.amount)}</strong></td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="text-right">Total:</td>
        <td class="text-right"><strong>${inr(total)}</strong></td>
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