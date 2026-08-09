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

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || "";

  if (!month) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Month parameter required</h2>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const from = `${month}-01T00:00:00+05:30`;
  const toDate = new Date(month + "-01");
  toDate.setMonth(toDate.getMonth() + 1);
  toDate.setDate(toDate.getDate() - 1);
  const to = toDate.toISOString().split("T")[0] + "T23:59:59+05:30";

  const txns = await fetchAll(
    supabase
      .from("transaction_list").select("id, code, client_name, status, date_updated")
      .gte("date_updated", from).lte("date_updated", to).neq("status", 4)
  );

  const txnIds = [...new Set(txns?.map((t) => t.id) || [])];
  const tpData = txnIds.length ? await fetchAll(
    supabase.from("transaction_products").select("transaction_id, product_id, product_name, price, qty").in("transaction_id", txnIds)
  ) : [];

  const clients = await fetchAll(
    supabase.from("client_list").select("id, firstname, middlename, lastname").eq("delete_flag", 0)
  );

  const products = await fetchAll(
    supabase.from("product_list").select("id, name").eq("delete_flag", 0)
  );

  const saleRows: { date_updated: string; code: string | null; client_name: string; product_name: string; price: number; qty: number; total: number }[] = [];
  for (const tp of tpData || []) {
    const txn = (txns || []).find((t) => t.id === tp.transaction_id);
    if (!txn) continue;
    const client = (clients || []).find((c) => c.id === txn.client_name);
    const product = (products || []).find((p) => p.id === tp.product_id);
    saleRows.push({
      date_updated: txn.date_updated,
      code: txn.code,
      client_name: client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : "Walk-in",
      product_name: product?.name || tp.product_name || "Unknown",
      price: tp.price || 0,
      qty: tp.qty || 1,
      total: (tp.price || 0) * (tp.qty || 1),
    });
  }
  saleRows.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

  if (!saleRows.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi sales record nahi mila</h2>
        <p style="color:#666">Selected month mein koi record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const total = saleRows.reduce((s, r) => s + r.total, 0);
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const rows = saleRows.map((r, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:11px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:11px">${fmtDate(r.date_updated)}</td>
      <td style="padding:8px;border:1px solid #dee2e6">
        <div style="font-weight:600;font-size:11px;color:#001f3f">${r.code || "—"}</div>
        <div style="font-size:10px;color:#666">${r.client_name}</div>
      </td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:11px">${r.product_name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${inr(r.price)}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:11px">${r.qty}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-weight:700;color:#27ae60;font-size:11px">${inr(r.total)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Monthly Sales Report — ${monthLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:900px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .stats{display:flex;gap:12px;padding:14px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6}
    .stat{background:#fff;border:1px solid #dee2e6;border-radius:4px;padding:10px 16px;text-align:center;flex:1}
    .stat-num{font-size:22px;font-weight:900;color:#001f3f}
    .stat-label{font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
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
      <h1>🛒 ${SHOP.name} — Monthly Sales Report</h1>
      <p>Month: ${monthLabel} | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${saleRows.length}</div>
        <div class="stat-label">Total Entries</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#27ae60">${inr(total)}</div>
        <div class="stat-label">Total Sales</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:12%">Date</th>
          <th style="width:22%">Code / Client</th>
          <th style="width:25%">Product</th>
          <th style="width:12%">Price</th>
          <th style="width:8%">Qty</th>
          <th style="width:16%">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#e8f5e9;font-weight:700">
          <td colspan="5" style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total Monthly Sales (${saleRows.length} records):</td>
          <td style="padding:10px 8px;border:1px solid #dee2e6"></td>
          <td style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#27ae60">${inr(total)}</td>
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