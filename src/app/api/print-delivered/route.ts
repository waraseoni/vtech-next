import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function formatIST(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(new Date(iso));
}

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
  const clientId = searchParams.get("client_id") || "all";

  const startDate = `${from}T00:00:00+05:30`;
  const endDate = `${to}T23:59:59+05:30`;

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

  const txData = await fetchAll(query);

  if (!txData || txData.length === 0) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi delivered items nahi mili</h2>
        <p style="color:#666">Selected date range mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientIds = [...new Set(txData.map(t => t.client_name).filter(id => id != null))];

  const [, { data: clientNamesData }] = await Promise.all([
    clientIds.length > 0 ? fetchAllIn((ids: number[]) => supabase.from('client_list').select('id, firstname, middlename, lastname').in('id', ids), clientIds).then(rows => ({ data: rows })) : Promise.resolve({ data: [] }),
    clientIds.length > 0 ? fetchAllIn((ids: number[]) => supabase.from('client_list').select('id, firstname, middlename, lastname, contact').in('id', ids), clientIds).then(rows => ({ data: rows })) : Promise.resolve({ data: [] })
  ]);

  const clientMap: Record<number, { name: string; contact: string }> = {};
  (clientNamesData || []).forEach((c) => {
    clientMap[c.id] = {
      name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
      contact: c.contact || '',
    };
  });

  const transactions = txData.map((t) => ({
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
    ? fmtDate(from)
    : `${formatIST(from, { day: '2-digit', month: 'short' })} - ${formatIST(to, { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const rows = transactions.map((t, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${formatIST(t.date_completed, { day: '2-digit', month: 'short' })}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.job_id}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.item || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${t.client_name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#c0392b;font-size:12px">${inr(t.amount)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Delivered Items Report — ${dateRangeLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:900px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;flex:1}
    .stat-num{font-size:22px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
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
      <h1>📦 ${SHOP.name} — Delivered Items Report</h1>
      <p>Period: ${dateRangeLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${count}</div>
        <div class="stat-label">Delivered Items</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(total)}</div>
        <div class="stat-label">Total Amount</div>
      </div>
      <div class="stat">
        <div class="stat-num">${unique}</div>
        <div class="stat-label">Unique Clients</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(avg)}</div>
        <div class="stat-label">Avg Bill</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:12%">Date</th>
          <th style="width:12%">Job ID</th>
          <th style="width:25%">Item</th>
          <th style="width:26%">Customer</th>
          <th style="width:20%">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="5" style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${count} records):</td>
          <td style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#c0392b">${inr(total)}</td>
        </tr>
      </tfoot>
    </table>
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
