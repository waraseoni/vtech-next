import { Wallet } from "lucide-react";

export default function PaymentsLoading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
        <Wallet size={24} className="text-white animate-spin" />
      </div>
      <p className="text-slate-400 text-sm font-bold">Loading payments…</p>
    </div>
  );
}
