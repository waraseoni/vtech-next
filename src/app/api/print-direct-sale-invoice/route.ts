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
  const url = new URL(request.url);
  const saleId = url.searchParams.get("id");

  if (!saleId) {
    return NextResponse.json({ error: "Missing sale id" }, { status: 400 });
  }

  const { data: sale, error } = await supabase
    .from("direct_sales")
    .select("*")
    .eq("id", parseInt(saleId))
    .single();

  if (error || !sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const [{ data: items }, { data: client }, { data: staff }, { data: editor }] = await Promise.all([
    supabase.from("direct_sale_items").select("*").eq("sale_id", sale.id),
    sale.client_id ? supabase.from("client_list").select("contact, address, firstname, middlename, lastname").eq("id", sale.client_id).single() : Promise.resolve({ data: null }),
    sale.created_by ? supabase.from("mechanic_list").select("firstname, lastname").eq("id", sale.created_by).single() : Promise.resolve({ data: null }),
    sale.last_edited_by ? supabase.from("profiles").select("full_name").eq("id", sale.last_edited_by).single() : Promise.resolve({ data: null }),
  ]);

  const clientName = client ? [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ") : (sale.client_id ? "Unknown" : "Walk-in Customer");
  const clientContact = client?.contact || null;
  const clientAddress = client?.address || null;
  const staffName = staff ? `${staff.firstname} ${staff.lastname}`.trim() : "Unknown";
  const editorName = editor?.full_name || null;

  const saleItems = (items || []).map((it: any) => ({
    product_name: it.product_name,
    qty: it.qty,
    price: it.price,
    total: it.qty * it.price,
  }));

  const subtotal = saleItems.reduce((s, i) => s + i.total, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${sale.sale_code}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;padding:30px;max-width:800px;margin:0 auto;color:#1a1a1a}
    .hdr{text-align:center;border-bottom:3px solid #001f3f;padding-bottom:16px;margin-bottom:20px}
    .co-name{font-size:26px;font-weight:900;color:#001f3f;margin:0 0 4px}
    .co-meta{font-size:12px;color:#666}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
    .box h3{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:0 0 8px}
    .box p{font-size:12px;margin:2px 0;color:#334155}
    table{width:100%;border-collapse:collapse;font-size:13px}
    thead{background:#001f3f;color:#fff}
    th{padding:10px 12px;text-align:left}
    th:nth-child(3){text-align:center}
    th:nth-child(4),th:nth-child(5){text-align:right}
    td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
    td:nth-child(3){text-align:center}
    td:nth-child(4),td:nth-child(5){text-align:right}
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
    @media print{.actions{display:none!important}}
  </style>
</head>
<body>
  <div class="hdr">
    <div class="co-name">${SHOP.name}</div>
    <div class="co-meta">${SHOP.address} | 📞 ${SHOP.mobile}</div>
    <div style="margin-top:8px;font-size:13px;color:#475569">DIRECT SALE INVOICE</div>
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
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${inr(it.price)}</td>
        <td style="text-align:right">${inr(it.total)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  
  <div class="total-box">
    <div class="total-inner">
      <div class="total-row"><span>Subtotal</span><span>${inr(subtotal)}</span></div>
      <div class="total-row grand"><span>Grand Total</span><span>${inr(sale.total_amount)}</span></div>
      <div class="words">${numberToWords(sale.total_amount)} Rupees Only</div>
    </div>
  </div>
  
  ${sale.remarks ? `<div class="remarks"><b>Remarks:</b> ${sale.remarks}</div>` : ""}
  
  <div class="footer">Goods sold are not returnable. Thank you for your business! — ${SHOP.name}</div>
  
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