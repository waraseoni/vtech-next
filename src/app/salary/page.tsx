import { redirect } from "next/navigation";

// Canonical salary page = /mechanics/salary (SSR report + master + payout +
// history view/edit/delete — sab port ho chuka hai).
// Ye route (purana client salary page) ab usi ka redirect hai — purane
// bookmarks seedha naye page par. `?month=` forward hota hai.
// NOTE: /salary/[id]/ledger alag drill-down route hai — untouched, kaam karta
// rahega (uska back-link redirect se hokar salary home pahunchta hai).
export default async function SalaryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) qs.set("month", sp.month);
  const suffix = qs.toString();
  redirect(`/mechanics/salary${suffix ? `?${suffix}` : ""}`);
}
