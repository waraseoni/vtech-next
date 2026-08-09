import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_MAP: Record<number, string> = {
  0: "Pending", 1: "On-Progress", 2: "Done",
  3: "Paid", 4: "Cancelled", 5: "Delivered",
};
const STATUS_COLOR: Record<number, string> = {
  0: "#868e96", 1: "#339af0", 2: "#20c997",
  3: "#40c057", 4: "#fa5252", 5: "#7950f2",
};
const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875", email: "vtech.jbp@gmail.com",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}
function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url      = new URL(req.url);
  const dateFrom = url.searchParams.get("date_from") || "";
  const dateTo   = url.searchParams.get("date_to")   || "";

  // ── Fetch transactions ─────────────────────────────────────────────────────
  let q = supabase
    .from("transaction_list")
    .select("*")
    .eq("del_status", 0)
    .order("date_created", { ascending: false });

  if (dateFrom) q = q.gte("date_created", `${dateFrom}T00:00:00+05:30`);
  if (dateTo)   q = q.lte("date_created", `${dateTo}T23:59:59+05:30`);

  const txns = await fetchAll(q);
  if (!txns.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi transactions nahi mili</h2>
        <p style="color:#666">Selected date range mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // ── Fetch client names ─────────────────────────────────────────────────────
  const clientIds = [...new Set(txns.map(t => Number(t.client_name)))];
  const clients = await fetchAllIn(
    (ids) => supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact")
      .in("id", ids),
    clientIds
  );
  const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

  // ── Fetch mechanic names ───────────────────────────────────────────────────
  const mechIds = [...new Set(txns.map(t => t.mechanic_id).filter(Boolean))];
  const mechMap = new Map<number, string>();
  if (mechIds.length > 0) {
    const mechs = await fetchAllIn(
      (ids) => supabase
        .from("mechanic_list")
        .select("id, firstname, lastname")
        .in("id", ids),
      mechIds
    );
    mechs?.forEach(m => mechMap.set(m.id, `${m.firstname} ${m.lastname}`.trim()));
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalAmount    = txns.reduce((s, t) => s + (t.amount || 0), 0);
  const deliveredCount = txns.filter(t => t.status === 5).length;
  const pendingCount   = txns.filter(t => t.status === 0).length;

  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo ? fmtDate(dateFrom + "T00:00") : `${fmtDate(dateFrom + "T00:00")} – ${fmtDate(dateTo + "T00:00")}`)
    : "All Records";

  // ── Table rows ─────────────────────────────────────────────────────────────
  const rows = txns.map((t, i) => {
    const cid    = Number(t.client_name);
    const client = clientMap.get(cid);
    const cName  = client
      ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ")
      : `Client #${cid}`;
    const mName  = t.mechanic_id ? (mechMap.get(t.mechanic_id) || "—") : "—";
    const sColor = STATUS_COLOR[t.status] || "#333";
    const rowBg  = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px;white-space:nowrap">${fmtDateTime(t.date_created)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:700;color:#1971c2;font-size:12px">#${t.job_id}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:11px;color:#666">${t.code || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-weight:600;font-size:12px">${cName}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:11px;color:#555">${client?.contact || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:12px">${t.item || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:11px;color:#c0392b">${t.fault || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:11px;color:#555">${t.uniq_id || "—"}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;font-size:11px">${mName}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:right;font-weight:700;font-size:12px">${inr(t.amount || 0)}</td>
      <td style="padding:7px 8px;border:1px solid #dee2e6;text-align:center">
        <span style="display:inline-block;padding:2px 8px;border-radius:3px;background:${sColor};color:#fff;font-size:10px;font-weight:700;white-space:nowrap">${STATUS_MAP[t.status] || "—"}</span>
        ${t.status === 5 && t.date_completed ? `<div style="font-size:9px;color:#666;margin-top:2px">${fmtDate(t.date_completed)}</div>` : ""}
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Transactions Report — ${dateLabel}</title>
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
    .tbl-wrap{overflow-x:auto;padding:0}
    table{width:100%;border-collapse:collapse;font-size:12px;min-width:1000px}
    thead tr{background:#001f3f}
    th{padding:9px 8px;color:#fff;font-size:11px;font-weight:700;text-align:left;white-space:nowrap}
    .actions{text-align:center;padding:16px;background:#f8f9fa;border-top:1px solid #dee2e6}
    .btn{padding:10px 22px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;margin:4px;display:inline-flex;align-items:center;gap:6px;transition:all .2s}
    .btn:hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(0,0,0,.15)}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .footer{text-align:center;color:#666;font-size:11px;padding:10px}
    @media print{
      @page{margin:.8cm;size:A4 landscape}
      body{background:#fff;padding:0;font-size:10px}
      .actions{display:none!important}
      .card{box-shadow:none;border:1px solid #ddd}
      .hdr{background:#001f3f!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      thead tr{background:#001f3f!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      table{font-size:9.5px}
      th{font-size:9px}
    }
    @media screen and (max-width:768px){
      body{padding:10px}
      .stats{gap:8px}
      .stat{min-width:90px}
    }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <!-- Header -->
    <div class="hdr">
      <h1>📋 ${SHOP.name} — Transactions Report</h1>
      <p>Period: ${dateLabel} &nbsp;|&nbsp; Generated: ${fmtDateTime(new Date().toISOString())} &nbsp;|&nbsp; ${SHOP.mobile}</p>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${txns.length}</div>
        <div class="stat-label">Total Jobs</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#7950f2">${deliveredCount}</div>
        <div class="stat-label">Delivered</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#868e96">${pendingCount}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#2f9e44">${inr(totalAmount)}</div>
        <div class="stat-label">Total Amount</div>
      </div>
    </div>

    <!-- Table -->
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:4%">#</th>
            <th style="width:12%">Date / Time</th>
            <th style="width:7%">Job ID</th>
            <th style="width:8%">Code</th>
            <th style="width:13%">Client</th>
            <th style="width:9%">Contact</th>
            <th style="width:11%">Item</th>
            <th style="width:11%">Fault</th>
            <th style="width:6%">Loc.</th>
            <th style="width:8%">Mechanic</th>
            <th style="width:7%">Amount</th>
            <th style="width:8%">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f0f4ff;font-weight:700">
            <td colspan="10" style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total (${txns.length} records):</td>
            <td style="padding:9px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#2f9e44">${inr(totalAmount)}</td>
            <td style="border:1px solid #dee2e6"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">🖨 Print Report</button>
      <button onclick="window.close()" class="btn btn-close">✕ Close</button>
    </div>
  </div>
  <div class="footer">${SHOP.name} &nbsp;|&nbsp; ${SHOP.address} &nbsp;|&nbsp; ${SHOP.mobile}</div>
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