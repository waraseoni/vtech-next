import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";

const supabase = getAdminSupabase();

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchShopInfo() {
  const { data } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  (data || []).forEach((r: { meta_field: string; meta_value: string }) => {
    info[r.meta_field] = r.meta_value;
  });
  return {
    name: info.name || "V-Technologies",
    tagline: info.tagline || "Power Supply & Stage Light Repair Solutions",
    address: info.address || "",
    mobile: info.contact || "",
    email: info.email || "",
    gstin: info.gst_no || "",
    logo: info.logo || "",
    signature: info.signature || "",
  };
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d + (d.length === 10 ? "T00:00:00" : "")));
}

function inr(n: number): string {
  return "\u20b9" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function helper(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + helper(n % 100);
  }
  if (num === 0) return "Zero Rupees Only";
  let w = "";
  const cr = Math.floor(num / 10000000); num %= 10000000;
  const lk = Math.floor(num / 100000); num %= 100000;
  const th = Math.floor(num / 1000); num %= 1000;
  if (cr) w += helper(cr) + "Crore ";
  if (lk) w += helper(lk) + "Lakh ";
  if (th) w += helper(th) + "Thousand ";
  w += helper(num);
  return w.trim() + " Rupees Only";
}

// ─── STATUS MAP ───────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
};

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requireStaff();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const poId = url.searchParams.get("po_id");

  if (!poId) {
    return new NextResponse("po_id parameter required", { status: 400 });
  }

  const SHOP = await fetchShopInfo();

  // ── Fetch PO header ──
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_code, supplier_id, contact_person_id, status, expected_date, notes, total_amount, date_created, received_date")
    .eq("id", Number(poId))
    .maybeSingle();

  if (!po) {
    return new NextResponse(`Purchase Order #${poId} not found`, { status: 404 });
  }

  // ── Fetch supplier details ──
  let supplierName = "—";
  let supplierAddress = "";
  let supplierGstin = "";
  let supplierCity = "";
  let supplierState = "";
  let supplierContactPhone = "";
  let supplierEmail = "";

  if (po.supplier_id) {
    const { data: sup } = await supabase
      .from("suppliers")
      .select("name, address, gstin, city, state, contact, email")
      .eq("id", po.supplier_id)
      .maybeSingle();
    if (sup) {
      supplierName = sup.name || "—";
      supplierAddress = sup.address || "";
      supplierGstin = sup.gstin || "";
      supplierCity = sup.city || "";
      supplierState = sup.state || "";
      supplierContactPhone = sup.contact || "";
      supplierEmail = sup.email || "";
    }
  }

  // ── Fetch contact person name ──
  let contactPerson = "";
  if (po.contact_person_id) {
    const { data: cp } = await supabase
      .from("supplier_contact_persons")
      .select("name")
      .eq("id", po.contact_person_id)
      .maybeSingle();
    contactPerson = cp?.name || "";
  }

  // ── Fetch PO items + product names ──
  const { data: itemRows } = await supabase
    .from("purchase_order_items")
    .select("product_id, qty_ordered, qty_received, unit_cost")
    .eq("purchase_order_id", po.id);

  const items: Array<{ name: string; qty: number; received: number; rate: number; total: number }> = [];
  if (itemRows && itemRows.length) {
    const pIds = [...new Set(itemRows.map((i) => i.product_id))];
    const { data: prods } = await supabase
      .from("product_list")
      .select("id, name, hsn")
      .in("id", pIds);
    const prodMap = new Map((prods || []).map((p) => [p.id, p.name]));
    const hsnMap = new Map((prods || []).map((p) => [p.id, (p as { hsn?: string }).hsn || ""]));

    itemRows.forEach((i) => {
      items.push({
        name: prodMap.get(i.product_id) || `#${i.product_id}`,
        qty: i.qty_ordered || 0,
        received: i.qty_received || 0,
        rate: i.unit_cost || 0,
        total: (i.qty_ordered || 0) * (i.unit_cost || 0),
      });
    });
  }

  const subtotal = items.reduce((s, r) => s + r.total, 0);
  const totalQty = items.reduce((s, r) => s + r.qty, 0);
  const grandTotal = po.total_amount || subtotal;
  const statusLabel = STATUS_LABEL[po.status] || po.status;

  // ── Build item rows ──
  const itemRowsHtml = items.length
    ? items
        .map(
          (r, i) => `
      <tr>
        <td class="tc">${i + 1}</td>
        <td>${r.name}</td>
        <td class="tc">${r.qty}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="tc" style="color:#999">No items</td></tr>`;

  const statusColor =
    po.status === "received" ? "#28a745" :
    po.status === "cancelled" ? "#dc3545" :
    po.status === "ordered" ? "#007bff" :
    "#ffc107";

  // ── Supplier address full line ──
  const supAddrParts = [supplierAddress, supplierCity, supplierState].filter(Boolean);
  const supAddrLine = supAddrParts.join(", ") || "—";

  // ── HTML ───────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Purchase Order — ${po.po_code}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{width:210mm;min-height:297mm;margin:0 auto 20px;background:#fff;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.12)}

    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #007bff;padding-bottom:14px;margin-bottom:16px}
    .hdr-left{flex:1}
    .hdr-right{flex:1;text-align:right}
    .shop-name{font-size:22px;font-weight:900;color:#007bff;text-transform:uppercase;letter-spacing:1px}
    .shop-tagline{font-size:12px;color:#666;font-style:italic;margin:3px 0 6px}
    .shop-details{font-size:11.5px;color:#555;line-height:1.6}

    .po-title{font-size:22px;font-weight:900;color:#001f3f;text-align:center;letter-spacing:3px;margin:12px 0 16px;text-transform:uppercase;padding:10px 0;border-top:2px solid #dee2e6;border-bottom:2px solid #dee2e6}
    .po-badge{display:inline-block;padding:5px 16px;border-radius:4px;font-size:12px;font-weight:700;color:#fff;background:${statusColor};vertical-align:middle;margin-left:10px}

    .info-row{display:flex;gap:14px;margin-bottom:16px}
    .info-box{flex:1;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:12px}
    .info-box-title{font-size:12px;font-weight:700;color:#495057;border-bottom:1px solid #007bff;padding-bottom:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
    .ig{display:flex;margin-bottom:5px;font-size:12.5px}
    .il{font-weight:600;color:#495057;min-width:120px;flex-shrink:0}
    .iv{color:#212529}

    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
    th{background:#001f3f;color:#fff;padding:9px 8px;font-size:12px}
    td{padding:7px 8px;border:1px solid #dee2e6;vertical-align:top}
    tr:nth-child(even) td{background:#f8f9fa}
    .tc{text-align:center}.tr{text-align:right}

    .total-row td{background:#ffc107;font-weight:700;font-size:14px}
    .subtotal-row td{background:#f8f9fa;font-weight:600}
    .amt-table{width:50%;margin-left:auto;border-collapse:collapse;font-size:13px}
    .amt-table td{padding:8px 12px;border:1px solid #dee2e6}
    .words-row td{background:#f8f9fa;font-size:12px;padding:10px 12px;border:1px solid #dee2e6}

    .terms{margin-top:16px;padding:12px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-size:11.5px}
    .terms strong{font-size:13px}
    .terms ol{margin:6px 0 0 16px}
    .terms li{margin-bottom:3px}

    .footer{margin-top:24px;padding-top:16px;border-top:1px dashed #ccc}
    .sig-row{display:flex;justify-content:space-between;gap:20px;margin-top:40px}
    .sig-box{text-align:center;flex:1}
    .sig-line{border-top:1px solid #333;margin-top:60px;padding-top:8px;font-size:12px;color:#555}

    .actions{width:210mm;margin:0 auto 20px;background:#fff;border:2px solid #dee2e6;border-radius:8px;padding:20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.08)}
    .actions h4{font-size:16px;font-weight:700;margin-bottom:16px;color:#333}
    .btn-group{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-bottom:12px}
    .btn{padding:11px 22px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:all .25s;min-width:180px;justify-content:center}
    .btn:hover{transform:translateY(-2px);box-shadow:0 6px 14px rgba(0,0,0,.15)}
    .btn-print{background:#28a745;color:#fff}
    .btn-pdf{background:#007bff;color:#fff}
    .btn-close{background:#6c757d;color:#fff}

    @media print{
      @page{margin:0;size:A4 portrait}
      body{background:#fff;padding:0;font-size:11px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .wrap{width:100%;min-height:auto;margin:0;padding:12mm;box-shadow:none}
      .actions{display:none!important}
      th{background:#001f3f!important;color:#fff!important}
      .total-row td{background:#ffc107!important}
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

<div class="wrap">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      ${SHOP.logo
        ? `<img src="${SHOP.logo}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;" />`
        : `<div style="font-size:28px;font-weight:900;color:#007bff">V\u2022TECH</div>
           <div style="font-size:10px;font-weight:700;color:#999;letter-spacing:2px">REPAIR SHOP</div>`
      }
      <div class="shop-name" style="margin-top:6px">${SHOP.name}</div>
      <div class="shop-tagline">${SHOP.tagline}</div>
      <div class="shop-details">
        ${SHOP.address}<br/>
        ${SHOP.mobile ? `\u260e ${SHOP.mobile}` : ""}${SHOP.email ? ` \u00a0|\u00a0 \u2709 ${SHOP.email}` : ""}
        ${SHOP.gstin ? `<br/><strong>GSTIN: ${SHOP.gstin}</strong>` : ""}
      </div>
    </div>
    <div class="hdr-right">
      <div style="font-size:11px;color:#999;margin-bottom:8px">PURCHASE ORDER</div>
      <div style="font-size:13px;font-weight:700;color:#212529">PO No: <strong>${po.po_code}</strong></div>
      <div style="font-size:12px;color:#555;margin-top:4px">Date: ${fmtDate(po.date_created)}</div>
      ${po.expected_date ? `<div style="font-size:12px;color:#555;margin-top:2px">Expected: ${fmtDate(po.expected_date)}</div>` : ""}
    </div>
  </div>

  <!-- PO Title -->
  <div class="po-title">
    PURCHASE ORDER
    <span class="po-badge">${statusLabel}</span>
  </div>

  <!-- Supplier + PO Info -->
  <div class="info-row">
    <div class="info-box">
      <div class="info-box-title">To (Supplier)</div>
      <div class="ig"><span class="il">Name:</span><span class="iv"><strong>${supplierName}</strong></span></div>
      <div class="ig"><span class="il">Address:</span><span class="iv">${supAddrLine}</span></div>
      ${supplierContactPhone ? `<div class="ig"><span class="il">Phone:</span><span class="iv">${supplierContactPhone}</span></div>` : ""}
      ${supplierEmail ? `<div class="ig"><span class="il">Email:</span><span class="iv">${supplierEmail}</span></div>` : ""}
      ${supplierGstin ? `<div class="ig"><span class="il">GSTIN:</span><span class="iv">${supplierGstin}</span></div>` : ""}
      ${contactPerson ? `<div class="ig"><span class="il">Contact Person:</span><span class="iv">${contactPerson}</span></div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-box-title">PO Details</div>
      <div class="ig"><span class="il">PO Number:</span><span class="iv"><strong>${po.po_code}</strong></span></div>
      <div class="ig"><span class="il">Order Date:</span><span class="iv">${fmtDate(po.date_created)}</span></div>
      <div class="ig"><span class="il">Expected Date:</span><span class="iv">${fmtDate(po.expected_date)}</span></div>
      <div class="ig"><span class="il">Status:</span><span class="iv"><span style="display:inline-block;padding:2px 10px;border-radius:3px;font-size:11px;font-weight:700;background:${statusColor};color:#fff">${statusLabel}</span></span></div>
      ${po.received_date ? `<div class="ig"><span class="il">Received Date:</span><span class="iv">${fmtDate(po.received_date)}</span></div>` : ""}
      ${po.notes ? `<div class="ig" style="align-items:flex-start"><span class="il">Notes:</span><span class="iv">${po.notes}</span></div>` : ""}
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th width="5%" class="tc">#</th>
        <th>Product Description</th>
        <th width="12%" class="tc">Qty Ordered</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHtml}
    </tbody>
  </table>

  <!-- Total Summary -->
  <div style="margin:14px 0;padding:12px 16px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;text-align:right">
    <span style="font-size:13px;color:#555">Total Items: <strong>${totalQty} units</strong></span>
    <div style="font-size:15px;font-weight:700;color:#001f3f;margin-top:6px">
      Price: As per supplier invoice
    </div>
  </div>

  <!-- Terms & Conditions -->
  <div class="terms">
    <strong>Terms &amp; Conditions:</strong>
    <ol>
      <li>Please quote PO number on your invoice and all delivery documents.</li>
      <li>Goods must match the specifications and quantities ordered above.</li>
      <li>Any shortage or damage must be reported within 48 hours of delivery.</li>
      <li>Payment will be made as per agreed terms after satisfactory delivery &amp; verification.</li>
      <li>Please send your best price confirmation against this PO.</li>
      <li>All disputes are subject to Jabalpur Jurisdiction only.</li>
    </ol>
  </div>

  <!-- Signatures -->
  <div class="footer">
    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-line">Authorized Signature (Buyer)</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">Supplier's Signature & Stamp</div>
      </div>
    </div>
  </div>

</div>

<!-- Actions -->
<div class="actions">
  <h4>Purchase Order — ${po.po_code}</h4>
  <div class="btn-group">
    <button onclick="window.print()" class="btn btn-print">\ud83d\udda8 Print Purchase Order</button>
    <button onclick="savePDF()" class="btn btn-pdf">\ud83d\udce5 Save as PDF</button>
    <button onclick="window.close()" class="btn btn-close">\u2715 Close</button>
  </div>
  <div style="margin-top:10px;font-size:11px;color:#999">
    Shortcut: <strong>Ctrl+P</strong> = Print \u00a0|\u00a0 <strong>Ctrl+S</strong> = PDF \u00a0|\u00a0 <strong>Esc</strong> = Close
  </div>
</div>

<script>
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
