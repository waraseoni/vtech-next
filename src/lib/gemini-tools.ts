import { createClient } from "@supabase/supabase-js";
import { FunctionDeclaration } from "@google/generative-ai";

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
    },
  }
];

// 2. Execution Logic for the Tools
export async function executeGeminiTool(functionCall: any): Promise<any> {
    const name = functionCall.name;
    const args = functionCall.args;
    
    try {
        if (name === "get_business_summary") {
            const { count: clientsCount } = await supabase.from("client_list").select("*", { count: "exact", head: true }).eq("delete_flag", 0);
            const { count: jobsCount } = await supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0);
            
            // Calculate total revenue (Paid and Delivered jobs)
            const { data: revenueData } = await supabase.from("transaction_list").select("amount").in("status", [3, 5]).eq("del_status", 0);
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
            const { data: revData } = await supabase.from("transaction_list")
                .select("amount, status, date_completed, date_updated")
                .eq("status", 5)
                .eq("del_status", 0)
                .gte("date_completed", `${args.start_date}T00:00:00+05:30`)
                .lte("date_completed", `${args.end_date}T23:59:59+05:30`);
            
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
                supabase.from("transaction_list")
                    .select("id, amount, status, date_completed, mechanic_commission_amount")
                    .eq("status", 5)
                    .eq("del_status", 0)
                    .gte("date_completed", `${from}T00:00:00+05:30`)
                    .lte("date_completed", `${to}T23:59:59+05:30`),
                supabase.from("direct_sales")
                    .select("id, total_amount, date_created, client_id")
                    .gte("date_created", `${from}T00:00:00+05:30`)
                    .lte("date_created", `${to}T23:59:59+05:30`),
                supabase.from("client_payments")
                    .select("id, amount, discount, payment_date")
                    .gte("payment_date", `${from}T00:00:00+05:30`)
                    .lte("payment_date", `${to}T23:59:59+05:30`),
                supabase.from("expense_list")
                    .select("amount, date_created")
                    .gte("date_created", `${from}T00:00:00+05:30`)
                    .lte("date_created", `${to}T23:59:59+05:30`),
                supabase.from("loan_payments")
                    .select("amount_paid")
                    .gte("payment_date", `${from}T00:00:00+05:30`)
                    .lte("payment_date", `${to}T23:59:59+05:30`),
                supabase.from("attendance_list")
                    .select("mechanic_id, status")
                    .in("status", [1, 3])
                    .gte("curr_date", from)
                    .lte("curr_date", to),
                supabase.from("mechanic_list")
                    .select("id, daily_salary")
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
            const { data } = await supabase.from("mechanic_list")
                .select("firstname, lastname, designation, contact, status")
                .eq("delete_flag", 0);
            return { mechanics: data || [] };
        }

        if (name === "get_customer_details_by_name") {
            const customerName = args?.customer_name;
            if (!customerName) return { error: "Customer name is required" };

            // 1. Search in client_list (assuming firstname or lastname matches)
            const { data: customers } = await supabase.from("client_list")
                .select("*")
                .eq("delete_flag", 0)
                .or(`firstname.ilike.%${customerName}%,lastname.ilike.%${customerName}%`);
            
            if (!customers || customers.length === 0) {
                // If not found in client_list, try searching directly in transaction_list for jobs
                const { data: jobsObj } = await supabase.from("transaction_list")
                    .select("job_id, client_name, item, fault, status, amount, date_created")
                    .eq("del_status", 0)
                    .ilike("client_name", `%${customerName}%`)
                    .order("date_created", { ascending: false })
                    .limit(5);

                if (!jobsObj || jobsObj.length === 0) {
                    return { result: `No customer or jobs found matching the name '${customerName}'` };
                }
                return { result: `Customer not found in client list, but found these recent jobs for '${customerName}'`, recent_jobs: jobsObj };
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

        return { error: "Unknown function call" };
    } catch (error: any) {
        console.error("Tool Execution Error:", error);
        return { error: error.message };
    }
}
