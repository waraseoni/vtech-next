"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import { formatIST, startOfMonthIST, endOfMonthIST, toISTDatePart } from "@/lib/dateUtils";

type Row = {
  id: number;
  payment_date: string;
  client_id: number;
  amount: number;
  discount: number | null;
  payment_mode: string;
  remarks: string | null;
};

export default function ClientPaymentReportPage() {
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [clientSearch, setClientSearch] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Get current month start and end date
  const getCurrentMonthRange = () => {
    return {
      from: startOfMonthIST(),
      to: endOfMonthIST(),
    };
  };

  // Fetch all payments
  useEffect(() => {
    const fetchPayments = async () => {
      setErr("");
      setLoading(true);

      const { data, error } = await supabase
        .from("client_payments")
        .select("id, payment_date, client_id, amount, discount, payment_mode, remarks")
        .order("payment_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(1000);

      if (error) {
        setErr(error.message);
      } else {
        setAllRows((data || []) as Row[]);
      }
      setLoading(false);
    };

    fetchPayments();
  }, []);

  // Set default to current month on first load
  useEffect(() => {
    if (allRows.length > 0 && !fromDate && !toDate) {
      const { from, to } = getCurrentMonthRange();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- first load par default month range set karna; render me nahi ho sakta (allRows depend)
      setFromDate(from);
      setToDate(to);
    }
  }, [allRows, fromDate, toDate]);

  // Filter + Pagination Logic
  const filteredAndPaginated = useMemo(() => {
    let result = [...allRows];

    // Date Filter
    if (fromDate) {
      result = result.filter((r) => r.payment_date >= fromDate);
    }
    if (toDate) {
      result = result.filter((r) => r.payment_date <= toDate);
    }

    // Client ID Search
    if (clientSearch.trim()) {
      const searchId = parseInt(clientSearch.trim());
      if (!isNaN(searchId)) {
        result = result.filter((r) => r.client_id === searchId);
      }
    }

    const totalAmount = result.reduce(
      (sum, r) => sum + Number(r.amount || 0) - Number(r.discount || 0),
      0
    );

    // Pagination
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedRows = result.slice(start, start + itemsPerPage);

    return {
      rows: paginatedRows,
      totalCount: result.length,
      totalAmount,
    };
  }, [allRows, fromDate, toDate, clientSearch, currentPage]);

  const { rows, totalCount, totalAmount } = filteredAndPaginated;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Quick Date Actions
  const setQuickDate = (preset: string) => {
    const today = new Date();
    let start: Date = new Date();
    let end: Date = new Date();

    switch (preset) {
      case "today":
        start = end = today;
        break;
      case "yesterday":
        start = end = new Date(today);
        start.setDate(start.getDate() - 1);
        end = start;
        break;
      case "last7":
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = today;
        break;
      case "last30":
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        end = today;
        break;
      case "thisMonth":
        const monthRange = getCurrentMonthRange();
        setFromDate(monthRange.from);
        setToDate(monthRange.to);
        setClientSearch("");
        setCurrentPage(1);
        return;
      case "reset":
        const currentMonth = getCurrentMonthRange();
        setFromDate(currentMonth.from);
        setToDate(currentMonth.to);
        setClientSearch("");
        setCurrentPage(1);
        return;
      default:
        return;
    }

    setFromDate(toISTDatePart(start));
    setToDate(toISTDatePart(end));
    setClientSearch("");
    setCurrentPage(1);
  };

  return (
    <AdminPage title="Clients Payment" subtitle="Modern payment report with filters & pagination">
      <div className="space-y-6">
        {/* Glassy Filter Panel */}
        <div className="bg-[#161b27]/80 backdrop-blur-xl border border-[#21293d]/80 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[280px]">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Date Range
              </label>
              <div className="flex gap-3">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-[#0f141f] border border-[#21293d] text-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 w-full"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-[#0f141f] border border-[#21293d] text-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 w-full"
                />
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                Client ID
              </label>
              <input
                type="text"
                placeholder="Search by Client ID..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="bg-[#0f141f] border border-[#21293d] text-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 w-full placeholder-slate-600"
              />
            </div>

            {/* Quick Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "7 Days", value: "last7" },
                { label: "30 Days", value: "last30" },
                { label: "This Month", value: "thisMonth" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setQuickDate(btn.value)}
                  className="px-5 py-3 bg-[#1a2234] hover:bg-[#21293d] border border-[#2a3347] text-slate-300 hover:text-white rounded-2xl text-sm font-medium transition-all active:scale-95"
                >
                  {btn.label}
                </button>
              ))}

              <button
                onClick={() => setQuickDate("reset")}
                className="px-5 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-2xl text-sm font-medium transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-[#161b27]/90 backdrop-blur-2xl border border-[#21293d] rounded-3xl overflow-hidden shadow-xl">
          <div className="px-8 py-5 border-b border-[#21293d] flex items-center justify-between bg-[#111520]/80">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.125em] text-slate-500">
                SHOWING {rows.length} OF {totalCount} PAYMENTS
              </div>
              <div className="text-2xl font-black text-emerald-300 tracking-tight">
                Rs. {totalAmount.toFixed(2)}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-2.5 bg-[#1a2234] hover:bg-[#21293d] disabled:opacity-40 rounded-2xl border border-[#2a3347] transition-all"
                >
                  ← Previous
                </button>

                <div className="px-6 py-2.5 bg-[#0f141f] rounded-2xl border border-[#21293d] font-mono text-slate-400">
                  Page {currentPage} / {totalPages}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-5 py-2.5 bg-[#1a2234] hover:bg-[#21293d] disabled:opacity-40 rounded-2xl border border-[#2a3347] transition-all"
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {err && <div className="px-8 py-4 text-red-400">{err}</div>}

          {loading ? (
            <div className="py-20 text-center text-slate-600 font-black tracking-widest">LOADING...</div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-slate-500">No payments found for selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0c101a] sticky top-0 z-10">
                  <tr className="border-b border-[#21293d]">
                    <th className="text-left px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Date</th>
                    <th className="text-left px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Client ID</th>
                    <th className="text-left px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Mode</th>
                    <th className="text-right px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Amount</th>
                    <th className="text-right px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-500">Discount</th>
                    <th className="text-right px-8 py-5 text-xs font-black uppercase tracking-widest text-emerald-400">Net Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a2234]">
                  {rows.map((r) => {
                    const net = Number(r.amount || 0) - Number(r.discount || 0);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.025] transition-colors">
                        <td className="px-8 py-5 text-slate-300">
                          {formatIST(r.payment_date, { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-8 py-5 font-mono text-slate-400">#{r.client_id}</td>
                        <td className="px-8 py-5 text-slate-400 capitalize">{r.payment_mode}</td>
                        <td className="px-8 py-5 text-right font-semibold text-slate-200">
                          Rs. {Number(r.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-8 py-5 text-right text-slate-500">
                          {r.discount ? `- Rs. ${Number(r.discount).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-8 py-5 text-right font-black text-emerald-300 text-lg">
                          Rs. {net.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}