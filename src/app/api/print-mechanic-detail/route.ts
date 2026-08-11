import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type DbRow = ReturnType<typeof JSON.parse>;

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!id) {
    return NextResponse.json({ error: "Missing mechanic id" }, { status: 400 });
  }

  const { data: mechanic } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname, contact, designation, daily_salary, commission_percent, status")
    .eq("id", parseInt(id))
    .single();

  if (!mechanic) {
    return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });
  }

  const name = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ");

  let jobs: DbRow[] = [];
  let advances: DbRow[] = [];
  let attendance: DbRow[] = [];

  if (from && to) {
    const start = `${from}T00:00:00`;
    const end = `${to}T23:59:59`;

    const [jobsRes, advRes, attRes] = await Promise.all([
      fetchAll(supabase.from("transaction_list")
        .select("id, job_id, item, mechanic_commission_amount, date_updated, status")
        .eq("mechanic_id", parseInt(id))
        .gte("date_updated", start)
        .lte("date_updated", end)
        .order("date_updated", { ascending: false })),
      fetchAll(supabase.from("advance_payments")
        .select("id, reason, amount, date_paid")
        .eq("mechanic_id", parseInt(id))
        .gte("date_paid", from)
        .lte("date_paid", to)
        .order("date_paid", { ascending: false })),
      fetchAll(supabase.from("attendance_list")
        .select("id, curr_date, status")
        .eq("mechanic_id", parseInt(id))
        .gte("curr_date", from)
        .lte("curr_date", to)
        .order("curr_date", { ascending: false })),
    ]);

    jobs = jobsRes;
    advances = advRes;
    attendance = attRes;
  }

  const totalComm = jobs.reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
  const totalAdv = advances.reduce((s, a) => s + (a.amount || 0), 0);
  const presentDays = attendance.filter(a => a.status === 1).length;
  const halfDays = attendance.filter(a => a.status === 3).length;

  const periodLabel = from && to ? `${fmtDate(from)} - ${fmtDate(to)}` : "All Time";
  const statusLabel = mechanic.status === 1 ? 'Active' : 'Inactive';
  const statusLabels = ['', 'In Progress', 'Done', 'Paid', 'Cancelled', 'Delivered'];

  const jobRows = jobs.length > 0 ? jobs.map((j, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(j.date_updated)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${j.job_id}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${j.item || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${statusLabels[j.status] || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;color:#c0392b">${inr(j.mechanic_commission_amount)}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="6" style="padding:16px;text-align:center;color:#666">No jobs in this period</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Mechanic Detail — ${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:900px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;flex-wrap:wrap}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;flex:1;min-width:100px}
    .stat-num{font-size:22px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
    .mechanic-info{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:12px 20px;margin:14px 20px}
    .mechanic-name{font-size:16px;font-weight:700;color:#001f3f}
    .mechanic-detail{font-size:12px;color:#666;margin-top:4px}
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
      <h1>🔧 ${SHOP.name} — Mechanic Performance Report</h1>
      <p>Period: ${periodLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="mechanic-info">
      <div class="mechanic-name">${name}</div>
      <div class="mechanic-detail">${mechanic.designation || 'Mechanic'} | ${mechanic.contact || '-'} | Salary: ${inr(mechanic.daily_salary)}/day | Status: ${statusLabel}</div>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${jobs.length}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(totalComm)}</div>
        <div class="stat-label">Commission</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalAdv)}</div>
        <div class="stat-label">Advances</div>
      </div>
      <div class="stat">
        <div class="stat-num">${presentDays}/${halfDays}</div>
        <div class="stat-label">Present/Half</div>
      </div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:15%">Date</th>
          <th style="width:12%">Job ID</th>
          <th style="width:28%">Item</th>
          <th style="width:22%">Status</th>
          <th style="width:18%">Commission</th>
        </tr>
      </thead>
      <tbody>${jobRows}</tbody>
    </table>
  </div>

  <div class="card">
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
