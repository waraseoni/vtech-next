import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function getEffectiveRate(mechanicId: number, dateStr: string, defaultRate: number, history: { mechanic_id: number; salary: number; effective_date: string }[]) {
  const applicableRate = history.find(h => h.mechanic_id === mechanicId && h.effective_date <= dateStr);
  return applicableRate ? applicableRate.salary : defaultRate;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const monthStart = `${month}-01`;
  const nextMonthD = new Date(monthStart);
  nextMonthD.setMonth(nextMonthD.getMonth() + 1);
  const nextMonthStart = nextMonthD.toISOString().split("T")[0];

  const { data: mechData } = await supabase
    .from("mechanic_list")
    .select("id, firstname, middlename, lastname, salary_per_day, designation")
    .eq("status", 1)
    .eq("delete_flag", 0)
    .order("firstname");

  const typedMechs = (mechData || []).map((m) => ({ ...m, designation: m.designation || null }));
  const mechIds = typedMechs.map(m => m.id);

  if (mechIds.length === 0) {
    return new NextResponse("<html><body>No mechanics found</body></html>", { headers: { "Content-Type": "text/html" } });
  }

  const [
    { data: allAtt },
    { data: allComm },
    { data: allAdv },
    { data: allHist }
  ] = await Promise.all([
    supabase.from("attendance_list").select("mechanic_id, curr_date, status").in("mechanic_id", mechIds).in("status", [1, 3]).lt("curr_date", nextMonthStart),
    supabase.from("transaction_list").select("mechanic_id, mechanic_commission_amount, date_created").in("mechanic_id", mechIds).lt("date_created", `${nextMonthStart}T00:00:00`),
    supabase.from("advance_payments").select("mechanic_id, amount, date_paid").in("mechanic_id", mechIds).lt("date_paid", nextMonthStart),
    supabase.from("mechanic_salary_history").select("*").in("mechanic_id", mechIds).order("effective_date", { ascending: false }).order("id", { ascending: false })
  ]);

  const attList = allAtt || [];
  const commList = allComm || [];
  const advList = allAdv || [];
  const histList = allHist || [];

  const salaryRows = typedMechs.map((m) => {
    const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
    const defaultSal = m.salary_per_day || 0;

    let earnedPrev = 0;
    attList.filter((a: any) => a.mechanic_id === m.id && a.curr_date < monthStart).forEach((a: any) => {
      const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
      earnedPrev += (a.status === 3 ? rate / 2 : rate);
    });

    const commPrevSum = commList.filter((c: any) => c.mechanic_id === m.id && c.date_created < `${monthStart}T00:00:00`)
                                .reduce((s: number, c: any) => s + (c.mechanic_commission_amount || 0), 0);

    const advPrevSum = advList.filter((a: any) => a.mechanic_id === m.id && a.date_paid < monthStart)
                              .reduce((s: number, a: any) => s + (a.amount || 0), 0);

    const oldBalance = earnedPrev + commPrevSum - advPrevSum;

    let currentFix = 0;
    let presentCount = 0;
    let halfDayCount = 0;

    attList.filter((a: any) => a.mechanic_id === m.id && a.curr_date >= monthStart && a.curr_date < nextMonthStart).forEach((a: any) => {
      const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
      if (a.status === 3) {
        halfDayCount++;
        currentFix += (rate / 2);
      } else {
        presentCount++;
        currentFix += rate;
      }
    });

    const currentComm = commList.filter((c: any) => c.mechanic_id === m.id && c.date_created >= `${monthStart}T00:00:00` && c.date_created < `${nextMonthStart}T00:00:00`)
                                .reduce((s: number, c: any) => s + (c.mechanic_commission_amount || 0), 0);

    const currentAdv = advList.filter((a: any) => a.mechanic_id === m.id && a.date_paid >= monthStart && a.date_paid < nextMonthStart)
                              .reduce((s: number, a: any) => s + (a.amount || 0), 0);

    const netFinal = oldBalance + currentFix + currentComm - currentAdv;

    return {
      id: m.id, name, salary_per_day: defaultSal,
      present_count: presentCount, half_day_count: halfDayCount,
      current_fix: currentFix, current_comm: currentComm,
      old_balance: oldBalance, current_adv: currentAdv, net_final: netFinal
    };
  });

  const summaryTotals = salaryRows.reduce((acc, row) => ({
    payout: acc.payout + (row.net_final > 0 ? row.net_final : 0),
    advances: acc.advances + row.current_adv,
    commissions: acc.commissions + row.current_comm
  }), { payout: 0, advances: 0, commissions: 0 });

  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Salary Report - ${monthLabel}</title>
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
    <h1>Salary Report</h1>
    <div class="subtitle">${monthLabel} | Date: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-label">Total Payable</div>
      <div class="summary-value positive">${inr(summaryTotals.payout)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Month Advances</div>
      <div class="summary-value negative">${inr(summaryTotals.advances)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Commissions</div>
      <div class="summary-value">${inr(summaryTotals.commissions)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Staff Name</th>
        <th class="text-center">Present</th>
        <th class="text-center">Half</th>
        <th class="text-right">Fixed</th>
        <th class="text-right">Commission</th>
        <th class="text-right">Old Balance</th>
        <th class="text-right">Advance</th>
        <th class="text-right">Net Final</th>
      </tr>
    </thead>
    <tbody>
      ${salaryRows.map((r, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td><strong>${r.name}</strong></td>
        <td class="text-center">${r.present_count}</td>
        <td class="text-center">${r.half_day_count}</td>
        <td class="text-right">${inr(r.current_fix)}</td>
        <td class="text-right">${inr(r.current_comm)}</td>
        <td class="text-right ${r.old_balance >= 0 ? 'positive' : 'negative'}">${inr(r.old_balance)}</td>
        <td class="text-right negative">${inr(r.current_adv)}</td>
        <td class="text-right ${r.net_final >= 0 ? 'positive' : 'negative'}"><strong>${inr(r.net_final)}</strong></td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="text-right">Total:</td>
        <td class="text-right">${inr(salaryRows.reduce((s, r) => s + r.current_fix, 0))}</td>
        <td class="text-right">${inr(summaryTotals.commissions)}</td>
        <td class="text-right">${inr(salaryRows.reduce((s, r) => s + r.old_balance, 0))}</td>
        <td class="text-right negative">${inr(summaryTotals.advances)}</td>
        <td class="text-right positive"><strong>${inr(summaryTotals.payout)}</strong></td>
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