import { Suspense } from "react";
import { Store } from "lucide-react";
import VyaparDarpanClient from "./client";
import PageLoader from "@/components/PageLoader";

export const metadata = {
  title: "Vyapar Darpan — Business Mirror — V-TECH",
};

// BUG FIX: Validate date params — garbage ?from=abc values would break date parsing.
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export default async function VyaparDarpanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = isValidDate(params.from || "") ? params.from! : "";
  const to = isValidDate(params.to || "") ? params.to! : "";

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Suspense
        fallback={<PageLoader icon={Store} label="Polishing the Mirror..." tone="purple" />}
      >
        <VyaparDarpanClient fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}
