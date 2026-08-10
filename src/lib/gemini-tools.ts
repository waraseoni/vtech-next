import { createClient } from "@supabase/supabase-js";
import { FunctionDeclaration } from "@google/generative-ai";
import { todayIST } from "./dateUtils";
import { pageAll } from "./fetch-all";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATUS_MAP: Record<number, string> = {
    0: "Pending",
    1: "On-Progress",
    2: "Done",
    3: "Paid",
    4: "Cancelled",
    5: "Delivered",
};

export type AiRole = "admin" | "staff";

// Tools that only admin may use (financial / staff management data).
export const ADMIN_ONLY_TOOLS = new Set([
    "get_business_summary",
    "get_mechanic_performance",
    "get_financial_report",
    "get_expense_report",
    "get_loan_status",
]);

/** Shared system prompt — VTech persona + business rules + role policy. */
export function buildSystemPrompt(role: AiRole): string {
    const isAdmin = role === "admin";
    return `Namaste! You are "VTech Sahayak" — the senior business assistant of V-Technologies (V-TECH PRO), an electronics repair & equipment shop in Jabalpur, owned by Vikram Jain. You behave like a sharp, trusted senior of the shop: dukaan ka hisaab, customers aur kaam — sab yaad rakhte ho. Answers bilkul seedhe, sahi numbers ke saath.
Today's date is: ${new Date().toLocaleDateString("en-GB")} (YYYY-MM-DD for tool usage: ${todayIST()}).
Current logged-in user role: ${isAdmin ? "ADMIN" : "STAFF"}.

BUSINESS FACTS:
- Location: F4, Hotel Plaza, Beside Jayanti Complex, Marhatal, Jabalpur – 482002. Phone: 9179105875. Hours: 10 AM – 8 PM.
- Main services: SMPS / Power Supply Repair, EV Charger Repair, Stage Light Repair, DMX Controller Repair, electronic gadget service, and product sales.
- Promos: 10% off first service, 15% off old customers (follow-up), 20% off offers, free diagnosis + emergency repair.
- Money: all amounts in Indian Rupees. Always format with ₹ and Indian numbering (en-IN, e.g. ₹1,20,000).

WORKFLOW & DATA MODEL:
- Repair jobs live in transaction_list; client_name column stores the client id. Status: 0=Pending (kaam shuru nahi), 1=On-Progress (kaam chal raha), 2=Done (kaam pura), 3=Paid (bill chuka), 4=Cancelled, 5=Delivered (item mil gaya).
- Job grand total = services (price) + products (qty × price). Job code = YYYYMMDD+daily sequence; job_id = global number.
- Revenue (repairs) = job amounts for Delivered (status 5) jobs, counted by date_completed. Cash In = client payments + walk-in direct sales.
- Direct sales in direct_sales (code SALE + 6 digits); client_id 0/null means walk-in customer.
- Stock: available = inventory quantities − items used in active jobs − direct sale items. Thresholds: ≤0 Out of Stock, ≤5 Low, else In stock. alert_quantity = reorder point.
- Mechanic commission: job-level mechanic_commission_amount (auto = commission_percent % of services total).
- Payment modes: Cash, UPI (PhonePe/GPay), Bank Transfer, Card. A payment settles amount + discount.
- Attendance: status 1 = Present, 3 = Half Day (<6 hours work). Salary = full days × daily_salary + half days × (daily_salary/2).
- GST on bills: CGST 9% + SGST 9% = 18%.

FINANCIAL RULES:
- Client balance = opening_balance + repair_billed (Delivered jobs) + direct_sales_billed + loan_given (Σ client loan total_payable) − total_paid (Σ payments incl. discount).
- Profit = Revenue − (salaries + mechanic commissions + shop expenses + EMI + discounts). Don't double-count walk-in sales as revenue when they are only cash-in.
- Loans: client loans (money shop lent to customers) status 1 = Active; lender loans (shop's own debts) with EMI instalments.

ROLE POLICY (follow strictly):
${isAdmin
    ? "- You are ADMIN: you can see and answer EVERYTHING — profit, revenue, expenses, salaries, loans, business summary and all financial data."
    : "- You are STAFF: you can answer about clients, jobs, inventory, attendance and customer balances. You must NOT reveal admin-only data (profit, revenue, expenses, salaries, loans, business summary). If the user asks about profit, revenue, salaries, expenses, loans or admin settings, politely reply: \"Ye jaankari sirf Admin dekh sakta hai. Iske liye Admin se baat karein.\" and DO NOT call admin-only tools. Never invent numbers."}
- If a tool is blocked or returns nothing, say so honestly — never make up data.

BEHAVIOUR:
- When the user asks about profit/revenue/cash-in/clients/jobs/alerts/stock/attendance, use the tools (if your role allows). Prefer tools over guessing.
- Use status_label text (e.g. "Delivered") instead of numbers in replies. Use full client names (not ids).
- Answer in Hindi/Hinglish (roman) if the user speaks it, otherwise English. Be concise, use bullet points.
- IMPORTANT: After every answer, add 1-2 short practical SUGGESTIONS when something is actionable (e.g. reorder low stock, follow up with a due client, complete pending jobs, remind a client). Keep them brief and helpful.`;
}

// 1. Definition of Tools (Functions) that Gemini/Groq can call
export const geminiTools: any[] = [
  {
    name: "get_business_summary",
    description: "Fetches a quick high-level summary of the business including total clients, total jobs, and total revenue.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    } as any,
  },
  {
    name: "get_top_customers",
    description: "Fetches the top customers based on their outstanding balance or recent activity.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of customers to return (default 5)",
        },
      },
      required: [],
    } as any,
  },
  {
    name: "get_recent_jobs",
    description: "Fetches the most recent jobs/transactions. Can filter by status (0=Pending, 1=In Progress, 2=Done, 3=Paid, 4=Cancelled, 5=Delivered).",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of jobs to return (e.g., 5 or 10)",
        },
        status: {
          type: "integer",
          description: "Optional job status to filter by (0-5).",
        },
      },
      required: [],
    } as any,
  },
  {
    name: "get_job_statistics",
    description: "Returns statistics about service/repair jobs within a date range. For a single day, use same date for both start and end.",
    parameters: {
      type: "object",
      properties: {
        start_date: { type: "string", description: "Start date (YYYY-MM-DD). For single day, same as end_date." },
        end_date: { type: "string", description: "End date (YYYY-MM-DD). For single day, same as start_date." }
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_mechanic_performance",
    description: "Fetches the performance and details of all mechanics/staff.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    } as any,
  },
  {
    name: "get_customer_details_by_name",
    description: "Searches the database for a customer by their name and returns their details like balance, phone, address, and recent jobs.",
    parameters: {
      type: "object",
      properties: {
        customer_name: {
          type: "string",
          description: "The name of the customer to search for (e.g., 'Siddhi')",
        },
      },
      required: ["customer_name"],
    } as any,
  },
  {
    name: "get_job_details_by_id",
    description: "Searches the database for a specific job/transaction by its Exact Job ID and returns its full details including status, client name, item, fault, and amount.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The exact Job ID to search for (e.g., '12' or '45')",
        },
      },
      required: ["job_id"],
    } as any,
  },
  {
    name: "get_financial_report",
    description: "Fetches a comprehensive financial report for a specific date range. Includes Total Revenue (Repairs + Direct Sales), Total Cash In, Expenses, and Net Profit. For a single day, use the same date for both 'from' and 'to'.",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD). If user asks for a single specific day (e.g. '23 March'), use that same date for both 'from' and 'to'.",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD). If user asks for a single specific day, MUST be same as 'from'.",
        },
      },
      required: ["from", "to"],
    } as any,
  },
  {
    name: "get_business_alerts",
    description: "Returns current business notifications/alerts: low stock, pending jobs (2+ days), clients whose payment due date crossed, today's pending attendance, and (for admin only) high outstanding clients and active loans. Use this when the user asks for notifications, alerts, reminders, pending work, or what needs attention today.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    } as any,
  },
  {
    name: "get_inventory_status",
    description: "Returns current stock levels for all products with low-stock flags (quantity vs alert_quantity). Use for inventory, stock, kaunsi cheez khatam hone wali hai.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    } as any,
  },
  {
    name: "get_client_outstanding",
    description: "Returns clients with positive net balance, computed exactly like the Clients page: balance = opening_balance + delivered repairs (status 5) + direct sales billed + loans given - total payments (incl. discounts). Sorted by highest balance. Use for pending balance, kis customer se kitna paisa baaki hai, dues.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of clients to return (default 15)",
        },
      },
      required: [],
    } as any,
  },
  {
    name: "get_expense_report",
    description: "Fetches expenses grouped by category for a date range with total. For a single day, use the same date for both 'from' and 'to'. Admin only.",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD)",
        },
      },
      required: ["from", "to"],
    } as any,
  },
  {
    name: "get_attendance_report",
    description: "Fetches attendance summary (present/half-day days) per mechanic for a date range. For a single day, use the same date for both 'from' and 'to'.",
    parameters: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        to: {
          type: "string",
          description: "End date (YYYY-MM-DD)",
        },
      },
      required: ["from", "to"],
    } as any,
  },
  {
    name: "get_loan_status",
    description: "Returns lender loans (remaining amounts) and active client loans with EMI. Admin only.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    } as any,
  },
];

// 2. Execution Logic for the Tools
export async function executeGeminiTool(functionCall: any, role: AiRole = "admin"): Promise<any> {
    const name = functionCall.name;
    const args = functionCall.args;

    // Role gate: staff must not see admin-only financial/staff data.
    if (ADMIN_ONLY_TOOLS.has(name) && role !== "admin") {
        return { error: `'${name}' sirf Admin ke liye hai. Staff ise nahi dekh sakta. Ye jaankari lene ke liye Admin se baat karein.` };
    }

    try {
        if (name === "get_business_summary") {
            const { count: clientsCount } = await supabase.from("client_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0);
            const { count: jobsCount } = await supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0);
            
            // Calculate total revenue (Paid and Delivered jobs)
            const { data: revenueData } = await pageAll(supabase.from("transaction_list").select("amount").in("status", [3, 5]).eq("del_status", 0));
            const totalRevenue = revenueData?.reduce((sum, job) => sum + (Number(job.amount) || 0), 0) || 0;

            return {
                total_active_clients: clientsCount,
                total_jobs_in_system: jobsCount,
                total_revenue_from_paid_delivered_jobs: totalRevenue
            };
        }
        
        if (name === "get_top_customers") {
            const limit = args?.limit || 5;
            // Fetch customers with opening balance or general activity
            const { data } = await supabase.from("client_list")
                .select("firstname, lastname, contact, opening_balance")
                .eq("delete_flag", 0)
                .order("opening_balance", { ascending: false })
                .limit(limit);
            return { top_customers: data || [] };
        }

        if (name === "get_recent_jobs") {
            const limit = parseInt(args?.limit) || 5;
            let query = supabase.from("transaction_list")
                .select("job_id, client_name, item, fault, status, amount, date_created")
                .eq("del_status", 0)
                .order("date_created", { ascending: false })
                .limit(limit);
                
            if (args?.status !== undefined && args?.status !== "") {
                query = query.eq("status", parseInt(args.status));
            }
            
            const { data } = await query;
            const jobs = data || [];
            
            // Map IDs to original names dynamically
            for (const job of jobs) {
                if (job.client_name) {
                    const { data: clientInfo } = await supabase.from("client_list").select("firstname, lastname").eq("id", job.client_name).maybeSingle();
                    if (clientInfo) {
                        (job as any).actual_client_name = `${clientInfo.firstname || ''} ${clientInfo.lastname || ''}`.trim();
                    }
                }
                // Add status label
                (job as any).status_label = STATUS_MAP[job.status] || "Unknown";
            }
            
            return { recent_jobs: jobs };
        }

        if (name === "get_job_statistics") {
            let countQuery = supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0);
            
            if (args?.start_date) {
                countQuery = countQuery.gte("date_created", `${args.start_date}T00:00:00+05:30`);
            }
            if (args?.end_date) {
                countQuery = countQuery.lte("date_created", `${args.end_date}T23:59:59+05:30`);
            }
            
            const { count: jobsCount } = await countQuery;

            // Revenue calculation - filter by completion date (status 5 ONLY for Ledger revenue)
            const { data: revData } = await pageAll(supabase.from("transaction_list")
                .select("amount, status, date_completed, date_updated")
                .eq("status", 5)
                .eq("del_status", 0)
                .gte("date_completed", `${args.start_date}T00:00:00+05:30`)
                .lte("date_completed", `${args.end_date}T23:59:59+05:30`));
            
            const totalRevenue = revData?.reduce((sum, job) => sum + (Number(job.amount) || 0), 0) || 0;
            
            return {
                start_date_filtered: args?.start_date || "beginning of time",
                end_date_filtered: args?.end_date || "today",
                total_jobs_created_in_period: jobsCount,
                revenue_from_delivered_paid_jobs: totalRevenue
            };
        }

        if (name === "get_financial_report") {
            const from = args.from || args.start_date;
            const to = args.to || args.end_date;
            if (!from || !to) return { error: "From and To dates are required." };

            const [
                repairRes,
                directRes,
                paymentRes,
                expenseRes,
                loanRes,
                attendanceRes,
                mechanicRes
            ] = await Promise.all([
                pageAll(supabase.from("transaction_list")
                    .select("id, amount, status, date_completed, mechanic_commission_amount")
                    .eq("status", 5)
                    .eq("del_status", 0)
                    .gte("date_completed", `${from}T00:00:00+05:30`)
                    .lte("date_completed", `${to}T23:59:59+05:30`)),
                pageAll(supabase.from("direct_sales")
                    .select("id, total_amount, date_created, client_id")
                    .gte("date_created", `${from}T00:00:00+05:30`)
                    .lte("date_created", `${to}T23:59:59+05:30`)),
                pageAll(supabase.from("client_payments")
                    .select("id, amount, discount, payment_date")
                    .gte("payment_date", `${from}T00:00:00+05:30`)
                    .lte("payment_date", `${to}T23:59:59+05:30`)),
                pageAll(supabase.from("expense_list")
                    .select("amount, date_created")
                    .gte("date_created", `${from}T00:00:00+05:30`)
                    .lte("date_created", `${to}T23:59:59+05:30`)),
                pageAll(supabase.from("loan_payments")
                    .select("amount_paid")
                    .gte("payment_date", `${from}T00:00:00+05:30`)
                    .lte("payment_date", `${to}T23:59:59+05:30`)),
                pageAll(supabase.from("attendance_list")
                    .select("mechanic_id, status")
                    .in("status", [1, 3])
                    .gte("curr_date", from)
                    .lte("curr_date", to)),
                pageAll(supabase.from("mechanic_list")
                    .select("id, daily_salary"))
            ]);

            // Revenue: Job Income + Walk-in Sales + Client Sales
            const jobIncome = (repairRes.data || []).reduce((sum, j) => sum + (Number(j.amount) || 0), 0);
            const directSalesRevenue = (directRes.data || []).reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
            const totalRevenue = jobIncome + directSalesRevenue;

            // Expenses: Salaries + Commissions + Shop Expenses + EMI + Discounts
            const mechanicMap: Record<number, number> = {};
            (mechanicRes.data || []).forEach(m => {
                mechanicMap[m.id] = Number(m.daily_salary) || 0;
            });

            const salaries = (attendanceRes.data || []).reduce((sum, a) => {
                const daily = mechanicMap[a.mechanic_id] || 0;
                return sum + (a.status === 3 ? daily / 2 : daily);
            }, 0);

            const commissions = (repairRes.data || []).reduce((sum, j) => sum + (Number(j.mechanic_commission_amount) || 0), 0);
            const shopExpenses = (expenseRes.data || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const emiPayments = (loanRes.data || []).reduce((sum, l) => sum + (Number(l.amount_paid) || 0), 0);
            const totalDiscounts = (paymentRes.data || []).reduce((sum, p) => sum + (Number(p.discount) || 0), 0);
            const totalBusinessExpenses = salaries + commissions + shopExpenses + emiPayments + totalDiscounts;

            // Cash Inflow: Payments Received + Walk-in Cash Sales
            const walkinCash = (directRes.data || [])
                .filter(s => !s.client_id || s.client_id === 0)
                .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
            const paymentsReceived = (paymentRes.data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const totalCashIn = paymentsReceived + walkinCash;

            return {
                period: { from, to },
                summary_ledger_matched: {
                    job_revenue: jobIncome,
                    direct_sales_revenue: directSalesRevenue,
                    total_revenue: totalRevenue,
                    expenses_breakdown: {
                        staff_salaries: salaries,
                        mechanic_commissions: commissions,
                        shop_expenses: shopExpenses,
                        emi_loan_payments: emiPayments,
                        customer_discounts: totalDiscounts
                    },
                    total_expenses: totalBusinessExpenses,
                    net_profit: totalRevenue - totalBusinessExpenses,
                    cash_in_breakdown: {
                        payments_from_clients: paymentsReceived,
                        walkin_cash_sales: walkinCash
                    },
                    total_cash_in: totalCashIn
                }
            };
        }

        if (name === "get_mechanic_performance") {
            const { data } = await pageAll(supabase.from("mechanic_list")
                .select("firstname, lastname, designation, contact, status")
                .eq("delete_flag", 0));
            return { mechanics: data || [] };
        }

        if (name === "get_customer_details_by_name") {
            const customerName = (args?.customer_name || "").trim();
            if (!customerName) return { error: "Customer name is required" };

            // Multi-word names ("Vikash Mehra", "ghansor wale vijay") are common.
            // Split into tokens, drop filler words, then match tokens across
            // name/address fields with threshold scoring.
            const searchableFields = ["firstname", "middlename", "lastname", "address"];
            const STOP_WORDS = new Set(["wale", "waley", "ji", "ka", "ke", "ki", "ko", "se", "ne", "kar", "karne", "and", "of", "the", "mr", "mrs", "shri", "smt", "shri. "]);
            const sanitize = (t: string) => t.replace(/[,%().]/g, "").trim();
            const tokens = customerName.toLowerCase().split(/[\s,._-]+/).map(sanitize).filter((t: string) => t && !STOP_WORDS.has(t));

            let customers: any[] | null = null;

            if (tokens.length === 1) {
                // Single word → PostgREST OR across all name/address fields
                const conds = searchableFields.map(f => `${f}.ilike.%${tokens[0]}%`).join(",");
                const { data } = await pageAll(supabase.from("client_list")
                    .select("*")
                    .eq("delete_flag", 0)
                    .or(conds));
                customers = data;
            } else if (tokens.length > 1) {
                // Multi-word → fetch active clients and score token matches in JS (small dataset)
                const { data: all } = await pageAll(supabase.from("client_list")
                    .select("*")
                    .eq("delete_flag", 0));
                const norm = (v: any) => (v ? String(v).toLowerCase() : "");
                const threshold = Math.max(1, Math.ceil(tokens.length / 2));
                const score = (c: any) => {
                    const hay = searchableFields.map(f => norm(c[f]));
                    const matched = tokens.filter((t: string) => hay.some(x => x.includes(t))).length;
                    if (matched < threshold) return 0;
                    const name = `${norm(c.firstname)} ${norm(c.middlename)} ${norm(c.lastname)}`;
                    const nameMatched = tokens.filter((t: string) => name.includes(t)).length;
                    return matched * 10 + nameMatched; // more matched tokens > name-only matches
                };
                customers = (all || [])
                    .map(c => ({ c, s: score(c) }))
                    .filter(x => x.s > 0)
                    .sort((a, b) => b.s - a.s)
                    .slice(0, 5)
                    .map(x => x.c);
            }

            if (!customers || customers.length === 0) {
                // Fallback: search jobs by item/fault text
                const ors = tokens.map((t: string) => `item.ilike.%${t}%,fault.ilike.%${t}%`).join(",");
                const { data: jobsObj } = await supabase.from("transaction_list")
                    .select("job_id, client_name, item, fault, status, amount, date_created")
                    .eq("del_status", 0)
                    .or(ors)
                    .order("date_created", { ascending: false })
                    .limit(10);

                if (!jobsObj || jobsObj.length === 0) {
                    return { result: `No customer or jobs found matching the name '${customerName}'` };
                }
                return { result: `Customer not found in client list, but found these recent jobs matching '${customerName}'`, recent_jobs: jobsObj };
            }

            // If we found a customer, fetch some of their recent jobs
            const customerDetails = [];
            for (const cust of customers) {
               // The client_name column in transaction_list actually stores the client_list.id
               const { data: jobs } = await supabase.from("transaction_list")
                  .select("job_id, client_name, item, fault, status, amount, date_created")
                  .eq("del_status", 0)
                  .eq("client_name", cust.id)
                  .order("date_created", { ascending: false })
                  .limit(5);
               
               customerDetails.push({
                   customer_info: cust,
                   recent_jobs: jobs || []
               });
            }

            return { customers_found: customerDetails };
        }

        if (name === "get_job_details_by_id") {
            const jobId = args?.job_id;
            if (!jobId) return { error: "Job ID or Search text is required" };

            const isNumeric = /^\d+$/.test(jobId);
            let query = supabase.from("transaction_list").select("*").eq("del_status", 0);

            // Find the job with the exact job_id or search by text
            if (isNumeric) {
                query = query.eq("job_id", jobId);
            } else {
                query = query.or(`item.ilike.%${jobId}%,fault.ilike.%${jobId}%`).order('date_created', { ascending: false }).limit(5);
            }

            const { data: jobs, error } = await query;
            
            if (error) {
                return { error: `Database error while searching for ${jobId}: ${error.message}` };
            }

            if (!jobs || jobs.length === 0) {
                return { result: `Koi bhi job, jiska id ya keyword '${jobId}' ho, wo nahi mila.` };
            }

            for (const job of jobs) {
                if (job.client_name) {
                    // Fetch the actual client name based on ID
                    const { data: clientInfo } = await supabase.from("client_list")
                        .select("firstname, lastname")
                        .eq("id", job.client_name)
                        .maybeSingle();

                    if (clientInfo) {
                        (job as any).actual_client_name = `${clientInfo.firstname || ''} ${clientInfo.lastname || ''}`.trim();
                    } else {
                        (job as any).actual_client_name = "Unknown Client";
                    }
                }
                
                // Add status label
                (job as any).status_label = STATUS_MAP[job.status] || "Unknown";
            }

            return isNumeric ? { job_details: jobs[0] } : { matching_jobs: jobs };
        }

        if (name === "get_business_alerts") {
            const today = todayIST(); // YYYY-MM-DD
            const isAdmin = role === "admin";
            const alerts: any[] = [];

            // 1. Low stock (quantity across entries vs alert_quantity)
            const [invRes, prodRes] = await Promise.all([
                pageAll(supabase.from("inventory_list").select("product_id, quantity")),
                pageAll(supabase.from("product_list").select("id, name, alert_quantity").eq("delete_flag", 0)),
            ]);
            const qty: Record<number, number> = {};
            (invRes.data || []).forEach((i: any) => { qty[i.product_id] = (qty[i.product_id] || 0) + (Number(i.quantity) || 0); });
            const lowStock = (prodRes.data || [])
                .filter((p: any) => (Number(p.alert_quantity) || 0) > 0 && (qty[p.id] || 0) <= Number(p.alert_quantity))
                .map((p: any) => ({ product_id: p.id, name: p.name, quantity: qty[p.id] || 0, alert_quantity: Number(p.alert_quantity) }));
            if (lowStock.length) alerts.push({ type: "low_stock", severity: "warning", title: "Low Stock — Reorder Needed", items: lowStock });

            // 2. Pending jobs older than 2 days
            const { data: pendJobs } = await pageAll(supabase.from("transaction_list")
                .select("job_id, item, status, date_created")
                .in("status", [0, 1])
                .eq("del_status", 0)
                .order("date_created", { ascending: true }));
            const pending = (pendJobs || []).map((j: any) => ({
                job_id: j.job_id,
                item: j.item,
                status_label: STATUS_MAP[j.status] || "Unknown",
                days_pending: Math.max(0, Math.floor((Date.now() - new Date(j.date_created).getTime()) / 86400000)),
            })).filter((j: any) => j.days_pending >= 2).slice(0, 10);
            if (pending.length) alerts.push({ type: "pending_jobs", severity: "info", title: "Pending Jobs (2+ days old)", items: pending });

            // 3. Clients whose payment_due_date crossed — only if balance is still outstanding
            const { data: dueClients } = await pageAll(supabase.from("client_list")
                .select("id, firstname, lastname, contact, payment_due_date, opening_balance")
                .not("payment_due_date", "is", null));
            const crossed = (dueClients || []).filter((c: any) => c.payment_due_date && c.payment_due_date <= today);
            let dueDate: any[] = [];
            if (crossed.length) {
                const ids = crossed.map((c: any) => c.id);
                const [txRes, dirRes, payRes, loanRes] = await Promise.all([
                    pageAll(supabase.from("transaction_list").select("client_name, amount").eq("del_status", 0).eq("status", 5).in("client_name", ids.map(String))),
                    pageAll(supabase.from("direct_sales").select("client_id, total_amount").in("client_id", ids)),
                    pageAll(supabase.from("client_payments").select("client_id, amount, discount").in("client_id", ids)),
                    pageAll(supabase.from("client_loans").select("client_id, total_payable").in("client_id", ids)),
                ]);
                const repairBilled: Record<number, number> = {};
                (txRes.data || []).forEach((t: any) => { const id = Number(t.client_name); if (id) repairBilled[id] = (repairBilled[id] || 0) + (Number(t.amount) || 0); });
                const directBilled: Record<number, number> = {};
                (dirRes.data || []).forEach((d: any) => { if (d.client_id) directBilled[d.client_id] = (directBilled[d.client_id] || 0) + (Number(d.total_amount) || 0); });
                const loanGiven: Record<number, number> = {};
                (loanRes.data || []).forEach((l: any) => { if (l.client_id) loanGiven[l.client_id] = (loanGiven[l.client_id] || 0) + (Number(l.total_payable) || 0); });
                const totalPaid: Record<number, number> = {};
                (payRes.data || []).forEach((p: any) => { totalPaid[p.client_id] = (totalPaid[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0); });
                dueDate = crossed.map((c: any) => ({
                    client_id: c.id,
                    name: `${c.firstname} ${c.lastname}`.trim(),
                    contact: c.contact,
                    due_date: c.payment_due_date,
                    outstanding: Math.round(((Number(c.opening_balance) || 0) + (repairBilled[c.id] || 0) + (directBilled[c.id] || 0) + (loanGiven[c.id] || 0) - (totalPaid[c.id] || 0)) * 100) / 100,
                })).filter((c: any) => c.outstanding > 0);
            }
            if (dueDate.length) alerts.push({ type: "due_payment_date", severity: "warning", title: "Payment Due Date Crossed", items: dueDate });

            // 4. Today's attendance pending
            const { data: mechs } = await pageAll(supabase.from("mechanic_list").select("id, firstname, lastname").eq("delete_flag", 0));
            const { data: attToday } = await pageAll(supabase.from("attendance_list").select("mechanic_id").eq("curr_date", today));
            const presentIds = new Set((attToday || []).map((a: any) => a.mechanic_id));
            const missing = (mechs || []).filter((m: any) => !presentIds.has(m.id))
                .map((m: any) => ({ mechanic_id: m.id, name: `${m.firstname} ${m.lastname}`.trim() }));
            if (missing.length) alerts.push({ type: "attendance_missing", severity: "info", title: "Attendance Pending Today", items: missing });

            // 5-6. Admin-only financial alerts
            if (isAdmin) {
                const [clientsRes, txRes, dirRes, payRes, loanRes] = await Promise.all([
                    pageAll(supabase.from("client_list").select("id, firstname, lastname, contact, opening_balance").eq("delete_flag", 0)),
                    pageAll(supabase.from("transaction_list").select("client_name, amount").eq("del_status", 0).eq("status", 5)),
                    pageAll(supabase.from("direct_sales").select("client_id, total_amount")),
                    pageAll(supabase.from("client_payments").select("client_id, amount, discount")),
                    pageAll(supabase.from("client_loans").select("client_id, total_payable")),
                ]);
                const repairBilled: Record<number, number> = {};
                (txRes.data || []).forEach((t: any) => { const id = Number(t.client_name); if (id) repairBilled[id] = (repairBilled[id] || 0) + (Number(t.amount) || 0); });
                const directBilled: Record<number, number> = {};
                (dirRes.data || []).forEach((d: any) => { if (d.client_id) directBilled[d.client_id] = (directBilled[d.client_id] || 0) + (Number(d.total_amount) || 0); });
                const loanGiven: Record<number, number> = {};
                (loanRes.data || []).forEach((l: any) => { if (l.client_id) loanGiven[l.client_id] = (loanGiven[l.client_id] || 0) + (Number(l.total_payable) || 0); });
                const totalPaid: Record<number, number> = {};
                (payRes.data || []).forEach((p: any) => { totalPaid[p.client_id] = (totalPaid[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0); });
                const ob = (clientsRes.data || [])
                    .map((c: any) => ({
                        id: c.id, firstname: c.firstname, lastname: c.lastname, contact: c.contact, opening_balance: Number(c.opening_balance) || 0,
                        outstanding: Math.round(((Number(c.opening_balance) || 0) + (repairBilled[c.id] || 0) + (directBilled[c.id] || 0) + (loanGiven[c.id] || 0) - (totalPaid[c.id] || 0)) * 100) / 100,
                    }))
                    .filter((c: any) => c.outstanding > 0)
                    .sort((a: any, b: any) => b.outstanding - a.outstanding)
                    .slice(0, 5);
                if (ob.length) alerts.push({ type: "high_outstanding", severity: "warning", title: "High Outstanding (Admin)", items: ob });

                const { data: cLoans } = await supabase.from("client_loans")
                    .select("id, client_id, principal_amount, total_payable, emi_amount, status")
                    .eq("status", 1);
                if ((cLoans || []).length) alerts.push({ type: "active_loans", severity: "info", title: "Active Client Loans (Admin)", items: cLoans });
            }

            return {
                generated_at: `${today}T${new Date().toISOString()}`,
                count: alerts.length,
                alerts,
                note: isAdmin ? undefined : "Financial alerts (outstanding/loans) sirf Admin ko dikhte hain.",
            };
        }

        if (name === "get_inventory_status") {
            const [invRes, prodRes] = await Promise.all([
                pageAll(supabase.from("inventory_list").select("product_id, quantity, place")),
                pageAll(supabase.from("product_list").select("id, name, alert_quantity, price").eq("delete_flag", 0)),
            ]);
            const qty: Record<number, number> = {};
            (invRes.data || []).forEach((i: any) => { qty[i.product_id] = (qty[i.product_id] || 0) + (Number(i.quantity) || 0); });
            const items = (prodRes.data || []).map((p: any) => {
                const quantity = qty[p.id] || 0;
                const alert = Number(p.alert_quantity) || 0;
                return { product_id: p.id, name: p.name, price: Number(p.price) || 0, quantity, alert_quantity: alert, low_stock: alert > 0 && quantity <= alert };
            });
            return { total_products: items.length, low_stock_count: items.filter((x: any) => x.low_stock).length, inventory: items };
        }

        if (name === "get_client_outstanding") {
            const limit = parseInt(args?.limit) || 15;
            const [clientsRes, txRes, dirRes, payRes, loanRes] = await Promise.all([
                pageAll(supabase.from("client_list").select("id, firstname, middlename, lastname, contact, opening_balance").eq("delete_flag", 0)),
                pageAll(supabase.from("transaction_list").select("client_name, amount").eq("del_status", 0).eq("status", 5)),
                pageAll(supabase.from("direct_sales").select("client_id, total_amount")),
                pageAll(supabase.from("client_payments").select("client_id, amount, discount")),
                pageAll(supabase.from("client_loans").select("client_id, total_payable")),
            ]);
            const repairBilled: Record<number, number> = {};
            (txRes.data || []).forEach((t: any) => { const id = Number(t.client_name); if (id) repairBilled[id] = (repairBilled[id] || 0) + (Number(t.amount) || 0); });
            const directBilled: Record<number, number> = {};
            (dirRes.data || []).forEach((d: any) => { if (d.client_id) directBilled[d.client_id] = (directBilled[d.client_id] || 0) + (Number(d.total_amount) || 0); });
            const loanGiven: Record<number, number> = {};
            (loanRes.data || []).forEach((l: any) => { if (l.client_id) loanGiven[l.client_id] = (loanGiven[l.client_id] || 0) + (Number(l.total_payable) || 0); });
            const totalPaid: Record<number, number> = {};
            (payRes.data || []).forEach((p: any) => { totalPaid[p.client_id] = (totalPaid[p.client_id] || 0) + (Number(p.amount) || 0) + (Number(p.discount) || 0); });
            const list = (clientsRes.data || [])
                .map((c: any) => {
                    const ob = Number(c.opening_balance) || 0;
                    const rep = repairBilled[c.id] || 0;
                    const dir = directBilled[c.id] || 0;
                    const loan = loanGiven[c.id] || 0;
                    const paid = totalPaid[c.id] || 0;
                    return { client_id: c.id, name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(), contact: c.contact, opening_balance: ob, repair_billed: rep, direct_sales_billed: dir, loan_given: loan, total_paid: paid, net_balance: Math.round((ob + rep + dir + loan - paid) * 100) / 100 };
                })
                .filter((x: any) => x.net_balance > 0)
                .sort((a: any, b: any) => b.net_balance - a.net_balance)
                .slice(0, limit);
            return { outstanding_clients: list, note: "Balance = opening balance + delivered repairs + direct sales + loans given - total payments (incl. discounts)." };
        }

        if (name === "get_expense_report") {
            const from = args.from || args.start_date;
            const to = args.to || args.end_date;
            if (!from || !to) return { error: "From and To dates are required." };
            const { data } = await pageAll(supabase.from("expense_list")
                .select("category, amount, date_created")
                .gte("date_created", `${from}T00:00:00+05:30`)
                .lte("date_created", `${to}T23:59:59+05:30`));
            const byCat: Record<string, number> = {};
            let total = 0;
            (data || []).forEach((e: any) => {
                const amt = Number(e.amount) || 0;
                total += amt;
                const cat = e.category || "Other";
                byCat[cat] = Math.round(((byCat[cat] || 0) + amt) * 100) / 100;
            });
            return {
                from, to,
                total_expense: Math.round(total * 100) / 100,
                by_category: Object.entries(byCat)
                    .map(([category, amount]) => ({ category, amount }))
                    .sort((a: any, b: any) => b.amount - a.amount),
            };
        }

        if (name === "get_attendance_report") {
            const from = args.from || args.start_date;
            const to = args.to || args.end_date;
            if (!from || !to) return { error: "From and To dates are required." };
            const [attRes, mechRes] = await Promise.all([
                pageAll(supabase.from("attendance_list").select("mechanic_id, status, curr_date").gte("curr_date", from).lte("curr_date", to)),
                pageAll(supabase.from("mechanic_list").select("id, firstname, lastname").eq("delete_flag", 0)),
            ]);
            const mechName: Record<number, string> = {};
            (mechRes.data || []).forEach((m: any) => { mechName[m.id] = `${m.firstname} ${m.lastname}`.trim(); });
            const perMech: Record<number, any> = {};
            (attRes.data || []).forEach((a: any) => {
                if (!perMech[a.mechanic_id]) perMech[a.mechanic_id] = { mechanic_id: a.mechanic_id, name: mechName[a.mechanic_id] || `#${a.mechanic_id}`, present_days: 0, half_days: 0, total_days: 0 };
                perMech[a.mechanic_id].total_days++;
                if (a.status === 1) perMech[a.mechanic_id].present_days++;
                else if (a.status === 3) perMech[a.mechanic_id].half_days++;
            });
            return { from, to, summary: Object.values(perMech), note: "Based on attendance records in range." };
        }

        if (name === "get_loan_status") {
            const [lendersRes, loanPaysRes, cLoansRes, clientsRes] = await Promise.all([
                pageAll(supabase.from("lender_list").select("id, fullname, contact, loan_amount, interest_rate, emi_amount, status")),
                pageAll(supabase.from("loan_payments").select("lender_id, amount_paid")),
                pageAll(supabase.from("client_loans").select("id, client_id, principal_amount, total_payable, emi_amount, status, loan_date")),
                pageAll(supabase.from("client_list").select("id, firstname, lastname")),
            ]);
            const paid: Record<number, number> = {};
            (loanPaysRes.data || []).forEach((p: any) => { paid[p.lender_id] = (paid[p.lender_id] || 0) + (Number(p.amount_paid) || 0); });
            const lenderLoans = (lendersRes.data || []).map((l: any) => {
                const amt = Number(l.loan_amount) || 0;
                const paidAmt = paid[l.id] || 0;
                return { lender_id: l.id, fullname: l.fullname, contact: l.contact, loan_amount: amt, paid: Math.round(paidAmt * 100) / 100, remaining: Math.round((amt - paidAmt) * 100) / 100, status: l.status };
            });
            const clientName: Record<number, string> = {};
            (clientsRes.data || []).forEach((c: any) => { clientName[c.id] = `${c.firstname} ${c.lastname}`.trim(); });
            const clientLoans = (cLoansRes.data || []).filter((l: any) => l.status === 1).map((l: any) => ({
                loan_id: l.id,
                client_name: clientName[l.client_id] || `#${l.client_id}`,
                principal_amount: l.principal_amount,
                total_payable: l.total_payable,
                emi_amount: l.emi_amount,
            }));
            return { lender_loans: lenderLoans, active_client_loans: clientLoans };
        }

        return { error: "Unknown function call" };
    } catch (error: any) {
        console.error("Tool Execution Error:", error);
        return { error: error.message };
    }
}
