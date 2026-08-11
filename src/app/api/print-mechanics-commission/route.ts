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

  const from = month ? `${month}-01T00:00:00+05:30` : "";
  let to = "";
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`;
  }

  const mechData = await fetchAll(
    supabase
      .from("mechanic_list")
      .select("id, firstname, middlename, lastname, commission_percent")
      .order("firstname")
  );

  // PHP commission_history: only DELIVERED jobs (status=5) by date_completed
  let q = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, client_name, date_created, date_completed, mechanic_id, mechanic_commission_amount")
    .eq("status", 5)
    .gte("date_completed", from)
    .lte("date_completed", to);
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

  const mechMap = new Map(mechData?.map(m => [m.id, {
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
    rate: m.commission_percent || 0,
  }]) ?? []);

  // Client names (PHP: LEFT JOIN client_list on client_name)
  const clientIds = [...new Set(txns.map(t => Number(t.client_name)).filter(Boolean))];
  const clientMap = new Map<number, string>();
  if (clientIds.length > 0) {
    const { data: clRows } = await supabase.from("client_list").select("id, firstname, middlename, lastname").in("id", clientIds);
    (clRows || []).forEach(c => clientMap.set(c.id, [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ")));
  }

  // Service amounts (PHP: SUM(transaction_services.price))
  const txnIds = txns.map(t => t.id);
  const svcMap: Record<number, number> = {};
  if (txnIds.length > 0) {
    const { data: svcs } = await supabase.from("transaction_services").select("transaction_id, price").in("transaction_id", txnIds);
    svcs?.forEach(s => { svcMap[s.transaction_id] = (svcMap[s.transaction_id] || 0) + (s.price || 0); });
  }

  // Effective rate per job (PHP: latest history with effective_date <= job's date_created)
  const mechIds = [...new Set(txns.map(t => t.mechanic_id))];
  const histByMech: Record<number, { effective_date: string; id: number; commission_percent: number }[]> = {};
  if (mechIds.length > 0) {
    const { data: histRows } = await supabase.from("mechanic_commission_history")
      .select("id, mechanic_id, commission_percent, effective_date").in("mechanic_id", mechIds);
    (histRows || []).forEach(h => {
      if (!histByMech[h.mechanic_id]) histByMech[h.mechanic_id] = [];
      histByMech[h.mechanic_id].push({ effective_date: h.effective_date, id: h.id, commission_percent: h.commission_percent });
    });
    Object.values(histByMech).forEach(arr =>
      arr.sort((a, b) => (a.effective_date < b.effective_date ? 1 : a.effective_date > b.effective_date ? -1 : b.id - a.id))
    );
  }
  const effRateFor = (mechId: number, onDate: string, fallback: number): number => {
    const on = (onDate || "").slice(0, 10);
    const hist = histByMech[mechId] || [];
    for (const h of hist) {
      if (h.effective_date <= on) return h.commission_percent;
    }
    return fallback;
  };

  const enriched = [];
  for (const t of txns) {
    const mech = mechMap.get(t.mechanic_id);
    enriched.push({
      id: t.id,
      job_id: t.job_id || String(t.id),
      code: t.code || null,
      item: t.item || "",
      client_name: clientMap.get(Number(t.client_name)) || "",
      date_created: t.date_created,
      date_completed: t.date_completed,
      mechanic_id: t.mechanic_id,
      m_name: mech?.name || "Unknown",
      rate: effRateFor(t.mechanic_id, t.date_created, mech?.rate || 0),
      service_amount: svcMap[t.id] || 0,
      mechanic_commission_amount: t.mechanic_commission_amount || 0,
    });
  }

  // PHP sorts by date_completed DESC
  enriched.sort((a, b) =>
    new Date(b.date_completed || b.date_created).getTime() - new Date(a.date_completed || a.date_created).getTime()
  );

  const rows = enriched;
  const totalComm = rows.reduce((s, r) => s + r.mechanic_commission_amount, 0);
  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "All Records";
  const staffLabel = mechanicId && mechanicId !== "all" ? mechMap.get(parseInt(mechanicId))?.name || "Staff" : "All Staff";

  const byMechanic = rows.reduce<Record<number, { name: string; total: number; jobs: number }>>(
    (acc, r) => {
      if (!acc[r.mechanic_id]) acc[r.mechanic_id] = { name: r.m_name, total: 0, jobs: 0 };
      acc[r.mechanic_id].total += r.mechanic_commission_amount;
      acc[r.mechanic_id].jobs += 1;
      return acc;
    }, {}
  );
  const summary = Object.values(byMechanic).sort((a, b) => b.total - a.total);

  const rowsHtml = rows.map((r, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${fmtDate(r.date_completed || r.date_created)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:700;color:#1971c2;font-size:12px">#${r.job_id}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${r.item || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${r.client_name || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:600;font-size:12px">${r.m_name}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center;font-size:12px">${r.rate.toFixed(0)}%</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:600;font-size:12px">${inr(r.service_amount)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#2f9e44;font-size:12px">${inr(r.mechanic_commission_amount)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Mechanic Commission — ${monthLabel}</title>
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
      <h1>💰 ${SHOP.name} — Mechanic Commission</h1>
      <p>Month: ${monthLabel} | Staff: ${staffLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${rows.length}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#2f9e44">${inr(totalComm)}</div>
        <div class="stat-label">Total Commission</div>
      </div>
      <div class="stat">
        <div class="stat-num">${summary.length}</div>
        <div class="stat-label">Staff Count</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:4%">#</th>
          <th style="width:10%">Date</th>
          <th style="width:8%">Job ID</th>
          <th style="width:14%">Item</th>
          <th style="width:15%">Client</th>
          <th style="width:13%">Staff</th>
          <th style="width:6%">Rate</th>
          <th style="width:15%">Service Amt</th>
          <th style="width:15%">Commission</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="8" style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${rows.length} records):</td>
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