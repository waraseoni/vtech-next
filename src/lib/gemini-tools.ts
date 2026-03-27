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

// 1. Definition of Tools (Functions) that Gemini can call
export const geminiTools: FunctionDeclaration[] = [
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
    } as any,
  },
  {
    name: "get_job_statistics",
    description: "Fetches accurate aggregated statistics about jobs (count and total revenue) optionally filtered by a date range (start_date and end_date). Use this when asked 'how many jobs this month' or 'what is the revenue between dates'.",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (e.g., '2026-03-01')",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (e.g., '2026-03-31')",
        },
      },
    } as any,
  },
  {
    name: "get_mechanic_performance",
    description: "Fetches the performance and details of all mechanics/staff.",
    parameters: {
      type: "object",
      properties: {},
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
    description: "Fetches a comprehensive financial report for a specific date range. Includes Total Revenue (from delivered/paid jobs) and Total Cash In (actual payments received).",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (e.g., '2026-03-24')",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (e.g., '2026-03-24')",
        },
      },
      required: ["start_date", "end_date"],
    } as any,
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
                countQuery = countQuery.gte("date_created", `${args.start_date}T00:00:00.000Z`);
            }
            if (args?.end_date) {
                countQuery = countQuery.lte("date_created", `${args.end_date}T23:59:59.999Z`);
            }
            
            const { count: jobsCount } = await countQuery;

            // Revenue calculation - filter by date_completed (status 5) or date_updated (status 3)
            let revQuery = supabase.from("transaction_list").select("amount, status, date_completed, date_updated").in("status", [3, 5]).eq("del_status", 0);
            
            if (args?.start_date) {
                revQuery = revQuery.or(`date_completed.gte.${args.start_date}T00:00:00.000Z,date_updated.gte.${args.start_date}T00:00:00.000Z`);
            }
            if (args?.end_date) {
                revQuery = revQuery.or(`date_completed.lte.${args.end_date}T23:59:59.999Z,date_updated.lte.${args.end_date}T23:59:59.999Z`);
            }

            const { data: revData } = await revQuery;
            const totalRevenue = revData?.reduce((sum, job) => sum + (Number(job.amount) || 0), 0) || 0;
            
            return {
                start_date_filtered: args?.start_date || "beginning of time",
                end_date_filtered: args?.end_date || "today",
                total_jobs_created: jobsCount,
                total_revenue_from_paid_delivered_jobs: totalRevenue
            };
        }

        if (name === "get_financial_report") {
            const start = args?.start_date;
            const end = args?.end_date;
            if (!start || !end) return { error: "Start date and end date are required." };

            // 1. Revenue: Delivered or Paid jobs during this period
            // Status 5 is Delivered, Status 3 is Paid.
            const { data: revData } = await supabase.from("transaction_list")
                .select("amount, status, date_completed, date_updated")
                .in("status", [3, 5])
                .eq("del_status", 0)
                .or(`date_completed.gte.${start}T00:00:00,date_updated.gte.${start}T00:00:00`)
                .or(`date_completed.lte.${end}T23:59:59,date_updated.lte.${end}T23:59:59`);
                // Note: .or in Supabase JS is tricky for complex logic. 
                // We'll filter precisely in JS to be safe.
            
            const filteredRev = revData?.filter(job => {
                const checkDate = job.status === 5 ? job.date_completed : job.date_updated;
                if (!checkDate) return false;
                const d = checkDate.split("T")[0];
                return d >= start && d <= end;
            }) || [];

            const totalRevenue = filteredRev.reduce((sum, job) => sum + (Number(job.amount) || 0), 0);

            // 2. Cash In: Actual payments received during this period
            const { data: payData } = await supabase.from("client_payments")
                .select("amount")
                .gte("payment_date", start)
                .lte("payment_date", end);
            
            const totalCashIn = payData?.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0) || 0;

            // 3. Jobs Created
            const { count: newJobs } = await supabase.from("transaction_list")
                .select("*", { count: "exact", head: true })
                .eq("del_status", 0)
                .gte("date_created", `${start}T00:00:00`)
                .lte("date_created", `${end}T23:59:59`);

            return {
                period: `${start} to ${end}`,
                total_revenue_amount: totalRevenue,
                total_cash_in_amount: totalCashIn,
                new_jobs_created: newJobs,
                note: "Revenue is the total bill value of jobs marked Delivered/Paid today. Cash In is the actual money collected today."
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
            if (!jobId) return { error: "Job ID is required" };

            // Find the job with the exact job_id
            const { data: jobs, error } = await supabase.from("transaction_list")
                .select("*")
                .eq("del_status", 0)
                .eq("job_id", jobId);
            
            if (error) {
                return { error: `Database error while searching for Job ID ${jobId}: ${error.message}` };
            }

            if (!jobs || jobs.length === 0) {
                return { result: `Koi bhi job, jiska id '${jobId}' ho, wo nahi mila.` };
            }

            const job = jobs[0];
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

            return { job_details: job };
        }

        return { error: "Unknown function call" };
    } catch (error: any) {
        console.error("Tool Execution Error:", error);
        return { error: error.message };
    }
}
