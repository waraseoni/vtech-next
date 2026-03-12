// TEMPORARY DEBUG FILE — /app/api/reports/ledger-debug/route.ts
// Browser mein visit: /api/reports/ledger-debug?from=2026-03-01&to=2026-03-31
// Debug ke baad DELETE kar dena.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// ── Timezone-safe helpers ─────────────────────────────────────────────────────
// BUG FIX 1: Original code used new Date().toISOString().slice(0,7)+'-01'
// toISOString() returns UTC — at midnight IST this gives previous month!
// Fix: construct date string from local parts using IST-aware calculation.
const pad = (n: number) => String(n).padStart(2, "0");

function todayIST(): string {
  // Use Intl to get current date in IST regardless of server TZ
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

function firstOfMonthIST(): string {
  const t = todayIST();
  return t.slice(0, 7) + "-01";
}

// BUG FIX 2: Original used startOfDay(parseISO(from)).toISOString() for timestamp filters.
// parseISO('2026-03-01') in date-fns v2 parses as LOCAL midnight — OK in IST.
// But to avoid any date-fns version ambiguity, we construct IST midnight directly.
function istMidnightStart(dateStr: string): string {
  // dateStr = 'YYYY-MM-DD' — make IST midnight → UTC ISO string for Supabase
  return `${dateStr}T00:00:00+05:30`;
}
function istMidnightEnd(dateStr: string): string {
  return `${dateStr}T23:59:59+05:30`;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // BUG FIX 1 applied here
  const from = searchParams.get("from") || firstOfMonthIST();
  const to   = searchParams.get("to")   || todayIST();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()         { return cookieStore.getAll(); },
        setAll(cs)       { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  // BUG FIX 2 applied: IST-aware timestamps for Supabase
  const start = istMidnightStart(from);
  const end   = istMidnightEnd(to);

  const debug: Record<string, unknown> = {
    meta: {
      from, to,
      start_utc: new Date(start).toISOString(),
      end_utc:   new Date(end).toISOString(),
      server_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today_ist: todayIST(),
    },
  };

  // Helper to run a query and capture result neatly
  const run = async (key: string, q: ReturnType<typeof supabase.from>) => {
    const t0 = Date.now();
    const res = await (q as any);
    debug[key] = {
      ok:      !res.error,
      error:   res.error?.message ?? null,
      count:   res.data?.length ?? 0,
      ms:      Date.now() - t0,
      sample:  (res.data ?? []).slice(0, 2),
    };
  };

  await run("1_repair_jobs",
    supabase.from("transaction_list")
      .select("id,job_id,date_completed,item,amount,mechanic_commission_amount,client_name,mechanic_id,status,del_status")
      .eq("status", 5).eq("del_status", 0)
      .gte("date_completed", start).lte("date_completed", end).limit(5)
  );

  await run("2_walkin_sales",
    supabase.from("direct_sales")
      .select("id,sale_code,total_amount,date_created,client_id")
      .or("client_id.is.null,client_id.eq.0")
      .gte("date_created", start).lte("date_created", end).limit(5)
  );

  await run("3_client_sales",
    supabase.from("direct_sales")
      .select("id,sale_code,total_amount,date_created,client_id")
      .not("client_id", "is", null).neq("client_id", 0)
      .gte("date_created", start).lte("date_created", end).limit(5)
  );

  // client_payments uses DATE column — plain date string filter is correct
  await run("4_client_payments",
    supabase.from("client_payments")
      .select("id,client_id,amount,discount,payment_date,payment_mode")
      .gte("payment_date", from).lte("payment_date", to).limit(5)
  );

  await run("5_attendance",
    supabase.from("attendance_list")
      .select("mechanic_id,curr_date,status")
      .in("status", [1, 3])
      .gte("curr_date", from).lte("curr_date", to).limit(5)
  );

  await run("6_advances",
    supabase.from("advance_payments")
      .select("id,mechanic_id,date_paid,amount,reason")
      .gte("date_paid", from).lte("date_paid", to).limit(5)
  );

  await run("7_expenses",
    supabase.from("expense_list")
      .select("id,category,amount,remarks,date_created")
      .gte("date_created", start).lte("date_created", end).limit(5)
  );

  await run("8_loan_payments",
    supabase.from("loan_payments")
      .select("id,amount_paid,payment_date,remarks")
      .gte("payment_date", from).lte("payment_date", to).limit(5)
  );

  await run("9_stock",
    supabase.from("inventory_list")
      .select("quantity,product:product_id(id,name,price)")
      .gt("quantity", 0).limit(5)
  );

  await run("10_mechanics",
    supabase.from("mechanic_list")
      .select("id,firstname,lastname,daily_salary,salary_per_day")
      .eq("delete_flag", 0).limit(5)
  );

  await run("11_lenders",
    supabase.from("lender_list").select("id,loan_amount,status").limit(5)
  );

  await run("12_attendance_with_mechanic_join",
    supabase.from("attendance_list")
      .select("mechanic_id,status,mechanic:mechanic_id(firstname,lastname,daily_salary,salary_per_day)")
      .in("status", [1, 3])
      .gte("curr_date", from).lte("curr_date", to).limit(3)
  );

  await run("13_client_list_sample",
    supabase.from("client_list").select("id,firstname,lastname").limit(3)
  );

  await run("14_transaction_client_name_raw",
    supabase.from("transaction_list")
      .select("id,client_name,status").eq("status", 5).limit(5)
  );

  // Summary: flag any queries with errors
  const errors = Object.entries(debug)
    .filter(([k, v]) => k !== "meta" && (v as any).ok === false)
    .map(([k, v]) => ({ query: k, error: (v as any).error }));

  return NextResponse.json(
    { ...debug, _summary: { total_queries: 14, errors_count: errors.length, errors } },
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}