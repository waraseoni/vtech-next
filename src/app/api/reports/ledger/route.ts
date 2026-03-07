import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to date' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const start = startOfDay(parseISO(from)).toISOString();
  const end = endOfDay(parseISO(to)).toISOString();

  try {
    // 1. Repair jobs income + commission
    const { data: repairJobs, error: repairError } = await supabase
      .from('transaction_list')
      .select(`
        id, job_id, date_completed, item, amount, mechanic_commission_amount,
        client:client_name (firstname, middlename, lastname),
        mechanic:mechanic_id (firstname, lastname)
      `)
      .eq('status', 5)
      .eq('del_status', 0)
      .gte('date_completed', start)
      .lte('date_completed', end);

    // 2. Walk-in direct sales
    const { data: walkinSales, error: walkinError } = await supabase
      .from('direct_sales')
      .select(`
        id, sale_code, total_amount, date_created,
        items:direct_sale_items (product_id, qty, price, product:product_id (name))
      `)
      .is('client_id', null)
      .gte('date_created', start)
      .lte('date_created', end);

    // 3. Client direct sales
    const { data: clientSales, error: clientSalesError } = await supabase
      .from('direct_sales')
      .select(`
        id, sale_code, total_amount, date_created, client_id,
        client:client_id (firstname, middlename, lastname),
        items:direct_sale_items (product_id, qty, price, product:product_id (name))
      `)
      .not('client_id', 'is', null)
      .gte('date_created', start)
      .lte('date_created', end);

    // 4. Client payments
    const { data: clientPayments, error: paymentsError } = await supabase
      .from('client_payments')
      .select(`
        id, client_id, amount, discount, payment_date, remarks, payment_method,
        client:client_id (firstname, lastname)
      `)
      .gte('payment_date', from)
      .lte('payment_date', to);

    // 5. Attendance (salary)
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_list')
      .select(`
        mechanic_id, curr_date, status,
        mechanic:mechanic_id (firstname, lastname, daily_salary)
      `)
      .in('status', [1, 3])
      .gte('curr_date', from)
      .lte('curr_date', to);

    // 6. Advance payments
    const { data: advances, error: advancesError } = await supabase
      .from('advance_payments')
      .select(`
        date_paid, amount, reason, payment_mode,
        mechanic:mechanic_id (firstname, lastname)
      `)
      .gte('date_paid', from)
      .lte('date_paid', to);

    // 7. Expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expense_list')
      .select('*')
      .gte('date_created', start)
      .lte('date_created', end);

    // 8. Loan payments (EMI)
    const { data: loanPayments, error: loanError } = await supabase
      .from('loan_payments')
      .select('amount_paid')
      .gte('payment_date', from)
      .lte('payment_date', to);

    // 9. Stock value
    const { data: stock, error: stockError } = await supabase
      .from('inventory_list')
      .select('quantity, product:product_id (id, name, price)')
      .gt('quantity', 0);

    // 10. Staff liability (all-time, optimized)
    const { data: mechanics, error: mechError } = await supabase
      .from('mechanic_list')
      .select('id, firstname, lastname, daily_salary');

    // 11. All-time totals for liability
    const { data: allRepairs, error: allRepairsError } = await supabase
      .from('transaction_list')
      .select('mechanic_id, mechanic_commission_amount')
      .eq('status', 5);

    const { data: allAttendance, error: allAttError } = await supabase
      .from('attendance_list')
      .select('mechanic_id, curr_date, status')
      .in('status', [1, 3]);

    const { data: allAdvances, error: allAdvError } = await supabase
      .from('advance_payments')
      .select('mechanic_id, amount');

    // 12. Loan outstanding
    const { data: lenders, error: lendersError } = await supabase
      .from('lender_list')
      .select('loan_amount')
      .eq('status', 1);
    const totalLoan = lenders?.reduce((sum, l) => sum + (l.loan_amount || 0), 0) || 0;

    const totalLoanPaid = loanPayments?.reduce((sum, l) => sum + (l.amount_paid || 0), 0) || 0;
    const loanOutstanding = totalLoan - totalLoanPaid;

    // Process data
    const jobIncome = repairJobs?.reduce((sum, j) => sum + (j.amount || 0), 0) || 0;
    const walkinIncome = walkinSales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const clientSalesIncome = clientSales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
    const clientPaymentsReceived = clientPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const totalDiscountGiven = clientPayments?.reduce((sum, p) => sum + (p.discount || 0), 0) || 0;
    const totalCommission = repairJobs?.reduce((sum, j) => sum + (j.mechanic_commission_amount || 0), 0) || 0;
    const totalAdvanceGiven = advances?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
    const totalOtherExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const totalEmiPaid = loanPayments?.reduce((sum, l) => sum + (l.amount_paid || 0), 0) || 0;

    // Salary calculation
    const salaryMap: Record<number, { name: string; full: number; half: number; daily: number }> = {};
    attendance?.forEach((a: any) => {
      const mid = a.mechanic_id;
      if (!salaryMap[mid]) {
        salaryMap[mid] = {
          name: `${a.mechanic?.firstname || ''} ${a.mechanic?.lastname || ''}`.trim(),
          full: 0,
          half: 0,
          daily: a.mechanic?.daily_salary || 0,
        };
      }
      if (a.status === 1) salaryMap[mid].full++;
      else if (a.status === 3) salaryMap[mid].half++;
    });
    const salaryDetails = Object.entries(salaryMap).map(([mid, data]) => ({
      mechanic_name: data.name,
      full_days: data.full,
      half_days: data.half,
      total_days: data.full + data.half * 0.5,
      daily_salary: data.daily,
      salary_earned: (data.full + data.half * 0.5) * data.daily,
    }));
    const totalSalary = salaryDetails.reduce((sum, s) => sum + s.salary_earned, 0);

    // Stock value
    const stockItems = stock?.map((i: any) => ({
      name: i.product?.name || 'Unknown',
      price: i.product?.price || 0,
      quantity: i.quantity || 0,
    })) || [];
    const stockValue = stockItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Staff liability (all-time)
    let staffLiability = 0;
    if (mechanics) {
      for (const m of mechanics) {
        const earnedComm = allRepairs
          ?.filter((r: any) => r.mechanic_id === m.id)
          .reduce((sum, r) => sum + (r.mechanic_commission_amount || 0), 0) || 0;

        // Earned salary (need salary history)
        // Simplified: use attendance with salary rates (we'll approximate)
        // For accurate, we need salary history, but for optimization we'll use current daily salary * total days
        const mechanicAttendance = allAttendance?.filter((a: any) => a.mechanic_id === m.id) || [];
        let earnedSal = 0;
        for (const a of mechanicAttendance) {
          // Get salary rate at that date (simplified – use daily_salary from mechanic_list)
          // In production, you'd query mechanic_salary_history per date, but that's heavy.
          // We'll use a simplified approach for now.
          const daily = m.daily_salary || 0;
          earnedSal += a.status === 3 ? daily / 2 : daily;
        }

        const paid = allAdvances
          ?.filter((a: any) => a.mechanic_id === m.id)
          .reduce((sum, a) => sum + (a.amount || 0), 0) || 0;

        staffLiability += earnedComm + earnedSal - paid;
      }
    }

    // Build ledger entries
    const ledgerEntries: any[] = [];
    clientPayments?.forEach((p: any) => {
      ledgerEntries.push({
        date: p.payment_date,
        category: 'Client Payment',
        details: `${p.client?.firstname || ''} ${p.client?.lastname || ''}`.trim() + (p.discount ? ` (Discount: ₹${p.discount})` : ''),
        type: 'Cash In',
        net_amount: p.amount,
        discount_amount: p.discount,
        client_id: p.client_id,
        client_fullname: `${p.client?.firstname || ''} ${p.client?.lastname || ''}`.trim(),
      });
    });
    walkinSales?.forEach((s: any) => {
      ledgerEntries.push({
        date: s.date_created,
        category: 'Direct Sale (Walk-in)',
        details: `Invoice: ${s.sale_code}`,
        type: 'Cash In',
        net_amount: s.total_amount,
      });
    });
    expenses?.forEach((e: any) => {
      ledgerEntries.push({
        date: e.date_created,
        category: 'Shop Expense',
        details: `${e.category} - ${e.remarks}`,
        type: 'Cash Out',
        net_amount: e.amount,
      });
    });
    loanPayments?.forEach((lp: any) => {
      ledgerEntries.push({
        date: lp.payment_date,
        category: 'Loan EMI',
        details: lp.remarks || 'EMI Payment',
        type: 'Cash Out',
        net_amount: lp.amount_paid,
      });
    });
    advances?.forEach((a: any) => {
      ledgerEntries.push({
        date: a.date_paid,
        category: 'Staff Advance',
        details: `${a.mechanic?.firstname || ''} ${a.mechanic?.lastname || ''} - ${a.reason || ''}`,
        type: 'Cash Out',
        net_amount: a.amount,
      });
    });
    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      repairJobs: repairJobs || [],
      walkinSales: walkinSales || [],
      clientSales: clientSales || [],
      clientPayments: clientPayments || [],
      commissionData: repairJobs?.map((j: any) => ({
        job_id: j.job_id,
        amount: j.amount,
        mechanic_commission_amount: j.mechanic_commission_amount,
        date_completed: j.date_completed,
        mechanic_firstname: j.mechanic?.firstname,
        mechanic_lastname: j.mechanic?.lastname,
      })) || [],
      salaryDetails,
      advancePayments: advances?.map((a: any) => ({
        date_paid: a.date_paid,
        mechanic_name: a.mechanic ? `${a.mechanic.firstname} ${a.mechanic.lastname}`.trim() : 'Unknown',
        amount: a.amount,
        reason: a.reason,
        payment_mode: a.payment_mode,
      })) || [],
      expenses: expenses || [],
      ledgerEntries,
      stockItems,
      jobIncome,
      walkinIncome,
      clientSalesIncome,
      clientPaymentsReceived,
      totalDiscountGiven,
      totalCommission,
      totalAdvanceGiven,
      totalOtherExpenses,
      totalEmiPaid,
      totalSalary,
      stockValue,
      staffLiability,
      loanOutstanding,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}