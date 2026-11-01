"use client";

import { queryOptions } from "@tanstack/react-query";
import { supabase, getCachedUser } from "@/lib/supabase";
import { fetchJobViewData, type JobViewSnapshot } from "@/app/jobs/[id]/view/jobViewQueries";

// Query logic neutral module me hai (server RSC seed bhi wahi call karta hai).
export type {
  JobDetail,
  Client,
  Mechanic,
  TransactionProduct,
  TransactionService,
  TransactionImage,
  JobViewSnapshot,
} from "@/app/jobs/[id]/view/jobViewQueries";

export const jobViewKey = (id: number) => ["job-view", id] as const;

// system_info YAHAN nahi — firm info shared `useSystemInfo()` cache se aata hai.
export async function fetchJobView(numId: number): Promise<JobViewSnapshot> {
  const {
    data: { user },
  } = await getCachedUser();

  let userRole = "staff";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = (profile as { role?: string } | null)?.role || "staff";
  }

  return fetchJobViewData(supabase, numId, userRole);
}

export function jobViewOptions(id: number) {
  return queryOptions<JobViewSnapshot>({
    queryKey: jobViewKey(id),
    queryFn: () => fetchJobView(id),
  });
}
