import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { fetchAll, pageAll } from '@/lib/fetch-all';
import { requireStaff, UNAUTHORIZED } from '@/lib/api-auth';

export async function GET(request: Request) {
  if (!(await requireStaff())) return UNAUTHORIZED();

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
  const start = `${from}T00:00:00+05:30`;
  const end   = `${to}T23:59:59+05:30`;

  try {

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  MASTER LOOKUP MAPS
    //  Supabase foreign key joins kaam nahi karte (schema cache mein nahi),
    //  isliye sab data pehle fetch karke manually map karo
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const [
      { data: allClients },
      { data: allMechanics },
      { data: allProducts },
      { data: salaryHistory },
    ] = await Promise.all([
      pageAll(supabase.from('client_list').select('id, firstname, middlename, lastname')),
      pageAll(supabase.from('mechanic_list').select('id, firstname, lastname, daily_salary, delete_flag')),
      pageAll(supabase.from('product_list').select('id, name, price')),
      pageAll(supabase.from('mechanic_salary_history').select('mechanic_id, effective_date, salary')),
    ]);

    const clientMap: Record<number, { firstname: string; middlename: string; lastname: string }> = {};
    allClients?.forEach((c) => {
      clientMap[c.id] = { firstname: c.firstname || '', middlename: c.middlename || '', lastname: c.lastname || '' };
    });

    const mechanicMap: Record<number, { firstname: string; lastname: string; daily: number }> = {};
    allMechanics?.forEach((m) => {
      mechanicMap[m.id] = {
        firstname: m.firstname || '',
        lastname:  m.lastname  || '',
        daily:     Number(m.daily_salary) || 0,
      };
    });

    // Salary history (PHP: latest effective_date <= attendance date, else daily_salary)
    const salaryHistoryMap: Record<number, { effective_date: string; salary: number }[]> = {};
    (salaryHistory || []).forEach((h) => {
      if (!salaryHistoryMap[h.mechanic_id]) salaryHistoryMap[h.mechanic_id] = [];
      salaryHistoryMap[h.mechanic_id].push({
        effective_date: h.effective_date,
        salary:         Number(h.salary) || 0,
      });
    });
    Object.values(salaryHistoryMap).forEach(arr =>
      arr.sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime())
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

    const productMap: Record<number, { name: string; price: number }> = {};
    allProducts?.forEach((p) => {
      productMap[p.id] = { name: p.name || '', price: Number(p.price) || 0 };
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  PARALLEL DATA FETCH â€” sab ek saath
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      // 1. Repair jobs (PHP: status=5 + date range â€” no del_status filter)
      pageAll(supabase.from('transaction_list')
        .select('id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id')
        .eq('status', 5)
        .gte('date_completed', start).lte('date_completed', end)),

      // 2. Walk-in sales
      pageAll(supabase.from('direct_sales')
        .select('id, sale_code, total_amount, date_created, client_id')
        .or('client_id.is.null,client_id.eq.0')
        .gte('date_created', start).lte('date_created', end)),

      // 3. Client sales
      pageAll(supabase.from('direct_sales')
        .select('id, sale_code, total_amount, date_created, client_id')
        .not('client_id', 'is', null).neq('client_id', 0)
        .gte('date_created', start).lte('date_created', end)),

      // 4. Client payments
      pageAll(supabase.from('client_payments')
        .select('id, client_id, amount, discount, payment_date, remarks, payment_mode')
        .gte('payment_date', from).lte('payment_date', to)),

      // 5. Attendance (period)
      pageAll(supabase.from('attendance_list')
        .select('mechanic_id, curr_date, status')
        .in('status', [1, 3])
        .gte('curr_date', from).lte('curr_date', to)),

      // 6. Advances (period)
      pageAll(supabase.from('advance_payments')
        .select('mechanic_id, date_paid, amount, reason')
        .gte('date_paid', from).lte('date_paid', to)),

      // 7. Expenses (period)
      pageAll(supabase.from('expense_list')
        .select('id, category, amount, remarks, date_created')
        .gte('date_created', start).lte('date_created', end)),

      // 8. Loan payments (period)
      pageAll(supabase.from('loan_payments')
        .select('amount_paid, payment_date, remarks')
        .gte('payment_date', from).lte('payment_date', to)),

      // 9. Inventory (no join - manual)
      pageAll(supabase.from('inventory_list')
        .select('product_id, quantity')),

      // 10. Lenders (active)
      pageAll(supabase.from('lender_list')
        .select('loan_amount').eq('status', 1)),

      // 11. All-time loan paid
      pageAll(supabase.from('loan_payments').select('amount_paid')),

      // 12. All-time repairs (liability)
      pageAll(supabase.from('transaction_list')
        .select('mechanic_id, mechanic_commission_amount')
        .eq('status', 5)),

      // 13. All-time attendance (liability)
      pageAll(supabase.from('attendance_list')
        .select('mechanic_id, curr_date, status').in('status', [1, 3])),

      // 14. All-time advances (liability)
      pageAll(supabase.from('advance_payments').select('mechanic_id, amount')),
    ]);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SALE ITEMS â€” walkin aur client sales ke liye alag fetch
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const allSaleIds = [
      ...(walkinRaw || []).map((s) => s.id),
      ...(clientSalesRaw || []).map((s) => s.id),
    ];

    const saleItemsMap: Record<number, { product_id: number; qty: number; price: number }[]> = {};
    for (let i = 0; i < allSaleIds.length; i += 500) {
      const saleItems = await fetchAll(
        supabase
          .from('direct_sale_items')
          .select('sale_id, product_id, qty, price')
          .in('sale_id', allSaleIds.slice(i, i + 500))
      );
      saleItems?.forEach((item) => {
        if (!saleItemsMap[item.sale_id]) saleItemsMap[item.sale_id] = [];
        saleItemsMap[item.sale_id].push(item);
      });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  DATA SHAPING
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // Repair Jobs
    const repairJobs = (repairJobsRaw || []).map((j) => {
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
    const walkinSales = (walkinRaw || []).map((s) => {
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
    const clientSales = (clientSalesRaw || []).map((s) => {
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
    const clientPayments = (clientPaymentsRaw || []).map((p) => {
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
    const advancePayments = (advancesRaw || []).map((a) => {
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
    const expenses = (expensesRaw || []).map((e) => ({
      date_created: e.date_created,
      category:     e.category,
      remarks:      e.remarks || '',
      amount:       Number(e.amount) || 0,
      payment_mode: null,
      reference:    null,
    }));

    // Stock Items (inventory_list â†’ product_list manual join)
    // PHP Balance Sheet: SUM(p.price*i.quantity) over ALL inventory rows
    // PHP detail table: only quantity > 0 rows
    const stockSumMap: Record<number, number> = {};
    (inventoryRaw || []).forEach((i) => {
      stockSumMap[i.product_id] = (stockSumMap[i.product_id] || 0) + (Number(i.quantity) || 0);
    });
    const stockValue = Object.entries(stockSumMap)
      .reduce((s, [pid, qty]) => s + (productMap[parseInt(pid)]?.price || 0) * qty, 0);
    const stockItems = Object.entries(stockSumMap)
      .filter(([, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const prod = productMap[parseInt(pid)];
        return { name: prod?.name || '', price: prod?.price || 0, quantity: qty };
      })
      .filter(i => i.name !== '');

    // Loan Outstanding (all-time)
    const totalLoan        = (lenders || []).reduce((s, l) => s + (Number(l.loan_amount) || 0), 0);
    const totalLoanPaidAll = (allLoanPaid || []).reduce((s, l) => s + (Number(l.amount_paid) || 0), 0);
    const loanOutstanding  = Math.max(0, totalLoan - totalLoanPaidAll);

    // Salary Calculation
    const salaryMap: Record<number, { name: string; full: number; half: number; daily: number }> = {};
    (attendance || []).forEach((a) => {
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

    // P&L salary (PHP: per attendance row, salary_history rate <= curr_date, else daily_salary)
    const totalSalary = (attendance || []).reduce((sum, a) => {
      const rate = historyRateFor(a.mechanic_id, a.curr_date) ?? (mechanicMap[a.mechanic_id]?.daily || 0);
      return sum + (a.status === 3 ? rate / 2 : rate);
    }, 0);

    // Staff Liability (all-time) â€” PHP: ALL mechanics (no delete_flag filter),
    // earned_sal uses salary_history rate (fallback 0), earned_comm all status=5
    let staffLiability = 0;
    (allMechanics || []).forEach((m) => {
      const earnedComm = (allRepairsRaw || [])
        .filter((r) => r.mechanic_id === m.id)
        .reduce((s, r) => s + (Number(r.mechanic_commission_amount) || 0), 0);

      const earnedSal = (allAttRaw || [])
        .filter((a) => a.mechanic_id === m.id)
        .reduce((s, a) => {
          const rate = historyRateFor(m.id, a.curr_date) ?? 0;
          return s + (a.status === 3 ? rate / 2 : rate);
        }, 0);

      const paid = (allAdvRaw || [])
        .filter((a) => a.mechanic_id === m.id)
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);

      staffLiability += (earnedComm + earnedSal) - paid;
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  TOTALS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    const jobIncome              = repairJobs.reduce((s, j) => s + j.amount, 0);
    const walkinIncome           = walkinSales.reduce((s, j) => s + j.total_amount, 0);
    const clientSalesIncome      = clientSales.reduce((s, j) => s + j.total_amount, 0);
    const clientPaymentsReceived = clientPayments.reduce((s, p) => s + p.amount, 0);
    const totalDiscountGiven     = clientPayments.reduce((s, p) => s + p.discount, 0);
    const totalCommission        = repairJobs.reduce((s, j) => s + j.mechanic_commission_amount, 0);
    const totalAdvanceGiven      = advancePayments.reduce((s, a) => s + a.amount, 0);
    const totalOtherExpenses     = expenses.reduce((s, e) => s + e.amount, 0);
    const totalEmiPaid           = (loanPaymentsRaw || []).reduce((s, l) => s + (Number(l.amount_paid) || 0), 0);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  LEDGER ENTRIES
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    type LedgerEntry = {
      date: string;
      category: string;
      details: string;
      type: 'Cash In' | 'Cash Out';
      net_amount: number;
      discount_amount?: number;
      client_id?: number | null;
      client_fullname?: string;
    };
    const ledgerEntries: LedgerEntry[] = [];

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

    (loanPaymentsRaw || []).forEach((lp) => ledgerEntries.push({
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  RESPONSE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  } catch (err) {
    console.error('Ledger API error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
