import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchClientsPageData } from "@/lib/server-clients";
import ClientsBody from "./components/ClientsBody";

// G3 pilot: server component page. Data ab server par render-time fetch hota hai
// (cookie+RLS server client — service-role NEVER), phir interactive UI ko props
// ke roop me ClientsBody (client component) ko milta hai.
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const { clients, firmInfo, userRole } = await fetchClientsPageData({
    userRole: session.role,
  });

  return <ClientsBody clients={clients} firmInfo={firmInfo} userRole={userRole} />;
}
