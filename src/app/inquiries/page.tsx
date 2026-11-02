import { Suspense } from "react";
import InquiriesClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchInquiriesSeed } from "./inquiriesSeed";
import { MessageSquare } from "lucide-react";

export const metadata = {
  title: "Inquiries",
};

export const dynamic = "force-dynamic";

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const { from, to, status } = await searchParams;
  // Sirf default view (current month, all statuses) seed hota hai — URL filters
  // par client apna Supabase fetch chalata hai.
  const initial =
    !from && !to && !status
      ? await loadStaffSeed("Inquiries", (supabase) => fetchInquiriesSeed(supabase))
      : null;

  return (
    <Suspense
      fallback={<PageLoader icon={MessageSquare} label="Loading Inquiries..." tone="blue" />}
    >
      <InquiriesClient initial={initial} />
    </Suspense>
  );
}
