"use client";

import { queryOptions } from "@tanstack/react-query";
import { supabase, getCachedUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import {
  JOB_STATUS_DELIVERED,
  LOAN_STATUS_ACTIVE,
  balanceFromMaps,
  buildDueMaps,
} from "@/lib/client-due";

export interface JobDetail {
  id: number;
  job_id: string;
  code: string;
  client_name: string;
  item: string;
  fault: string;
  remark: string;
  uniq_id: string;
  amount: number;
  mechanic_amount: number;
  mechanic_commission_amount: number;
  mechanic_id: number | null;
  user_id: number;
  del_status: number;
  status: number;
  location_id?: number | null;
  date_created: string;
  date_updated: string;
  date_completed: string | null;
}

export interface Client {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  email: string;
  address: string;
  opening_balance?: number;
}

export interface Mechanic {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  designation: string;
  contact: string;
}

export interface TransactionProduct {
  transaction_id: number;
  product_id: number;
  product_name: string | null;
  qty: number;
  price: number;
  hsn: string | null;
}

export interface TransactionService {
  transaction_id: number;
  service_id: number;
  service_name: string | null;
  price: number;
  hsn: string | null;
}

export interface TransactionImage {
  id: number;
  transaction_id: number;
  image_path: string;
  date_created: string;
}

export interface JobViewSnapshot {
  userRole: string;
  job: JobDetail;
  prevJob: { id: number; job_id: string } | null;
  nextJob: { id: number; job_id: string } | null;
  client: Client | null;
  /** Client ka total outstanding (net due) — jobs list ke badge jaisa hi formula. */
  clientDue: number;
  mechanic: Mechanic | null;
  images: TransactionImage[];
  products: TransactionProduct[];
  services: TransactionService[];
}

export const jobViewKey = (id: number) => ["job-view", id] as const;

// system_info YAHAN nahi — firm info shared `useSystemInfo()` cache se aata hai
// (har mount par alag se 1 round-trip pehle leta tha).
export async function fetchJobView(numId: number): Promise<JobViewSnapshot> {
  const {
    data: { user },
  } = await getCachedUser();

  const [profRes, jobRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("transaction_list")
      .select(
        "id, job_id, code, client_name, item, fault, remark, uniq_id, amount, mechanic_amount, mechanic_commission_amount, mechanic_id, user_id, del_status, status, location_id, date_created, date_updated, date_completed"
      )
      .eq("id", numId)
      .eq("del_status", 0)
      .single(),
  ]);

  const { data: jobData, error: jobErr } = jobRes;
  if (jobErr || !jobData) throw jobErr ?? new Error("Job not found");

  // Neighboring active jobs for Prev/Next navigation (order by id, newest first)
  const [prevRes, nextRes] = await Promise.all([
    supabase
      .from("transaction_list")
      .select("id, job_id")
      .eq("del_status", 0)
      .lt("id", numId)
      .order("id", { ascending: false })
      .limit(1),
    supabase
      .from("transaction_list")
      .select("id, job_id")
      .eq("del_status", 0)
      .gt("id", numId)
      .order("id", { ascending: true })
      .limit(1),
  ]);

  const clientId = Number(jobData.client_name);
  // Due inputs — enrichJobRows (jobs list) ke EXACT filters: sirf Delivered (5)
  // aur non-deleted jobs bill hue maane jaate hain (PHP formula).
  const [clientRes, mechRes, prodRes, svcRes, imgRes, billedRes, paidRes, salesRes, loansRes] =
    await Promise.all([
      supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact, email, address, opening_balance")
        .eq("id", clientId)
        .single(),
      jobData.mechanic_id
        ? supabase
            .from("mechanic_list")
            .select("id, firstname, middlename, lastname, designation, contact")
            .eq("id", jobData.mechanic_id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("transaction_products")
        .select("transaction_id, product_id, product_name, qty, price")
        .eq("transaction_id", numId),
      supabase
        .from("transaction_services")
        .select("transaction_id, service_id, service_name, price")
        .eq("transaction_id", numId),
      supabase
        .from("transaction_images")
        .select("id, transaction_id, image_path, date_created")
        .eq("transaction_id", numId)
        .order("date_created", { ascending: false }),
      supabase
        .from("transaction_list")
        .select("client_name, amount")
        .eq("status", JOB_STATUS_DELIVERED)
        .neq("del_status", 1)
        .eq("client_name", String(clientId)),
      supabase
        .from("client_payments")
        .select("client_id, amount, discount, loan_id")
        .eq("client_id", clientId),
      supabase.from("direct_sales").select("client_id, total_amount").eq("client_id", clientId),
      supabase
        .from("client_loans")
        .select("id, client_id, total_payable")
        .eq("status", LOAN_STATUS_ACTIVE)
        .eq("client_id", clientId),
    ]);

  const dueMaps = buildDueMaps({
    repairs: billedRes.data,
    directSales: salesRes.data,
    payments: paidRes.data,
    loans: loansRes.data,
  });
  const clientDue = balanceFromMaps(
    dueMaps,
    clientId,
    (clientRes.data as { opening_balance?: number } | null)?.opening_balance
  );

  if (prodRes.error || svcRes.error || imgRes.error) {
    // Column-projection typo yahan chup-chup empty lists nahi dega (regression 29457)
    logger.warn("txn line-items fetch:", prodRes.error || svcRes.error || imgRes.error);
  }

  const prods = (prodRes.data || []) as TransactionProduct[];
  const prodIds = [...new Set(prods.map((p) => p.product_id).filter(Boolean))];
  const svcs = (svcRes.data || []) as TransactionService[];
  const svcIds = [...new Set(svcs.map((s) => s.service_id).filter(Boolean))];
  // Name/HSN lookups independent of each other — one round (perf Phase 5)
  const [plRes, slRes] = await Promise.all([
    prodIds.length > 0
      ? supabase.from("product_list").select("id, name, hsn").in("id", prodIds)
      : Promise.resolve({ data: null }),
    svcIds.length > 0
      ? supabase.from("service_list").select("id, name, hsn").in("id", svcIds)
      : Promise.resolve({ data: null }),
  ]);

  const plRows = plRes.data;
  const pm = Object.fromEntries((plRows || []).map((p) => [p.id, p.name]));
  const phsn = Object.fromEntries((plRows || []).map((p) => [p.id, p.hsn]));
  const slRows = slRes.data;
  const sm = Object.fromEntries((slRows || []).map((s) => [s.id, s.name]));
  const shsn = Object.fromEntries((slRows || []).map((s) => [s.id, s.hsn]));

  return {
    userRole: user ? (profRes.data as { role?: string } | null)?.role || "staff" : "staff",
    job: jobData as JobDetail,
    prevJob: (prevRes.data?.[0] as { id: number; job_id: string } | null) ?? null,
    nextJob: (nextRes.data?.[0] as { id: number; job_id: string } | null) ?? null,
    client: clientRes.data ? (clientRes.data as Client) : null,
    clientDue,
    mechanic: mechRes.data ? (mechRes.data as Mechanic) : null,
    images: (imgRes.data || []) as TransactionImage[],
    products: prods.map((p) => ({
      ...p,
      product_name: p.product_name || pm[p.product_id] || null,
      hsn: phsn[p.product_id] || null,
    })),
    services: svcs.map((s) => ({
      ...s,
      service_name: s.service_name || sm[s.service_id] || null,
      hsn: shsn[s.service_id] || null,
    })),
  };
}

export function jobViewOptions(id: number) {
  return queryOptions<JobViewSnapshot>({
    queryKey: jobViewKey(id),
    queryFn: () => fetchJobView(id),
  });
}
