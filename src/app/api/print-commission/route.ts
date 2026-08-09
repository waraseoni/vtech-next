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

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || "";
  const mechanicId = url.searchParams.get("mechanic_id") || "all";

  const from = month ? `${month}-01T00:00:00` : "";
  const toDate = month ? new Date(month + "-01") : new Date();
  toDate.setMonth(toDate.getMonth() + 1);
  const to = month ? toDate.toISOString().split("T")[0] + "T23:59:59" : "";

  const mechData = await fetchAll(
    supabase
      .from("mechanic_list").select("id, firstname, middlename, lastname")
      .eq("delete_flag", 0).order("firstname")
  );

  let q = supabase
    .from("transaction_list").select("id, job_id, code, date_created, mechanic_id, mechanic_commission_amount")
    .gte("date_created", from).lte("date_created", to);
  if (mechanicId && mechanicId !== "all") q = q.eq("mechanic_id", parseInt(mechanicId));
  const txns = await fetchAll(q);

  if (!txns?.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi commission records nahi mili</h2>
        <p style="color:#666">Selected month mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const mechMap = new Map(mechData?.map(m => [m.id, [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ")]) ?? []);

  const enriched = [];
  for (const t of txns) {
    const svcAmt = 0;
    enriched.push({
      id: t.id,
      job_id: t.job_id || String(t.id),
      code: t.code,
      date_created: t.date_created,
      m_name: mechMap.get(t.mechanic_id) || "Unknown",
      service_amount: svcAmt,
      mechanic_commission_amount: t.mechanic_commission_amount || 0,
    });
  }

  enriched.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

  const totalComm = enriched.reduce((s, r) => s + (r.mechanic_commission_amount || 0), 0);
  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "All Records";
  const staffLabel = mechanicId && mechanicId !== "all" ? mechMap.get(parseInt(mechanicId)) || "Staff" : "All Staff";

  const rows = enriched.map((r, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(r.date_created)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:700;color:#1971c2;font-size:12px">#${r.job_id}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${r.code || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:600;font-size:12px">${r.m_name}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;font-size:12px">${inr(r.service_amount)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#2f9e44;font-size:12px">${inr(r.mechanic_commission_amount)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Commission Report — ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:1000px;margin:0 auto}
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
      <h1>💰 ${SHOP.name} — Commission Report</h1>
      <p>Month: ${monthLabel} | Staff: ${staffLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${enriched.length}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#2f9e44">${inr(totalComm)}</div>
        <div class="stat-label">Total Commission</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:12%">Date</th>
          <th style="width:10%">Job ID</th>
          <th style="width:8%">Code</th>
          <th style="width:20%">Staff</th>
          <th style="width:15%">Service Amt</th>
          <th style="width:15%">Commission</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="5" style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${enriched.length} records):</td>
          <td style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px">${inr(enriched.reduce((s, r) => s + r.service_amount, 0))}</td>
          <td style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#2f9e44">${inr(totalComm)}</td>
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