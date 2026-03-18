"use client";

import AdminPage from "@/app/components/AdminPage";

export default function BackupPage() {
  return (
    <AdminPage
      title="Backup"
      subtitle="Backup/export tools (under construction)."
    >
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 space-y-3">
        <p className="text-slate-400 text-sm">
          Abhi export/print routes already hain:
        </p>
        <ul className="text-slate-500 text-sm list-disc pl-5 space-y-1">
          <li><code className="text-slate-400">/api/export-transactions</code></li>
          <li><code className="text-slate-400">/api/print-transactions</code></li>
          <li><code className="text-slate-400">/api/print-bill</code></li>
        </ul>
        <p className="text-slate-400 text-sm">
          Next: UI buttons + date range selectors + downloaded file naming.
        </p>
      </div>
    </AdminPage>
  );
}

