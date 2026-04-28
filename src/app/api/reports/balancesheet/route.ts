import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: 'Missing from or to date' }, { status: 400 });
  }

  // PHP-style date handling (local time)
  const from = `${fromParam}T00:00:00+05:30`;
  const to = `${toParam}T23:59:59+05:30`;

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
    const [
      { data: clients },
      { data: mechanics },
      { data: products },
      { data: lenders },
    ] = await Promise.all([
      supabase.from('client_list').select('id, firstname, middlename, lastname, contact, opening_balance').eq('delete_flag', 0),
      supabase.from('mechanic_list').select('id, firstname, middlename, lastname, salary_per_day, commission_percent').eq('delete_flag', 0),
      supabase.from('product_list').select('id, name, description, price').eq('delete_flag', 0),
      supabase.from('lender_list').select('*').eq('delete_flag', 0),
    ]);

    const [
      allTxnsRes,
      periodTxnsRes,
      allPaymentsRes,
      periodPaymentsRes,
      allAttendanceRes,
      periodAttendanceRes,
      allAdvancesRes,
      periodAdvancesRes,
      inventoryRes,
      walkinSalesRes,
      clientSalesRes,
      directSaleItemsRes,
      allExpensesRes,
      periodExpensesRes,
      loanPaymentsRes,
    ] = await Promise.all([
      // All repairs (for opening balance) - matching PHP (no del_status filter)
      supabase.from('transaction_list').select('id, client_name, amount, date_completed, status').eq('status', 5),
      // Period repairs - matching PHP (no del_status filter)
      supabase.from('transaction_list').select('id, client_name, amount, date_completed, status').eq('status', 5).gte('date_completed', from).lte('date_completed', to),
      // All payments (for opening balance)
      supabase.from('client_payments').select('id, client_id, amount, discount, payment_date'),
      // Period payments
      supabase.from('client_payments').select('id, client_id, amount, discount, payment_date').gte('payment_date', from).lte('payment_date', to),
      // All attendance
      supabase.from('attendance_list').select('mechanic_id, curr_date, status'),
      // Period attendance
      supabase.from('attendance_list').select('mechanic_id, curr_date, status').in('status', [1, 3]).gte('curr_date', from).lte('curr_date', to),
      // All advances
      supabase.from('advance_payments').select('mechanic_id, amount, date_paid'),
      // Period advances
      supabase.from('advance_payments').select('mechanic_id, amount, date_paid').gte('date_paid', from).lte('date_paid', to),
      // Inventory
      supabase.from('inventory_list').select('product_id, quantity'),
      // Walk-in sales (no client_id or client_id = 0)
      supabase.from('direct_sales').select('id, total_amount, date_created').or('client_id.is.null,client_id.eq.0'),
      // Client sales (has client_id and not 0)
      supabase.from('direct_sales').select('id, total_amount, date_created, client_id').not('client_id', 'is', null).neq('client_id', 0),
      // Sale items
      supabase.from('direct_sale_items').select('product_id, qty, sale_id'),
      // All expenses
      supabase.from('expense_list').select('category, amount, date_created'),
      // Period expenses
      supabase.from('expense_list').select('category, amount, date_created').gte('date_created', from).lte('date_created', to),
      // Loan payments
      supabase.from('loan_payments').select('lender_id, amount_paid, payment_date'),
    ]);

    const allTxns = allTxnsRes.data || [];
    const periodTxns = periodTxnsRes.data || [];
    const allPayments = allPaymentsRes.data || [];
    const periodPayments = periodPaymentsRes.data || [];
    const allAttendance = allAttendanceRes.data || [];
    const periodAttendance = periodAttendanceRes.data || [];
    const allAdvances = allAdvancesRes.data || [];
    const periodAdvances = periodAdvancesRes.data || [];
    const inventory = inventoryRes.data || [];
    const walkinSales = walkinSalesRes.data || [];
    const clientSales = clientSalesRes.data || [];
    const directSaleItems = directSaleItemsRes.data || [];
    const allExpenses = allExpensesRes.data || [];
    const periodExpenses = periodExpensesRes.data || [];
    const loanPayments = loanPaymentsRes.data || [];

    const clientMap: Record<number, any> = {};
    (clients || []).forEach((c: any) => {
      clientMap[c.id] = c;
    });

    const mechanicMap: Record<number, any> = {};
    (mechanics || []).forEach((m: any) => {
      mechanicMap[m.id] = m;
    });

    const productMap: Record<number, any> = {};
    (products || []).forEach((p: any) => {
      productMap[p.id] = p;
    });

    const lenderMap: Record<number, any> = {};
    (lenders || []).forEach((l: any) => {
      lenderMap[l.id] = l;
    });

    const prevTxnsMap: Record<number, number> = {};
    (allTxns || []).forEach((t: any) => {
      if (t.date_completed && t.date_completed < from) {
        const cid = parseInt(t.client_name);
        if (!isNaN(cid)) {
          prevTxnsMap[cid] = (prevTxnsMap[cid] || 0) + (Number(t.amount) || 0);
        }
      }
    });

    const periodTxnsMap: Record<number, { amount: number; count: number }> = {};
    (periodTxns || []).forEach((t: any) => {
      const cid = parseInt(t.client_name);
      if (!isNaN(cid)) {
        if (!periodTxnsMap[cid]) periodTxnsMap[cid] = { amount: 0, count: 0 };
        periodTxnsMap[cid].amount += Number(t.amount) || 0;
        periodTxnsMap[cid].count++;
      }
    });

    const prevPmtsMap: Record<number, number> = {};
    (allPayments || []).forEach((p: any) => {
      if (p.payment_date < from) {
        prevPmtsMap[p.client_id] = (prevPmtsMap[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0);
      }
    });

    const periodPmtsMap: Record<number, number> = {};
    (periodPayments || []).forEach((p: any) => {
      periodPmtsMap[p.client_id] = (periodPmtsMap[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0);
    });

    const customerLedger = (clients || [])
      .map((c: any) => {
        const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ');
        const openingBal = (Number(c.opening_balance) || 0) + (prevTxnsMap[c.id] || 0) - (prevPmtsMap[c.id] || 0);
        const repairAmt = periodTxnsMap[c.id]?.amount || 0;
        const paymentAmt = periodPmtsMap[c.id] || 0;
        const currentBal = openingBal + repairAmt - paymentAmt;
        const prevCount = Object.values(prevTxnsMap).length;
        const periodCount = periodTxnsMap[c.id]?.count || 0;
        return {
          client_id: c.id,
          customer_name: name,
          contact: c.contact,
          opening_balance: openingBal,
          total_repair_amount: repairAmt,
          total_payment: paymentAmt,
          current_balance: currentBal,
          previous_transactions: prevCount,
          total_jobs: periodCount,
        };
      })
      .filter((c: any) => c.total_repair_amount > 0 || c.total_payment > 0 || Math.abs(c.current_balance) > 0.01)
      .sort((a: any, b: any) => b.total_repair_amount - a.total_repair_amount);

    const allAttMap: Record<number, { full: number; half: number }> = {};
    (allAttendance || []).filter((a: any) => a.status === 1 || a.status === 3).forEach((a: any) => {
      if (!allAttMap[a.mechanic_id]) allAttMap[a.mechanic_id] = { full: 0, half: 0 };
      if (a.status === 1) allAttMap[a.mechanic_id].full++;
      else allAttMap[a.mechanic_id].half++;
    });

    const periodAttMap: Record<number, { full: number; half: number }> = {};
    (periodAttendance || []).forEach((a: any) => {
      if (!periodAttMap[a.mechanic_id]) periodAttMap[a.mechanic_id] = { full: 0, half: 0 };
      if (a.status === 1) periodAttMap[a.mechanic_id].full++;
      else periodAttMap[a.mechanic_id].half++;
    });

    const allAdvMap: Record<number, number> = {};
    (allAdvances || []).forEach((a: any) => {
      allAdvMap[a.mechanic_id] = (allAdvMap[a.mechanic_id] || 0) + (Number(a.amount) || 0);
    });

    const periodAdvMap: Record<number, number> = {};
    (periodAdvances || []).forEach((a: any) => {
      periodAdvMap[a.mechanic_id] = (periodAdvMap[a.mechanic_id] || 0) + (Number(a.amount) || 0);
    });

    const mechanicLedger = (mechanics || [])
      .map((m: any) => {
        const name = [m.firstname, m.middlename, m.lastname].filter(Boolean).join(' ');
        const salary = Number(m.salary_per_day) || 0;
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
          balance_amount: balance,
        };
      })
      .filter((m: any) => m.days_worked_in_period > 0 || m.balance_amount !== 0);

    const stockSumMap: Record<number, number> = {};
    (inventory || []).forEach((i: any) => {
      stockSumMap[i.product_id] = (stockSumMap[i.product_id] || 0) + (Number(i.quantity) || 0);
    });

    const directSaleByProduct: Record<number, number> = {};
    const allDirectSales = [...(walkinSales || []), ...(clientSales || [])];
    (directSaleItems || []).forEach((item: any) => {
      const sale = allDirectSales.find((s: any) => s.id === item.sale_id);
      if (sale && sale.date_created >= from && sale.date_created <= to) {
        directSaleByProduct[item.product_id] = (directSaleByProduct[item.product_id] || 0) + (Number(item.qty) || 0);
      }
    });

    const stockInventory = (products || [])
      .map((p: any) => {
        const stockIn = stockSumMap[p.id] || 0;
        const soldDs = directSaleByProduct[p.id] || 0;
        const remaining = stockIn - soldDs;
        return {
          product_id: p.id,
          product_name: p.name,
          description: p.description || '',
          sale_price: Number(p.price) || 0,
          total_stock_in: stockIn,
          sold_quantity: soldDs,
          remaining_stock: remaining,
          stock_value: remaining * (Number(p.price) || 0),
        };
      })
      .filter((p: any) => p.total_stock_in > 0 || p.sold_quantity > 0);

    const repairIncome = (periodTxns || []).reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
    const walkinIncome = (walkinSales || []).filter((s: any) => s.date_created >= from && s.date_created <= to).reduce((s: number, t: any) => s + (Number(t.total_amount) || 0), 0);
    const clientSalesIncome = (clientSales || []).filter((s: any) => s.date_created >= from && s.date_created <= to).reduce((s: number, t: any) => s + (Number(t.total_amount) || 0), 0);
    const directSalesIncome = walkinIncome + clientSalesIncome;

    const incomeSummary = [
      { description: 'रिपेयर आय (Repair Income)', amount: repairIncome },
      { description: 'वॉक-इन बिक्री (Walk-in Sales)', amount: walkinIncome },
      { description: 'ग्राहक बिक्री (Client Sales)', amount: clientSalesIncome },
      { description: 'कुल सीधी बिक्री (Total Direct Sales)', amount: directSalesIncome },
    ];

    const expMap: Record<string, number> = {};
    (periodExpenses || []).forEach((e: any) => {
      expMap[e.category || 'Uncategorized'] = (expMap[e.category || 'Uncategorized'] || 0) + (Number(e.amount) || 0);
    });
    const expenseSummary = Object.entries(expMap).map(([k, v]) => ({ expense_category: k, amount: v }));

    const loanMap: Record<number, { prev: number; period: number; total: number }> = {};
    (loanPayments || []).forEach((p: any) => {
      if (!loanMap[p.lender_id]) loanMap[p.lender_id] = { prev: 0, period: 0, total: 0 };
      loanMap[p.lender_id].total += Number(p.amount_paid) || 0;
      if (p.payment_date >= from && p.payment_date <= to) {
        loanMap[p.lender_id].period += Number(p.amount_paid) || 0;
      } else if (p.payment_date < from) {
        loanMap[p.lender_id].prev += Number(p.amount_paid) || 0;
      }
    });

    const loanLedger = (lenders || [])
      .map((l: any) => {
        const bal = (Number(l.loan_amount) || 0) - (loanMap[l.id]?.total || 0);
        const emi = Number(l.emi_amount) || 0;
        const remainingEmis = emi > 0 ? Math.ceil(bal / emi) : 0;
        return {
          lender_id: l.id,
          lender_name: l.fullname || l.name || 'Lender',
          loan_amount: Number(l.loan_amount) || 0,
          interest_rate: Number(l.interest_rate) || 0,
          emi_amount: emi,
          start_date: l.start_date || '',
          previous_payments: loanMap[l.id]?.prev || 0,
          paid_in_period: loanMap[l.id]?.period || 0,
          total_paid: loanMap[l.id]?.total || 0,
          balance_amount: bal,
          remaining_emis: remainingEmis,
          status: bal > 0 ? 'सक्रिय' : 'समाप्त',
        };
      })
      .filter((l: any) => l.paid_in_period > 0 || l.balance_amount > 0);

    const topCustomers = customerLedger
      .filter((c: any) => c.total_repair_amount > 0 || Math.abs(c.current_balance) > 0)
      .sort((a: any, b: any) => b.total_repair_amount - a.total_repair_amount)
      .slice(0, 10)
      .map((c: any) => ({
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

    return NextResponse.json({
      customerLedger,
      mechanicLedger,
      stockInventory,
      incomeSummary,
      expenseSummary,
      loanLedger,
      topCustomers,
      summary: {
        totalIncome: repairIncome + directSalesIncome,
        totalExpenses: expenseSummary.reduce((s: number, e: any) => s + e.amount, 0),
        netProfit: repairIncome + directSalesIncome - expenseSummary.reduce((s: number, e: any) => s + e.amount, 0),
        totalStockValue: stockInventory.reduce((s: number, p: any) => s + p.stock_value, 0),
        totalMechBalance: mechanicLedger.reduce((s: number, m: any) => s + m.balance_amount, 0),
        totalLoanBalance: loanLedger.reduce((s: number, l: any) => s + l.balance_amount, 0),
      },
    });

  } catch (err: any) {
    console.error('Balance Sheet API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
