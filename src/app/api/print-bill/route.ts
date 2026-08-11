import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

// ─── Supabase (server-side) ──────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DbRow = ReturnType<typeof JSON.parse>;

// ─── Helper: fetch system info ────────────────────────────────────────────────
async function fetchShopInfo() {
  const { data } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  (data || []).forEach(r => { info[r.meta_field] = r.meta_value; });
  return {
    name:    info.name        || "V-Technologies",
    tagline: "Power Supply & Stage Light Repair Solutions",
    address: info.address     || "F4, Hotel Plaza, Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
    mobile:  info.contact     || "9179105875",
    email:   info.email       || "vtech.jbp@gmail.com",
    gstin:   info.gst_no      || info.gstin || "",
    upiId:   info.upi_id      || "",
    signature: info.signature || "",
    logo:    info.logo        || "",
  };
}

const CGST_RATE = 9;
const SGST_RATE = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}
function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

// ─── Number to Words (Indian system) ─────────────────────────────────────────
function numberToWords(num: number): string {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function helper(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "") + " ";
    return ones[Math.floor(n/100)] + " Hundred " + helper(n%100);
  }
  if (num === 0) return "Zero Rupees Only";
  let w = "";
  const cr = Math.floor(num / 10000000); num %= 10000000;
  const lk = Math.floor(num / 100000);   num %= 100000;
  const th = Math.floor(num / 1000);     num %= 1000;
  if (cr) w += helper(cr) + "Crore ";
  if (lk) w += helper(lk) + "Lakh ";
  if (th) w += helper(th) + "Thousand ";
  w += helper(num);
  return w.trim() + " Rupees Only";
}

// ─── STATUS MAP ───────────────────────────────────────────────────────────────
const STATUS: Record<number, string> = {
  0: "Pending", 1: "In Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered",
};

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url      = new URL(req.url);
  const jobIdStr = url.searchParams.get("job_id");
  const billType = url.searchParams.get("bill_type") || "non_gst"; // non_gst default

  // ── Fetch dynamic shop info ──────────────────────────────────────────────
  const SHOP = await fetchShopInfo();

  if (!jobIdStr) {
    return new NextResponse("job_id parameter required", { status: 400 });
  }

  // ── Fetch transaction ──────────────────────────────────────────────────────
  let txnRaw: DbRow | null = null;

  const r1 = await supabase.from("transaction_list").select("*").eq("job_id", jobIdStr).single();
  if (r1.data) txnRaw = r1.data;

  if (!txnRaw) {
    const num = parseInt(jobIdStr, 10);
    if (!isNaN(num)) {
      const r2 = await supabase.from("transaction_list").select("*").eq("job_id", num).single();
      if (r2.data) txnRaw = r2.data;

      if (!txnRaw) {
        const r3 = await supabase.from("transaction_list").select("*").eq("id", num).single();
        if (r3.data) txnRaw = r3.data;
      }
    }
  }

  if (!txnRaw) {
    return new NextResponse(`Job ID ${jobIdStr} not found`, { status: 404 });
  }
  const txn: DbRow = txnRaw;

  // ── Fetch client ───────────────────────────────────────────────────────────
  const { data: client } = await supabase
    .from("client_list")
    .select("firstname, middlename, lastname, contact, email, address")
    .eq("id", parseInt(txn.client_name))
    .single();

  // ── Fetch products ─────────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from("transaction_products")
    .select("product_id, product_name, qty, price")
    .eq("transaction_id", txn.id);

  // ── Fetch services ─────────────────────────────────────────────────────────
  const { data: services } = await supabase
    .from("transaction_services")
    .select("service_id, service_name, price")
    .eq("transaction_id", txn.id);

  // ── Fetch HSN/SAC for line items ───────────────────────────────────────────
  const prodIds = [...new Set((products || []).map(p => p.product_id).filter(Boolean))];
  const svcIds  = [...new Set((services || []).map(s => s.service_id).filter(Boolean))];
  const [{ data: prodRows }, { data: svcRows }] = await Promise.all([
    prodIds.length ? supabase.from("product_list").select("id, hsn").in("id", prodIds) : Promise.resolve({ data: [] }),
    svcIds.length  ? supabase.from("service_list").select("id, hsn").in("id", svcIds)  : Promise.resolve({ data: [] }),
  ]);
  const hsnMap = { ...Object.fromEntries((prodRows || []).map(p => [p.id, p.hsn])), ...Object.fromEntries((svcRows || []).map(s => [s.id, s.hsn])) };

  // ── Build line items ───────────────────────────────────────────────────────
  interface LineItem { desc: string; qty: number; rate: number; total: number; hsn: string; }
  const items: LineItem[] = [];

  (products || []).forEach(p => {
    items.push({ desc: `${p.product_name || "Part"} (Part)`, qty: p.qty ?? 1, rate: p.price ?? 0, total: (p.qty ?? 1) * (p.price ?? 0), hsn: hsnMap[p.product_id] || "" });
  });
  (services || []).forEach(s => {
    items.push({ desc: `${s.service_name || "Repair Service"} (Service)`, qty: 1, rate: s.price ?? 0, total: s.price ?? 0, hsn: hsnMap[s.service_id] || "" });
  });

  // ── Billing calculations ───────────────────────────────────────────────────
  const subtotal   = items.reduce((s, r) => s + r.total, 0) || txn.amount || 0;
  const isGST      = billType === "gst";
  const cgstAmt    = isGST ? Math.round(subtotal * (CGST_RATE / 100) * 100) / 100 : 0;
  const sgstAmt    = isGST ? Math.round(subtotal * (SGST_RATE / 100) * 100) / 100 : 0;
  const grandTotal = subtotal + cgstAmt + sgstAmt;

  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ").trim()
    : "Walk-in Customer";

  const invoiceTitle = isGST ? "TAX INVOICE" : "ESTIMATE";
  const billTypeText = isGST ? "GST Invoice" : "Retail Invoice";
  const badgeColor   = isGST ? "#dc3545" : "#17a2b8";
  const accentColor  = isGST ? "#dc3545" : "#007bff";

  // ── THERMAL RECEIPT (POS, 58mm) ──────────────────────────────────────────────
  if (url.searchParams.get("type") === "thermal") {
    const thermalRows = items.length > 0
      ? items.map((r, i) => `
        <tr>
          <td>${i + 1}. ${r.desc}${r.qty > 1 ? ` x${r.qty}` : ""}</td>
          <td>${inr(r.total)}</td>
        </tr>`).join("")
      : `<tr><td>Repair service</td><td>${inr(subtotal)}</td></tr>`;

    const thermalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Receipt — Job #${txn.job_id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:58mm;margin:0 auto;font-family:'Courier New',monospace;font-size:11px;color:#000;padding:4mm 2mm;line-height:1.45}
  .ctr{text-align:center}
  .shop{font-size:15px;font-weight:900;text-transform:uppercase}
  .title{font-size:13px;font-weight:900;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:3px 0;margin:6px 0;text-align:center;text-transform:uppercase}
  .row{display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse;margin:4px 0}
  td{border-bottom:1px dotted #aaa;padding:2px 0}
  .tr{text-align:right}
  .tot td{border-top:1px solid #000;border-bottom:1px solid #000;font-weight:900;padding:4px 0}
  .words{margin-top:4px;text-align:center}
  .foot{margin-top:8px;text-align:center}
  .dash{border-top:1px dashed #000;margin:6px 0}
  .btns{margin-top:10px;text-align:center}
  .btn{padding:9px 22px;border:none;border-radius:4px;background:#001f3f;color:#fff;font-size:13px;font-weight:700;cursor:pointer}
  @media print{ body{padding:0} .btns{display:none} @page{size:58mm auto;margin:2mm} }
</style>
</head>
<body>
  <div class="ctr shop">${SHOP.name}</div>
  <div class="ctr">${SHOP.address}</div>
  <div class="ctr">📞 ${SHOP.mobile}${SHOP.gstin ? `  GSTIN: ${SHOP.gstin}` : ""}</div>
  <div class="title">${isGST ? "TAX INVOICE" : "ESTIMATE / RECEIPT"}</div>
  <div class="row"><span>Job #</span><span>${txn.job_id}</span></div>
  <div class="row"><span>Code</span><span>${txn.code || "—"}</span></div>
  <div class="row"><span>Date</span><span>${fmtDate(txn.date_created)}</span></div>
  <div class="row"><span>Time</span><span>${fmtTime(txn.date_created)}</span></div>
  <div class="row"><span>Status</span><span>${STATUS[txn.status] || "—"}</span></div>
  <div class="dash"></div>
  <div class="row"><span>Customer</span><span>${clientName}</span></div>
  <div class="row"><span>Mobile</span><span>${client?.contact || "—"}</span></div>
  <div class="row"><span>Item</span><span>${txn.item || "—"}</span></div>
  <div class="row"><span>Fault</span><span>${txn.fault || "—"}</span></div>
  ${txn.uniq_id ? `<div class="row"><span>Location</span><span>${txn.uniq_id}</span></div>` : ""}
  <div class="dash"></div>
  <table>
    ${thermalRows}
  </table>
  <table class="tot">
    <tr><td>Sub Total</td><td class="tr">${inr(subtotal)}</td></tr>
    ${isGST ? `
    <tr><td>CGST @${CGST_RATE}%</td><td class="tr">${inr(cgstAmt)}</td></tr>
    <tr><td>SGST @${SGST_RATE}%</td><td class="tr">${inr(sgstAmt)}</td></tr>
    <tr><td>GRAND TOTAL</td><td class="tr">${inr(grandTotal)}</td></tr>` : `
    <tr><td>GRAND TOTAL</td><td class="tr">${inr(grandTotal)}</td></tr>`}
  </table>
  <div class="words">${numberToWords(Math.floor(grandTotal))}</div>
  <div class="dash"></div>
  <div class="foot">❤ Thank You for Your Business!<br/>For queries: ${SHOP.mobile}</div>
  <div class="btns">
    <button class="btn" onclick="window.print()">🖨 Print Receipt</button>
  </div>
  <script>setTimeout(()=>window.print(), 300);</script>
</body>
</html>`;
    return new NextResponse(thermalHtml, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── Items rows HTML ────────────────────────────────────────────────────────
  const itemRows = items.length > 0
    ? items.map((r, i) => `
      <tr>
        <td class="tc">${i + 1}</td>
        <td>${r.desc}</td>
        <td class="tc">${r.hsn || "—"}</td>
        <td class="tc">${r.qty}</td>
        <td class="tr">${inr(r.rate)}</td>
        <td class="tr">${inr(r.total)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="tc" style="color:#999;font-style:italic;">
        Repair service — no individual items listed
       </td></tr>`;

  // ── Remarks row ────────────────────────────────────────────────────────────
  const remarkRow = txn.remark?.trim() ? `
    <tr style="background:#fffbeb">
      <td colspan="6" style="padding:8px 10px;font-size:12px;color:#666;border:1px solid #dee2e6;">
        <strong>Remarks:</strong> ${txn.remark}
      </td>
    </tr>` : "";

  // ── GST rows ───────────────────────────────────────────────────────────────
  const gstRows = isGST ? `
    <tr class="gst-row">
      <td class="al" colspan="5">CGST @ ${CGST_RATE}%:</td>
      <td class="ar">${inr(cgstAmt)}</td>
    </tr>
    <tr class="gst-row">
      <td class="al" colspan="5">SGST @ ${SGST_RATE}%:</td>
      <td class="ar">${inr(sgstAmt)}</td>
    </tr>
    <tr class="gst-row" style="font-weight:bold">
      <td class="al" colspan="5">Total GST (${CGST_RATE + SGST_RATE}%):</td>
      <td class="ar">${inr(cgstAmt + sgstAmt)}</td>
    </tr>` : "";

  // ── Fetch UPI ID from system_info ──────────────────────────────────────────
  const { data: upiRow } = await supabase
    .from("system_info")
    .select("meta_value")
    .eq("meta_field", "upi_id")
    .single();
  const upiId = upiRow?.meta_value || SHOP.mobile + "@ybl";

  // ── QR Code helpers ────────────────────────────────────────────────────────
  function qrUrl(data: string, size = 130): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  }
  function upiQrUrl(amount: number): string {
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(SHOP.name)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent("Payment for Job #" + txn.job_id)}`;
    return qrUrl(upiUri, 130);
  }
  const upiQrImg = upiQrUrl(grandTotal);
  const trackingQrImg = qrUrl(`https://vtech-rsms/job-status?job_id=${txn.job_id}`, 130);

  // ── HTML ───────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${billTypeText} — Job #${txn.job_id}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{width:210mm;min-height:297mm;margin:0 auto 20px;background:#fff;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.12)}

    /* Header */
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:14px;margin-bottom:16px}
    .hdr-left{flex:1}
    .hdr-mid{flex:2;text-align:center;padding:0 14px}
    .hdr-right{flex:1;text-align:right}
    .shop-name{font-size:22px;font-weight:900;color:${accentColor};text-transform:uppercase;letter-spacing:1px}
    .shop-tagline{font-size:12px;color:#666;font-style:italic;margin:3px 0 6px}
    .shop-details{font-size:11.5px;color:#555;line-height:1.6}
    .badge{display:inline-block;padding:7px 18px;background:${badgeColor};color:#fff;font-weight:700;font-size:13px;border-radius:4px;text-transform:uppercase}
    .inv-title{font-size:20px;font-weight:900;color:${accentColor};text-align:center;letter-spacing:2px;margin:10px 0 14px;text-transform:uppercase}

    /* Info boxes */
    .info-row{display:flex;gap:14px;margin-bottom:14px}
    .info-box{flex:1;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:12px}
    .info-box-title{font-size:12px;font-weight:700;color:#495057;border-bottom:1px solid ${accentColor};padding-bottom:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
    .ig{display:flex;margin-bottom:5px;font-size:12.5px}
    .il{font-weight:600;color:#495057;min-width:110px;flex-shrink:0}
    .iv{color:#212529}
    .status-badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:11px;font-weight:700;background:#ffc107;color:#212529}

    /* Table */
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
    th{background:#001f3f;color:#fff;padding:9px 8px;font-size:12px}
    td{padding:7px 8px;border:1px solid #dee2e6;vertical-align:top}
    tr:nth-child(even) td{background:#f8f9fa}
    .tc{text-align:center}.tr{text-align:right}.al{text-align:right;font-weight:600;background:#f8f9fa}
    .ar{text-align:right;font-weight:600}

    /* Amount section */
    .amt-table{width:55%;margin-left:auto;border-collapse:collapse;font-size:13px}
    .amt-table td{padding:8px 12px;border:1px solid #dee2e6}
    .gst-row td{background:#e7f1ff}
    .subtotal-row td{background:#f8f9fa;font-weight:600}
    .total-row td{background:#ffc107;font-weight:700;font-size:14px}
    .words-row td{background:#f8f9fa;font-size:12px;padding:10px 12px;border:1px solid #dee2e6}

    /* Terms */
    .terms{margin-top:16px;padding:12px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-size:11.5px}
    .terms strong{font-size:13px}
    .terms ol{margin:6px 0 0 16px}
    .terms li{margin-bottom:3px}

    /* Footer */
    .footer{margin-top:24px;padding-top:16px;border-top:1px dashed #ccc;text-align:center}
    .ty{font-size:15px;font-weight:700;color:#28a745;margin-bottom:8px}
    .sig{margin-top:40px;text-align:right;padding-right:40px;font-size:12.5px}

    /* Action buttons (no-print) */
    .actions{width:210mm;margin:0 auto 20px;background:#fff;border:2px solid #dee2e6;border-radius:8px;padding:20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08)}
    .actions h4{font-size:16px;font-weight:700;margin-bottom:16px;color:#333}
    .btn-group{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-bottom:16px}
    .btn{padding:11px 22px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .25s;min-width:180px;justify-content:center}
    .btn:hover{transform:translateY(-2px);box-shadow:0 6px 14px rgba(0,0,0,.15)}
    .btn-gst{background:#dc3545;color:#fff}
    .btn-non-gst{background:#17a2b8;color:#fff}
    .btn-print{background:#28a745;color:#fff}
    .btn-pdf{background:#007bff;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .active-type{box-shadow:0 0 0 3px rgba(0,0,0,.25)!important;transform:translateY(-2px)}
    .divider{border-top:2px dashed #ccc;margin:16px 0}

    @media print{
      @page{margin:0;size:A4 portrait}
      body{background:#fff;padding:0;font-size:11px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .wrap{width:100%;min-height:auto;margin:0;padding:12mm;box-shadow:none}
      .actions{display:none!important}
      th{background:#001f3f!important;color:#fff!important}
      .gst-row td{background:#e7f1ff!important}
      .total-row td{background:#ffc107!important}
      .subtotal-row td{background:#f8f9fa!important}
      .badge{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    }
    @media screen and (max-width:900px){
      .wrap,.actions{width:100%;max-width:100%}
      .hdr{flex-direction:column;text-align:center;gap:10px}
      .hdr-right{text-align:center}
      .info-row{flex-direction:column}
      .amt-table{width:100%}
    }
  </style>
</head>
<body>

<!-- ═══════════════════════════════ INVOICE ══════════════════════════════════ -->
<div class="wrap">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      ${SHOP.logo
        ? `<img src="${SHOP.logo}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;" />`
        : `<div style="font-size:28px;font-weight:900;color:${accentColor}">V•TECH</div>
           <div style="font-size:10px;font-weight:700;color:#999;letter-spacing:2px">REPAIR SHOP</div>`}
    </div>
    <div class="hdr-mid">
      <div class="shop-name">${SHOP.name}</div>
      <div class="shop-tagline">${SHOP.tagline}</div>
      <div class="shop-details">
        ${SHOP.address}<br>
        📞 ${SHOP.mobile} &nbsp;|&nbsp; ✉ ${SHOP.email}<br>
        ${isGST ? `<strong>GSTIN: ${SHOP.gstin}</strong>` : ""}
      </div>
    </div>
    <div class="hdr-right">
      <div class="badge">${billTypeText}</div>
    </div>
  </div>

  <!-- Invoice Title -->
  <div class="inv-title">${invoiceTitle}</div>

  <!-- Invoice Info + Client Info -->
  <div class="info-row">
    <!-- Invoice Details -->
    <div class="info-box">
      <div class="info-box-title">Invoice Details</div>
      <div class="ig"><span class="il">Invoice No:</span><span class="iv"><strong>#${txn.job_id}</strong></span></div>
      <div class="ig"><span class="il">Code:</span><span class="iv">${txn.code || "—"}</span></div>
      <div class="ig"><span class="il">Date:</span><span class="iv">${fmtDate(txn.date_created)}</span></div>
      <div class="ig"><span class="il">Time:</span><span class="iv">${fmtTime(txn.date_created)}</span></div>
      <div class="ig"><span class="il">Status:</span><span class="iv"><span class="status-badge">${STATUS[txn.status] || "—"}</span></span></div>
      ${txn.uniq_id ? `<div class="ig"><span class="il">Location:</span><span class="iv">${txn.uniq_id}</span></div>` : ""}
    </div>
    <!-- Customer Details -->
    <div class="info-box">
      <div class="info-box-title">Customer Details</div>
      <div class="ig"><span class="il">Name:</span><span class="iv"><strong>${clientName}</strong></span></div>
      <div class="ig"><span class="il">Mobile:</span><span class="iv">${client?.contact || "—"}</span></div>
      <div class="ig"><span class="il">Email:</span><span class="iv">${client?.email || "—"}</span></div>
      <div class="ig" style="align-items:flex-start"><span class="il">Address:</span><span class="iv">${client?.address || "—"}</span></div>
    </div>
  </div>

  <!-- Item Details -->
  <div class="info-box" style="margin-bottom:14px">
    <div class="info-box-title">Item Description</div>
    <div class="ig"><span class="il">Item/Model:</span><span class="iv"><strong>${txn.item || "—"}</strong></span></div>
    <div class="ig"><span class="il">Fault:</span><span class="iv" style="color:#c0392b">${txn.fault || "—"}</span></div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th width="5%" class="tc">#</th>
        <th>Description</th>
        <th width="12%" class="tc">HSN/SAC</th>
        <th width="8%" class="tc">Qty</th>
        <th width="16%" class="tr">Rate (₹)</th>
        <th width="16%" class="tr">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${remarkRow}
    </tbody>
  </table>

  <!-- Amount Summary -->
  <table class="amt-table">
    <tr class="subtotal-row">
      <td style="text-align:right;font-weight:600">Sub Total:</td>
      <td style="text-align:right;font-weight:600">${inr(subtotal)}</td>
    </tr>
    ${gstRows}
    <tr class="total-row">
      <td style="text-align:right;font-weight:700">Grand Total:</td>
      <td style="text-align:right;font-weight:700">${inr(grandTotal)}</td>
    </tr>
    <tr class="words-row">
      <td colspan="2">
        <strong>Amount in Words:</strong> ${numberToWords(Math.floor(grandTotal))}
      </td>
    </tr>
  </table>

  <!-- Terms & Conditions -->
  <div class="terms">
    <strong>Terms &amp; Conditions:</strong>
    <ol>
      <li>Goods once repaired/sold will not be taken back or exchanged without valid reason.</li>
      <li>All disputes are subject to Jabalpur Jurisdiction only.</li>
      <li>Warranty as per manufacturer's terms and conditions.</li>
      <li>Please check all items at the time of delivery.</li>
      <li>Keep this invoice for warranty claim.</li>
      <li>E. &amp; O.E.</li>
    </ol>
  </div>

  <!-- QR Section -->
  <div style="display:flex;justify-content:center;gap:24px;margin:20px 0;padding:16px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;">
    <div id="trackQrBox" style="display:none;text-align:center;">
      <img src="${trackingQrImg}" alt="Track QR" width="120" height="120" style="border:1px solid #ddd;border-radius:4px;" />
      <div style="font-size:11px;color:#666;margin-top:6px;font-weight:600;">Scan to Track Job</div>
    </div>
    <div style="text-align:center;">
      <img src="${upiQrImg}" alt="UPI QR Code" width="120" height="120" style="border:1px solid #ddd;border-radius:4px;" />
      <div style="font-size:11px;color:#1a7a3a;margin-top:6px;font-weight:700;">Scan to Pay UPI</div>
      <div style="font-size:10px;color:#999;">${upiId}</div>
    </div>
  </div>
  <div style="text-align:center;margin-bottom:10px;">
    <button onclick="toggleTrackQR()" style="font-size:11px;padding:4px 12px;border:1px solid #ccc;border-radius:3px;cursor:pointer;background:#fff;color:#666;">👁 Toggle Track QR</button>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="ty">❤ Thank You for Your Business!</div>
    <div style="color:#666;font-size:12.5px">
      For any queries: 📞 ${SHOP.mobile} &nbsp;|&nbsp; ✉ ${SHOP.email}
    </div>
    <div class="sig">
      ${SHOP.signature
        ? `<img src="${SHOP.signature}" alt="Signature" style="max-height:50px;max-width:200px;object-fit:contain;"><br>`
        : `<div style="border-top:1px solid #333;width:220px;display:inline-block;padding-top:8px">`
      }
        For ${SHOP.name}<br><strong>Authorized Signature</strong>
      ${SHOP.signature ? "" : "</div>"}
    </div>
  </div>
</div>

<!-- ═══════════════════════════════ ACTIONS ══════════════════════════════════ -->
<div class="actions">
  <h4>Select Bill Type</h4>
  <div class="btn-group">
    <a href="?job_id=${txn.job_id}&bill_type=gst"
       class="btn btn-gst ${isGST ? "active-type" : ""}">
      🧾 GST Invoice (with Tax)
    </a>
    <a href="?job_id=${txn.job_id}&bill_type=non_gst"
       class="btn btn-non-gst ${!isGST ? "active-type" : ""}">
      🏪 Retail Invoice (No Tax)
    </a>
  </div>
  <div class="divider"></div>
  <div class="btn-group">
    <button onclick="window.print()" class="btn btn-print">🖨 Print Invoice</button>
    <button onclick="savePDF()" class="btn btn-pdf">📥 Save as PDF</button>
    <button onclick="window.close()" class="btn btn-close">✕ Close</button>
  </div>
  <div style="margin-top:12px;font-size:11px;color:#999">
    Shortcut keys: <strong>Ctrl+P</strong> = Print &nbsp;|&nbsp; <strong>Ctrl+S</strong> = PDF &nbsp;|&nbsp; <strong>Esc</strong> = Close
  </div>
</div>

<script>
function toggleTrackQR(){
  var el=document.getElementById('trackQrBox');
  el.style.display=el.style.display==='none'?'block':'none';
}
function savePDF(){
  window.print();
  setTimeout(()=>alert("PDF save karne ke liye:\\n1. Print dialog mein 'Save as PDF' select karo\\n2. Paper: A4\\n3. Margins: Default\\n4. Background graphics: ON"),200);
}
document.addEventListener("keydown",e=>{
  if(e.ctrlKey && e.key==="p"){e.preventDefault();window.print();}
  if(e.ctrlKey && e.key==="s"){e.preventDefault();savePDF();}
  if(e.key==="Escape") window.close();
});
</script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}