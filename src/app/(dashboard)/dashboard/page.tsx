import { Suspense } from "react";
import { requireStaffWithRole, type ServerUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchDashboardBatches, fetchDashboardProfile } from "@/lib/server-dashboard";
import DashboardBody from "./DashboardBody";
import { DashboardSkeleton } from "./DashboardSkeleton";

export const dynamic = "force-dynamic";

type SessionInfo = {
  user: ServerUser;
  role: string;
};

async function DashboardContent({ session }: { session: SessionInfo }) {
  const [batches, profile] = await Promise.all([
    fetchDashboardBatches(),
    fetchDashboardProfile({
      userId: session.user.id,
      userRole: session.role,
      userFullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
      userEmail: session.user.email ?? null,
    }),
  ]);

  return <DashboardBody initial={{ profile, ...batches }} />;
}

export default async function DashboardPage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent session={session} />
    </Suspense>
  );
}
