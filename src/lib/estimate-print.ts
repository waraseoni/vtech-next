// Estimate A4 print HTML (pure). Route isliye thin rehta hai aur escaping/
// totals tests seedha isi function par chalte hain. Koi QR/tracking nahi.

import { computeEstimateTotals, type EstimatePrintPayload } from "@/lib/estimate";
import { escHtml, type PrintShop } from "@/lib/print-shop";
import { numberToWords } from "@/lib/numberToWords";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

function fmtDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  if (!m) return escHtml(v);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return escHtml(v);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function renderEstimateHtml(data: EstimatePrintPayload, shop: PrintShop): string {
  const totals = computeEstimateTotals(data.lines, {
    gstEnabled: data.gstEnabled,
    gstRate: data.gstRate,
    discountType: data.discountType,
    discountValue: data.discountValue,
  });

  const title =
    data.printOptions.showTitle && data.printOptions.title.trim()
      ? escHtml(data.printOptions.title.trim())
      : "";
  const disclaimer =
    data.printOptions.showDisclaimer && data.printOptions.disclaimer.trim()
      ? escHtml(data.printOptions.disclaimer.trim())
      : "";
  const client = data.client && data.client.name.trim() ? data.client : null;
  const gstin = shop.gstin ? `<div>GSTIN: <strong>${escHtml(shop.gstin)}</strong></div>` : "";

  const itemRows = data.lines
    .map(
      (r, i) => `
      <tr>
        <td class="tc">${i + 1}</td>
        <td>${escHtml(r.name)}</td>
        ${data.gstEnabled ? `<td class="tc">${escHtml(r.hsn || "—")}</td>` : ""}
        <td class="tc">${r.qty}</td>
        <td class="tr">${inr(r.rate)}</td>
        <td class="tr">${inr(Math.round((r.qty * r.rate + Number.EPSILON) * 100) / 100)}</td>
      </tr>`
    )
    .join("");

  const summaryRows = [
    `<tr class="subtotal-row"><td class="al">Sub Total:</td><td class="ar">${inr(totals.subtotal)}</td></tr>`,
    totals.discountAmount > 0
      ? `<tr><td class="al">Discount:</td><td class="ar">− ${inr(totals.discountAmount)}</td></tr>`
      : "",
    totals.discountAmount > 0 || data.gstEnabled
      ? `<tr><td class="al">Taxable Amount:</td><td class="ar">${inr(totals.taxable)}</td></tr>`
      : "",
    data.gstEnabled
      ? `<tr class="gst-row"><td class="al">CGST @ ${data.gstRate / 2}%:</td><td class="ar">${inr(totals.cgst)}</td></tr>
         <tr class="gst-row"><td class="al">SGST @ ${data.gstRate / 2}%:</td><td class="ar">${inr(totals.sgst)}</td></tr>`
      : "",
    totals.roundOff !== 0
      ? `<tr><td class="al">Round Off:</td><td class="ar">${totals.roundOff > 0 ? "+" : "−"} ${inr(Math.abs(totals.roundOff))}</td></tr>`
      : "",
    `<tr class="total-row"><td class="al">Grand Total:</td><td class="ar">${inr(totals.grandTotal)}</td></tr>`,
    `<tr class="words-row"><td colspan="2"><strong>Amount in Words:</strong> ${escHtml(
      numberToWords(totals.grandTotal)
    )}</td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(data.reference || shop.name)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{width:210mm;min-height:297mm;margin:0 auto 20px;background:#fff;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,.12)}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid #0f766e;padding-bottom:14px;margin-bottom:14px}
    .hdr-main{flex:1;text-align:right}
    .shop-name{font-size:22px;font-weight:900;color:#0f766e;text-transform:uppercase;letter-spacing:1px}
    .shop-tagline{font-size:12px;color:#666;font-style:italic;margin:3px 0 6px}
    .shop-details{font-size:11.5px;color:#555;line-height:1.6}
    .doc-title{font-size:20px;font-weight:900;color:#0f766e;text-align:center;letter-spacing:2px;margin:10px 0 14px;text-transform:uppercase}
    .info-row{display:flex;gap:14px;margin-bottom:14px}
    .info-box{flex:1;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:12px}
    .info-box-title{font-size:12px;font-weight:700;color:#495057;border-bottom:1px solid #0f766e;padding-bottom:6px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px}
    .ig{display:flex;margin-bottom:5px;font-size:12.5px}
    .il{font-weight:600;color:#495057;min-width:100px;flex-shrink:0}
    .iv{color:#212529;word-break:break-word}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12.5px}
    th{background:#0f3f3b;color:#fff;padding:9px 8px;font-size:12px;text-align:left}
    td{padding:7px 8px;border:1px solid #dee2e6;vertical-align:top}
    tr:nth-child(even) td{background:#f8f9fa}
    .tc{text-align:center}.tr{text-align:right}.al{text-align:right;font-weight:600;background:#f8f9fa}
    .ar{text-align:right;font-weight:600}
    .amt-table{width:60%;margin-left:auto;border-collapse:collapse;font-size:13px}
    .amt-table td{padding:8px 12px;border:1px solid #dee2e6}
    .gst-row td{background:#e7f1ff}
    .subtotal-row td{background:#f8f9fa;font-weight:600}
    .total-row td{background:#d1fae5;font-weight:700;font-size:14px}
    .words-row td{background:#f8f9fa;font-size:12px;padding:10px 12px}
    .notes{margin-top:16px;padding:12px 14px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;font-size:11.5px;white-space:pre-wrap}
    .disclaimer{margin-top:10px;padding:10px 12px;border:1px dashed #d1d5db;border-radius:4px;font-size:11px;color:#6b7280;white-space:pre-wrap}
    .sign-row{display:flex;justify-content:space-between;gap:40px;margin-top:56px;font-size:12.5px}
    .sign{width:220px;border-top:1px solid #333;padding-top:8px;text-align:center}
    .footer{margin-top:28px;padding-top:14px;border-top:1px dashed #ccc;text-align:center;color:#666;font-size:12px}
    .actions{width:210mm;margin:0 auto 20px;background:#fff;border:2px solid #dee2e6;border-radius:8px;padding:16px;text-align:center}
    .btn{padding:10px 22px;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:700;margin:0 6px}
    .btn-print{background:#28a745;color:#fff}
    .btn-close{background:#6c757d;color:#fff}
    @media print{
      @page{margin:0;size:A4 portrait}
      body{background:#fff;padding:0;font-size:11px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .wrap{width:100%;min-height:auto;margin:0;padding:12mm;box-shadow:none}
      .actions{display:none!important}
      th{background:#0f3f3b!important;color:#fff!important}
      .gst-row td{background:#e7f1ff!important}
      .total-row td{background:#d1fae5!important}
    }
    @media screen and (max-width:900px){
      .wrap,.actions{width:100%}
      .hdr{flex-direction:column;text-align:center}
      .hdr-main{text-align:center}
      .info-row{flex-direction:column}
      .amt-table{width:100%}
    }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <div>
      ${
        shop.logo
          ? `<img src="${escHtml(shop.logo)}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;" />`
          : `<div style="font-size:26px;font-weight:900;color:#0f766e">${escHtml(shop.name)}</div>`
      }
    </div>
    <div class="hdr-main">
      <div class="shop-name">${escHtml(shop.name)}</div>
      ${shop.tagline ? `<div class="shop-tagline">${escHtml(shop.tagline)}</div>` : ""}
      <div class="shop-details">
        ${shop.address ? `${escHtml(shop.address)}<br/>` : ""}
        ${shop.mobile ? `📞 ${escHtml(shop.mobile)}` : ""}
        ${shop.email ? ` &nbsp;|&nbsp; ✉ ${escHtml(shop.email)}` : ""}
        ${gstin ? `<br/>${gstin}` : ""}
      </div>
    </div>
  </div>

  ${title ? `<div class="doc-title">${title}</div>` : ""}

  <div class="info-row">
    <div class="info-box">
      <div class="info-box-title">Reference Details</div>
      <div class="ig"><span class="il">Ref. No:</span><span class="iv"><strong>${escHtml(
        data.reference
      )}</strong></span></div>
      <div class="ig"><span class="il">Date:</span><span class="iv">${fmtDate(data.date)}</span></div>
      ${
        data.validTill
          ? `<div class="ig"><span class="il">Valid Till:</span><span class="iv">${fmtDate(
              data.validTill
            )}</span></div>`
          : ""
      }
    </div>
    ${
      client
        ? `<div class="info-box">
      <div class="info-box-title">Client Details</div>
      <div class="ig"><span class="il">Name:</span><span class="iv"><strong>${escHtml(
        client.name
      )}</strong></span></div>
      ${client.mobile ? `<div class="ig"><span class="il">Mobile:</span><span class="iv">${escHtml(client.mobile)}</span></div>` : ""}
      ${client.email ? `<div class="ig"><span class="il">Email:</span><span class="iv">${escHtml(client.email)}</span></div>` : ""}
      ${client.address ? `<div class="ig"><span class="il">Address:</span><span class="iv">${escHtml(client.address)}</span></div>` : ""}
    </div>`
        : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th width="5%" style="text-align:center">#</th>
        <th>Description</th>
        ${data.gstEnabled ? '<th width="12%" style="text-align:center">HSN/SAC</th>' : ""}
        <th width="9%" style="text-align:center">Qty</th>
        <th width="16%" style="text-align:right">Rate (₹)</th>
        <th width="16%" style="text-align:right">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="amt-table">${summaryRows}</table>

  ${data.remarks.trim() ? `<div class="notes">${escHtml(data.remarks.trim())}</div>` : ""}
  ${disclaimer ? `<div class="disclaimer">${disclaimer}</div>` : ""}

  <div class="sign-row">
    <div class="sign">Client Signature</div>
    <div class="sign">For ${escHtml(shop.name)}<br/><strong>Authorized Signature</strong></div>
  </div>

  <div class="footer">Thank you for your enquiry.</div>
</div>

<div class="actions">
  <button onclick="window.print()" class="btn btn-print">🖨 Print</button>
  <button onclick="window.close()" class="btn btn-close">✕ Close</button>
</div>
<script>setTimeout(function(){window.print()},400)</script>
</body>
</html>`;
}
