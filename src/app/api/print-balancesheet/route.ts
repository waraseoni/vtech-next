import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { requireAdmin } from "@/lib/api-auth";
import { fetchBalanceSheetData } from "@/lib/balance-sheet-data";
import { buildBalanceSheet, type StatementRow } from "@/lib/balance-sheet";
import { escHtml, getPrintShop } from "@/lib/print-shop";
import { printHtmlResponse } from "@/lib/print-html";
import { todayIST } from "@/lib/dateUtils";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const money = (v: number) => {
  const x = Number.isFinite(v) ? v : 0;
  const abs = Math.abs(x).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${x < 0 ? "-" : ""}₹${abs}`;
};
const amount = (v: number) => (v === 0 ? "—" : money(v));

function fmtDay(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00+05:30`));
}

const cell = (v: string | number) => (typeof v === "number" ? money(v) : escHtml(v));

type Col = { label: string; num?: boolean };

function detailTable(
  title: string,
  cols: Col[],
  rows: (string | number)[][],
  opts: { empty?: string; total?: (string | number)[] } = {}
): string {
  const head = cols
    .map((c) => `<th${c.num ? ' class="num"' : ""}>${escHtml(c.label)}</th>`)
    .join("");
  const body =
    rows.length === 0
      ? `<tr><td class="empty" colspan="${cols.length}">${escHtml(opts.empty || "कोई डेटा नहीं")}</td></tr>`
      : rows
          .map(
            (r) =>
              `<tr>${r
                .map((v, i) => `<td${cols[i]?.num ? ' class="num"' : ""}>${cell(v)}</td>`)
                .join("")}</tr>`
          )
          .join("");
  const total = opts.total
    ? `<tr class="total">${opts.total
        .map((v, i) => `<td${cols[i]?.num ? ' class="num"' : ""}><strong>${cell(v)}</strong></td>`)
        .join("")}</tr>`
    : "";
  return `<section class="section">
    <h2>${escHtml(title)}</h2>
    <table><thead><tr>${head}</tr></thead><tbody>${body}${total}</tbody></table>
  </section>`;
}

function statementRows(rows: StatementRow[]): string {
  return rows
    .map(
      (r) => `<div class="srow">
        <span class="slabel">${escHtml(r.label)}${
          r.count > 0 ? ` <span class="cnt">(${r.count})</span>` : ""
        }</span>
        <span class="samt">${amount(r.amount)}</span>
      </div>`
    )
    .join("");
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user)
    return NextResponse.json({ error: "Unauthorized — pehle login karein" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const today = todayIST();
  const from = searchParams.get("from") || today;
  const to = searchParams.get("to") || from;
  const asOn = searchParams.get("asOn") || to;
  if (!isDay(from) || !isDay(to) || !isDay(asOn) || from > to) {
    return NextResponse.json({ error: "Invalid from/to/asOn date" }, { status: 400 });
  }

  const data = await fetchBalanceSheetData(getAdminSupabase(), { from, to, asOn });
  const shop = await getPrintShop();

  const statement = buildBalanceSheet({
    customers: data.customerLedger,
    mechanics: data.mechanicLedger,
    loans: data.loanLedger,
    stock: data.stockInventory,
    cash: data.cashFlow.balance,
    clientLoans: data.clientLoanLedger,
  });

  const { summary, cashFlow } = data;
  const prev = summary.previous;
  const prevDelta = prev ? summary.netProfit - prev.netProfit : 0;
  const prevLine = prev
    ? `<p class="prev">पिछली अवधि (${fmtDay(prev.from)} – ${fmtDay(prev.to)}): आय ${money(
        prev.totalIncome
      )} · व्यय ${money(prev.totalExpenses)} · शुद्ध लाभ ${money(prev.netProfit)} — ${
        prevDelta >= 0 ? "सुधार" : "गिरावट"
      } ${money(Math.abs(prevDelta))}</p>`
    : "";

  const customerRows = data.customerLedger.map((c) => [
    c.customer_name,
    c.opening_balance,
    c.total_repair_amount,
    c.total_sales,
    c.total_payment,
    c.current_balance,
  ]);
  const customerTotals = data.customerLedger.reduce(
    (acc, c) => {
      acc[0] += c.opening_balance;
      acc[1] += c.total_repair_amount;
      acc[2] += c.total_sales;
      acc[3] += c.total_payment;
      acc[4] += c.current_balance;
      return acc;
    },
    [0, 0, 0, 0, 0]
  );

  const mechanicRows = data.mechanicLedger.map((m) => [
    m.mechanic_name,
    m.days_worked_in_period,
    m.salary_due_in_period,
    m.period_commission,
    m.advance_in_period,
    m.balance_amount,
  ]);
  const mechanicTotals = data.mechanicLedger.reduce(
    (acc, m) => {
      acc[0] += m.days_worked_in_period;
      acc[1] += m.salary_due_in_period;
      acc[2] += m.period_commission;
      acc[3] += m.advance_in_period;
      acc[4] += m.balance_amount;
      return acc;
    },
    [0, 0, 0, 0, 0]
  );

  const clientLoanRows = data.clientLoanLedger.map((l) => [
    l.client_name,
    fmtDay(l.loan_date),
    l.total_payable,
    l.paid,
    l.outstanding,
  ]);
  const clientLoanTotal = data.clientLoanLedger.reduce(
    (acc, l) => {
      acc[0] += l.total_payable;
      acc[1] += l.paid;
      acc[2] += l.outstanding;
      return acc;
    },
    [0, 0, 0]
  );

  const stockRows = data.stockInventory.map((s) => [
    s.product_name,
    s.total_stock_in,
    s.sold_quantity,
    s.remaining_stock,
    s.stock_value,
  ]);
  const stockTotal = data.stockInventory.reduce((s, p) => s + p.stock_value, 0);

  const incomeRows = data.incomeSummary.map((i) => [i.description, i.amount]);
  const incomeTotal = ["कुल आय", summary.totalIncome];
  const expenseRows = data.expenseSummary.map((e) => [e.expense_category || "अन्य", e.amount]);
  const expenseTotal = ["कुल व्यय", summary.totalExpenses];

  const loanRows = data.loanLedger.map((l) => [
    l.lender_name,
    l.loan_amount,
    l.total_paid,
    l.balance_amount,
  ]);
  const loanTotals = data.loanLedger.reduce(
    (acc, l) => {
      acc[0] += l.loan_amount;
      acc[1] += l.total_paid;
      acc[2] += l.balance_amount;
      return acc;
    },
    [0, 0, 0]
  );

  const cashRows = [
    ...cashFlow.inflow.map((r) => [`जमा — ${r.label}`, r.amount] as (string | number)[]),
    ...cashFlow.outflow.map((r) => [`खर्च — ${r.label}`, r.amount] as (string | number)[]),
  ];

  const html = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>व्यापार चिट्ठा — ${fmtDay(asOn)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Nirmala UI","Noto Sans Devanagari","Segoe UI",Arial,sans-serif;background:#efece1;color:#1f2937;padding:18px;font-size:12px}
    .sheet{max-width:900px;margin:0 auto;background:#fffdf6;border:1px solid #e3dcc8;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.12);padding:22px 24px}
    .head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #1f2937;padding-bottom:12px}
    .brand{display:flex;gap:12px;align-items:center}
    .logo{width:46px;height:46px;object-fit:contain;border-radius:6px;background:#fff;border:1px solid #e3dcc8}
    .shop{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b5b3e}
    h1{font-size:22px;font-weight:900;color:#111827;line-height:1.2;margin-top:2px}
    .sub{font-size:11px;color:#4b5563;margin-top:3px}
    .meta{text-align:right;font-size:11px;color:#4b5563;line-height:1.6}
    .kpis{display:flex;gap:8px;margin:14px 0}
    .kpi{flex:1;border:1px solid #e3dcc8;border-radius:5px;padding:8px 10px;background:#faf7ec}
    .kpi .lbl{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b7280}
    .kpi .val{font-size:15px;font-weight:900;margin-top:2px;font-variant-numeric:tabular-nums}
    .green{color:#15803d}.red{color:#b91c1c}.blue{color:#1d4ed8}.ink{color:#111827}
    .stmt{border:1px solid #d8d0b8;border-radius:5px;overflow:hidden}
    .cols{display:flex}
    .col{flex:1;padding:12px 14px}
    .col + .col{border-left:1px solid #d8d0b8}
    .col h3{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#6b5b3e;border-bottom:1px solid #d8d0b8;padding-bottom:5px;margin-bottom:6px}
    .srow{display:flex;justify-content:space-between;gap:10px;padding:3.5px 0;border-bottom:1px dotted #e7e1cf;font-size:11.5px}
    .srow:last-child{border-bottom:0}
    .slabel{color:#374151}
    .cnt{color:#9ca3af;font-size:9.5px}
    .samt{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
    .tot{display:flex;justify-content:space-between;border-top:3px double #111827;margin-top:6px;padding-top:6px;font-weight:900;font-size:11.5px}
    .sub2{display:flex;justify-content:space-between;padding-top:4px;color:#1d4ed8;font-weight:800;font-size:11px}
    .note{padding:8px 14px;border-top:1px solid #d8d0b8;background:#faf7ec;font-size:9.5px;color:#6b7280;line-height:1.5}
    .pl{margin-top:12px;border:1px solid #d8d0b8;border-radius:5px;padding:9px 14px;background:#faf7ec}
    .pl .row{display:flex;gap:22px;flex-wrap:wrap;font-size:11px;font-weight:700}
    .pl .row span b{font-variant-numeric:tabular-nums}
    .prev{margin-top:5px;font-size:9.5px;color:#6b7280}
    .details{margin-top:14px}
    .section{margin-top:10px;border:1px solid #d8d0b8;border-radius:5px;overflow:hidden;page-break-inside:avoid}
    .section h2{font-size:10.5px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#6b5b3e;background:#f5f1e3;padding:6px 10px;border-bottom:1px solid #d8d0b8}
    table{width:100%;border-collapse:collapse;font-size:10.5px}
    th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:5px 8px;border-bottom:1px solid #d8d0b8;background:#fffdf6}
    td{padding:4.5px 8px;border-bottom:1px dotted #e7e1cf;color:#374151}
    tr:last-child td{border-bottom:0}
    .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .empty{text-align:center;color:#9ca3af;padding:12px}
    tr.total td{background:#f5f1e3;border-top:2px solid #b9ad8b;color:#111827}
    .sign{display:flex;justify-content:space-between;margin-top:30px;padding-top:12px;border-top:1px solid #d8d0b8;font-size:10px;color:#6b7280}
    .sign div{text-align:center;min-width:180px}
    .line{margin-top:22px;border-top:1px solid #6b7280}
    footer{margin-top:10px;text-align:center;font-size:9px;color:#9ca3af;line-height:1.6}
    .toolbar{position:sticky;bottom:0;display:flex;justify-content:center;gap:10px;padding:14px;background:linear-gradient(transparent,#efece1 40%)}
    .btn{border:0;border-radius:6px;padding:10px 22px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}
    .btn-print{background:#15803d;color:#fff}
    .btn-close{background:#4b5563;color:#fff}
    @media print{
      @page{size:A4 portrait;margin:10mm}
      body{background:#fff;padding:0}
      .sheet{max-width:none;border:0;border-radius:0;box-shadow:none;padding:0;background:#fff}
      .toolbar{display:none!important}
      .section,.stmt,.pl{page-break-inside:avoid}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    }
  </style>
</head>
<body>
<div class="sheet">
  <header class="head">
    <div class="brand">
      ${shop.logo ? `<img class="logo" src="${escHtml(shop.logo)}" alt=""/>` : ""}
      <div>
        <div class="shop">${escHtml(shop.name)}</div>
        <h1>व्यापार चिट्ठा</h1>
        <p class="sub">Balance Sheet · स्थिति: ${fmtDay(asOn)} · अवधि: ${fmtDay(from)} – ${fmtDay(to)}</p>
      </div>
    </div>
    <div class="meta">
      <div>दिनांक: ${fmtDay(today)}</div>
      ${shop.mobile ? `<div>मोबाइल: ${escHtml(shop.mobile)}</div>` : ""}
      ${shop.gstin ? `<div>GSTIN: ${escHtml(shop.gstin)}</div>` : ""}
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><div class="lbl">कुल संपत्ति</div><div class="val green">${money(statement.totalAssets)}</div></div>
    <div class="kpi"><div class="lbl">कुल देनदारी</div><div class="val ink">${money(statement.totalLiabilities)}</div></div>
    <div class="kpi"><div class="lbl">पूंजी (शुद्ध मूल्य)</div><div class="val ${statement.capital >= 0 ? "blue" : "red"}">${money(statement.capital)}</div></div>
    <div class="kpi"><div class="lbl">शुद्ध लाभ (अवधि)</div><div class="val ${summary.netProfit >= 0 ? "green" : "red"}">${money(summary.netProfit)}</div></div>
  </div>

  <div class="stmt">
    <div class="cols">
      <div class="col">
        <h3>संपत्ति (Assets)</h3>
        ${statementRows(statement.assets)}
        <div class="tot"><span>कुल संपत्ति</span><span>${money(statement.totalAssets)}</span></div>
      </div>
      <div class="col">
        <h3>देनदारी (Liabilities)</h3>
        ${statementRows(statement.liabilities)}
        <div class="tot"><span>कुल देनदारी</span><span>${money(statement.totalLiabilities)}</span></div>
        <div class="sub2"><span>पूंजी (Net Worth)</span><span>${money(statement.capital)}</span></div>
        <div class="tot"><span>कुल (देनदारी + पूंजी)</span><span>${money(
          statement.totalLiabilities + statement.capital
        )}</span></div>
      </div>
    </div>
    <div class="note">संपत्ति = देनदारी + पूंजी. नकद/बैंक शेष अनुमानित है (owner capital/drawings और paid-purchase records se bahar).</div>
  </div>

  <div class="pl">
    <div class="row">
      <span>आय: <b class="green">${money(summary.totalIncome)}</b></span>
      <span>व्यय: <b>${money(summary.totalExpenses)}</b></span>
      <span>शुद्ध लाभ: <b class="${summary.netProfit >= 0 ? "green" : "red"}">${money(
        summary.netProfit
      )}</b></span>
    </div>
    ${prevLine}
  </div>

  <div class="details">
    ${detailTable(
      "ग्राहक लेजर",
      [
        { label: "ग्राहक" },
        { label: "पिछला", num: true },
        { label: "मरम्मत", num: true },
        { label: "बिक्री", num: true },
        { label: "भुगतान", num: true },
        { label: "बैलेंस", num: true },
      ],
      customerRows,
      {
        total: [
          `कुल (${data.customerLedger.length})`,
          customerTotals[0],
          customerTotals[1],
          customerTotals[2],
          customerTotals[3],
          customerTotals[4],
        ],
      }
    )}
    ${detailTable(
      "मैकेनिक लेजर",
      [
        { label: "मैकेनिक" },
        { label: "दिन", num: true },
        { label: "वेतन", num: true },
        { label: "कमीशन", num: true },
        { label: "अग्रिम", num: true },
        { label: "बकाया", num: true },
      ],
      mechanicRows,
      {
        total: [
          `कुल (${data.mechanicLedger.length})`,
          mechanicTotals[0],
          mechanicTotals[1],
          mechanicTotals[2],
          mechanicTotals[3],
          mechanicTotals[4],
        ],
      }
    )}
    ${detailTable(
      "क्लाइंट लोन (दिए गए)",
      [
        { label: "ग्राहक" },
        { label: "तारीख" },
        { label: "कुल देय", num: true },
        { label: "जमा", num: true },
        { label: "बाकी", num: true },
      ],
      clientLoanRows,
      {
        total: [
          `कुल (${data.clientLoanLedger.length})`,
          "",
          clientLoanTotal[0],
          clientLoanTotal[1],
          clientLoanTotal[2],
        ],
        empty: "कोई सक्रिय क्लाइंट लोन नहीं",
      }
    )}
    ${detailTable(
      "स्टॉक",
      [
        { label: "प्रोडक्ट" },
        { label: "स्टॉक इन", num: true },
        { label: "बिका", num: true },
        { label: "शेष", num: true },
        { label: "मूल्य", num: true },
      ],
      stockRows,
      { total: [`कुल (${data.stockInventory.length})`, "", "", "", stockTotal] }
    )}
    ${detailTable("आय", [{ label: "विवरण" }, { label: "राशि", num: true }], incomeRows, {
      total: incomeTotal,
    })}
    ${detailTable("व्यय", [{ label: "श्रेणी" }, { label: "राशि", num: true }], expenseRows, {
      total: expenseTotal,
    })}
    ${detailTable(
      "लेंडर लोन",
      [
        { label: "लेंडर" },
        { label: "लोन", num: true },
        { label: "चुकाया", num: true },
        { label: "बकाया", num: true },
      ],
      loanRows,
      {
        total: [`कुल (${data.loanLedger.length})`, loanTotals[0], loanTotals[1], loanTotals[2]],
        empty: "कोई लोन नहीं",
      }
    )}
    ${detailTable(
      "नकद/बैंक (अनुमानित)",
      [{ label: "विवरण" }, { label: "राशि", num: true }],
      cashRows,
      {
        total: ["शेष (जमा − खर्च)", cashFlow.balance],
        empty: "कोई नकद गतिविधि नहीं",
      }
    )}
  </div>

  <div class="sign">
    <div><div class="line"></div>हस्ताक्षर / Signature</div>
    <div><div class="line"></div>दिनांक / Date</div>
  </div>

  <footer>
    ${escHtml(shop.name)}${shop.address ? ` · ${escHtml(shop.address)}` : ""}${
      shop.mobile ? ` · ${escHtml(shop.mobile)}` : ""
    }<br/>
    यह चिट्ठा कारोबार के दर्ज रिकॉर्ड पर आधारित है · संपत्ति = देनदारी + पूंजी
  </footer>
</div>
<div class="toolbar">
  <button onclick="window.print()" class="btn btn-print">🖨 प्रिंट करें</button>
  <button onclick="window.close()" class="btn btn-close">✕ बंद करें</button>
</div>
<script>
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "p") { e.preventDefault(); window.print(); }
  if (e.key === "Escape") window.close();
});
</script>
</body>
</html>`;

  return printHtmlResponse(html);
}
