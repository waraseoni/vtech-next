"use client";

import AdminPage from "@/app/components/AdminPage";

export default function DailySalesReportPage() {
  return (
    <AdminPage
      title="Daily Sales"
      subtitle="Day-wise sales summary (under construction)."
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
        <p className="text-slate-400 text-sm">
          Next: selected date range me `direct_sales` + `direct_sale_items` se totals,
          aur `transaction_list` (delivered/paid) se service totals combine karke daily breakdown.
        </p>
      </div>
    </AdminPage>
  );
}

