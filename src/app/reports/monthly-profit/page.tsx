"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { pageAll } from "@/lib/fetch-all";
import { 
  BarChart3, TrendingUp, DollarSign, 
  Package, Receipt, 
  Printer
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Line
} from "recharts";
import { format, eachMonthOfInterval } from "date-fns";
import { X } from "lucide-react";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type MonthlyData = {
  month: string;
  monthNum: number;
  repair: number;
  walkin: number;
  clientSales: number;
  revenue: number;
  commission: number;
  expenses: number;
  salaries: number;
  emi: number;
  discounts: number;
  totalExp: number;
  profit: number;
  margin: number;
};

type DbRow = ReturnType<typeof JSON.parse>;

const istMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date(iso));

export default function MonthlyProfitReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlyData[]>([]);
  const [rawData, setRawData] = useState<Record<string, DbRow[]>>({});
  const [modalConfig, setModalConfig] = useState<{title: string, type: string, data: DbRow[]} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        const endTz = `${year}-12-31T23:59:59+05:30`;

        const [
          { data: transactions },
          { data: directSales },
          { data: clientPayments },
          { data: expenses },
          { data: loanPayments },
          { data: attendance },
          { data: mechanics },
          { data: clients },
          { data: lenders }
        ] = await Promise.all([
          pageAll(supabase.from("transaction_list").select("id, code, client_name, amount, mechanic_commission_amount, date_completed").eq("status", 5).gte("date_completed", start).lte("date_completed", endTz)),
          pageAll(supabase.from("direct_sales").select("id, sale_code, client_id, total_amount, date_created").gte("date_created", start).lte("date_created", end)),
          pageAll(supabase.from("client_payments").select("id, client_id, amount, discount, remarks, created_at").gte("created_at", start).lte("created_at", end)),
          pageAll(supabase.from("expense_list").select("id, amount, date_created, category, remarks, payment_mode").gte("date_created", start).lte("date_created", end)),
          pageAll(supabase.from("loan_payments").select("id, lender_id, amount_paid, payment_date, remarks").gte("payment_date", start).lte("payment_date", end)),
          pageAll(supabase.from("attendance_list").select("mechanic_id, curr_date, status").gte("curr_date", start).lte("curr_date", end)),
          pageAll(supabase.from("mechanic_list").select("id, firstname, middlename, lastname, daily_salary")),
          pageAll(supabase.from("client_list").select("id, firstname, middlename, lastname")),
          pageAll(supabase.from("lender_list").select("id, fullname"))
        ]);

        const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });

        const monthlyRecords: MonthlyData[] = months.map((mDate, idx) => {
          const mNum = idx + 1;
          const mStr = format(mDate, "MM");
          const mName = format(mDate, "MMMM");
          const prefix = `${year}-${mStr}`;

          // 1. Repair jobs billed + commission (by date_completed, status=5)
          const mJobs = (transactions || []).filter(t => istMonth(t.date_completed) === prefix);
          const repair = mJobs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
          const commission = mJobs.reduce((s, t) => s + (parseFloat(t.mechanic_commission_amount) || 0), 0);

          // 2. Direct sales split (walk-in vs registered client)
          const mSales = (directSales || []).filter(d => String(d.date_created).startsWith(prefix));
          const walkin = mSales.filter(d => !d.client_id || d.client_id === 0 || d.client_id === "")
            .reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);
          const clientSales = mSales.filter(d => d.client_id && d.client_id !== 0 && d.client_id !== "")
            .reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);

          // 3. Discounts
          const discounts = (clientPayments || [])
            .filter(p => String(p.created_at).startsWith(prefix))
            .reduce((s, p) => s + (parseFloat(p.discount) || 0), 0);

          // 4. Expenses
          const mExpenses = (expenses || [])
            .filter(e => String(e.date_created).startsWith(prefix))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

          // 5. EMI
          const emi = (loanPayments || [])
            .filter(lp => String(lp.payment_date).startsWith(prefix))
            .reduce((s, lp) => s + (parseFloat(lp.amount_paid) || 0), 0);

          // 6. Salaries (attendance x current daily rate)
          const mAtt = (attendance || []).filter(a => String(a.curr_date).startsWith(prefix));
          let salaries = 0;
          mAtt.forEach(att => {
            const mech = (mechanics || []).find(me => me.id === att.mechanic_id);
            const rate = mech?.daily_salary || 0;
            if (att.status === 1) salaries += rate;
            else if (att.status === 3) salaries += (rate / 2);
          });

          const revenue = repair + walkin + clientSales;
          const totalExp = commission + mExpenses + salaries + emi + discounts;
          const profit = revenue - totalExp;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

          return {
            month: mName,
            monthNum: mNum,
            repair,
            walkin,
            clientSales,
            revenue,
            commission,
            expenses: mExpenses,
            salaries,
            emi,
            discounts,
            totalExp,
            profit,
            margin
          };
        });

        setData(monthlyRecords);
        setRawData({ transactions, directSales, clientPayments, expenses, loanPayments, attendance, mechanics, clients, lenders });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  const totals = useMemo(() => {
    return data.reduce((acc, m) => ({
      repair: acc.repair + m.repair,
      revenue: acc.revenue + m.revenue,
      commission: acc.commission + m.commission,
      expenses: acc.expenses + m.expenses,
      salaries: acc.salaries + m.salaries,
      emi: acc.emi + m.emi,
      discounts: acc.discounts + m.discounts,
      totalExp: acc.totalExp + m.totalExp,
      profit: acc.profit + m.profit
    }), { repair: 0, revenue: 0, commission: 0, expenses: 0, salaries: 0, emi: 0, discounts: 0, totalExp: 0, profit: 0 });
  }, [data]);

  const openModal = (type: string, monthNum: number, monthName: string) => {
    const mStr = monthNum.toString().padStart(2, '0');
    const prefix = `${year}-${mStr}`;
    let detailData: DbRow[] = [];
    let title = "";

    if (type === 'repair_jobs') {
      title = `Repair Jobs (Delivered) - ${monthName} ${year}`;
      detailData = (rawData.transactions || []).map((t) => {
        const client = (rawData.clients || []).find((c) => c.id === t.client_name);
        return { ...t, client_name: client ? `${client.firstname} ${client.middlename || ''} ${client.lastname || ''}`.replace(/\s+/g, ' ').trim() : 'Walk-in' };
      }).filter((t) => istMonth(t.date_completed) === prefix);
    } else if (type === 'commission') {
      title = `Mechanic Commission - ${monthName} ${year}`;
      detailData = (rawData.transactions || []).map((t) => {
        const client = (rawData.clients || []).find((c) => c.id === t.client_name);
        return { ...t, client_name: client ? `${client.firstname} ${client.middlename || ''} ${client.lastname || ''}`.replace(/\s+/g, ' ').trim() : 'Walk-in' };
      }).filter((t) => istMonth(t.date_completed) === prefix && parseFloat(t.mechanic_commission_amount) > 0);
    } else if (type === 'walkin_sales') {
      title = `Walk-in Direct Sales - ${monthName} ${year}`;
      detailData = (rawData.directSales || []).filter((d) => String(d.date_created).startsWith(prefix) && (!d.client_id || d.client_id === 0 || d.client_id === ""));
    } else if (type === 'client_sales') {
      title = `Client Direct Sales - ${monthName} ${year}`;
      detailData = (rawData.directSales || []).map((d) => {
        const client = (rawData.clients || []).find((c) => c.id === d.client_id);
        return { ...d, client_name: client ? `${client.firstname} ${client.middlename || ''} ${client.lastname || ''}`.replace(/\s+/g, ' ').trim() : 'Unknown Client' };
      }).filter((d) => String(d.date_created).startsWith(prefix) && d.client_id && d.client_id !== 0 && d.client_id !== "");
    } else if (type === 'expenses') {
      title = `Shop Expenses - ${monthName} ${year}`;
      detailData = (rawData.expenses || []).filter((e) => String(e.date_created).startsWith(prefix));
    } else if (type === 'salaries') {
      title = `Staff Salaries - ${monthName} ${year}`;
      const mAtt = (rawData.attendance || []).filter((a) => String(a.curr_date).startsWith(prefix));
      const mechMap: Record<number, { name: string; full: number; half: number; rate: number }> = {};
      mAtt.forEach((att) => {
        const mech = (rawData.mechanics || []).find((me) => me.id === att.mechanic_id);
        if (!mech) return;
        if (!mechMap[mech.id]) {
          mechMap[mech.id] = { name: [mech.firstname, mech.middlename, mech.lastname].filter(Boolean).join(" ") || `Mechanic #${mech.id}`, full: 0, half: 0, rate: mech.daily_salary || 0 };
        }
        if (att.status === 1) mechMap[mech.id].full += 1;
        else if (att.status === 3) mechMap[mech.id].half += 1;
      });
      detailData = Object.values(mechMap).filter((m) => m.full > 0 || m.half > 0);
    } else if (type === 'emi') {
      title = `Loan EMI Payments - ${monthName} ${year}`;
      detailData = (rawData.loanPayments || []).map((lp) => {
        const lender = (rawData.lenders || []).find((l) => l.id === lp.lender_id);
        return { ...lp, lender_name: lender ? lender.fullname : 'Unknown Lender' };
      }).filter((lp) => String(lp.payment_date).startsWith(prefix));
    } else if (type === 'discounts') {
      title = `Customer Discounts - ${monthName} ${year}`;
      detailData = (rawData.clientPayments || []).map((cp) => {
        const client = (rawData.clients || []).find((c) => c.id === cp.client_id);
        return { ...cp, client_name: client ? `${client.firstname} ${client.middlename || ''} ${client.lastname || ''}`.replace(/\s+/g, ' ').trim() : 'Unknown Client' };
      }).filter((cp) => String(cp.created_at).startsWith(prefix) && parseFloat(cp.discount) > 0);
    }

    setModalConfig({ title, type, data: detailData });
  };

  const cellCls = "px-4 py-3 text-right font-bold text-slate-300 cursor-pointer hover:text-white hover:underline decoration-slate-500 underline-offset-4";

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Monthly Profit/Loss Report</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Yearly Performance Analysis (Click amounts for details)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="bg-[#0d1117] border border-[#21293d] text-white px-4 py-2 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            {[...Array(7)].map((_, i) => (
              <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
            ))}
          </select>
          <button onClick={() => window.print()} className="w-10 h-10 flex items-center justify-center bg-[#0d1117] border border-[#21293d] rounded-xl text-slate-400 hover:text-white transition-all">
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-6 shadow-2xl h-[400px]">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" /> Sales vs Profit Trend
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1f2937', borderRadius: '12px' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              formatter={(v) => [inr(Number(v) || 0), ""]}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
            <Bar dataKey="revenue" name="Total Revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
            <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Package/>} label="Repair Jobs (Delivered)" value={totals.repair} color="blue" />
        <StatCard icon={<DollarSign/>} label="Total Revenue" value={totals.revenue} color="indigo" />
        <StatCard icon={<Receipt/>} label="Total Expenses" value={totals.totalExp} color="rose" />
        <StatCard icon={<TrendingUp/>} label="Net Profit" value={totals.profit} color="emerald" isProfit />
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <th className="px-4 py-4 sticky left-0 bg-[#0d1117]">Month</th>
                <th className="px-4 py-4 text-right" title="Repair jobs (Delivered)">Repair Jobs</th>
                <th className="px-4 py-4 text-right" title="Direct walk-in sales">Walk-in</th>
                <th className="px-4 py-4 text-right" title="Sales to registered clients">Client Sales</th>
                <th className="px-4 py-4 text-right text-emerald-400" title="Total Revenue">Revenue</th>
                <th className="px-4 py-4 text-right text-amber-400" title="Mechanic commission">Commission</th>
                <th className="px-4 py-4 text-right" title="Shop expenses">Expenses</th>
                <th className="px-4 py-4 text-right" title="Staff salary from attendance">Salaries</th>
                <th className="px-4 py-4 text-right" title="Loan EMI payments">EMI</th>
                <th className="px-4 py-4 text-right text-rose-400" title="Customer discounts given">Discounts</th>
                <th className="px-4 py-4 text-right text-rose-400" title="Total Expenses">Total Exp.</th>
                <th className="px-4 py-4 text-right" title="Net Profit">Net Profit</th>
                <th className="px-4 py-4 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={13} className="px-4 py-8"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td></tr>
                ))
              ) : data.map((row) => (
                <tr key={row.month} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-3 text-white font-black sticky left-0 bg-[#161b27]">{row.month}</td>
                  <td className={cellCls} onClick={() => openModal('repair_jobs', row.monthNum, row.month)}>{inr(row.repair)}</td>
                  <td className={cellCls} onClick={() => openModal('walkin_sales', row.monthNum, row.month)}>{inr(row.walkin)}</td>
                  <td className={cellCls} onClick={() => openModal('client_sales', row.monthNum, row.month)}>{inr(row.clientSales)}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-400">{inr(row.revenue)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-400 cursor-pointer hover:text-amber-300 hover:underline decoration-amber-500/50 underline-offset-4" onClick={() => openModal('commission', row.monthNum, row.month)}>{inr(row.commission)}</td>
                  <td className={cellCls} onClick={() => openModal('expenses', row.monthNum, row.month)}>{inr(row.expenses)}</td>
                  <td className={cellCls} onClick={() => openModal('salaries', row.monthNum, row.month)}>{inr(row.salaries)}</td>
                  <td className={cellCls} onClick={() => openModal('emi', row.monthNum, row.month)}>{inr(row.emi)}</td>
                  <td className={cellCls} onClick={() => openModal('discounts', row.monthNum, row.month)}>{inr(row.discounts)}</td>
                  <td className="px-4 py-3 text-right font-black text-rose-400">{inr(row.totalExp)}</td>
                  <td className={`px-4 py-3 text-right font-black ${row.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {inr(row.profit)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                      row.margin > 20 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      row.margin > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {row.margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#0d1117] font-black border-t border-[#21293d]">
              <tr>
                <td className="px-4 py-5 text-slate-500 text-[10px] uppercase tracking-widest sticky left-0 bg-[#0d1117]">Grand Total</td>
                <td className="px-4 py-5 text-right text-white">{inr(totals.repair)}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(data.reduce((s, m) => s + m.walkin, 0))}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(data.reduce((s, m) => s + m.clientSales, 0))}</td>
                <td className="px-4 py-5 text-right text-emerald-400">{inr(totals.revenue)}</td>
                <td className="px-4 py-5 text-right text-amber-400">{inr(totals.commission)}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(totals.expenses)}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(totals.salaries)}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(totals.emi)}</td>
                <td className="px-4 py-5 text-right text-slate-300">{inr(totals.discounts)}</td>
                <td className="px-4 py-5 text-right text-rose-400">{inr(totals.totalExp)}</td>
                <td className={`px-4 py-5 text-right text-lg ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{inr(totals.profit)}</td>
                <td className="px-4 py-5 text-center">
                  <span className="text-white text-lg">{totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Drill-down Modal */}
      {modalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-[#21293d]">
              <h2 className="text-xl font-black text-white">{modalConfig.title}</h2>
              <button onClick={() => setModalConfig(null)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-rose-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {modalConfig.data.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-bold">No data found for this period.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#21293d]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#0d1117] text-slate-400 text-[10px] uppercase tracking-widest">
                      {['repair_jobs', 'commission'].includes(modalConfig.type) && (
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Client</th><th className="px-4 py-3 text-right">Amount</th>{modalConfig.type === 'repair_jobs' && <th className="px-4 py-3 text-right">Commission</th>}</tr>
                      )}
                      {['walkin_sales', 'client_sales'].includes(modalConfig.type) && (
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Sale Code</th>{modalConfig.type === 'client_sales' && <th className="px-4 py-3">Client</th>}<th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Amount</th></tr>
                      )}
                      {modalConfig.type === 'expenses' && (
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>
                      )}
                      {modalConfig.type === 'salaries' && (
                        <tr><th className="px-4 py-3">Staff Name</th><th className="px-4 py-3 text-center">Full Days</th><th className="px-4 py-3 text-center">Half Days</th><th className="px-4 py-3 text-center">Total Days</th><th className="px-4 py-3 text-right">Daily Rate</th><th className="px-4 py-3 text-right">Salary</th></tr>
                      )}
                      {modalConfig.type === 'emi' && (
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Lender</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Amount</th></tr>
                      )}
                      {modalConfig.type === 'discounts' && (
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-right">Discount</th></tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-[#21293d]">
                      {modalConfig.data.map((row, i) => {
                        if (['repair_jobs', 'commission'].includes(modalConfig.type)) return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{new Date(row.date_completed).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}</td>
                            <td className="px-4 py-3 text-slate-400">{row.code || '-'}</td>
                            <td className="px-4 py-3 text-slate-300">{row.client_name || 'Walk-in'}</td>
                            <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(parseFloat(row.amount) || 0)}</td>
                            {modalConfig.type === 'repair_jobs' && <td className="px-4 py-3 text-right text-amber-400 font-bold">{inr(parseFloat(row.mechanic_commission_amount) || 0)}</td>}
                          </tr>
                        );
                        if (['walkin_sales', 'client_sales'].includes(modalConfig.type)) return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{String(row.date_created).slice(0, 10)}</td>
                            <td className="px-4 py-3 text-slate-400">{row.sale_code || '-'}</td>
                            {modalConfig.type === 'client_sales' && <td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name || 'Unknown'}</td>}
                            <td className="px-4 py-3 text-slate-400">{row.remarks || '-'}</td>
                            <td className="px-4 py-3 text-right text-emerald-400 font-bold">{inr(parseFloat(row.total_amount) || 0)}</td>
                          </tr>
                        );
                        if (modalConfig.type === 'expenses') return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{String(row.date_created).slice(0, 10)}</td>
                            <td className="px-4 py-3 text-slate-300"><span className="px-2 py-1 bg-slate-800 rounded-md text-xs">{row.category}</span></td>
                            <td className="px-4 py-3 text-slate-400">{row.remarks || '-'}</td>
                            <td className="px-4 py-3 text-slate-400">{row.payment_mode || 'Cash'}</td>
                            <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(parseFloat(row.amount))}</td>
                          </tr>
                        );
                        if (modalConfig.type === 'salaries') {
                          const totalDays = row.full + (row.half * 0.5);
                          const salary = totalDays * row.rate;
                          return (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-white font-bold">{row.name}</td>
                              <td className="px-4 py-3 text-center text-slate-300">{row.full}</td>
                              <td className="px-4 py-3 text-center text-slate-300">{row.half}</td>
                              <td className="px-4 py-3 text-center text-indigo-400 font-bold">{totalDays}</td>
                              <td className="px-4 py-3 text-right text-slate-400">{inr(row.rate)}</td>
                              <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(salary)}</td>
                            </tr>
                          );
                        }
                        if (modalConfig.type === 'emi') return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{String(row.payment_date).slice(0, 10)}</td>
                            <td className="px-4 py-3 text-indigo-300 font-bold">{row.lender_name}</td>
                            <td className="px-4 py-3 text-slate-400">{row.remarks || '-'}</td>
                            <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(parseFloat(row.amount_paid))}</td>
                          </tr>
                        );
                        if (modalConfig.type === 'discounts') return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{String(row.created_at).slice(0, 10)}</td>
                            <td className="px-4 py-3 text-indigo-300 font-bold">{row.client_name}</td>
                            <td className="px-4 py-3 text-slate-400">{row.remarks || '-'}</td>
                            <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(parseFloat(row.discount))}</td>
                          </tr>
                        );
                        return null;
                      })}
                    </tbody>
                    <tfoot className="bg-[#0d1117] border-t border-[#21293d]">
                      <tr>
                        <td colSpan={modalConfig.type === 'salaries' ? 5 : 4} className="px-4 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-black">Total</td>
                        <td className="px-4 py-4 text-right text-rose-500 font-black text-base">
                          {inr(modalConfig.data.reduce((sum: number, row) => {
                            if (modalConfig.type === 'repair_jobs') return sum + (parseFloat(row.amount) || 0);
                            if (modalConfig.type === 'commission') return sum + (parseFloat(row.mechanic_commission_amount) || 0);
                            if (modalConfig.type === 'walkin_sales' || modalConfig.type === 'client_sales') return sum + (parseFloat(row.total_amount) || 0);
                            if (modalConfig.type === 'expenses') return sum + (parseFloat(row.amount) || 0);
                            if (modalConfig.type === 'salaries') return sum + ((row.full + (row.half * 0.5)) * row.rate);
                            if (modalConfig.type === 'emi') return sum + (parseFloat(row.amount_paid) || 0);
                            if (modalConfig.type === 'discounts') return sum + (parseFloat(row.discount) || 0);
                            return sum;
                          }, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, isProfit }: { icon: ReactNode, label: string, value: number, color: string, isProfit?: boolean }) {
  const colors: Record<string, string> = {
    blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
    indigo: "from-indigo-500 to-indigo-700 shadow-indigo-500/20",
    rose: "from-rose-500 to-rose-700 shadow-rose-500/20",
    emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20"
  };

  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-3xl p-5 shadow-xl group hover:border-indigo-500/30 transition-all">
      <div className={`w-10 h-10 bg-gradient-to-br ${colors[color]} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <h3 className={`text-lg font-black tracking-tight ${isProfit ? (value >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
        {inr(value)}
      </h3>
    </div>
  );
}
