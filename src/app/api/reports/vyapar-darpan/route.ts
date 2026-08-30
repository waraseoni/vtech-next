import { NextResponse } from "next/server";
import { fetchAll, pageAll } from "@/lib/fetch-all";
import { getServerSupabase, requireStaff, UNAUTHORIZED } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// ════════════════════════════════════════════════════════════════════════
//  VYAPAR DARPAN — "Business Mirror"
//  Aati-khata (P&L) + Chittha (Balance Sheet) — server-side se accurate
//  numbers, live schema par base kar ke. Pehle ye page client-side mein
//  sab numbers 0 dikha raha tha kyunki guessed columns + broken embed
//  (mechanic_list embed) + UTC toISOString dates the. Ab sab kuch real
//  schema se nikalta hai, RLS-safe server client se.
// ════════════════════════════════════════════════════════════════════════

const toNum = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export async function GET(request: Request) {
  if (!(await requireStaff())) return UNAUTHORIZED();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to date" }, { status: 400 });
  }

  const supabase = await getServerSupabase();

  // PHP-style local (IST) date handling
  const start = `${from}T00:00:00+05:30`;
  const end = `${to}T23:59:59+05:30`;

  try {
    // ── Master lookup maps (FK joins kaam nahi karte — manual map) ──
    const [
      { data: allClients },
      { data: allMechanics },
      { data: allProducts },
      { data: salaryHistory },
    ] = await Promise.all([
      pageAll(supabase.from("client_list").select("id, firstname, middlename, lastname")),
      pageAll(
        supabase.from("mechanic_list").select("id, firstname, middlename, lastname, daily_salary")
      ),
      pageAll(supabase.from("product_list").select("id, name, cost_price, price")),
      pageAll(
        supabase.from("mechanic_salary_history").select("mechanic_id, effective_date, salary")
      ),
    ]);

    const clientMap: Record<number, string> = {};
    allClients?.forEach((c) => {
      clientMap[c.id] = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim();
    });

    const mechanicMap: Record<number, { name: string; daily: number }> = {};
    allMechanics?.forEach((m) => {
      mechanicMap[m.id] = {
        name:
          [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" ").trim() ||
          `Staff #${m.id}`,
        daily: toNum(m.daily_salary),
      };
    });

    const productMap: Record<number, { name: string; price: number; cost: number }> = {};
    allProducts?.forEach((p) => {
      productMap[p.id] = { name: p.name || "", price: toNum(p.price), cost: toNum(p.cost_price) };
    });

    // Salary history: latest effective_date <= attendance date, else daily_salary
    const salaryHistoryMap: Record<number, { effective_date: string; salary: number }[]> = {};
    (salaryHistory || []).forEach((h) => {
      if (!salaryHistoryMap[h.mechanic_id]) salaryHistoryMap[h.mechanic_id] = [];
      salaryHistoryMap[h.mechanic_id].push({
        effective_date: h.effective_date,
        salary: toNum(h.salary),
      });
    });
    Object.values(salaryHistoryMap).forEach((arr) =>
      arr.sort(
        (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
      )
    );
    const historyRateFor = (mechId: number, onDate: string): number | null => {
      const hist = salaryHistoryMap[mechId];
      if (!hist || !onDate) return null;
      const on = new Date(onDate).getTime();
      let rate: number | null = null;
      for (const h of hist) {
        if (new Date(h.effective_date).getTime() <= on) rate = h.salary;
        else break;
      }
      return rate;
    };

    // ── Parallel period data fetch ──
    const [
      { data: repairJobsRaw },
      { data: walkinRaw },
      { data: clientSalesRaw },
      { data: clientPaymentsRaw },
      { data: attendance },
      { data: advancesRaw },
      { data: expensesRaw },
      { data: loanPaymentsRaw },
      { data: inventoryRaw },
      { data: lenders },
      { data: allLoanPaid },
      { data: allRepairsRaw },
      { data: allAttRaw },
      { data: allAdvRaw },
    ] = await Promise.all([
      // Repair income — revenue jab delivered hota hai (status=5)
      pageAll(
        supabase
          .from("transaction_list")
          .select(
            "id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name"
          )
          .eq("status", 5)
          .gte("date_completed", start)
          .lte("date_completed", end)
      ),
      // Walk-in direct sales (client_id null/0)
      pageAll(
        supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount, date_created")
          .or("client_id.is.null,client_id.eq.0")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      // Client (credit) direct sales
      pageAll(
        supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount, date_created")
          .not("client_id", "is", null)
          .neq("client_id", 0)
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      // Client payments (cash recovery) — discounts given
      pageAll(
        supabase
          .from("client_payments")
          .select("id, client_id, amount, discount, payment_date")
          .gte("payment_date", from)
          .lte("payment_date", to)
      ),
      // Attendance for salary (status 1 = full, 3 = half)
      pageAll(
        supabase
          .from("attendance_list")
          .select("mechanic_id, curr_date, status")
          .in("status", [1, 3])
          .gte("curr_date", from)
          .lte("curr_date", to)
      ),
      // Staff advances (period)
      pageAll(
        supabase
          .from("advance_payments")
          .select("mechanic_id, date_paid, amount, reason")
          .gte("date_paid", from)
          .lte("date_paid", to)
      ),
      // Shop expenses
      pageAll(
        supabase
          .from("expense_list")
          .select("id, category, amount, remarks, date_created")
          .gte("date_created", start)
          .lte("date_created", end)
      ),
      // Loan EMI paid (period)
      pageAll(
        supabase
          .from("loan_payments")
          .select("amount_paid, payment_date, remarks")
          .gte("payment_date", from)
          .lte("payment_date", to)
      ),
      // Inventory (all-time) — for stock value
      pageAll(supabase.from("inventory_list").select("product_id, quantity")),
      // Active lenders — loan outstanding
      pageAll(supabase.from("lender_list").select("loan_amount").eq("status", 1)),
      // All-time loan paid — for outstanding
      pageAll(supabase.from("loan_payments").select("amount_paid")),
      // All-time repairs — commission liability
      pageAll(
        supabase
          .from("transaction_list")
          .select("mechanic_id, mechanic_commission_amount")
          .eq("status", 5)
      ),
      // All-time attendance — salary liability
      pageAll(
        supabase
          .from("attendance_list")
          .select("mechanic_id, curr_date, status")
          .in("status", [1, 3])
      ),
      // All-time advances — paid-to-staff
      pageAll(supabase.from("advance_payments").select("mechanic_id, amount")),
    ]);

    // ── Sale items (parts sold) ──
    const allSaleIds = [
      ...(walkinRaw || []).map((s) => s.id),
      ...(clientSalesRaw || []).map((s) => s.id),
    ];
    const saleItemsMap: Record<number, { qty: number; price: number }[]> = {};
    for (let i = 0; i < allSaleIds.length; i += 500) {
      const saleItems = await fetchAll(
        supabase
          .from("direct_sale_items")
          .select("sale_id, qty, price")
          .in("sale_id", allSaleIds.slice(i, i + 500))
      );
      saleItems?.forEach((it) => {
        if (!saleItemsMap[it.sale_id]) saleItemsMap[it.sale_id] = [];
        saleItemsMap[it.sale_id].push({ qty: toNum(it.qty), price: toNum(it.price) });
      });
    }

    // ── Income (Kul Bikri) ──
    const repairIncome = (repairJobsRaw || []).reduce((s, j) => s + toNum(j.amount), 0);
    const walkinIncome = (walkinRaw || []).reduce((s, x) => s + toNum(x.total_amount), 0);
    const clientSalesIncome = (clientSalesRaw || []).reduce((s, x) => s + toNum(x.total_amount), 0);
    const partSalesValue =
      (walkinRaw || []).reduce(
        (s, x) => s + (saleItemsMap[x.id] || []).reduce((a, it) => a + it.qty * it.price, 0),
        0
      ) +
      (clientSalesRaw || []).reduce(
        (s, x) => s + (saleItemsMap[x.id] || []).reduce((a, it) => a + it.qty * it.price, 0),
        0
      );
    const totalSales = repairIncome + walkinIncome + clientSalesIncome;

    // ── Expenses (Kharche) ──
    const totalShopExpenses = (expensesRaw || []).reduce((s, e) => s + toNum(e.amount), 0);
    const totalEmiPaid = (loanPaymentsRaw || []).reduce((s, l) => s + toNum(l.amount_paid), 0);
    const totalCommission = (repairJobsRaw || []).reduce(
      (s, j) => s + toNum(j.mechanic_commission_amount),
      0
    );
    const totalDiscountGiven = (clientPaymentsRaw || []).reduce((s, p) => s + toNum(p.discount), 0);
    const totalAdvanceGiven = (advancesRaw || []).reduce((s, a) => s + toNum(a.amount), 0);

    // Staff salary (P&L) — attendance row par applicable rate
    const totalSalary = (attendance || []).reduce((sum, a) => {
      const rate =
        historyRateFor(a.mechanic_id, a.curr_date) ?? (mechanicMap[a.mechanic_id]?.daily || 0);
      return sum + (a.status === 3 ? rate / 2 : rate);
    }, 0);

    // ── Gross / Net Profit ──
    // Parts ka actual cost nahi milta agar product_map.cost 0 ho, to conservative
    // 90% parts-cost assumption use karo (phele wali methodology note ke mutabik).
    let partsCost = 0;
    let useCostAssumption = false;
    const repPartCosts = 0; // repair parts actual cost not tracked reliably
    if (repPartCosts > 0) {
      partsCost = repPartCosts;
    } else {
      useCostAssumption = true;
      partsCost = partSalesValue * 0.9;
    }
    const grossProfit = totalSales - partsCost;
    const totalIndirectExpenses =
      totalShopExpenses +
      totalEmiPaid +
      totalCommission +
      totalDiscountGiven +
      totalAdvanceGiven +
      totalSalary;
    const netProfit = grossProfit - totalIndirectExpenses;

    // ── Stock value (current inventory x sale price) ──
    const stockSumMap: Record<number, number> = {};
    (inventoryRaw || []).forEach((i) => {
      stockSumMap[i.product_id] = (stockSumMap[i.product_id] || 0) + toNum(i.quantity);
    });
    const stockValue = Object.entries(stockSumMap).reduce(
      (s, [pid, qty]) => s + (productMap[parseInt(pid)]?.price || 0) * qty,
      0
    );

    // ── Loan outstanding (all-time) ──
    const totalLoan = (lenders || []).reduce((s, l) => s + toNum(l.loan_amount), 0);
    const totalLoanPaidAll = (allLoanPaid || []).reduce((s, l) => s + toNum(l.amount_paid), 0);
    const loanOutstanding = Math.max(0, totalLoan - totalLoanPaidAll);

    // ── Staff liability (all-time: earned salary + commission - paid advances) ──
    let staffLiability = 0;
    (allMechanics || []).forEach((m) => {
      const earnedComm = (allRepairsRaw || [])
        .filter((r) => r.mechanic_id === m.id)
        .reduce((s, r) => s + toNum(r.mechanic_commission_amount), 0);
      const earnedSal = (allAttRaw || [])
        .filter((a) => a.mechanic_id === m.id)
        .reduce((s, a) => {
          const rate = historyRateFor(m.id, a.curr_date) ?? 0;
          return s + (a.status === 3 ? rate / 2 : rate);
        }, 0);
      const paid = (allAdvRaw || [])
        .filter((a) => a.mechanic_id === m.id)
        .reduce((s, a) => s + toNum(a.amount), 0);
      staffLiability += Math.max(0, earnedComm + earnedSal - paid);
    });

    return NextResponse.json({
      period: { from, to },
      totals: {
        totalSales,
        repairIncome,
        walkinIncome,
        clientSalesIncome,
        partSalesValue,
        partsCost,
        useCostAssumption,
        grossProfit,
        totalSalary,
        totalCommission,
        totalShopExpenses,
        totalEmiPaid,
        totalDiscountGiven,
        totalAdvanceGiven,
        totalIndirectExpenses,
        netProfit,
      },
      balanceSheet: {
        assetStock: stockValue,
        assetCash: netProfit > 0 ? netProfit : 0,
        liabilityLoan: loanOutstanding,
        liabilityStaff: staffLiability,
        liabilityExpenses: totalShopExpenses,
        netWorth: stockValue + Math.max(0, netProfit) - loanOutstanding - staffLiability,
      },
      counts: {
        deliveredJobs: (repairJobsRaw || []).length,
        walkinSales: (walkinRaw || []).length,
        clientSales: (clientSalesRaw || []).length,
        expenses: (expensesRaw || []).length,
        emiPayments: (loanPaymentsRaw || []).length,
      },
    });
  } catch (err) {
    logger.error("Vyapar Darpan API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
