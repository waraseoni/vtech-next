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
    .select("id, firstname, middlename, lastname, daily_salary")
    .eq("id", parseInt(id))
    .single();

  if (!mechanic) {
    return NextResponse.json({ error: "Mechanic not found" }, { status: 404 });
  }

  const name = [mechanic.firstname, mechanic.middlename, mechanic.lastname].filter(Boolean).join(" ");
  const dailyRate = mechanic.daily_salary || 0;

  if (!from || !to) {
    return new NextResponse("<html><body><h1>Please specify from and to dates</h1></body></html>", { headers: { "Content-Type": "text/html" } });
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

  const periodLabel = `${formatDate(from)} - ${formatDate(to)}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Mechanic Ledger - ${name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a1a2e; padding-bottom: 15px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 18px; font-weight: 700; margin-top: 15px; }
    .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
    .mechanic-info { font-size: 14px; font-weight: 600; margin-bottom: 15px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
    .summary-card { background: #f8f9fa; border-radius: 8px; padding: 12px; text-align: center; }
    .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 16px; font-weight: 900; color: #1a1a2e; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
    th { background: #f8f9fa; padding: 8px 6px; text-align: left; font-weight: 700; font-size: 9px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 6px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
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
    <h1>Mechanic Daily Ledger</h1>
    <div class="subtitle">${periodLabel} | Generated: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="mechanic-info">${name} | Daily Rate: ${inr(dailyRate)}</div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Opening</div>
      <div class="summary-value ${opening >= 0 ? '' : 'negative'}">${inr(opening)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Earned</div>
      <div class="summary-value">${inr(totalEarned)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Commission</div>
      <div class="summary-value positive">${inr(totalComm)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Advances</div>
      <div class="summary-value negative">${inr(totalAdv)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Day</th>
        <th>Status</th>
        <th class="text-right">Earned</th>
        <th class="text-right">Comm</th>
        <th class="text-right">Advance</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(e => `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${e.dayName}</td>
        <td>${e.status}</td>
        <td class="text-right">${inr(e.earned)}</td>
        <td class="text-right positive">${inr(e.commission)}</td>
        <td class="text-right negative">${inr(e.advance)}</td>
        <td class="text-right ${e.running >= 0 ? '' : 'negative'}">${inr(e.running)}</td>
      </tr>`).join("")}
    </tbody>
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