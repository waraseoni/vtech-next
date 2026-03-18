"use client";

import AdminPage from "@/app/components/AdminPage";

export default function ClientAmtPage() {
  return (
    <AdminPage
      title="Client Amount"
      subtitle="Client opening balance / adjustments (under construction)."
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
        <p className="text-slate-400 text-sm">
          Next: `client_list.opening_balance` ko manage karna, aur client ledger me
          opening balance ko include karna.
        </p>
      </div>
    </AdminPage>
  );
}

