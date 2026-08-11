import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireStaff, UNAUTHORIZED } from '@/lib/api-auth';

export async function GET(request: Request) {
  if (!(await requireStaff())) return UNAUTHORIZED();

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'Missing from or to date' }, { status: 400 });
  }

  // PHP-style date handling (local time)
  const from = `${fromParam}T00:00:00+05:30`;
  const to = `${toParam}T23:59:59+05:30`;
  const toDay = toParam;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  try {
    type DbRow = ReturnType<typeof JSON.parse>;
    const makeQuery = (table: string, select: string) => supabase.from(table).select(select);
    type Query = ReturnType<typeof makeQuery>;
    const fetchList = async (table: string, select: string, builder: (q: Query) => Query) => {
      const list: DbRow[] = [];
      let page = 0;
      while (true) {
        let q = makeQuery(table, select);
        q = builder(q);
        const { data, error } = await q.range(page * 1000, (page + 1) * 1000 - 1);
        if (error) console.error(error);
        if (data) list.push(...data);
        if (!data || data.length < 1000) break;
        page++;
      }
      return list;
    };

    const [clients, mechanics, products, lenders, salaryHistory] = await Promise.all([
      fetchList('client_list', 'id, firstname, middlename, lastname, contact, opening_balance', q => q.eq('delete_flag', 0)),
      fetchList('mechanic_list', 'id, firstname, middlename, lastname, daily_salary, commission_percent', q => q.eq('delete_flag', 0)),
      fetchList('product_list', 'id, name, description, price', q => q.eq('delete_flag', 0)),
      fetchList('lender_list', '*', q => q),
      fetchList('mechanic_salary_history', 'mechanic_id, salary, effective_date', q => q),
    ]);

    const [
      custTxns, incomeRepairs,
      allPayments, periodPayments,
      allAttendance, periodAttendance,
      allAdvances, periodAdvances,
      inventory, walkinSales, clientSales, directSaleItems,
      transactionProducts,
      periodExpenses, loanPayments
    ] = await Promise.all([
      fetchList('transaction_list', 'id, client_name, amount, date_created, status', q => q.in('status', [3, 5])),
      fetchList('transaction_list', 'id, amount, date_completed, mechanic_id, mechanic_commission_amount', q => q.eq('status', 5).gte('date_completed', from).lte('date_completed', to)),
      fetchList('client_payments', 'id, client_id, amount, discount, payment_date', q => q),
      fetchList('client_payments', 'id, client_id, amount, discount, payment_date', q => q.gte('payment_date', from).lte('payment_date', to)),
      fetchList('attendance_list', 'mechanic_id, curr_date, status', q => q),
      fetchList('attendance_list', 'mechanic_id, curr_date, status', q => q.in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to)),
      fetchList('advance_payments', 'mechanic_id, amount, date_paid', q => q),
      fetchList('advance_payments', 'mechanic_id, amount, date_paid', q => q.gte('date_paid', from).lte('date_paid', to)),
      fetchList('inventory_list', 'product_id, quantity, stock_date', q => q),
      fetchList('direct_sales', 'id, total_amount, date_created', q => q.or('client_id.is.null,client_id.eq.0')),
      fetchList('direct_sales', 'id, total_amount, date_created, client_id', q => q.not('client_id', 'is', null).neq('client_id', 0)),
      fetchList('direct_sale_items', 'product_id, qty, sale_id', q => q),
      fetchList('transaction_products', 'transaction_id, product_id, qty', q => q),
      fetchList('expense_list', 'category, amount, date_created', q => q.gte('date_created', from).lte('date_created', to)),
      fetchList('loan_payments', 'lender_id, amount_paid, payment_date', q => q)
    ]);

    const mechanicMap: Record<number, { daily_salary?: number }> = {};
    (mechanics || []).forEach((m) => { mechanicMap[m.id] = m; });

    const historyByMech: Record<number, { effective_date: string; salary: number }[]> = {};
    (salaryHistory || []).forEach((h) => {
      const mid = Number(h.mechanic_id);
      if (!historyByMech[mid]) historyByMech[mid] = [];
      historyByMech[mid].push({ effective_date: h.effective_date, salary: Number(h.salary) || 0 });
    });
    Object.values(historyByMech).forEach((arr) => arr.sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1)));

    const historyRateFor = (mechanicId: number, date: string): number | null => {
      const arr = historyByMech[mechanicId];
      if (!arr || !arr.length) return null;
      let rate: number | null = null;
      for (const h of arr) {
        if (h.effective_date <= date) rate = h.salary;
        else break;
      }
      return rate;
    };

    // â”€â”€ Customer ledger â”€â”€
    const prevTxnsMap: Record<number, { amount: number; count: number }> = {};
    const periodTxnsMap: Record<number, { amount: number; count: number }> = {};
    (custTxns || []).forEach((t) => {
      const cid = parseInt(t.client_name);
      if (isNaN(cid)) return;
      if (t.date_created < from) {
        prevTxnsMap[cid] = prevTxnsMap[cid] || { amount: 0, count: 0 };
        prevTxnsMap[cid].amount += Number(t.amount) || 0;
        prevTxnsMap[cid].count++;
      } else if (t.date_created <= to) {
        periodTxnsMap[cid] = periodTxnsMap[cid] || { amount: 0, count: 0 };
        periodTxnsMap[cid].amount += Number(t.amount) || 0;
        periodTxnsMap[cid].count++;
      }
    });

    const prevPmtsMap: Record<number, number> = {};
    (allPayments || []).forEach((p) => {
      if (p.payment_date < from) {
        prevPmtsMap[p.client_id] = (prevPmtsMap[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0);
      }
    });

    const periodPmtsMap: Record<number, { amount: number; discount: number }> = {};
    (periodPayments || []).forEach((p) => {
      if (!periodPmtsMap[p.client_id]) periodPmtsMap[p.client_id] = { amount: 0, discount: 0 };
      periodPmtsMap[p.client_id].amount += Number(p.amount) || 0;
      periodPmtsMap[p.client_id].discount += Number(p.discount) || 0;
    });

    const periodSalesMap: Record<number, number> = {};
    (clientSales || []).forEach((s) => {
      if (s.date_created >= from && s.date_created <= to) {
        periodSalesMap[s.client_id] = (periodSalesMap[s.client_id] || 0) + (Number(s.total_amount) || 0);
      }
    });

    const customerLedger = (clients || [])
      .map((c) => {
        const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ');
        const prev = prevTxnsMap[c.id];
        const period = periodTxnsMap[c.id];
        const pmt = periodPmtsMap[c.id];
        const openingBal = (Number(c.opening_balance) || 0) + (prev?.amount || 0) - (prevPmtsMap[c.id] || 0);
        const repairAmt = period?.amount || 0;
        const salesAmt = periodSalesMap[c.id] || 0;
        const paymentAmt = pmt?.amount || 0;
        const discountAmt = pmt?.discount || 0;
        const currentBal = openingBal + repairAmt + salesAmt - paymentAmt - discountAmt;
        return {
          client_id: c.id,
          customer_name: name,
          contact: c.contact,
          opening_balance: openingBal,
          total_repair_amount: repairAmt,
          total_sales: salesAmt,
          total_payment: paymentAmt,
          total_discount: discountAmt,
          current_balance: currentBal,
          previous_transactions: prev?.count || 0,
          total_jobs: period?.count || 0,
        };
      })
      .filter((c) => c.opening_balance !== 0 || c.total_repair_amount > 0 || c.total_sales > 0 || c.total_payment > 0)
      .sort((a, b) => (a.customer_name < b.customer_name ? -1 : a.customer_name > b.customer_name ? 1 : 0));

    // â”€â”€ Mechanic / staff ledger â”€â”€
    const allAttMap: Record<number, { full: number; half: number }> = {};
    (allAttendance || []).forEach((a) => {
      if ((a.status !== 1 && a.status !== 3) || a.curr_date > to) return;
      if (!allAttMap[a.mechanic_id]) allAttMap[a.mechanic_id] = { full: 0, half: 0 };
      if (a.status === 1) allAttMap[a.mechanic_id].full++;
      else allAttMap[a.mechanic_id].half++;
    });

    const periodAttMap: Record<number, { full: number; half: number }> = {};
    (periodAttendance || []).forEach((a) => {
      if (!periodAttMap[a.mechanic_id]) periodAttMap[a.mechanic_id] = { full: 0, half: 0 };
      if (a.status === 1) periodAttMap[a.mechanic_id].full++;
      else periodAttMap[a.mechanic_id].half++;
    });

    const allAdvMap: Record<number, number> = {};
    (allAdvances || []).forEach((a) => {
      if (a.date_paid > to) return;
      allAdvMap[a.mechanic_id] = (allAdvMap[a.mechanic_id] || 0) + (Number(a.amount) || 0);
    });

    const periodAdvMap: Record<number, number> = {};
    (periodAdvances || []).forEach((a) => {
      periodAdvMap[a.mechanic_id] = (periodAdvMap[a.mechanic_id] || 0) + (Number(a.amount) || 0);
    });

    const commMap: Record<number, number> = {};
    (incomeRepairs || []).forEach((t) => {
      commMap[t.mechanic_id] = (commMap[t.mechanic_id] || 0) + (Number(t.mechanic_commission_amount) || 0);
    });

    const mechanicLedger = (mechanics || [])
      .map((m) => {
        const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(' ');
        const salary = Number(m.daily_salary) || 0;
        const daysAll = (allAttMap[m.id]?.full || 0) + (allAttMap[m.id]?.half || 0) * 0.5;
        const daysPeriod = (periodAttMap[m.id]?.full || 0) + (periodAttMap[m.id]?.half || 0) * 0.5;
        const totalAdv = allAdvMap[m.id] || 0;
        const advPeriodAmt = periodAdvMap[m.id] || 0;
        const totalSalary = daysAll * salary;
        const salaryPeriod = daysPeriod * salary;
        const balance = totalSalary - totalAdv;
        return {
          mechanic_id: m.id,
          mechanic_name: name,
          daily_salary: salary,
          commission_percent: Number(m.commission_percent) || 0,
          total_advance_amount: totalAdv,
          advance_in_period: advPeriodAmt,
          total_days_worked: daysAll,
          days_worked_in_period: daysPeriod,
          total_salary_due: totalSalary,
          salary_due_in_period: salaryPeriod,
          period_commission: commMap[m.id] || 0,
          balance_amount: balance,
        };
      })
      .filter((m) => m.balance_amount !== 0 || m.days_worked_in_period > 0);

    // â”€â”€ Stock inventory â”€â”€
    const txnMap: Record<number, { status: number; date_created: string }> = {};
    (custTxns || []).forEach((t) => {
      txnMap[t.id] = { status: t.status, date_created: t.date_created };
    });

    const saleDateMap: Record<number, string> = {};
    [...(walkinSales || []), ...(clientSales || [])].forEach((s) => {
      saleDateMap[s.id] = s.date_created;
    });

    const stockInMap: Record<number, number> = {};
    (inventory || []).forEach((i) => {
      if (i.stock_date && i.stock_date <= toDay) {
        stockInMap[i.product_id] = (stockInMap[i.product_id] || 0) + (Number(i.quantity) || 0);
      }
    });

    const dsAllMap: Record<number, number> = {};
    const dsPeriodMap: Record<number, number> = {};
    (directSaleItems || []).forEach((item) => {
      const sd = saleDateMap[item.sale_id];
      if (!sd) return;
      dsAllMap[item.product_id] = (dsAllMap[item.product_id] || 0) + (Number(item.qty) || 0);
      if (sd >= from && sd <= to) {
        dsPeriodMap[item.product_id] = (dsPeriodMap[item.product_id] || 0) + (Number(item.qty) || 0);
      }
    });

    const tpAllMap: Record<number, number> = {};
    const tpPeriodMap: Record<number, number> = {};
    (transactionProducts || []).forEach((tp) => {
      const tl = txnMap[tp.transaction_id];
      if (!tl || (tl.status !== 3 && tl.status !== 5)) return;
      tpAllMap[tp.product_id] = (tpAllMap[tp.product_id] || 0) + (Number(tp.qty) || 0);
      if (tl.date_created >= from && tl.date_created <= to) {
        tpPeriodMap[tp.product_id] = (tpPeriodMap[tp.product_id] || 0) + (Number(tp.qty) || 0);
      }
    });

    const stockInventory = (products || [])
      .map((p) => {
        const stockIn = stockInMap[p.id] || 0;
        const rawRemaining = stockIn - (dsAllMap[p.id] || 0) - (tpAllMap[p.id] || 0);
        const remaining = Math.max(0, rawRemaining);
        return {
          product_id: p.id,
          product_name: p.name,
          description: p.description || '',
          sale_price: Number(p.price) || 0,
          total_stock_in: stockIn,
          sold_quantity: (dsPeriodMap[p.id] || 0) + (tpPeriodMap[p.id] || 0),
          remaining_stock: remaining,
          stock_value: remaining * (Number(p.price) || 0),
        };
      })
      .filter((p) => p.total_stock_in > 0)
      .sort((a, b) => a.remaining_stock - b.remaining_stock);

    // â”€â”€ Income & expense â”€â”€
    const repairIncome = (incomeRepairs || []).reduce((s: number, t) => s + (Number(t.amount) || 0), 0);
    const walkinIncome = (walkinSales || []).filter((s) => s.date_created >= from && s.date_created <= to).reduce((s: number, t) => s + (Number(t.total_amount) || 0), 0);
    const clientSalesIncome = (clientSales || []).filter((s) => s.date_created >= from && s.date_created <= to).reduce((s: number, t) => s + (Number(t.total_amount) || 0), 0);
    const directSalesIncome = walkinIncome + clientSalesIncome;

    const incomeSummary = [
      { description: 'à¤°à¤¿à¤ªà¥‡à¤¯à¤° à¤†à¤¯ (Repair Income)', amount: repairIncome },
      { description: 'à¤µà¥‰à¤•-à¤‡à¤¨ à¤¬à¤¿à¤•à¥à¤°à¥€ (Walk-in Sales)', amount: walkinIncome },
      { description: 'à¤—à¥à¤°à¤¾à¤¹à¤• à¤¬à¤¿à¤•à¥à¤°à¥€ (Client Sales)', amount: clientSalesIncome },
      { description: 'à¤•à¥à¤² à¤¸à¥€à¤§à¥€ à¤¬à¤¿à¤•à¥à¤°à¥€ (Total Direct Sales)', amount: directSalesIncome },
    ];

    const expMap: Record<string, number> = {};
    (periodExpenses || []).forEach((e) => {
      expMap[e.category || 'Uncategorized'] = (expMap[e.category || 'Uncategorized'] || 0) + (Number(e.amount) || 0);
    });
    const expenseSummary = Object.entries(expMap).map(([k, v]) => ({ expense_category: k, amount: v }));

    // â”€â”€ Loan ledger â”€â”€
    const loanAllMap: Record<number, number> = {};
    const loanMap: Record<number, { prev: number; period: number; total: number }> = {};
    (loanPayments || []).forEach((p) => {
      const amt = Number(p.amount_paid) || 0;
      loanAllMap[p.lender_id] = (loanAllMap[p.lender_id] || 0) + amt;
      if (!loanMap[p.lender_id]) loanMap[p.lender_id] = { prev: 0, period: 0, total: 0 };
      if (p.payment_date < from) {
        loanMap[p.lender_id].prev += amt;
      } else if (p.payment_date <= to) {
        loanMap[p.lender_id].period += amt;
      }
      if (p.payment_date <= to) loanMap[p.lender_id].total += amt;
    });

    const loanLedger = (lenders || [])
      .filter((l) => l.start_date && l.start_date <= toDay)
      .map((l) => {
        const bal = (Number(l.loan_amount) || 0) - (loanMap[l.id]?.total || 0);
        const emi = Number(l.emi_amount) || 0;
        const remainingEmis = emi > 0 ? Math.ceil(((Number(l.loan_amount) || 0) - (loanAllMap[l.id] || 0)) / emi) : 0;
        const status = Number(l.status) === 1 ? 'à¤¸à¤•à¥à¤°à¤¿à¤¯' : Number(l.status) === 2 ? 'à¤ªà¥‚à¤°à¥à¤£' : 'à¤…à¤¨à¥à¤¯';
        return {
          lender_id: l.id,
          lender_name: l.fullname || l.name || 'Lender',
          contact: l.contact || '',
          loan_amount: Number(l.loan_amount) || 0,
          interest_rate: Number(l.interest_rate) || 0,
          emi_amount: emi,
          start_date: l.start_date || '',
          previous_payments: loanMap[l.id]?.prev || 0,
          paid_in_period: loanMap[l.id]?.period || 0,
          total_paid: loanMap[l.id]?.total || 0,
          balance_amount: bal,
          remaining_emis: remainingEmis,
          status,
        };
      })
      .filter((l) => l.total_paid > 0 || l.balance_amount > 0);

    const topCustomers = customerLedger
      .filter((c) => c.total_repair_amount > 0 || Math.abs(c.current_balance) > 0)
      .sort((a, b) => b.total_repair_amount - a.total_repair_amount)
      .slice(0, 10)
      .map((c) => ({
        client_id: c.client_id,
        customer_name: c.customer_name,
        contact: c.contact,
        previous_jobs: c.previous_transactions,
        total_jobs: c.total_jobs,
        total_amount: c.total_repair_amount,
        total_payment_amount: c.total_payment,
        opening_balance: c.opening_balance,
        current_balance: c.current_balance,
      }));

    // â”€â”€ Dashboard summary (PHP $bh equivalents) â”€â”€
    let salaryEarned = 0;
    (periodAttendance || []).forEach((a) => {
      const rate = historyRateFor(a.mechanic_id, a.curr_date) ?? (mechanicMap[a.mechanic_id] ? Number(mechanicMap[a.mechanic_id].daily_salary) || 0 : 0);
      salaryEarned += a.status === 3 ? rate / 2 : rate;
    });

    const commissionExpense = (incomeRepairs || []).reduce((s: number, t) => s + (Number(t.mechanic_commission_amount) || 0), 0);
    const shopExpense = expenseSummary.reduce((s: number, e) => s + e.amount, 0);
    const emiExpense = (loanPayments || []).filter((p) => p.payment_date >= from && p.payment_date <= to).reduce((s: number, p) => s + (Number(p.amount_paid) || 0), 0);
    const discountGiven = (periodPayments || []).reduce((s: number, p) => s + (Number(p.discount) || 0), 0);

    const totalIncome = repairIncome + directSalesIncome;
    const totalExpenses = salaryEarned + commissionExpense + shopExpense + emiExpense + discountGiven;
    const netProfit = totalIncome - totalExpenses;

    const totalStockValue = stockInventory.reduce((s: number, p) => s + p.stock_value, 0);
    const totalMechBalance = mechanicLedger.reduce((s: number, m) => s + m.balance_amount, 0);
    const totalLoanBalance = loanLedger.reduce((s: number, l) => s + l.balance_amount, 0);

    return NextResponse.json({
      customerLedger,
      mechanicLedger,
      stockInventory,
      incomeSummary,
      expenseSummary,
      loanLedger,
      topCustomers,
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        totalStockValue,
        totalMechBalance,
        totalLoanBalance,
        salaryEarned,
        commissionExpense,
        shopExpense,
        emiExpense,
        discountGiven,
        repairIncome,
        directSalesIncome,
        cashReceived: (periodPayments || []).reduce((s: number, p) => s + (Number(p.amount) || 0), 0),
      },
    });

  } catch (err) {
    console.error('Balance Sheet API error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
