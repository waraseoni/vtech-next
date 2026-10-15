import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchDashboardInitialData } from "@/lib/server-dashboard";
import DashboardBody from "./DashboardBody";

// Phase 4 P1 (docs/plans/rsc_phase4_plan.md): dashboard pehle poora client
// page tha — hydration ke BAAD 5-6 sequential fetch batches chalte the
// (waterfall). Ab first-paint data server par render-time par aata hai
// (cookie+RLS server client — service-role NEVER), phir DashboardBody
// (client) interactive UI ko props ke roop me leta hai. Logged-out par
// requireStaffWithRole khud /login redirect karta hai.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const initial = await fetchDashboardInitialData({
    userId: session.user.id,
    userRole: session.role,
    userFullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
    userEmail: session.user.email ?? null,
  });

  return <DashboardBody initial={initial} />;
}
