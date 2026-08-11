import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  0: { label: "Pending", color: "#f59e0b", bg: "#fff7ed", desc: "Work not started yet" },
  1: { label: "On-Progress", color: "#667eea", bg: "#eef2ff", desc: "Work in progress" },
  2: { label: "Done", color: "#3b82f6", bg: "#eff6ff", desc: "Work completed" },
  3: { label: "Paid", color: "#10b981", bg: "#ecfdf5", desc: "Payment received" },
  4: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2", desc: "Transaction cancelled" },
  5: { label: "Delivered", color: "#059669", bg: "#ecfdf5", desc: "Item delivered to customer" },
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id");
  const code = url.searchParams.get("code");

  if (!jobId && !code) {
    return NextResponse.json({ error: "job_id or code required" }, { status: 400 });
  }

  let query = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, fault, remark, status, amount, date_created")
    .limit(1);

  if (jobId) query = query.eq("job_id", jobId);
  else query = query.eq("code", code);

  const { data: txnData, error: txnErr } = await query;

  if (txnErr || !txnData || txnData.length === 0) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Job not found</h2>
        <p style="color:#666">The requested job ID or code was not found.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const txn = txnData[0];
  const statusInfo = STATUS_CONFIG[txn.status] || { label: "Unknown", color: "#6b7280", bg: "#f3f4f6", desc: "Status unknown" };

  const { data: svcData } = await supabase
    .from("transaction_services")
    .select("service_id, price")
    .eq("transaction_id", txn.id);

  const serviceIds = (svcData || []).map((s) => s.service_id).filter(Boolean);
  const serviceNames: Record<number, string> = {};
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from("service_list").select("id, name").in("id", serviceIds);
    if (services) services.forEach((s) => { serviceNames[s.id] = s.name; });
  }

  const services = (svcData || []).map((s) => ({
    service_name: serviceNames[s.service_id] || "Unknown",
    price: s.price,
  }));

  const { data: prodData } = await supabase
    .from("transaction_products")
    .select("product_id, qty, price")
    .eq("transaction_id", txn.id);

  const productIds = (prodData || []).map((p) => p.product_id).filter(Boolean);
  const productNames: Record<number, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase.from("product_list").select("id, name").in("id", productIds);
    if (products) products.forEach((p) => { productNames[p.id] = p.name; });
  }

  const products = (prodData || []).map((p) => ({
    product_name: productNames[p.product_id] || "Unknown",
    qty: p.qty,
    price: p.price,
    total: p.qty * p.price,
  }));

  const totalServices = services.reduce((s, sv) => s + sv.price, 0);
  const totalProducts = products.reduce((s, p) => s + p.total, 0);
  const total = totalServices + totalProducts;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Job Status — ${txn.job_id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:800px;margin:0 auto}
    .card{background:#fff;border-radius:6px;box-shadow:0 1px 8px rgba(0,0,0,.1);margin-bottom:16px;overflow:hidden}
    .hdr{background:#001f3f;color:#fff;padding:16px 20px}
    .hdr h1{font-size:18px;font-weight:900;margin-bottom:2px}
    .hdr p{font-size:12px;opacity:.7}
    .job-info{padding:16px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6}
    .job-row{display:flex;justify-content:space-between;padding:6px 0}
    .job-label{font-size:12px;color:#666}
    .job-value{font-size:13px;font-weight:600;color:#001f3f}
    .status-badge{display:inline-block;padding:6px 14px;border-radius:20px;font-weight:700;font-size:12px;margin-top:10px}
    .card-title{padding:12px 20px;background:#f8f9fa;border-bottom:1px solid #dee2e6;font-size:12px;font-weight:700;text-transform:uppercase;color:#666}
    .card-body{padding:12px 20px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{padding:8px;text-align:left;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:1px solid #dee2e6}
    td{padding:8px;border-bottom:1px solid #eee;font-size:12px}
    .total-row{background:#f0f4ff;font-weight:700}
    .grand-total{padding:16px 20px;background:#001f3f;color:#fff;font-size:16px;font-weight:700;text-align:right}
    .actions{text-align:center;padding:16px;background:#f8f9fa;border-top:1px solid #dee2e6}
    .btn{padding:10px 22px;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:700;margin:4px}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .footer{text-align:center;color:#666;font-size:11px;padding:10px}
    @media print{
      body{background:#fff;padding:0}
      .actions{display:none!important}
    }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <h1>📋 ${SHOP.name} — Job Status</h1>
      <p>Generated: ${fmtDateTime(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="job-info">
      <div class="job-row"><span class="job-label">Job ID</span><span class="job-value">#${txn.job_id}</span></div>
      ${txn.code ? `<div class="job-row"><span class="job-label">Code</span><span class="job-value">${txn.code}</span></div>` : ""}
      <div class="job-row"><span class="job-label">Item</span><span class="job-value">${txn.item || "—"}</span></div>
      <div class="job-row"><span class="job-label">Fault</span><span class="job-value">${txn.fault || "—"}</span></div>
      <div class="job-row"><span class="job-label">Created</span><span class="job-value">${fmtDate(txn.date_created)}</span></div>
      <div><span class="job-label">Status</span><br><span class="status-badge" style="background:${statusInfo.bg};color:${statusInfo.color};border:2px solid ${statusInfo.color}">${statusInfo.label}</span></div>
    </div>
    ${services.length > 0 ? `
    <div class="card-title">Services (${services.length})</div>
    <table>
      <thead><tr><th>#</th><th>Service</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${services.map((s, i) => `<tr><td>${i+1}</td><td>${s.service_name}</td><td style="text-align:right">${inr(s.price)}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="2" style="text-align:right">Total:</td><td style="text-align:right">${inr(totalServices)}</td></tr>
      </tbody>
    </table>` : ""}
    ${products.length > 0 ? `
    <div class="card-title">Products (${products.length})</div>
    <table>
      <thead><tr><th>#</th><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${products.map((p, i) => `<tr><td>${i+1}</td><td>${p.product_name}</td><td style="text-align:center">${p.qty}</td><td style="text-align:right">${inr(p.price)}</td><td style="text-align:right">${inr(p.total)}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="4" style="text-align:right">Total:</td><td style="text-align:right">${inr(totalProducts)}</td></tr>
      </tbody>
    </table>` : ""}
    <div class="grand-total">Grand Total: ${inr(total)}</div>
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