import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, pageAll } from "@/lib/fetch-all";

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
  // "created" = attribute jobs by date_created (all statuses, pending shown; only delivered counts toward balance) — matches mechanics/ledger/[id]
  // "completed" (default) = attribute jobs by date_completed, delivered only — matches mechanics/[id]/ledger
  const mode = searchParams.get("mode") === "created" ? "created" : "completed";

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

  if (!from || !to) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Please specify from and to dates</h2>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // 1. Fetch Salary History
  const salaryHist = await fetchAll(
    supabase
      .from("mechanic_salary_history")
      .select("salary, effective_date")
      .eq("mechanic_id", id)
      .order("effective_date", { ascending: false })
  );

  const getDailyRate = (dateStr: string) => {
    const hist = (salaryHist || []).find(h => h.effective_date <= dateStr);
    return hist ? parseFloat(hist.salary) : mechanic.daily_salary;
  };

  const prevLimit = new Date(from);
  prevLimit.setDate(prevLimit.getDate() - 1);
  const prevLimitStr = prevLimit.toISOString().split("T")[0];

  const attrKey = mode === "created" ? "date_created" : "date_completed";
  const periodJobs = mode === "created"
    ? pageAll(supabase.from("transaction_list").select("id, job_id, item, mechanic_commission_amount, status, date_created").eq("mechanic_id", id).gte("date_created", from + " 00:00:00").lte("date_created", to + " 23:59:59"))
    : pageAll(supabase.from("transaction_list").select("id, job_id, item, mechanic_commission_amount, status, date_completed").eq("mechanic_id", id).eq("status", 5).gte("date_completed", from + " 00:00:00").lte("date_completed", to + " 23:59:59"));

  // 2. Fetch Data for Opening Balance & Period
  const [prevAtt, prevComm, prevAdv, allAtt, allComm, allAdv] = await Promise.all([
    pageAll(supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", id).in("status", [1, 3]).lte("curr_date", prevLimitStr)),
    pageAll(supabase.from("transaction_list").select("mechanic_commission_amount").eq("mechanic_id", id).eq("status", 5).lte("date_completed", prevLimitStr + " 23:59:59")),
    pageAll(supabase.from("advance_payments").select("amount").eq("mechanic_id", id).lte("date_paid", prevLimitStr)),
    pageAll(supabase.from("attendance_list").select("curr_date, status").eq("mechanic_id", id).gte("curr_date", from).lte("curr_date", to)),
    periodJobs,
    pageAll(supabase.from("advance_payments").select("amount, date_paid").eq("mechanic_id", id).gte("date_paid", from).lte("date_paid", to))
  ]);

  // 3. Calculate Opening Balance
  let opening = 0;
  (prevAtt.data || []).forEach(att => {
    const rate = getDailyRate(att.curr_date);
    opening += att.status === 1 ? rate : rate / 2;
  });
  opening += (prevComm.data || []).reduce((s, c) => s + (parseFloat(c.mechanic_commission_amount) || 0), 0);
  opening -= (prevAdv.data || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  // 4. Build Ledger Grid
  const entries: DbRow[] = [];
  let running = opening;
  let totalEarned = 0, totalComm = 0, totalGen = 0, totalAdv = 0;

  const startDate = new Date(from);
  const endDate = new Date(to);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dStr = currentDate.toISOString().split("T")[0];
    const dayName = dayNames[currentDate.getDay()];
    
    // Attendance
    const att = (allAtt.data || []).find(a => a.curr_date === dStr);
    let statusLabel = "Absent", wage = 0;
    if (att) {
      const rate = getDailyRate(dStr);
      if (att.status === 1) { statusLabel = "Present"; wage = rate; }
      else if (att.status === 3) { statusLabel = "Half Day"; wage = rate / 2; }
    }

    // Jobs: completed mode counts commission on delivery date (status=5 only);
    // created mode attributes jobs by creation date and counts only delivered toward balance
    const dayJobs = (allComm.data || []).filter(j => ((j as Record<string, string | null>)[attrKey] || "").startsWith(dStr));
    let commPay = 0;
    let commGen = 0;
    dayJobs.forEach(j => {
      const val = parseFloat(j.mechanic_commission_amount) || 0;
      commGen += val;
      if (mode === "completed" || j.status === 5) commPay += val;
    });

    // Advance
    const dayAdv = (allAdv.data || []).filter(a => a.date_paid === dStr).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

    running += (wage + commPay - dayAdv);
    totalEarned += wage;
    totalComm += commPay;
    totalGen += commGen;
    totalAdv += dayAdv;

    entries.push({ 
      date: dStr, 
      status: statusLabel, 
      earned: wage, 
      commission: commPay, 
      generated: commGen, 
      advance: dayAdv, 
      running, 
      dayName,
      jobs: dayJobs 
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const periodLabel = `${fmtDate(from)} - ${fmtDate(to)}`;

  const ledgerRows = entries.map((e, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    const jobDetails = (e.jobs || []).map((j: DbRow) => {
      const isDelivered = j.status === 5;
      return `
      <div style="font-size:9px;color:#666;border-bottom:1px solid #eee;padding:2px 0">
        <span style="color:#007bff;font-weight:bold">#${j.job_id}</span> ${j.item} 
        <span style="font-size:8px;font-weight:bold;color:${isDelivered ? '#28a745' : '#adb5bd'}">${isDelivered ? 'DELIVERED' : 'PENDING'}</span>
        <span style="float:right;font-weight:bold">₹${(parseFloat(j.mechanic_commission_amount) || 0).toFixed(0)}</span>
      </div>`;
    }).join("");

    return `<tr style="background:${rowBg}">
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${fmtDate(e.date)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${e.dayName}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">${e.status}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(e.earned)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px">
        ${jobDetails || '<span style="color:#ccc;font-style:italic">No jobs</span>'}
      </td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#28a745">
        ${inr(e.commission)}
        ${mode === "created" && e.generated > e.commission ? `<div style="font-size:8px;color:#adb5bd">Gen: ${inr(e.generated)}</div>` : ""}
      </td>
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
      ${mode === "created" ? '<p style="font-size:10px;opacity:.8;margin-top:2px">Jobs attributed by creation date — pending jobs shown; only delivered count toward balance.</p>' : ""}
    </div>
    <div class="mechanic-info">${name} | Daily Rate: ${inr(mechanic.daily_salary)}</div>
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
        <div class="stat-label">Comm ${mode === "created" ? "Payable" : ""}</div>
      </div>
      ${mode === "created" ? `<div class="stat">
        <div class="stat-num" style="color:#adb5bd">${inr(totalGen)}</div>
        <div class="stat-label">Comm Generated</div>
      </div>` : ""}
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
          <th style="width:10%">Date</th>
          <th style="width:10%">Day</th>
          <th style="width:10%">Status</th>
          <th style="width:12%;text-align:right">Wage</th>
          <th style="width:28%">Jobs & Details</th>
          <th style="width:10%;text-align:right">Comm</th>
          <th style="width:10%;text-align:right">Advance</th>
          <th style="width:10%;text-align:right">Balance</th>
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
