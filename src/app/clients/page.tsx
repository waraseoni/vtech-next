import { requireStaffWithRole } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchClientsBatches } from "@/lib/server-clients";
import ClientsBody from "./components/ClientsBody";

// G3 pilot: server component page. Data ab server par render-time fetch hota hai
// (cookie+RLS server client — service-role NEVER), phir interactive UI ko props
// ke roop me ClientsBody (client component) ko milta hai.
//
// PERF (17 Nov 2026): clients/firm-info fetch auth ke SAATH parallel start
// hota hai (pehle profiles RTT ke BAAD hi shuru hota tha). Role sirf UI gate
// ke liye chahiye, data queries RLS cookie se hi chalti hain — jobs page wala
// hi pattern.
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const batchesPromise = fetchClientsBatches();
  // Redirect path par bhi rejection handled rahe (warna unhandled warning).
  void batchesPromise.catch(() => {});

  const session = await requireStaffWithRole();
  if (!session) redirect("/login");

  const { clients, firmInfo } = await batchesPromise;

  return <ClientsBody clients={clients} firmInfo={firmInfo} userRole={session.role} />;
}
