import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
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
    .select("id, firstname, middlename, lastname, contact, designation, salary_per_day, commission_percent, status")
    .eq("id", parseInt(id))
    .single();

  if (!mechanic) {
    return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });
  }

  const name = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ");

  let jobs: any[] = [];
  let advances: any[] = [];
  let attendance: any[] = [];

  if (from && to) {
    const start = `${from}T00:00:00`;
    const end = `${to}T23:59:59`;

    const [jobsRes, advRes, attRes] = await Promise.all([
      supabase.from("transaction_list")
        .select("id, job_id, item, mechanic_commission_amount, date_updated, status")
        .eq("mechanic_id", parseInt(id))
        .gte("date_updated", start)
        .lte("date_updated", end)
        .order("date_updated", { ascending: false }),
      supabase.from("advance_payments")
        .select("id, reason, amount, date_paid")
        .eq("mechanic_id", parseInt(id))
        .gte("date_paid", from)
        .lte("date_paid", to)
        .order("date_paid", { ascending: false }),
      supabase.from("attendance_list")
        .select("id, curr_date, status")
        .eq("mechanic_id", parseInt(id))
        .gte("curr_date", from)
        .lte("curr_date", to)
        .order("curr_date", { ascending: false }),
    ]);

    jobs = jobsRes.data || [];
    advances = advRes.data || [];
    attendance = attRes.data || [];
  }

  const totalComm = jobs.reduce((s, j) => s + (j.mechanic_commission_amount || 0), 0);
  const totalAdv = advances.reduce((s, a) => s + (a.amount || 0), 0);
  const presentDays = attendance.filter(a => a.status === 1).length;
  const halfDays = attendance.filter(a => a.status === 3).length;
  const salaryDue = (presentDays + halfDays * 0.5) * (mechanic.salary_per_day || 0);

  const periodLabel = from && to ? `${formatDate(from)} - ${formatDate(to)}` : "All Time";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mechanic Detail - ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .mechanic-info { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; margin-bottom: 20px; }
    .mechanic-name { font-size: 18px; font-weight: 700; }
    .mechanic-detail { font-size: 12px; color: #666; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 18px; font-weight: 900; color: #1a1a2e; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
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
    <h1>Mechanic Performance Report</h1>
    <div class="subtitle">${periodLabel} | Generated: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="mechanic-info">
    <div class="mechanic-name">${name}</div>
    <div class="mechanic-detail">${mechanic.designation || 'Mechanic'} | ${mechanic.contact || '-'} | Salary: ${inr(mechanic.salary_per_day)}/day | Status: ${mechanic.status === 1 ? 'Active' : 'Inactive'}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Jobs</div>
      <div class="summary-value">${jobs.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Commission</div>
      <div class="summary-value">${inr(totalComm)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Advances</div>
      <div class="summary-value">${inr(totalAdv)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Present/Half</div>
      <div class="summary-value">${presentDays}/${halfDays}</div>
    </div>
  </div>

  ${jobs.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Job ID</th>
        <th>Item</th>
        <th>Status</th>
        <th class="text-right">Commission</th>
      </tr>
    </thead>
    <tbody>
      ${jobs.map((j, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${formatDate(j.date_updated)}</td>
        <td>${j.job_id}</td>
        <td>${j.item || '-'}</td>
        <td>${['', 'In Progress', 'Done', 'Paid', 'Cancelled', 'Delivered'][j.status] || '-'}</td>
        <td class="text-right">${inr(j.mechanic_commission_amount)}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : "<p style='text-align:center;color:#666;margin:20px'>No jobs in this period</p>"}

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