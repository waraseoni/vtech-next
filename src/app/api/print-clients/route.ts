import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";
import { fetchAll, pageAll, fetchAllIn } from "@/lib/fetch-all";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SHOP = {
  name: "V-Technologies",
  address: "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002",
  mobile: "9179105875",
};

const inr = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const user = await requireStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized \u2014 pehle login karein" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const tabFilter = searchParams.get("tab") || "all";
  const minBal = searchParams.get("minBal") || "";
  const maxBal = searchParams.get("maxBal") || "";
  const sortField = searchParams.get("sortField") || "balance";
  const sortDir = searchParams.get("sortDir") || "desc";

  const cls = await fetchAll(
    supabase
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance")
      .eq("delete_flag", 0)
  );

  if (!cls?.length) {
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:Arial;padding:40px;text-align:center">
        <h2>Koi clients nahi mili</h2>
        <p style="color:#666">Database mein koi client record nahi hai.</p>
        <button onclick="window.close()" style="margin-top:20px;padding:10px 24px;background:#6c757d;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Close</button>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const ids = cls.map((c) => c.id);

  const [{ data: repairs }, { data: dirSales }, { data: payments }, { data: loans }] = await Promise.all([
    pageAll(supabase.from("transaction_list").select("client_name, amount").eq("status", 5)),
    fetchAllIn((ids: number[]) => supabase.from("direct_sales").select("client_id, total_amount").in("client_id", ids), ids).then(rows => ({ data: rows })),
    fetchAllIn((ids: number[]) => supabase.from("client_payments").select("client_id, amount, discount").in("client_id", ids), ids).then(rows => ({ data: rows })),
    fetchAllIn((ids: number[]) => supabase.from("client_loans").select("client_id, total_payable").in("client_id", ids), ids).then(rows => ({ data: rows })),
  ]);

  const toNum = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
  const daysSince = (d: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : 999;

  const repMap: Record<number, number> = {};
  repairs?.forEach((r) => { const cid = parseInt(r.client_name ?? "", 10); if (!isNaN(cid)) repMap[cid] = (repMap[cid] || 0) + toNum(r.amount); });

  const dirMap: Record<number, number> = {};
  dirSales?.forEach((d) => { if (d.client_id) dirMap[d.client_id] = (dirMap[d.client_id] || 0) + toNum(d.total_amount); });

  const payMap: Record<number, number> = {};
  payments?.forEach((p) => { payMap[p.client_id] = (payMap[p.client_id] || 0) + toNum(p.amount) + toNum(p.discount); });

  const loanMap: Record<number, number> = {};
  loans?.forEach((l) => { loanMap[l.client_id] = (loanMap[l.client_id] || 0) + toNum(l.total_payable); });

  const clients = cls.map((c) => {
    const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
    const repairBilled = repMap[c.id] || 0;
    const directSales = dirMap[c.id] || 0;
    const paid = payMap[c.id] || 0;
    const loanGiven = loanMap[c.id] || 0;
    const balance = (c.opening_balance || 0) + repairBilled + directSales + loanGiven - paid;
    return {
      id: c.id, name, contact: c.contact || "", email: c.email || "", address: c.address || "",
      date_created: c.date_created, opening_balance: c.opening_balance || 0,
      repair_billed: repairBilled, direct_sales_billed: directSales,
      total_loan_given: loanGiven, total_paid: paid, balance,
      last_txn_date: null as string | null,
    };
  });

  const lo = minBal !== "" ? parseFloat(minBal) : -Infinity;
  const hi = maxBal !== "" ? parseFloat(maxBal) : Infinity;

  const filtered = clients.filter((c) => {
    const mb = c.balance >= lo && c.balance <= hi;
    const mt = tabFilter === "all" ? true : tabFilter === "due" ? c.balance > 0 : tabFilter === "high" ? c.balance > 20_000 : tabFilter === "clear" ? c.balance <= 0 && daysSince(c.last_txn_date) <= 30 : c.balance <= 0 && daysSince(c.last_txn_date) > 30;
    return mb && mt;
  });

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") cmp = a.name.localeCompare(b.name);
    else if (sortField === "balance") cmp = a.balance - b.balance;
    else if (sortField === "date_created") cmp = (a.date_created || "").localeCompare(b.date_created || "");
    else if (sortField === "total_paid") cmp = a.total_paid - b.total_paid;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalOutstanding = clients.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  const tabLabel = tabFilter === "all" ? "All Clients" : tabFilter === "due" ? "Due" : tabFilter === "high" ? "High Risk" : tabFilter === "clear" ? "Clear" : "Follow-up";

  const clientRows = filtered.map((c, i) => {
    const rowBg = i % 2 === 0 ? "#fff" : "#f8f9fa";
    return `<tr style="background:${rowBg}">
      <td style="padding:8px;border:1px solid #dee2e6;text-align:center;color:#666;font-size:12px">${i + 1}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px;font-weight:600">${c.name}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${c.contact}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${c.email || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;font-size:12px">${c.address || '-'}</td>
      <td style="padding:8px;border:1px solid #dee2e6;text-align:right;font-size:12px;font-weight:700;color:${c.balance > 0 ? '#c0392b' : '#28a745'}">${inr(c.balance)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Client List — ${tabLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;background:#f0f2f5;padding:20px;color:#212529}
    .wrap{max-width:1000px;margin:0 auto}
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
      <h1>👥 ${SHOP.name} — Client List</h1>
      <p>${tabLabel} | ${filtered.length} clients | Generated: ${fmtDate(new Date().toISOString())} | ${SHOP.mobile}</p>
    </div>
    <div class="stats">
      <div class="stat">
        <div class="stat-num">${clients.length}</div>
        <div class="stat-label">Total Clients</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${clients.filter(c => c.balance > 0).length}</div>
        <div class="stat-label">With Due</div>
      </div>
      <div class="stat">
        <div class="stat-num" style="color:#c0392b">${inr(totalOutstanding)}</div>
        <div class="stat-label">Total Outstanding</div>
      </div>
    </div>
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>
          <th style="width:5%">#</th>
          <th style="width:20%">Name</th>
          <th style="width:12%">Contact</th>
          <th style="width:18%">Email</th>
          <th style="width:25%">Address</th>
          <th style="width:20%">Balance</th>
        </tr>
      </thead>
      <tbody>${clientRows}</tbody>
      <tfoot>
        <tr style="background:#f0f4ff;font-weight:700">
          <td colspan="5" style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:12px">Total Outstanding:</td>
          <td style="padding:10px 8px;border:1px solid #dee2e6;text-align:right;font-size:13px;color:#c0392b">${inr(totalOutstanding)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="card">
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

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
