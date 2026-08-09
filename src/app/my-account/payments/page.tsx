"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, Loader2, AlertCircle, Inbox } from "lucide-react";

type Payment = {
  id: number; amount: number; discount?: number | null; payment_date?: string | null;
  payment_mode?: string | null; remarks?: string | null; job_id?: string | null; loan_id?: number | null;
};

const inr = (v: number) => "₹" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function MyPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/client/payments");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("payments failed");
        const data = await res.json();
        setPayments(data.payments || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load nahi hua");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center flex-shrink-0">
          <Receipt size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-black text-white">Meri Payments</h1>
          <p className="text-slate-500 text-xs mt-1">Aapke kiye gaye payments ki history</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Total Paid</p>
          <p className="text-3xl font-black text-emerald-400">{inr(totalPaid)}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-600">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-[#161b27] border border-dashed border-[#21293d] rounded-2xl p-10 text-center">
          <Inbox size={28} className="mx-auto text-slate-700" />
          <p className="text-slate-500 font-bold text-sm mt-3">Abhi tak koi payment record nahi</p>
        </div>
      ) : (
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-[#21293d]">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{p.payment_mode || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {p.job_id ? `#${p.job_id}` : p.loan_id ? `Loan #${p.loan_id}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 text-sm">{p.discount ? inr(p.discount) : "—"}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400 whitespace-nowrap">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
