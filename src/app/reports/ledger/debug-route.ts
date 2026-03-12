// TEMPORARY DEBUG FILE - /api/reports/ledger-debug/route.ts
// Is file ko apne project mein /app/api/reports/ledger-debug/route.ts par rakh do
// Browser mein visit karo: /api/reports/ledger-debug?from=2025-01-01&to=2025-12-31
// Console aur browser mein exact errors aur raw data dikhega
// Debug ke baad is file ko delete kar dena

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || new Date().toISOString().slice(0, 7) + '-01';
  const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const start = startOfDay(parseISO(from)).toISOString();
  const end = endOfDay(parseISO(to)).toISOString();

  const debug: Record<string, any> = { from, to, start, end };

  // 1. transaction_list - raw
  const q1 = await supabase
    .from('transaction_list')
    .select('id, job_id, date_completed, item, amount, mechanic_commission_amount, client_name, mechanic_id, status, del_status')
    .eq('status', 5)
    .eq('del_status', 0)
    .gte('date_completed', start)
    .lte('date_completed', end)
    .limit(5);
  debug['1_repair_jobs'] = { error: q1.error?.message, count: q1.data?.length, sample: q1.data?.slice(0, 2) };

  // 2. direct_sales walkin
  const q2 = await supabase
    .from('direct_sales')
    .select('id, sale_code, total_amount, date_created, client_id')
    .or('client_id.is.null,client_id.eq.0')
    .gte('date_created', start)
    .lte('date_created', end)
    .limit(5);
  debug['2_walkin_sales'] = { error: q2.error?.message, count: q2.data?.length, sample: q2.data?.slice(0, 2) };

  // 3. direct_sales client
  const q3 = await supabase
    .from('direct_sales')
    .select('id, sale_code, total_amount, date_created, client_id')
    .not('client_id', 'is', null)
    .neq('client_id', 0)
    .gte('date_created', start)
    .lte('date_created', end)
    .limit(5);
  debug['3_client_sales'] = { error: q3.error?.message, count: q3.data?.length, sample: q3.data?.slice(0, 2) };

  // 4. client_payments
  const q4 = await supabase
    .from('client_payments')
    .select('id, client_id, amount, discount, payment_date, payment_mode')
    .gte('payment_date', from)
    .lte('payment_date', to)
    .limit(5);
  debug['4_client_payments'] = { error: q4.error?.message, count: q4.data?.length, sample: q4.data?.slice(0, 2) };

  // 5. attendance_list
  const q5 = await supabase
    .from('attendance_list')
    .select('mechanic_id, curr_date, status')
    .in('status', [1, 3])
    .gte('curr_date', from)
    .lte('curr_date', to)
    .limit(5);
  debug['5_attendance'] = { error: q5.error?.message, count: q5.data?.length, sample: q5.data?.slice(0, 2) };

  // 6. advance_payments
  const q6 = await supabase
    .from('advance_payments')
    .select('id, mechanic_id, date_paid, amount, reason')
    .gte('date_paid', from)
    .lte('date_paid', to)
    .limit(5);
  debug['6_advances'] = { error: q6.error?.message, count: q6.data?.length, sample: q6.data?.slice(0, 2) };

  // 7. expense_list
  const q7 = await supabase
    .from('expense_list')
    .select('id, category, amount, remarks, date_created')
    .gte('date_created', start)
    .lte('date_created', end)
    .limit(5);
  debug['7_expenses'] = { error: q7.error?.message, count: q7.data?.length, sample: q7.data?.slice(0, 2) };

  // 8. loan_payments
  const q8 = await supabase
    .from('loan_payments')
    .select('id, amount_paid, payment_date, remarks')
    .gte('payment_date', from)
    .lte('payment_date', to)
    .limit(5);
  debug['8_loan_payments'] = { error: q8.error?.message, count: q8.data?.length, sample: q8.data?.slice(0, 2) };

  // 9. inventory + product join
  const q9 = await supabase
    .from('inventory_list')
    .select('quantity, product:product_id(id, name, price)')
    .gt('quantity', 0)
    .limit(5);
  debug['9_stock'] = { error: q9.error?.message, count: q9.data?.length, sample: q9.data?.slice(0, 2) };

  // 10. mechanic_list
  const q10 = await supabase
    .from('mechanic_list')
    .select('id, firstname, lastname, daily_salary, salary_per_day')
    .eq('delete_flag', 0)
    .limit(5);
  debug['10_mechanics'] = { error: q10.error?.message, count: q10.data?.length, sample: q10.data?.slice(0, 2) };

  // 11. lender_list
  const q11 = await supabase
    .from('lender_list')
    .select('id, loan_amount, status')
    .limit(5);
  debug['11_lenders'] = { error: q11.error?.message, count: q11.data?.length, sample: q11.data?.slice(0, 2) };

  // 12. mechanic join test on attendance
  const q12 = await supabase
    .from('attendance_list')
    .select('mechanic_id, status, mechanic:mechanic_id(firstname, lastname, daily_salary, salary_per_day)')
    .in('status', [1, 3])
    .gte('curr_date', from)
    .lte('curr_date', to)
    .limit(3);
  debug['12_attendance_with_mechanic_join'] = { error: q12.error?.message, count: q12.data?.length, sample: q12.data?.slice(0, 2) };

  // 13. client_list sample
  const q13 = await supabase
    .from('client_list')
    .select('id, firstname, lastname')
    .limit(3);
  debug['13_client_list_sample'] = { error: q13.error?.message, sample: q13.data };

  // 14. transaction client_name sample (kya number hai ya text?)
  const q14 = await supabase
    .from('transaction_list')
    .select('id, client_name, status')
    .eq('status', 5)
    .limit(5);
  debug['14_transaction_client_name_raw'] = { error: q14.error?.message, sample: q14.data };

  return NextResponse.json(debug, { status: 200 });
}
