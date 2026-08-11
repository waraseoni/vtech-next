import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

// ─── Supabase (server-side) ──────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

function inr(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

const STATUS: Record<number, string> = {
  0: "Pending", 1: "In Progress", 2: "Done", 3: "Paid", 4: "Cancelled", 5: "Delivered",
};

const STATUS_COLOR: Record<number, string> = {
  0: "#94a3b8", 1: "#f59e0b", 2: "#06b6d4", 3: "#10b981", 4: "#ef4444", 5: "#3b82f6",
};

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const url      = new URL(req.url);
  const idsParam = url.searchParams.get("ids") || "";
  const billType = url.searchParams.get("bill_type") || "non_gst";

  // Validate IDs
  const jobIds = idsParam.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  if (jobIds.length === 0) {
    return new NextResponse("Koi valid job IDs nahi diye gaye", { status: 400 });
  }

  // ── Fetch dynamic shop info ──────────────────────────────────────────────
  const SHOP = await fetchShopInfo();

  // ── Fetch transactions ─────────────────────────────────────────────────────
  const { data: txns, error: txnErr } = await supabase
    .from("transaction_list")
    .select("*")
    .in("id", jobIds)
    .eq("del_status", 0)
    .order("date_created", { ascending: true });

  if (txnErr || !txns?.length) {
    return new NextResponse("Jobs nahi mile. IDs check karo.", { status: 404 });
  }

  // ── Fetch client (all jobs should be for same client) ──────────────────────
  const clientId = parseInt(txns[0].client_name);
  const { data: client } = await supabase
    .from("client_list")
    .select("firstname, middlename, lastname, contact, email, address")
    .eq("id", clientId)
    .single();

  // ── Fetch products and services for ALL selected transactions ─────────────
  const [{ data: allProducts }, { data: allServices }] = await Promise.all([
    supabase
      .from("transaction_products")
      .select("transaction_id, product_id, product_name, qty, price")
      .in("transaction_id", jobIds),
    supabase
      .from("transaction_services")
      .select("transaction_id, service_id, service_name, price")
      .in("transaction_id", jobIds),
  ]);

  // ── Fetch HSN/SAC codes ────────────────────────────────────────────────────
  const prodIds = [...new Set((allProducts || []).map(p => p.product_id).filter(Boolean))];
  const svcIds  = [...new Set((allServices || []).map(s => s.service_id).filter(Boolean))];
  const [{ data: prodRows }, { data: svcRows }] = await Promise.all([
    prodIds.length ? supabase.from("product_list").select("id, hsn").in("id", prodIds) : Promise.resolve({ data: [] }),
    svcIds.length  ? supabase.from("service_list").select("id, hsn").in("id", svcIds)  : Promise.resolve({ data: [] }),
  ]);
  const hsnMap = { ...Object.fromEntries((prodRows || []).map(p => [p.id, p.hsn])), ...Object.fromEntries((svcRows || []).map(s => [s.id, s.hsn])) };

  // Map products/services by transaction_id
  const prodMap = new Map<number, { product_id: number; product_name: string; qty: number; price: number }[]>();
  const svcMap  = new Map<number, { service_id: number; service_name: string; price: number }[]>();
  (allProducts || []).forEach(p => {
    const tid = p.transaction_id;
    if (!prodMap.has(tid)) prodMap.set(tid, []);
    prodMap.get(tid)!.push(p);
  });
  (allServices || []).forEach(s => {
    const tid = s.transaction_id;
    if (!svcMap.has(tid)) svcMap.set(tid, []);
    svcMap.get(tid)!.push(s);
  });

  // ── Build invoice data ─────────────────────────────────────────────────────
  const isGST       = billType === "gst";
  const accentColor = isGST ? "#dc3545" : "#007bff";
  const badgeColor  = isGST ? "#dc3545" : "#17a2b8";
  const billTypeText = isGST ? "GST Invoice" : "Retail Invoice";
  const invoiceTitle = isGST ? "COMBINED TAX INVOICE" : "COMBINED INVOICE";

  const clientName = client
    ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ").trim()
    : "Walk-in Customer";

  // Build rows for each transaction
  interface JobRow {
    job_id: string;
    item: string;
    fault: string;
    status: number;
    date_created: string;
    amount: number;
    subtotal: number;
    lineItems: { desc: string; hsn: string; qty: number; rate: number; total: number }[];
  }
  const jobRows: JobRow[] = txns.map(txn => {
    const prods = prodMap.get(txn.id) || [];
    const svcs  = svcMap.get(txn.id) || [];
    const lineItems: { desc: string; hsn: string; qty: number; rate: number; total: number }[] = [];
    prods.forEach(p => lineItems.push({ desc: `${p.product_name || "Part"} (Part)`, hsn: hsnMap[p.product_id] || "—", qty: p.qty ?? 1, rate: p.price ?? 0, total: (p.qty ?? 1) * (p.price ?? 0) }));
    svcs.forEach(s  => lineItems.push({ desc: `${s.service_name || "Repair Service"} (Service)`, hsn: hsnMap[s.service_id] || "—", qty: 1, rate: s.price ?? 0, total: s.price ?? 0 }));
    const subtotal = lineItems.reduce((s, r) => s + r.total, 0) || txn.amount || 0;
    return {
      job_id: txn.job_id,
      item: txn.item || "—",
      fault: txn.fault || "—",
      status: txn.status,
      date_created: txn.date_created,
      amount: txn.amount || 0,
      subtotal,
      lineItems,
    };
  });

  // Grand totals
  const grandSubtotal = jobRows.reduce((s, r) => s + r.subtotal, 0);
  const cgstAmt  = isGST ? Math.round(grandSubtotal * (CGST_RATE / 100) * 100) / 100 : 0;
  const sgstAmt  = isGST ? Math.round(grandSubtotal * (SGST_RATE / 100) * 100) / 100 : 0;
  const grandTotal = grandSubtotal + cgstAmt + sgstAmt;

  // ── Build HTML sections for each job ──────────────────────────────────────
  const jobSections = jobRows.map((job) => {
    const sc = STATUS_COLOR[job.status] || "#94a3b8";
    const statusLabel = STATUS[job.status] || "—";

    const itemRowsHtml = job.lineItems.length > 0
      ? job.lineItems.map((r, i) => `
          <tr>
            <td class="tc">${i + 1}</td>
            <td>${esc(r.desc)}</td>
            <td class="tc">${esc(r.hsn)}</td>
            <td class="tc">${r.qty}</td>
            <td class="tr">${inr(r.rate)}</td>
            <td class="tr">${inr(r.total)}</td>
          </tr>`).join("")
      : `<tr><td colspan="6" class="tc" style="color:#999;font-style:italic;padding:10px">Repair service — no individual items listed</td></tr>`;

    return `
      <div class="job-section" style="margin-bottom:24px;page-break-inside:avoid">
        <!-- Job Header -->
        <div style="display:flex;align-items:center;gap:10px;background:#001f3f;color:#fff;padding:10px 14px;border-radius:6px 6px 0 0;">
          <span style="font-weight:900;font-size:15px;">#${esc(job.job_id)}</span>
          <span style="font-size:13px;flex:1">${esc(job.item)}</span>
          <span style="font-size:11px;background:${sc}33;color:${sc};border:1px solid ${sc}60;padding:2px 10px;border-radius:20px;font-weight:700">${esc(statusLabel)}</span>
          <span style="font-size:11px;color:#aaa">${fmtDateTime(job.date_created)}</span>
        </div>
        <!-- Fault -->
        <div style="background:#fff8f8;border:1px solid #fcdcdc;padding:8px 14px;font-size:12px;color:#c0392b;">
          <strong>Fault:</strong> ${esc(job.fault)}
        </div>
        <!-- Line Items -->
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin:0">
          <thead>
            <tr style="background:#f8f9fa">
              <th width="5%" class="tc" style="padding:7px;border:1px solid #dee2e6;">#</th>
              <th style="padding:7px;border:1px solid #dee2e6;text-align:left">Description</th>
              <th width="12%" class="tc" style="padding:7px;border:1px solid #dee2e6;">HSN/SAC</th>
              <th width="8%" class="tc" style="padding:7px;border:1px solid #dee2e6;">Qty</th>
              <th width="16%" class="tr" style="padding:7px;border:1px solid #dee2e6;">Rate (₹)</th>
              <th width="16%" class="tr" style="padding:7px;border:1px solid #dee2e6;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>
        <!-- Job Subtotal -->
        <div style="text-align:right;background:#f8f9fa;border:1px solid #dee2e6;border-top:none;padding:8px 14px;font-size:13px;font-weight:700;color:#001f3f">
          Job #${esc(job.job_id)} Subtotal: ${inr(job.subtotal)}
        </div>
      </div>`;
  }).join(`<div style="border-top:2px dashed #e2e8f0;margin:20px 0"></div>`);

  // ── GST rows ─────────────────────────────────────────────────────────────
  const gstRows = isGST ? `
    <tr style="background:#e7f1ff">
      <td style="text-align:right;font-weight:600;padding:8px 12px">CGST @ ${CGST_RATE}%:</td>
      <td style="text-align:right;font-weight:600;padding:8px 12px">${inr(cgstAmt)}</td>
    </tr>
    <tr style="background:#e7f1ff">
      <td style="text-align:right;font-weight:600;padding:8px 12px">SGST @ ${SGST_RATE}%:</td>
      <td style="text-align:right;font-weight:600;padding:8px 12px">${inr(sgstAmt)}</td>
    </tr>
    <tr style="background:#e7f1ff;font-weight:700">
      <td style="text-align:right;padding:8px 12px">Total GST (${CGST_RATE + SGST_RATE}%):</td>
      <td style="text-align:right;padding:8px 12px">${inr(cgstAmt + sgstAmt)}</td>
    </tr>` : "";

  // ── Job summary table ────────────────────────────────────────────────────
  const jobSummaryRows = jobRows.map((job, i) => `
    <tr style="${i % 2 === 0 ? "background:#f8f9fa" : ""}">
      <td style="padding:6px 10px;border:1px solid #dee2e6;font-weight:700;color:#0056b3">#${esc(job.job_id)}</td>
      <td style="padding:6px 10px;border:1px solid #dee2e6">${esc(job.item)}</td>
      <td style="padding:6px 10px;border:1px solid #dee2e6;text-align:right;font-weight:700">${inr(job.subtotal)}</td>
    </tr>`).join("");

  // ── Fetch UPI ID from system_info ──────────────────────────────────────────
  const { data: upiRow } = await supabase
    .from("system_info")
    .select("meta_value")
    .eq("meta_field", "upi_id")
    .single();
  const upiId = upiRow?.meta_value || SHOP.mobile + "@ybl";

  function qrUrl(data: string, size = 130): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  }
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(SHOP.name)}&am=${encodeURIComponent(grandTotal)}&cu=INR&tn=${encodeURIComponent("Payment for Invoice " + jobIds.join(","))}`;
  const upiQrImg = qrUrl(upiUri, 130);
  const trackingQrImg = qrUrl(`https://vtech-rsms/job-status?job_id=${jobIds[0]}`, 130);

  // ── Final HTML ────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Combined Invoice — ${clientName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{width:210mm;min-height:297mm;margin:0 auto 20px;background:#fff;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.12)}

    /* Header */
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${accentColor};padding-bottom:14px;margin-bottom:18px}
    .shop-name{font-size:24px;font-weight:900;color:${accentColor};text-transform:uppercase}
    .shop-tagline{font-size:11px;color:#666;font-style:italic;margin:3px 0 5px}
    .shop-details{font-size:11px;color:#555;line-height:1.7}
    .badge{display:inline-block;padding:7px 18px;background:${badgeColor};color:#fff;font-weight:700;font-size:13px;border-radius:4px}
    .inv-title{font-size:18px;font-weight:900;color:${accentColor};text-align:center;letter-spacing:2px;margin:0 0 16px;text-transform:uppercase}

    /* Info row */
    .info-row{display:flex;gap:12px;margin-bottom:18px}
    .info-box{flex:1;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:11px 13px}
    .info-box-title{font-size:11px;font-weight:700;color:#495057;border-bottom:1px solid ${accentColor};padding-bottom:5px;margin-bottom:8px;text-transform:uppercase}
    .ig{display:flex;margin-bottom:4px;font-size:12px}
    .il{font-weight:600;color:#495057;min-width:110px;flex-shrink:0}
    .iv{color:#212529}

    /* Table helpers */
    .tc{text-align:center}
    .tr{text-align:right}

    /* Amount table */
    .amt-table{width:55%;margin-left:auto;border-collapse:collapse;font-size:13px;margin-top:16px}
    .amt-table td{padding:8px 12px;border:1px solid #dee2e6}
    .subtotal-row td{background:#f8f9fa;font-weight:600}
    .total-row td{background:#ffc107;font-weight:700;font-size:15px}

    /* Actions */
    .actions{width:210mm;margin:0 auto 20px;background:#fff;border:2px solid #dee2e6;border-radius:8px;padding:20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08)}
    .btn-group{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-bottom:14px}
    .btn{padding:11px 24px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .2s;min-width:160px;justify-content:center}
    .btn:hover{transform:translateY(-2px);box-shadow:0 6px 14px rgba(0,0,0,.15)}
    .btn-gst{background:#dc3545;color:#fff}
    .btn-non-gst{background:#17a2b8;color:#fff}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    .active-type{box-shadow:0 0 0 3px rgba(0,0,0,.2)!important}
    .divider{border-top:2px dashed #ccc;margin:16px 0}

    /* Terms */
    .terms{margin-top:16px;padding:10px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-size:11px}
    .terms ol{margin:4px 0 0 14px}
    .terms li{margin-bottom:2px}

    /* Footer */
    .footer{margin-top:20px;padding-top:14px;border-top:1px dashed #ccc;text-align:center}
    .sig{margin-top:36px;text-align:right;padding-right:40px;font-size:12px}

    @media print{
      @page{margin:0;size:A4 portrait}
      body{background:#fff;padding:0;font-size:11px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .wrap{width:100%;min-height:auto;margin:0;padding:10mm;box-shadow:none}
      .actions{display:none!important}
    }
    @media screen and (max-width:900px){
      .wrap,.actions{width:100%}
      .hdr{flex-direction:column;text-align:center;gap:8px}
      .info-row{flex-direction:column}
      .amt-table{width:100%}
    }
  </style>
</head>
<body>

<!-- ═══════════════════ COMBINED INVOICE ═══════════════════ -->
<div class="wrap">

  <!-- Header -->
  <div class="hdr">
    <div>
      ${SHOP.logo
        ? `<img src="${SHOP.logo}" alt="Logo" style="max-height:70px;max-width:180px;object-fit:contain;" />`
        : `<div style="font-size:30px;font-weight:900;color:${accentColor}">V•TECH</div>
           <div style="font-size:10px;font-weight:700;color:#999;letter-spacing:2px">REPAIR SHOP</div>`}
    </div>
    <div style="text-align:center;flex:1;padding:0 20px">
      <div class="shop-name">${esc(SHOP.name)}</div>
      <div class="shop-tagline">${esc(SHOP.tagline)}</div>
      <div class="shop-details">
        ${esc(SHOP.address)}<br>
        📞 ${SHOP.mobile} &nbsp;|&nbsp; ✉ ${SHOP.email}
        ${isGST ? `<br><strong>GSTIN: ${SHOP.gstin}</strong>` : ""}
      </div>
    </div>
    <div style="text-align:right">
      <div class="badge">${billTypeText}</div>
      <div style="margin-top:8px;font-size:11px;color:#999">${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <!-- Invoice Title -->
  <div class="inv-title">${invoiceTitle}</div>

  <!-- Client + Summary Info -->
  <div class="info-row">
    <!-- Customer Details -->
    <div class="info-box">
      <div class="info-box-title">Customer Details</div>
      <div class="ig"><span class="il">Name:</span><span class="iv"><strong>${esc(clientName)}</strong></span></div>
      <div class="ig"><span class="il">Mobile:</span><span class="iv">${esc(client?.contact || "—")}</span></div>
      ${client?.email ? `<div class="ig"><span class="il">Email:</span><span class="iv">${esc(client.email)}</span></div>` : ""}
      ${client?.address ? `<div class="ig" style="align-items:flex-start"><span class="il">Address:</span><span class="iv">${esc(client.address)}</span></div>` : ""}
    </div>
    <!-- Invoice Summary -->
    <div class="info-box">
      <div class="info-box-title">Invoice Summary</div>
      <div class="ig"><span class="il">Total Jobs:</span><span class="iv"><strong>${jobRows.length}</strong></span></div>
      <div class="ig"><span class="il">Date:</span><span class="iv">${fmtDate(new Date().toISOString())}</span></div>
      <div class="ig"><span class="il">Bill Type:</span><span class="iv">${billTypeText}</span></div>
      <div class="ig"><span class="il">Grand Total:</span><span class="iv"><strong style="color:${accentColor};font-size:14px">${inr(grandTotal)}</strong></span></div>
    </div>
  </div>

  <!-- Quick Jobs Summary Table -->
  <div style="margin-bottom:20px">
    <div style="font-size:12px;font-weight:700;color:#495057;border-bottom:1px solid ${accentColor};padding-bottom:5px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Jobs Overview</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#001f3f;color:#fff">
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6">Job ID</th>
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6">Item / Description</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${jobSummaryRows}
        <tr style="background:#ffc107;font-weight:700;font-size:13px">
          <td colspan="2" style="padding:8px 10px;border:1px solid #dee2e6;text-align:right">GRAND TOTAL (${jobRows.length} Jobs):</td>
          <td style="padding:8px 10px;border:1px solid #dee2e6;text-align:right">${inr(grandSubtotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══ INDIVIDUAL JOB DETAILS ═══ -->
  <div style="font-size:12px;font-weight:700;color:#495057;border-bottom:1px solid ${accentColor};padding-bottom:5px;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px">Detailed Job Breakdown</div>
  ${jobSections}

  <!-- ═══ GRAND TOTAL ═══ -->
  <table class="amt-table">
    <tr class="subtotal-row">
      <td style="text-align:right;font-weight:600">Sub Total (${jobRows.length} Jobs):</td>
      <td style="text-align:right;font-weight:600">${inr(grandSubtotal)}</td>
    </tr>
    ${gstRows}
    <tr class="total-row">
      <td style="text-align:right;font-weight:700">Grand Total:</td>
      <td style="text-align:right;font-weight:700">${inr(grandTotal)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:10px 12px;font-size:12px;border:1px solid #dee2e6;background:#f8f9fa">
        <strong>Amount in Words:</strong> ${numberToWords(Math.floor(grandTotal))}
      </td>
    </tr>
  </table>

  <!-- Terms -->
  <div class="terms">
    <strong>Terms &amp; Conditions:</strong>
    <ol>
      <li>Goods once repaired/sold will not be taken back or exchanged without valid reason.</li>
      <li>All disputes are subject to Jabalpur Jurisdiction only.</li>
      <li>Warranty as per manufacturer's terms and conditions.</li>
      <li>Please check all items at the time of delivery.</li>
      <li>Keep this invoice for warranty claim. E. &amp; O.E.</li>
    </ol>
  </div>

  <!-- QR Section -->
  <div style="display:flex;justify-content:center;gap:24px;margin:20px 0;padding:16px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:6px;">
    <div id="trackQrBox" style="display:none;text-align:center;">
      <img src="${trackingQrImg}" alt="Track QR" width="95" height="95" style="border:1px solid #ddd;border-radius:4px;" />
      <div style="font-size:11px;color:#666;margin-top:6px;font-weight:600;">Scan to Track</div>
    </div>
    <div style="text-align:center;">
      <img src="${upiQrImg}" alt="UPI QR Code" width="95" height="95" style="border:1px solid #ddd;border-radius:4px;" />
      <div style="font-size:11px;color:#1a7a3a;margin-top:6px;font-weight:700;">Scan to Pay UPI</div>
      <div style="font-size:10px;color:#999;">${upiId}</div>
    </div>
  </div>
  <div style="text-align:center;margin-bottom:10px;">
    <button onclick="toggleTrackQR()" style="font-size:11px;padding:4px 12px;border:1px solid #ccc;border-radius:3px;cursor:pointer;background:#fff;color:#666;">👁 Toggle Track QR</button>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div style="font-size:15px;font-weight:700;color:#28a745;margin-bottom:6px">❤ Thank You for Your Business!</div>
    <div style="color:#666;font-size:12px">📞 ${SHOP.mobile} &nbsp;|&nbsp; ✉ ${SHOP.email}</div>
    <div class="sig">
      ${SHOP.signature
        ? `<img src="${SHOP.signature}" alt="Signature" style="max-height:50px;max-width:200px;object-fit:contain;"><br>`
        : `<div style="border-top:1px solid #333;width:220px;display:inline-block;padding-top:8px">`
      }
        For ${esc(SHOP.name)}<br><strong>Authorized Signature</strong>
      ${SHOP.signature ? "" : "</div>"}
    </div>
  </div>

</div>

<!-- ═══ ACTION BUTTONS ═══ -->
<div class="actions">
  <h4 style="font-size:16px;font-weight:700;margin-bottom:16px;color:#333">Select Bill Type</h4>
  <div class="btn-group">
    <a href="?ids=${jobIds.join(",")}&bill_type=gst"
       class="btn btn-gst ${isGST ? "active-type" : ""}">
      🧾 GST Invoice (with Tax)
    </a>
    <a href="?ids=${jobIds.join(",")}&bill_type=non_gst"
       class="btn btn-non-gst ${!isGST ? "active-type" : ""}">
      🏪 Retail Invoice (No Tax)
    </a>
  </div>
  <div class="divider"></div>
  <div class="btn-group">
    <button onclick="window.print()" class="btn btn-print">🖨 Print Combined Invoice</button>
    <button onclick="window.close()" class="btn btn-close">✕ Close</button>
  </div>
  <div style="margin-top:10px;font-size:11px;color:#999">
    Shortcut: <strong>Ctrl+P</strong> = Print &nbsp;|&nbsp; <strong>Esc</strong> = Close
  </div>
</div>

<script>
function toggleTrackQR(){
  var el=document.getElementById('trackQrBox');
  el.style.display=el.style.display==='none'?'block':'none';
}
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
