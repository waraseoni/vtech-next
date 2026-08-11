import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, pageAll } from "@/lib/fetch-all";

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

function getEffectiveRate(mechanicId: number, dateStr: string, defaultRate: number, history: { mechanic_id: number; salary: number; effective_date: string }[]) {
  const applicableRate = history.find(h => h.mechanic_id === mechanicId && h.effective_date <= dateStr);
  return applicableRate ? applicableRate.salary : defaultRate;
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || "";

  const monthStart = `${month}-01`;
  const nextMonthD = new Date(monthStart);
  nextMonthD.setMonth(nextMonthD.getMonth() + 1);
  const nextMonthStart = nextMonthD.toISOString().split("T")[0];

  const mechData = await fetchAll(
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, daily_salary, designation")
      .eq("status", 1)
      .eq("delete_flag", 0)
      .order("firstname")
  );

  const typedMechs = (mechData || []).map((m) => ({ ...m, designation: m.designation || null }));
  const mechIds = typedMechs.map(m => m.id);

  if (mechIds.length === 0) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi staff nahi mila</h2>
        <p style="color:#666">No active mechanics found.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const [{ data: allAtt }, { data: allComm }, { data: allAdv }, { data: allHist }] = await Promise.all([
    pageAll(supabase.from("attendance_list").select("mechanic_id, curr_date, status").in("mechanic_id", mechIds).in("status", [1, 3]).lt("curr_date", nextMonthStart)),
    pageAll(supabase.from("transaction_list").select("mechanic_id, mechanic_commission_amount, date_created").in("mechanic_id", mechIds).lt("date_created", `${nextMonthStart}T00:00:00+05:30`)),
    pageAll(supabase.from("advance_payments").select("mechanic_id, amount, date_paid").in("mechanic_id", mechIds).lt("date_paid", nextMonthStart)),
    pageAll(supabase.from("mechanic_salary_history").select("*").in("mechanic_id", mechIds).order("effective_date", { ascending: false }).order("id", { ascending: false }))
  ]);

  const attList = allAtt || [];
  const commList = allComm || [];
  const advList = allAdv || [];
  const histList = allHist || [];

  const salaryRows = typedMechs.map((m) => {
    const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ");
    const defaultSal = m.daily_salary || 0;

    let earnedPrev = 0;
    attList.filter((a) => a.mechanic_id === m.id && a.curr_date < monthStart).forEach((a) => {
      const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
      earnedPrev += (a.status === 3 ? rate / 2 : rate);
    });

    const commPrevSum = commList.filter((c) => c.mechanic_id === m.id && c.date_created < `${monthStart}T00:00:00+05:30`).reduce((s: number, c) => s + (c.mechanic_commission_amount || 0), 0);
    const advPrevSum = advList.filter((a) => a.mechanic_id === m.id && a.date_paid < monthStart).reduce((s: number, a) => s + (a.amount || 0), 0);
    const oldBalance = earnedPrev + commPrevSum - advPrevSum;

    let currentFix = 0, presentCount = 0, halfDayCount = 0;
    attList.filter((a) => a.mechanic_id === m.id && a.curr_date >= monthStart && a.curr_date < nextMonthStart).forEach((a) => {
      const rate = getEffectiveRate(m.id, a.curr_date, defaultSal, histList);
      if (a.status === 3) { halfDayCount++; currentFix += (rate / 2); }
      else { presentCount++; currentFix += rate; }
    });

    const currentComm = commList.filter((c) => c.mechanic_id === m.id && c.date_created >= `${monthStart}T00:00:00+05:30` && c.date_created < `${nextMonthStart}T00:00:00+05:30`).reduce((s: number, c) => s + (c.mechanic_commission_amount || 0), 0);
    const currentAdv = advList.filter((a) => a.mechanic_id === m.id && a.date_paid >= monthStart && a.date_paid < nextMonthStart).reduce((s: number, a) => s + (a.amount || 0), 0);
    const netFinal = oldBalance + currentFix + currentComm - currentAdv;

    return { id: m.id, name, daily_salary: defaultSal, present_count: presentCount, half_day_count: halfDayCount, current_fix: currentFix, current_comm: currentComm, old_balance: oldBalance, current_adv: currentAdv, net_final: netFinal };
  });

  const summaryTotals = salaryRows.reduce((acc, row) => ({
    payout: acc.payout + (row.net_final > 0 ? row.net_final : 0),
    advances: acc.advances + row.current_adv,
    commissions: acc.commissions + row.current_comm
  }), { payout: 0, advances: 0, commissions: 0 });

  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "All Records";

  const rowsHtml = salaryRows.map((r, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:11px">${i + 1}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-weight:600;font-size:11px">${r.name}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center;font-size:11px">${r.present_count}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center;font-size:11px">${r.half_day_count}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(r.current_fix)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(r.current_comm)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:${r.old_balance >= 0 ? '#28a745' : '#dc3545'}">${inr(r.old_balance)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#dc3545">${inr(r.current_adv)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;font-size:11px;color:${r.net_final >= 0 ? '#28a745' : '#dc3545'}">${inr(r.net_final)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Salary Report — ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:1200px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:20px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;flex-wrap:wrap}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;min-width:120px}
    .stat-num{font-size:22px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead tr{background:#001f3f}
    th{padding:8px 6px;color:#fff;font-size:10px;font-weight:700;text-align:left}
    .actions{text-align:center;padding:16px;background:#f8f9fa;border-top:1px solid #dee2e6}
    .btn{padding:10px 22px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;margin:4px}
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
      <h1>💰 ${SHOP.name} — Salary Report</h1>
      <p>Month: ${monthLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num" style="color:#28a745">${inr(summaryTotals.payout)}</div>
        <div class="stat-label">Total Payable</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#dc3545">${inr(summaryTotals.advances)}</div>
        <div class="stat-label">Month Advances</div>
      </div>
      <div class="stat">
        <div class="stat-num">${inr(summaryTotals.commissions)}</div>
        <div class="stat-label">Total Commissions</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:4%">#</th>
          <th style="width:18%">Staff Name</th>
          <th style="width:7%">Present</th>
          <th style="width:6%">Half</th>
          <th style="width:10%">Fixed</th>
          <th style="width:10%">Commission</th>
          <th style="width:10%">Old Bal</th>
          <th style="width:10%">Advance</th>
          <th style="width:10%">Net Final</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="4" style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px">Total:</td>
          <td style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(salaryRows.reduce((s, r) => s + r.current_fix, 0))}</td>
          <td style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(summaryTotals.commissions)}</td>
          <td style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(salaryRows.reduce((s, r) => s + r.old_balance, 0))}</td>
          <td style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#dc3545">${inr(summaryTotals.advances)}</td>
          <td style="padding:8px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px;color:#28a745">${inr(summaryTotals.payout)}</td>
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