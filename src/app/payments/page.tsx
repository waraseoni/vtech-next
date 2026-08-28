import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchPaymentsPageData } from "@/lib/server-payments";
import PaymentsPageInner from "./components/PaymentsPageInner";

// G3 migration: server component page. Data ab server par render-time fetch hota
// hai (cookie+RLS server client — service-role NEVER), phir interactive UI ko
// props ke roop me PaymentsPageInner (client component) ko milta hai. Pehla
// document SSR HTML me hi aata hai — client par ab initial fetch/loading nahi.
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireStaff();
  if (!user) redirect("/login");

  const { clients, payments } = await fetchPaymentsPageData();

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PaymentsPageInner initialClients={clients} initialPayments={payments} />
    </Suspense>
  );
}
