import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchExpensesPageData } from "@/lib/server-expenses";
import ExpensesPageInner from "./components/ExpensesPageInner";

// G3 migration: server component page. Data ab server par render-time fetch hota
// hai (cookie+RLS server client — service-role NEVER), phir interactive UI ko
// props ke roop me ExpensesPageInner (client component) ko milta hai. Pehla
// document SSR HTML me hi aata hai — client par ab initial fetch/loading nahi.
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const user = await requireStaff();
  if (!user) redirect("/login");

  const { mechanics, staffPayments, shopExpenses } = await fetchExpensesPageData();

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ExpensesPageInner
        initialMechanics={mechanics}
        initialStaffPayments={staffPayments}
        initialShopExpenses={shopExpenses}
      />
    </Suspense>
  );
}
