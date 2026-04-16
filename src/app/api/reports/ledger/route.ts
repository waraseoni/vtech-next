import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing from or to date' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()             { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  // PHP-style date handling (local time)
  const start = `${from} 00:00:00`;
  const end   = `${to} 23:59:59`;

  try {

    // ═══════════════════════════════════════════════════════════════════════
    //  MASTER LOOKUP MAPS
    //  Supabase foreign key joins kaam nahi karte (schema cache mein nahi),
    //  isliye sab data pehle fetch karke manually map karo
    // ═══════════════════════════════════════════════════════════════════════

    const [
      { data: allClients },
      { data: allMechanics },
      { data: allProducts },
    ] = await Promise.all([
      supabase.from('client_list').select('id, firstname, middlename, lastname'),
      supabase.from('mechanic_list').select('id, firstname, lastname, daily_salary, salary_per_day, delete_flag'),
      supabase.from('product_list').select('id, name, price'),
    ]);

    const clientMap: Record<number, { firstname: string; middlename: string; lastname: string }> = {};
    allClients?.forEach((c: any) => {
      clientMap[c.id] = { firstname: c.firstname || '', middlename: c.middlename || '', lastname: c.lastname || '' };
    });

    const mechanicMap: Record<number, { firstname: string; lastname: string; daily: number }> = {};
    allMechanics?.forEach((m: any) => {
      mechanicMap[m.id] = {
        firstname: m.firstname || '',
        lastname:  m.lastname  || '',
        daily:     Number(m.salary_per_day) || Number(m.daily_salary) || 0,
      };
    });

    const productMap: Record<number, { name: string; price: number }> = {};
    allProducts?.forEach((p: any) => {
      productMap[p.id] = { name: p.name || '', price: Number(p.price) || 0 };
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  PARALLEL DATA FETCH — sab ek saath
    // ═══════════════════════════════════════════════════════════════════════

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
      // 1. Repair jobs (matching PHP - no del_status filter)
      supabase.from('transaction_list')
        .select('id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id')
        .eq('status', 5)
        .gte('date_completed', start).lte('date_completed', end),

      // 2. Walk-in sales
      supabase.from('direct_sales')
        .select('id, sale_code, total_amount, date_created, client_id')
        .or('client_id.is.null,client_id.eq.0')
        .gte('date_created', start).lte('date_created', end),

      // 3. Client sales
      supabase.from('direct_sales')
        .select('id, sale_code, total_amount, date_created, client_id')
        .not('client_id', 'is', null).neq('client_id', 0)
        .gte('date_created', start).lte('date_created', end),

      // 4. Client payments
      supabase.from('client_payments')
        .select('id, client_id, amount, discount, payment_date, remarks, payment_mode')
        .gte('payment_date', from).lte('payment_date', to),

      // 5. Attendance (period)
      supabase.from('attendance_list')
        .select('mechanic_id, curr_date, status')
        .in('status', [1, 3])
        .gte('curr_date', from).lte('curr_date', to),

      // 6. Advances (period)
      supabase.from('advance_payments')
        .select('mechanic_id, date_paid, amount, reason')
        .gte('date_paid', from).lte('date_paid', to),

      // 7. Expenses (period)
      supabase.from('expense_list')
        .select('id, category, amount, remarks, date_created')
        .gte('date_created', start).lte('date_created', end),

      // 8. Loan payments (period)
      supabase.from('loan_payments')
        .select('amount_paid, payment_date, remarks')
        .gte('payment_date', from).lte('payment_date', to),

      // 9. Inventory (no join - manual)
      supabase.from('inventory_list')
        .select('product_id, quantity').gt('quantity', 0),

      // 10. Lenders (active)
      supabase.from('lender_list')
        .select('loan_amount').eq('status', 1),

      // 11. All-time loan paid
      supabase.from('loan_payments').select('amount_paid'),

      // 12. All-time repairs (liability)
      supabase.from('transaction_list')
        .select('mechanic_id, mechanic_commission_amount')
        .eq('status', 5).eq('del_status', 0),

      // 13. All-time attendance (liability)
      supabase.from('attendance_list')
        .select('mechanic_id, status').in('status', [1, 3]),

      // 14. All-time advances (liability)
      supabase.from('advance_payments').select('mechanic_id, amount'),
    ]);

    // ═══════════════════════════════════════════════════════════════════════
    //  SALE ITEMS — walkin aur client sales ke liye alag fetch
    // ═══════════════════════════════════════════════════════════════════════

    const allSaleIds = [
      ...(walkinRaw || []).map((s: any) => s.id),
      ...(clientSalesRaw || []).map((s: any) => s.id),
    ];

    const saleItemsMap: Record<number, any[]> = {};
    if (allSaleIds.length > 0) {
      const { data: saleItems } = await supabase
        .from('direct_sale_items')
        .select('sale_id, product_id, qty, price')
        .in('sale_id', allSaleIds);
      saleItems?.forEach((item: any) => {
        if (!saleItemsMap[item.sale_id]) saleItemsMap[item.sale_id] = [];
        saleItemsMap[item.sale_id].push(item);
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  DATA SHAPING
    // ═══════════════════════════════════════════════════════════════════════

    // Repair Jobs
    const repairJobs = (repairJobsRaw || []).map((j: any) => {
      const cid    = parseInt(j.client_name);
      const client = !isNaN(cid) ? clientMap[cid] : null;
      const mech   = mechanicMap[j.mechanic_id] || null;
      return {
        id:                         j.id,
        job_id:                     j.job_id,
        date_completed:             j.date_completed,
        item:                       j.item,
        amount:                     Number(j.amount) || 0,
        mechanic_commission_amount: Number(j.mechanic_commission_amount) || 0,
        client_firstname:           client?.firstname  || j.client_name || '',
        client_middlename:          client?.middlename || '',
        client_lastname:            client?.lastname   || '',
        mechanic_firstname:         mech?.firstname    || '',
        mechanic_lastname:          mech?.lastname     || '',
      };
    });

    // Walk-in Sales
    const walkinSales = (walkinRaw || []).map((s: any) => {
      const items     = saleItemsMap[s.id] || [];
      const firstItem = items[0];
      const prod      = firstItem ? productMap[firstItem.product_id] : null;
      return {
        id:           s.id,
        sale_code:    s.sale_code,
        total_amount: Number(s.total_amount) || 0,
        date_created: s.date_created,
        client_id:    null,
        product_name: prod?.name || (items.length > 1 ? 'Multiple Items' : null),
        quantity:     firstItem?.qty   || null,
        unit_price:   firstItem?.price ? Number(firstItem.price) : null,
      };
    });

    // Client Sales
    const clientSales = (clientSalesRaw || []).map((s: any) => {
      const client    = clientMap[s.client_id] || null;
      const items     = saleItemsMap[s.id] || [];
      const firstItem = items[0];
      const prod      = firstItem ? productMap[firstItem.product_id] : null;
      return {
        id:               s.id,
        sale_code:        s.sale_code,
        total_amount:     Number(s.total_amount) || 0,
        date_created:     s.date_created,
        client_id:        s.client_id,
        client_firstname: client?.firstname || '',
        client_lastname:  client?.lastname  || '',
        product_name:     prod?.name || (items.length > 1 ? 'Multiple Items' : null),
        quantity:         firstItem?.qty   || null,
        unit_price:       firstItem?.price ? Number(firstItem.price) : null,
      };
    });

    // Client Payments
    const clientPayments = (clientPaymentsRaw || []).map((p: any) => {
      const client = clientMap[p.client_id] || null;
      return {
        id:               p.id,
        client_id:        p.client_id,
        amount:           Number(p.amount)   || 0,
        discount:         Number(p.discount) || 0,
        payment_date:     p.payment_date,
        remarks:          p.remarks || null,
        payment_method:   p.payment_mode || 'Cash',
        client_firstname: client?.firstname || '',
        client_lastname:  client?.lastname  || '',
      };
    });

    // Advance Payments
    const advancePayments = (advancesRaw || []).map((a: any) => {
      const mech = mechanicMap[a.mechanic_id];
      return {
        date_paid:     a.date_paid,
        mechanic_name: mech ? `${mech.firstname} ${mech.lastname}`.trim() : `Staff #${a.mechanic_id}`,
        amount:        Number(a.amount) || 0,
        reason:        a.reason || null,
        payment_mode:  null,
      };
    });

    // Expenses
    const expenses = (expensesRaw || []).map((e: any) => ({
      date_created: e.date_created,
      category:     e.category,
      remarks:      e.remarks || '',
      amount:       Number(e.amount) || 0,
      payment_mode: null,
      reference:    null,
    }));

    // Stock Items (inventory_list → product_list manual join)
    const stockSumMap: Record<number, number> = {};
    (inventoryRaw || []).forEach((i: any) => {
      stockSumMap[i.product_id] = (stockSumMap[i.product_id] || 0) + (Number(i.quantity) || 0);
    });
    const stockItems = Object.entries(stockSumMap)
      .map(([pid, qty]) => {
        const prod = productMap[parseInt(pid)];
        return { name: prod?.name || '', price: prod?.price || 0, quantity: qty };
      })
      .filter(i => i.name !== '');
    const stockValue = stockItems.reduce((s, i) => s + i.price * i.quantity, 0);

    // Loan Outstanding (all-time)
    const totalLoan        = (lenders || []).reduce((s, l: any) => s + (Number(l.loan_amount) || 0), 0);
    const totalLoanPaidAll = (allLoanPaid || []).reduce((s, l: any) => s + (Number(l.amount_paid) || 0), 0);
    const loanOutstanding  = Math.max(0, totalLoan - totalLoanPaidAll);

    // Salary Calculation
    const salaryMap: Record<number, { name: string; full: number; half: number; daily: number }> = {};
    (attendance || []).forEach((a: any) => {
      const mid = a.mechanic_id;
      if (!salaryMap[mid]) {
        const mech = mechanicMap[mid];
        salaryMap[mid] = {
          name:  mech ? `${mech.firstname} ${mech.lastname}`.trim() : `Staff #${mid}`,
          full:  0, half: 0,
          daily: mech?.daily || 0,
        };
      }
      if (a.status === 1) salaryMap[mid].full++;
      else if (a.status === 3) salaryMap[mid].half++;
    });
    const salaryDetails = Object.values(salaryMap).map(d => ({
      mechanic_name: d.name,
      full_days:     d.full,
      half_days:     d.half,
      total_days:    d.full + d.half * 0.5,
      daily_salary:  d.daily,
      salary_earned: (d.full + d.half * 0.5) * d.daily,
    }));
    const totalSalary = salaryDetails.reduce((s, d) => s + d.salary_earned, 0);

    // Staff Liability (all-time)
    let staffLiability = 0;
    (allMechanics || []).filter((m: any) => m.delete_flag === 0).forEach((m: any) => {
      const daily = Number(m.salary_per_day) || Number(m.daily_salary) || 0;

      const earnedComm = (allRepairsRaw || [])
        .filter((r: any) => r.mechanic_id === m.id)
        .reduce((s, r: any) => s + (Number(r.mechanic_commission_amount) || 0), 0);

      const earnedSal = (allAttRaw || [])
        .filter((a: any) => a.mechanic_id === m.id)
        .reduce((s, a: any) => s + (a.status === 3 ? daily / 2 : daily), 0);

      const paid = (allAdvRaw || [])
        .filter((a: any) => a.mechanic_id === m.id)
        .reduce((s, a: any) => s + (Number(a.amount) || 0), 0);

      staffLiability += (earnedComm + earnedSal) - paid;
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  TOTALS
    // ═══════════════════════════════════════════════════════════════════════

    const jobIncome              = repairJobs.reduce((s, j) => s + j.amount, 0);
    const walkinIncome           = walkinSales.reduce((s, j) => s + j.total_amount, 0);
    const clientSalesIncome      = clientSales.reduce((s, j) => s + j.total_amount, 0);
    const clientPaymentsReceived = clientPayments.reduce((s, p) => s + p.amount, 0);
    const totalDiscountGiven     = clientPayments.reduce((s, p) => s + p.discount, 0);
    const totalCommission        = repairJobs.reduce((s, j) => s + j.mechanic_commission_amount, 0);
    const totalAdvanceGiven      = advancePayments.reduce((s, a) => s + a.amount, 0);
    const totalOtherExpenses     = expenses.reduce((s, e) => s + e.amount, 0);
    const totalEmiPaid           = (loanPaymentsRaw || []).reduce((s, l: any) => s + (Number(l.amount_paid) || 0), 0);

    // ═══════════════════════════════════════════════════════════════════════
    //  LEDGER ENTRIES
    // ═══════════════════════════════════════════════════════════════════════

    const ledgerEntries: any[] = [];

    clientPayments.forEach(p => ledgerEntries.push({
      date:            p.payment_date,
      category:        'Client Payment',
      details:         `${p.client_firstname} ${p.client_lastname}`.trim(),
      type:            'Cash In',
      net_amount:      p.amount,
      discount_amount: p.discount || 0,
      client_id:       p.client_id,
      client_fullname: `${p.client_firstname} ${p.client_lastname}`.trim(),
    }));

    walkinSales.forEach(s => ledgerEntries.push({
      date:       s.date_created,
      category:   'Direct Sale (Walk-in)',
      details:    `Invoice: ${s.sale_code}`,
      type:       'Cash In',
      net_amount: s.total_amount,
      client_id:  s.client_id || null,
    }));

    // Direct Sales (Client) are credit sales. 
    // They are NOT pushed to ledgerEntries as 'Cash In' to avoid double counting,
    // since cash is received later via client_payments.

    expenses.forEach(e => ledgerEntries.push({
      date:       e.date_created,
      category:   'Shop Expense',
      details:    `${e.category}${e.remarks ? ' - ' + e.remarks : ''}`,
      type:       'Cash Out',
      net_amount: e.amount,
    }));

    (loanPaymentsRaw || []).forEach((lp: any) => ledgerEntries.push({
      date:       lp.payment_date,
      category:   'Loan EMI',
      details:    lp.remarks || 'EMI Payment',
      type:       'Cash Out',
      net_amount: Number(lp.amount_paid) || 0,
    }));

    advancePayments.forEach(a => ledgerEntries.push({
      date:       a.date_paid,
      category:   'Staff Advance',
      details:    `${a.mechanic_name}${a.reason ? ' - ' + a.reason : ''}`,
      type:       'Cash Out',
      net_amount: a.amount,
    }));

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // ═══════════════════════════════════════════════════════════════════════
    //  RESPONSE
    // ═══════════════════════════════════════════════════════════════════════

    return NextResponse.json({
      repairJobs,
      walkinSales,
      clientSales,
      clientPayments,
      commissionData: repairJobs.map(j => ({
        job_id:                     j.job_id,
        amount:                     j.amount,
        mechanic_commission_amount: j.mechanic_commission_amount,
        date_completed:             j.date_completed,
        mechanic_firstname:         j.mechanic_firstname,
        mechanic_lastname:          j.mechanic_lastname,
      })),
      salaryDetails,
      advancePayments,
      expenses,
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
      staffLiability: Math.max(0, staffLiability),
      loanOutstanding,
    });

  } catch (err: any) {
    console.error('Ledger API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}