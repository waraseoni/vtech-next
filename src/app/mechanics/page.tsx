import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchMechanicsPageData } from "@/lib/server-mechanics";
import MechanicsBody from "./components/MechanicsBody";
import { MechanicsSkeleton } from "./MechanicsSkeleton";

export const dynamic = "force-dynamic";

async function MechanicsContent() {
  const { mechanics, userRole } = await fetchMechanicsPageData();
  return <MechanicsBody mechanics={mechanics} userRole={userRole} />;
}

export default async function MechanicsPage() {
  const user = await requireStaff();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={<MechanicsSkeleton />}>
      <MechanicsContent />
    </Suspense>
  );
}
