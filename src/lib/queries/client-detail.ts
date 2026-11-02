"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchClientDetailData, type ClientDetail } from "@/app/clients/clientDetailQueries";

// Query logic neutral module me hai (server RSC seed bhi wahi call karta hai).
export type {
  Client,
  PaymentReminder,
  Job,
  DirectSale,
  Payment,
  Loan,
  ClientDetail,
} from "@/app/clients/clientDetailQueries";

export async function fetchClientDetail(clientId: number): Promise<ClientDetail> {
  return fetchClientDetailData(supabase, clientId);
}

export const clientDetailKey = (clientId: number) => ["client-detail", clientId] as const;

export function clientDetailOptions(clientId: number) {
  return queryOptions<ClientDetail>({
    queryKey: clientDetailKey(clientId),
    queryFn: () => fetchClientDetail(clientId),
    staleTime: 30_000,
  });
}

export function useClientDetail(clientId: number) {
  const validId = Number.isFinite(clientId) && clientId > 0;
  return useQuery({ ...clientDetailOptions(clientId), enabled: validId });
}
