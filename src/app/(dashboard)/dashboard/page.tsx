import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchDashboardBatches, fetchDashboardProfile } from "@/lib/server-dashboard";
import DashboardBody from "./DashboardBody";

// Phase 4 P1 (docs/plans/rsc_phase4_plan.md): dashboard pehle poora client
// page tha — hydration ke BAAD 5-6 sequential fetch batches chalte the
// (waterfall). Ab first-paint data server par render-time par aata hai
// (cookie+RLS server client — service-role NEVER), phir DashboardBody
// (client) interactive UI ko props ke roop me leta hai. Logged-out par
// requireStaffWithRole khud /login redirect karta hai.
//
// PERF (17 Nov 2026): data batches auth ke SAATH parallel start hote hain —
// pehle auth (getClaims + profiles RTT) ke BAAD hi batches shuru hoti thin.
// Sirf profile widget ko userId chahiye, isliye wo auth ke baad chalta hai.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const batchesPromise = fetchDashboardBatches();
  // Redirect path par bhi rejection handled rahe (warna unhandled warning).
  void batchesPromise.catch(() => {});

  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const [batches, profile] = await Promise.all([
    batchesPromise,
    fetchDashboardProfile({
      userId: session.user.id,
      userRole: session.role,
      userFullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
      userEmail: session.user.email ?? null,
    }),
  ]);

  return <DashboardBody initial={{ profile, ...batches }} />;
}
