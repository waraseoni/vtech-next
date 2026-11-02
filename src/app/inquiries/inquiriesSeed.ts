import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfMonthIST, endOfMonthIST } from "@/lib/dateUtils";

/**
 * `/inquiries` (default view: current month, status = all) ka neutral server
 * seed — client ke `fetchInquiries` + `fetchAllTimeStats` ka read-only mirror.
 * Caller cookie+RLS client pass karta hai (koi write nahi).
 */

export type InquiryStatusFilter = "all" | "unread" | "read";

export type Inquiry = {
  id: number;
  fullname: string;
  contact: string;
  email: string;
  message: string;
  status: 0 | 1;
  date_created: string;
};

export type InquiriesSeed = {
  from: string;
  to: string;
  status: InquiryStatusFilter;
  data: Inquiry[];
  allTimeStats: { total: number; unread: number };
};

export async function fetchInquiriesSeed(
  supabase: SupabaseClient,
  from = startOfMonthIST(),
  to = endOfMonthIST(),
  status: InquiryStatusFilter = "all"
): Promise<InquiriesSeed> {
  // Mirror: date range + status=0 first, newest first.
  let q = supabase
    .from("message_list")
    .select("*")
    .gte("date_created", `${from}T00:00:00`)
    .lte("date_created", `${to}T23:59:59`)
    .order("status", { ascending: true })
    .order("date_created", { ascending: false });

  if (status === "unread") q = q.eq("status", 0);
  if (status === "read") q = q.eq("status", 1);

  // All-time unread badge ke do head-counts (client ki tarah parallel).
  const [{ data, error }, totalRes, unreadRes] = await Promise.all([
    q,
    supabase.from("message_list").select("status", { count: "exact", head: true }),
    supabase.from("message_list").select("status", { count: "exact", head: true }).eq("status", 0),
  ]);
  if (error) throw error;

  return {
    from,
    to,
    status,
    data: (data || []) as Inquiry[],
    allTimeStats: { total: totalRes.count || 0, unread: unreadRes.count || 0 },
  };
}
