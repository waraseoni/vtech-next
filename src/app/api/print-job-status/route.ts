import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; desc: string }> = {
  0: { label: "Pending", color: "#f59e0b", bg: "#fff7ed", desc: "Work not started yet" },
  1: { label: "On-Progress", color: "#667eea", bg: "#eef2ff", desc: "Work in progress" },
  2: { label: "Done", color: "#3b82f6", bg: "#eff6ff", desc: "Work completed" },
  3: { label: "Paid", color: "#10b981", bg: "#ecfdf5", desc: "Payment received" },
  4: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2", desc: "Transaction cancelled" },
  5: { label: "Delivered", color: "#059669", bg: "#ecfdf5", desc: "Item delivered to customer" },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const code = searchParams.get("code");

  if (!jobId && !code) {
    return NextResponse.json({ error: "job_id or code required" }, { status: 400 });
  }

  let query = supabase
    .from("transaction_list")
    .select("id, job_id, code, item, fault, remark, status, amount, client_name, date_created")
    .limit(1);

  if (jobId) {
    query = query.eq("job_id", jobId);
  } else {
    query = query.eq("code", code);
  }

  const { data: txnData, error: txnErr } = await query;

  if (txnErr || !txnData || txnData.length === 0) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const txn = txnData[0];

  const { data: svcData } = await supabase
    .from("transaction_services")
    .select("service_id, price")
    .eq("transaction_id", txn.id);

  const serviceIds = (svcData || []).map((s: any) => s.service_id).filter(Boolean);
  let serviceNames: Record<number, string> = {};
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from("service_list").select("id, name").in("id", serviceIds);
    if (services) services.forEach((s: any) => { serviceNames[s.id] = s.name; });
  }

  const services = (svcData || []).map((s: any) => ({
    service_name: serviceNames[s.service_id] || "Unknown",
    price: s.price,
  }));

  const { data: prodData } = await supabase
    .from("transaction_products")
    .select("product_id, qty, price")
    .eq("transaction_id", txn.id);

  const productIds = (prodData || []).map((p: any) => p.product_id).filter(Boolean);
  let productNames: Record<number, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase.from("product_list").select("id, name").in("id", productIds);
    if (products) products.forEach((p: any) => { productNames[p.id] = p.name; });
  }

  const products = (prodData || []).map((p: any) => ({
    product_name: productNames[p.product_id] || "Unknown",
    qty: p.qty,
    price: p.price,
    total: p.qty * p.price,
  }));

  const totalServices = services.reduce((s, sv) => s + sv.price, 0);
  const totalProducts = products.reduce((s, p) => s + p.total, 0);
  const total = totalServices + totalProducts;

  const statusInfo = STATUS_CONFIG[txn.status] || { label: "Unknown", color: "#6b7280", bg: "#f3f4f6", desc: "Status unknown" };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Job Status - ${txn.job_id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .job-id { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-top: 10px; }
    .status-badge { display: inline-block; padding: 8px 20px; border-radius: 50px; font-weight: 700; margin-top: 15px; border: 2px solid ${statusInfo.color}; background: ${statusInfo.bg}; color: ${statusInfo.color}; }
    .card { background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb; }
    .card-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 15px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { margin-bottom: 10px; }
    .info-label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; }
    .info-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    .total-row td { border-top: 2px solid #ddd; background: #f8f9fa; font-weight: 700; }
    .grand-total { font-size: 18px; font-weight: 900; color: #1a1a2e; margin-top: 20px; text-align: right; }
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
    <h1>Job Status Report</h1>
    <div class="subtitle">Generated: ${formatDate(new Date().toISOString())}</div>
    <div class="job-id">Job #${txn.job_id} ${txn.code ? `| Code: ${txn.code}` : ""}</div>
    <div class="status-badge">${statusInfo.label}</div>
  </div>

  <div class="card">
    <div class="card-title">Job Details</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Item</div>
        <div class="info-value">${txn.item || "-"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Fault/Issue</div>
        <div class="info-value">${txn.fault || "-"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Remark</div>
        <div class="info-value">${txn.remark || "-"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Customer Name</div>
        <div class="info-value">${txn.client_name || "-"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Created Date</div>
        <div class="info-value">${formatDate(txn.date_created)}</div>
      </div>
    </div>
  </div>

  ${services.length > 0 ? `
  <div class="card">
    <div class="card-title">Services</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Service Name</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${services.map((s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.service_name}</td>
          <td style="text-align:right">${inr(s.price)}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td colspan="2" style="text-align:right">Total Services:</td>
          <td style="text-align:right">${inr(totalServices)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ""}

  ${products.length > 0 ? `
  <div class="card">
    <div class="card-title">Products Used</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Product Name</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${products.map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.product_name}</td>
          <td style="text-align:center">${p.qty}</td>
          <td style="text-align:right">${inr(p.price)}</td>
          <td style="text-align:right">${inr(p.total)}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td colspan="4" style="text-align:right">Total Products:</td>
          <td style="text-align:right">${inr(totalProducts)}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ""}

  <div class="grand-total">Grand Total: ${inr(total)}</div>

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