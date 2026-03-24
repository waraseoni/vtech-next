import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!id) {
    return NextResponse.json({ error: "Missing mechanic id" }, { status: 400 });
  }

  const { data: mechanic } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname, daily_salary")
    .eq("id", parseInt(id))
    .single();

  if (!mechanic) {
    return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });
  }

  const name = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ");
  const dailyRate = mechanic.daily_salary || 0;

  if (!from || !to) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Please specify from and to dates</h2>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  const prevDateStr = d.toISOString().split("T")[0];

  const [prevAtt, prevComm, prevAdv, allAtt, allComm, allAdv] = await Promise.all([
    supabase.from("attendance_list").select("status").eq("mechanic_id", parseInt(id)).in("status", [1, 3]).lte("curr_date", prevDateStr),
    supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", parseInt(id)).lte("date_created", `${prevDateStr} 23:59:59`),
    supabase.from("advance_payments").select("amount").eq("mechanic_id", parseInt(id)).lte("date_paid", prevDateStr),
    supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", parseInt(id)).gte("curr_date", from).lte("curr_date", to),
    supabase.from("transaction_list").select("date_created, mechanic_commission_amount").eq("mechanic_id", parseInt(id)).gte("date_created", `${from}T00:00:00`).lte("date_created", `${to}T23:59:59`),
    supabase.from("advance_payments").select("date_paid, amount").eq("mechanic_id", parseInt(id)).gte("date_paid", from).lte("date_paid", to),
  ]);

  let opening = 0;
  (prevAtt.data || []).forEach((a: any) => { opening += a.status === 1 ? dailyRate : dailyRate / 2; });
  opening += (prevComm.data || []).reduce((s: number, c: any) => s + (c.mechanic_commission_amount || 0), 0);
  opening -= (prevAdv.data || []).reduce((s: number, a: any) => s + (a.amount || 0), 0);

  const entries: { date: string; status: string; earned: number; commission: number; advance: number; running: number; dayName: string }[] = [];
  let running = opening;
  let totalEarned = 0, totalComm = 0, totalAdv = 0;

  const startDate = new Date(from);
  const endDate = new Date(to);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const attMap: Record<string, number> = {};
  (allAtt.data || []).forEach((a: any) => { attMap[a.curr_date] = a.status; });

  const commMap: Record<string, number> = {};
  (allComm.data || []).forEach((c: any) => {
    const d = c.date_created?.split("T")[0];
    if (d) commMap[d] = (commMap[d] || 0) + (c.mechanic_commission_amount || 0);
  });

  const advMap: Record<string, number> = {};
  (allAdv.data || []).forEach((a: any) => {
    advMap[a.date_paid] = (advMap[a.date_paid] || 0) + (a.amount || 0);
  });

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayName = dayNames[currentDate.getDay()];
    const status = attMap[dateStr];

    let dailyEarned = 0;
    let statusLabel = "Absent";
    if (status === 1) { dailyEarned = dailyRate; statusLabel = "Present"; }
    else if (status === 3) { dailyEarned = dailyRate / 2; statusLabel = "Half Day"; }

    const dayComm = commMap[dateStr] || 0;
    const dayAdv = advMap[dateStr] || 0;

    running += dailyEarned + dayComm - dayAdv;
    totalEarned += dailyEarned;
    totalComm += dayComm;
    totalAdv += dayAdv;

    entries.push({ date: dateStr, status: statusLabel, earned: dailyEarned, commission: dayComm, advance: dayAdv, running, dayName });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const periodLabel = `${fmtDate(from)} - ${fmtDate(to)}`;

  const ledgerRows = entries.map((e, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${fmtDate(e.date)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${e.dayName}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${e.status}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(e.earned)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#28a745">${inr(e.commission)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#c0392b">${inr(e.advance)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:${e.running >= 0 ? '#001f3f' : '#c0392b'}">${inr(e.running)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Mechanic Ledger — ${name}</title>
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
    .stat-num{font-size:20px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
    .mechanic-info{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 20px;margin:14px 20px;font-size:13px;font-weight:600}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#001f3f}
    th{padding:8px 6px;color:#fff;font-size:10px;font-weight:700;text-align:left}
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
      <h1>📔 ${SHOP.name} — Mechanic Daily Ledger</h1>
      <p>Period: ${periodLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="mechanic-info">${name} | Daily Rate: ${inr(dailyRate)}</div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num" style="color:${opening >= 0 ? '#001f3f' : '#c0392b'}">${inr(opening)}</div>
        <div class="stat-label">Opening</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(totalEarned)}</div>
        <div class="stat-label">Total Earned</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(totalComm)}</div>
        <div class="stat-label">Commission</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalAdv)}</div>
        <div class="stat-label">Advances</div>
      </div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th style="width:15%">Date</th>
          <th style="width:15%">Day</th>
          <th style="width:14%">Status</th>
          <th style="width:14%;text-align:right">Earned</th>
          <th style="width:14%;text-align:right">Comm</th>
          <th style="width:14%;text-align:right">Advance</th>
          <th style="width:14%;text-align:right">Balance</th>
        </tr>
      </thead>
      <tbody>${ledgerRows}</tbody>
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
