import { Suspense } from "react";
import { requireStaffWithRole, type ServerUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchClientsBatches } from "@/lib/server-clients";
import ClientsBody from "./components/ClientsBody";
import { ClientsSkeleton } from "./ClientsSkeleton";

export const dynamic = "force-dynamic";

type SessionInfo = {
  user: ServerUser;
  role: string;
};

async function ClientsContent({ session }: { session: SessionInfo }) {
  const { clients, firmInfo } = await fetchClientsBatches();
  return <ClientsBody clients={clients} firmInfo={firmInfo} userRole={session.role} />;
}

export default async function ClientsPage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  return (
    <Suspense fallback={<ClientsSkeleton />}>
      <ClientsContent session={session} />
    </Suspense>
  );
}
