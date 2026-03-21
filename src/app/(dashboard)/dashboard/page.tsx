"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Dashboard page — redirects to root page (which shows dashboard content when logged in)
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to root page which shows dashboard when logged in
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-slate-600"/>
    </div>
  );
}
