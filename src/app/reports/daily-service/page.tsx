"use client";

import AdminPage from "@/app/components/AdminPage";

export default function DailyServiceReportPage() {
  return (
    <AdminPage
      title="Daily Service"
      subtitle="Day-wise service/jobs summary (under construction)."
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
        <p className="text-slate-400 text-sm">
          Next: `transaction_list` + `transaction_services` se daily count/revenue,
          aur mechanics-wise split (optional) banana.
        </p>
      </div>
    </AdminPage>
  );
}

