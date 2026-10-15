// Dashboard ke shared value/types — DONO taraf safe (zero runtime deps):
//   • src/lib/server-dashboard.ts   (server data layer, Phase 4 P1)
//   • DashboardBody.tsx             (client UI)
// Isme kabhi supabase / next/server / browser API import NAHI karna — warna
// client bundle me server-only code aa jayega. Sirf types + plain constants.
//
// STATUS_META yahan hai kyunki server statusData banata hai AUR client donut/
// chip colors isi se dikhata hai — dono jagah ek hi source of truth.

import type { WaitingSummary } from "./requiredParts";

export type Profile = { full_name: string; role: string };

export type Stat = {
  totalJobs: number;
  totalClients: number;
  pendingJobs: number;
  inProgressJobs: number;
  finishedJobs: number;
  deliveredJobs: number;
  totalMechanics: number;
  lowStock: number;
  todayRevenue: number;
};

export type RecentJob = {
  id: number;
  job_id: string | null;
  client_name: string;
  item: string;
  amount: number;
  status: number;
};

export type RecentPayment = {
  id: number;
  amount: number;
  payment_mode: string;
  payment_date: string;
  client_name: string;
};

export type LowStockItem = { name: string; quantity: number; place: string; alert: number };

export type RevenuePoint = { month: string; revenue: number };

export type StatusPoint = { name: string; value: number; color: string };

/** Server (server-dashboard.ts) se body ko milne wala first-paint payload. */
export type DashboardInitialData = {
  profile: Profile;
  stats: Stat;
  statusData: StatusPoint[];
  revenueData: RevenuePoint[];
  recentJobs: RecentJob[];
  recentPayments: RecentPayment[];
  lowStockItems: LowStockItem[];
  waitingSummary: WaitingSummary;
};

export const STATUS_META = [
  { label: "Pending", color: "#94a3b8" },
  { label: "In Progress", color: "#f59e0b" },
  { label: "Finished", color: "#06b6d4" },
  { label: "Paid", color: "#10b981" },
  { label: "Cancelled", color: "#ef4444" },
  { label: "Delivered", color: "#3b82f6" },
];
