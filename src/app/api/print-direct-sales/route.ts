import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("from") || "";
  const dateTo = url.searchParams.get("to") || "";
  const paymentFilter = url.searchParams.get("payment_mode") || "all";

  let query = supabase
    .from("direct_sales").select("*")
    .gte("date_created", `${dateFrom}T00:00:00`)
    .lte("date_created", `${dateTo}T23:59:59`)
    .order("date_created", { ascending: false });
  if (paymentFilter !== "all") query = query.eq("payment_mode", paymentFilter);

  const salesData = await fetchAll(query);

  if (!salesData?.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi direct sales nahi mili</h2>
        <p style="color:#666">Selected date range mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientIds = [...new Set(salesData.map(s => s.client_id).filter(Boolean))];
  const mechIds = [...new Set(salesData.map(s => s.created_by).filter(Boolean))];

  const [{ data: clients }, { data: mechanics }] = await Promise.all([
    clientIds.length > 0 ? supabase.from("client_list").select("id, firstname, middlename, lastname").in("id", clientIds) : Promise.resolve({ data: [] }),
    mechIds.length > 0 ? supabase.from("mechanic_list").select("id, firstname, lastname").in("id", mechIds) : Promise.resolve({ data: [] })
  ]);

  const clientMap = new Map((clients || []).map(c => [c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ")]));
  const mechMap = new Map((mechanics || []).map(m => [m.id, `${m.firstname} ${m.lastname}`.trim()]));

  const sales = salesData.map(s => ({
    ...s,
    client_name: s.client_id ? clientMap.get(s.client_id) || "Unknown" : "Walk-in",
    staff_name: s.created_by ? mechMap.get(s.created_by) || "Unknown" : "—"
  }));

  const totalAmount = sales.reduce((s, sale) => s + (sale.total_amount || 0), 0);
  const totalSales = sales.length;
  const avgAmount = totalSales > 0 ? totalAmount / totalSales : 0;

  const payBreakdown = sales.reduce((acc, s) => {
    acc[s.payment_mode] = (acc[s.payment_mode] || 0) + s.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo ? fmtDate(dateFrom) : `${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`)
    : "All Records";

  const rowsHtml = sales.map((s, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:700;color:#1971c2;font-size:12px">${s.sale_code}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(s.date_created)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:600;font-size:12px">${s.client_name}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${s.staff_name}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;font-size:12px">${inr(s.total_amount)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${s.payment_mode}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Direct Sales — ${dateLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:1100px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:20px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;flex-wrap:wrap}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;min-width:120px}
    .stat-num{font-size:22px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#001f3f}
    th{padding:9px 8px;color:#fff;font-size:11px;font-weight:700;text-align:left}
    .actions{text-align:center;padding:16px;background:#f8f9fa;border-top:1px solid #dee2e6}
    .btn{padding:10px 22px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;margin:4px;display:inline-flex;align-items:center;gap:6px}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .footer{text-align:center;color:#666;font-size:11px;padding:10px}
    @media print{
      @page{margin:.8cm;size:A4 landscape}
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
      <h1>🛒 ${SHOP.name} — Direct Sales Report</h1>
      <p>Period: ${dateLabel} | Generated: ${fmtDateTime(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${totalSales}</div>
        <div class="stat-label">Total Sales</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(totalAmount)}</div>
        <div class="stat-label">Total Amount</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#1971c2">${inr(avgAmount)}</div>
        <div class="stat-label">Avg per Sale</div>
      </div>
      ${Object.entries(payBreakdown).map(([mode, amt]) => `
      <div class="stat">
        <div class="stat-num" style="color:${mode === 'Cash' ? '#28a745' : '#1971c2'}">${inr(Number(amt) || 0)}</div>
        <div class="stat-label">${mode}</div>
      </div>
      `).join("")}
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:12%">Code</th>
          <th style="width:12%">Date</th>
          <th style="width:20%">Client</th>
          <th style="width:15%">Staff</th>
          <th style="width:15%">Amount</th>
          <th style="width:12%">Payment</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="5" style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${totalSales} sales):</td>
          <td style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#28a745">${inr(totalAmount)}</td>
          <td style="border:1px solid #dee2e6"></td>
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

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}