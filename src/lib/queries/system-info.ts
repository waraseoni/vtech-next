"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type SystemInfo = Record<string, string>;

export const systemInfoKey = ["system-info"] as const;

// Firm ka naam/address/logo har page par chahiye aur bahut kam badalta hai —
// pehle yeh har mount par 1 round-trip leta tha.
export function systemInfoOptions() {
  return queryOptions<SystemInfo>({
    queryKey: systemInfoKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("system_info").select("meta_field, meta_value");
      if (error) throw error;
      const info: SystemInfo = {};
      data?.forEach((r) => {
        info[r.meta_field] = r.meta_value;
      });
      return info;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useSystemInfo(): SystemInfo {
  const { data } = useQuery(systemInfoOptions());
  return data ?? {};
}
