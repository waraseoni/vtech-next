"use client";

import AdminPage from "@/app/components/AdminPage";

export default function YearlyReportPage() {
  return (
    <AdminPage
      title="Yearly Report"
      subtitle="Yearly summary (under construction)."
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
        <p className="text-slate-400 text-sm">
          Ye page abhi scaffold hua hai. Next step: yearly range select karke
          `transaction_list`, `direct_sales`, `client_payments`, `expense_list`,
          `loan_payments` se totals + charts banana.
        </p>
      </div>
    </AdminPage>
  );
}

