import { requireStaff } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { fetchMechanicsPageData } from "@/lib/server-mechanics";
import MechanicsBody from "./components/MechanicsBody";

// G3 migration: server component page. Data ab server par render-time fetch hota
// hai (cookie+RLS server client — service-role NEVER), phir interactive UI ko
// props ke roop me MechanicsBody (client component) ko milta hai. Sorted list
// SSR HTML me aa jata hai — client par ab initial fetch/loading nahi hai.
export const dynamic = "force-dynamic";

export default async function MechanicsPage() {
  const user = await requireStaff();
  if (!user) redirect("/login");

  const { mechanics, userRole } = await fetchMechanicsPageData();

  return <MechanicsBody mechanics={mechanics} userRole={userRole} />;
}
