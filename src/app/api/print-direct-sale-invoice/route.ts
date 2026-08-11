import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Helper: fetch system info (dynamic firm details) ────────────────────────
async function fetchShopInfo() {
  const { data } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  (data || []).forEach(r => { info[r.meta_field] = r.meta_value; });
  return {
    name:    info.name        || "V-Technologies",
    address: info.address     || "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
    mobile:  info.contact     || "9179105875",
    email:   info.email       || "",
    gstin:   info.gst_no      || info.gstin || "",
    upiId:   info.upi_id      || "",
    logo:    info.logo        || "",
  };
}

const CGST_RATE = 9;
const SGST_RATE = 9;

function fmtIST(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function inr(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function numberToWords(num: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];
  
  if (num === 0) return "Zero";
  
  let result = "";
  let scaleIndex = 0;
  let numStr = Math.floor(num).toString();
  
  while (numStr.length > 0) {
    const chunk = parseInt(numStr.slice(-3));
    const numStrLen = numStr.length;
    
    if (chunk < 20) {
      result = ones[chunk] + (scaleIndex > 0 ? " " + scales[scaleIndex] : "") + (result ? " " + result : "");
    } else {
      const ten = Math.floor(chunk / 10);
      const one = chunk % 10;
      result = tens[ten] + (one > 0 ? " " + ones[one] : "") + (scaleIndex > 0 ? " " + scales[scaleIndex] : "") + (result ? " " + result : "");
    }
    
    if (numStrLen > 3) {
      scaleIndex++;
      numStr = numStr.slice(0, -3);
    } else {
      break;
    }
  }
  
  return result;
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url = new URL(request.url);
  const saleId = url.searchParams.get("id");
  const billType = url.searchParams.get("bill_type") || "non_gst";

  if (!saleId) {
    return NextResponse.json({ error: "Missing sale id" }, { status: 400 });
  }

  const SHOP = await fetchShopInfo();

  const { data: sale, error } = await supabase
    .from("direct_sales")
    .select("*")
    .eq("id", parseInt(saleId))
    .single();

  if (error || !sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const [{ data: items }, { data: client }, { data: staff }] = await Promise.all([
    supabase.from("direct_sale_items").select("product_id, product_name, qty, price").eq("sale_id", sale.id),
    sale.client_id ? supabase.from("client_list").select("contact, address, firstname, middlename, lastname").eq("id", sale.client_id).single() : Promise.resolve({ data: null }),
    sale.created_by ? supabase.from("mechanic_list").select("firstname, lastname").eq("id", sale.created_by).single() : Promise.resolve({ data: null }),
  ]);

  // ── Fetch HSN/SAC codes for sold products ──────────────────────────────────
  const prodIds = [...new Set((items || []).map((it) => it.product_id).filter(Boolean))];
  const { data: prodRows } = prodIds.length
    ? await supabase.from("product_list").select("id, hsn").in("id", prodIds)
    : { data: [] };
  const hsnMap: Record<number, string> = Object.fromEntries((prodRows || []).map(p => [p.id, p.hsn]));

  const clientName = client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : (sale.client_id ? "Unknown" : "Walk-in Customer");
  const clientContact = client?.contact || null;
  const clientAddress = client?.address || null;
  const staffName = staff ? `${staff.firstname} ${staff.lastname}`.trim() : "Unknown";

  const saleItems = (items || []).map((it) => ({
    product_name: it.product_name,
    hsn: hsnMap[it.product_id] || "—",
    qty: it.qty,
    price: it.price,
    total: it.qty * it.price,
  }));

  const isGST     = billType === "gst";
  const accentColor = isGST ? "#dc3545" : "#001f3f";
  const subtotal  = saleItems.reduce((s, i) => s + i.total, 0);
  const cgstAmt   = isGST ? Math.round(subtotal * (CGST_RATE / 100) * 100) / 100 : 0;
  const sgstAmt   = isGST ? Math.round(subtotal * (SGST_RATE / 100) * 100) / 100 : 0;
  const grandTotal = isGST ? subtotal + cgstAmt + sgstAmt : sale.total_amount;

  // ── Fetch UPI ID from system_info ──────────────────────────────────────────
  const upiId = SHOP.upiId || SHOP.mobile + "@ybl";

  function qrUrl(data: string, size = 130): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  }
  function upiQrUrl(amount: number): string {
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(SHOP.name)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent("Payment for " + sale.sale_code)}`;
    return qrUrl(upiUri, 130);
  }
  const upiQrImg = upiQrUrl(grandTotal);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${sale.sale_code}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto;color:#1a1a1a}
    .hdr{text-align:center;border-bottom:3px solid ${accentColor};padding-bottom:16px;margin-bottom:20px}
    .co-name{font-size:26px;font-weight:900;color:${accentColor};margin:0 0 4px}
    .co-meta{font-size:12px;color:#666}
    .badge{display:inline-block;padding:4px 14px;border-radius:4px;color:#fff;font-size:11px;font-weight:700}
    .badge-gst{background:#dc3545}
    .badge-retail{background:#17a2b8}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
    .box h3{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 8px}
    .box p{font-size:12px;margin:2px 0;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead{background:#001f3f;color:#fff}
    th{padding:10px 12px;text-align:left}
    th:nth-child(3),th:nth-child(4){text-align:center}
    th:nth-child(5),th:nth-child(6){text-align:right}
    td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
    td:nth-child(3),td:nth-child(4){text-align:center}
    td:nth-child(5),td:nth-child(6){text-align:right}
    .total-box{display:flex;justify-content:flex-end;margin-top:16px}
    .total-inner{width:220px;border-top:2px solid #001f3f;padding-top:8px}
    .total-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
    .grand{font-weight:900;font-size:18px;color:#001f3f}
    .words{font-size:11px;color:#64748b;margin-top:6px;font-style:italic}
    .remarks{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px;margin-top:16px;font-size:12px}
    .footer{text-align:center;margin-top:30px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
    .badge{display:inline-block;background:#dcfce7;color:#16a34a;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .actions{position:fixed;bottom:20px;right:20px;display:flex;gap:10px}
    .btn{padding:10px 20px;border:none;border-radius:6px;font-weight:600;cursor:pointer}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .type-bar{position:fixed;bottom:20px;left:20px;display:flex;gap:8px;background:#fff;padding:8px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.15);border:1px solid #e2e8f0}
    .type-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;text-decoration:none}
    .type-gst{background:#dc3545;color:#fff}
    .type-retail{background:#17a2b8;color:#fff}
    .type-btn.inactive{background:#f1f5f9;color:#64748b}
    @media print{.actions,.type-bar{display:none!important}}
  </style>
</head>
<body>
  <div class="hdr">
    ${SHOP.logo ? `<img src="${SHOP.logo}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:6px;" />` : ""}
    <div class="co-name">${SHOP.name}</div>
    <div class="co-meta">${SHOP.address} | 📞 ${SHOP.mobile}${SHOP.email ? ` | ✉ ${SHOP.email}` : ""}</div>
    ${isGST ? `<div class="co-meta" style="margin-top:4px"><strong>GSTIN: ${SHOP.gstin || "—"}</strong></div>` : ""}
    <div style="margin-top:8px;font-size:13px;color:#475569;display:flex;justify-content:center;align-items:center;gap:10px">
      <span>DIRECT SALE INVOICE</span>
      <span class="badge ${isGST ? "badge-gst" : "badge-retail"}">${isGST ? "GST TAX INVOICE" : "RETAIL INVOICE"}</span>
    </div>
  </div>
  
  <div class="grid">
    <div class="box"><h3>Bill To</h3>
      <p><b>${clientName}</b></p>
      ${clientContact ? `<p>📞 ${clientContact}</p>` : ""}
      ${clientAddress ? `<p>📍 ${clientAddress}</p>` : ""}
    </div>
    <div class="box"><h3>Invoice Details</h3>
      <p><b>Invoice No:</b> ${sale.sale_code}</p>
      <p><b>Date:</b> ${fmtIST(sale.date_created)}</p>
      <p><b>Staff:</b> ${staffName}</p>
      <p><b>Payment:</b> <span class="badge">${sale.payment_mode}</span></p>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product</th>
        <th>HSN/SAC</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${saleItems.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.product_name}</td>
        <td>${it.hsn}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${inr(it.price)}</td>
        <td style="text-align:right">${inr(it.total)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  
  <div class="total-box">
    <div class="total-inner">
      <div class="total-row"><span>Subtotal</span><span>${inr(subtotal)}</span></div>
      ${isGST ? `
      <div class="total-row"><span>CGST @ ${CGST_RATE}%</span><span>${inr(cgstAmt)}</span></div>
      <div class="total-row"><span>SGST @ ${SGST_RATE}%</span><span>${inr(sgstAmt)}</span></div>` : ""}
      <div class="total-row grand"><span>Grand Total</span><span>${inr(grandTotal)}</span></div>
      <div class="words">${numberToWords(grandTotal)} Rupees Only</div>
    </div>
  </div>
  
  ${sale.remarks ? `<div class="remarks"><b>Remarks:</b> ${sale.remarks}</div>` : ""}
  
  <div style="display:flex;justify-content:center;gap:24px;margin:20px 0;padding:16px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;">
    <div style="text-align:center;">
      <img src="${upiQrImg}" alt="UPI QR Code" width="120" height="120" style="border:1px solid #ddd;border-radius:4px;" />
      <div style="font-size:11px;color:#1a7a3a;margin-top:6px;font-weight:700;">Scan to Pay UPI</div>
      <div style="font-size:10px;color:#999;">${upiId}</div>
    </div>
  </div>
  
  <div class="footer">Goods sold are not returnable. Thank you for your business! — ${SHOP.name}</div>
  
  <div class="type-bar">
    <a href="?id=${sale.id}&bill_type=gst" class="type-btn ${isGST ? "type-gst" : "inactive"}">🧾 GST Invoice</a>
    <a href="?id=${sale.id}&bill_type=non_gst" class="type-btn ${!isGST ? "type-retail" : "inactive"}">🏪 Retail Invoice</a>
  </div>
  <div class="actions">
    <button class="btn btn-close" onclick="window.close()">Close</button>
    <button class="btn btn-print" onclick="window.print()">🖨 Print</button>
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