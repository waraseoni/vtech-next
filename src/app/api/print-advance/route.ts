import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const mechanicId = url.searchParams.get("mechanic_id") || "";

  // Fetch advances
  let q = supabase
    .from("advance_payments")
    .select("id, mechanic_id, amount, date_paid, reason")
    .gte("date_paid", from)
    .lte("date_paid", to)
    .order("date_paid", { ascending: false });

  if (mechanicId && mechanicId !== "all") {
    q = q.eq("mechanic_id", parseInt(mechanicId));
  }

  const advances = await fetchAll(q);
  if (!advances?.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi advance entries nahi mili</h2>
        <p style="color:#666">Selected date range mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Fetch mechanics
  const mechIds = [...new Set(advances.map(a => a.mechanic_id))];
  const mechanics = await fetchAllIn(
    (ids) => supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname")
      .in("id", ids),
    mechIds
  );

  const mechMap = new Map(mechanics?.map(m => [m.id, [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")]) ?? []);

  const totalAdvance = advances.reduce((s, a) => s + (a.amount || 0), 0);

  const dateLabel = from && to
    ? (from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`)
    : "All Records";

  const staffLabel = mechanicId && mechanicId !== "all" 
    ? mechMap.get(parseInt(mechanicId)) || "Staff" 
    : "All Staff";

  const rows = advances.map((a, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(a.date_paid)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-weight:600;font-size:12px">${mechMap.get(a.mechanic_id) || "Unknown"}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#c0392b;font-size:12px">${inr(a.amount)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px;color:#666">${a.reason || "—"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Advance Report — ${dateLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:800px;margin:0 auto}
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
      <h1>💰 ${SHOP.name} — Advance Report</h1>
      <p>Period: ${dateLabel} | Staff: ${staffLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${advances.length}</div>
        <div class="stat-label">Total Entries</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalAdvance)}</div>
        <div class="stat-label">Total Advance</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:15%">Date</th>
          <th style="width:30%">Staff Name</th>
          <th style="width:20%">Amount</th>
          <th style="width:30%">Reason</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="3" style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${advances.length} records):</td>
          <td style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#c0392b">${inr(totalAdvance)}</td>
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