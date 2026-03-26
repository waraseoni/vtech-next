import { createClient } from "@supabase/supabase-js";
import { FunctionDeclaration } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
          description: "Number of jobs to return",
        },
        status: {
          type: "integer",
          description: "Optional job status to filter by.",
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
            const limit = args?.limit || 5;
            let query = supabase.from("transaction_list")
                .select("job_id, client_name, item, fault, status, amount, date_created")
                .eq("del_status", 0)
                .order("date_created", { ascending: false })
                .limit(limit);
                
            if (args?.status !== undefined) {
                query = query.eq("status", args.status);
            }
            
            const { data } = await query;
            return { recent_jobs: data || [] };
        }

        if (name === "get_job_statistics") {
            let countQuery = supabase.from("transaction_list").select("*", { count: "exact", head: true }).eq("del_status", 0);
            let revenueQuery = supabase.from("transaction_list").select("amount").in("status", [3, 5]).eq("del_status", 0);
            
            if (args?.start_date) {
                countQuery = countQuery.gte("date_created", `${args.start_date}T00:00:00.000Z`);
                revenueQuery = revenueQuery.gte("date_created", `${args.start_date}T00:00:00.000Z`);
            }
            if (args?.end_date) {
                countQuery = countQuery.lte("date_created", `${args.end_date}T23:59:59.999Z`);
                revenueQuery = revenueQuery.lte("date_created", `${args.end_date}T23:59:59.999Z`);
            }
            
            const { count: jobsCount } = await countQuery;
            const { data: revenueData } = await revenueQuery;
            
            const totalRevenue = revenueData?.reduce((sum, job) => sum + (Number(job.amount) || 0), 0) || 0;
            
            return {
                start_date_filtered: args?.start_date || "beginning of time",
                end_date_filtered: args?.end_date || "today",
                total_jobs_created: jobsCount,
                total_revenue_from_paid_delivered_jobs: totalRevenue
            };
        }

        if (name === "get_mechanic_performance") {
            const { data } = await supabase.from("mechanic_list")
                .select("firstname, lastname, designation, contact, status")
                .eq("delete_flag", 0);
            return { mechanics: data || [] };
        }

        return { error: "Unknown function call" };
    } catch (error: any) {
        console.error("Tool Execution Error:", error);
        return { error: error.message };
    }
}
