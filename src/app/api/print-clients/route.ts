import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const inr = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });

function formatDate(iso: string) {
  return Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tabFilter = searchParams.get("tab") || "all";
  const minBal = searchParams.get("minBal") || "";
  const maxBal = searchParams.get("maxBal") || "";
  const sortField = searchParams.get("sortField") || "balance";
  const sortDir = searchParams.get("sortDir") || "desc";

  const { data: cls } = await supabase
    .from("client_list")
    .select("id, firstname, middlename, lastname, contact, email, address, date_created, opening_balance")
    .eq("delete_flag", 0);

  if (!cls?.length) {
    return new NextResponse("<html><body><h1>No clients found</h1></body></html>", { headers: { "Content-Type": "text/html" } });
  }

  const ids = cls.map((c) => c.id);

  const [{ data: repairs }, { data: dirSales }, { data: payments }, { data: loans }] = await Promise.all([
    supabase.from("transaction_list").select("client_name, amount").eq("status", 5),
    supabase.from("direct_sales").select("client_id, total_amount").in("client_id", ids),
    supabase.from("client_payments").select("client_id, amount, discount").in("client_id", ids),
    supabase.from("client_loans").select("client_id, total_payable").eq("status", 1).in("client_id", ids),
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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Client List</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: white; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a2e; padding-bottom: 20px; }
    .shop-name { font-size: 28px; font-weight: 900; color: #1a1a2e; }
    .shop-address { font-size: 12px; color: #666; margin-top: 4px; }
    .shop-contact { font-size: 12px; color: #666; }
    h1 { font-size: 20px; font-weight: 700; margin-top: 20px; }
    .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-cards { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { flex: 1; background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
    .summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; }
    .summary-value { font-size: 20px; font-weight: 900; color: #1a1a2e; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 8px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
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
    <h1>Client List</h1>
    <div class="subtitle">${tabLabel} | ${filtered.length} clients | Generated: ${formatDate(new Date().toISOString())}</div>
  </div>

  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-label">Total Clients</div>
      <div class="summary-value">${clients.length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">With Due</div>
      <div class="summary-value negative">${clients.filter(c => c.balance > 0).length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Outstanding</div>
      <div class="summary-value negative">${inr(totalOutstanding)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Contact</th>
        <th>Email</th>
        <th>Address</th>
        <th class="text-right">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map((c, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.contact}</td>
        <td>${c.email}</td>
        <td>${c.address || '-'}</td>
        <td class="text-right ${c.balance > 0 ? 'negative' : 'positive'}"><strong>${inr(c.balance)}</strong></td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5" class="text-right"><strong>Total Outstanding:</strong></td>
        <td class="text-right negative"><strong>${inr(totalOutstanding)}</strong></td>
      </tr>
    </tfoot>
  </table>

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