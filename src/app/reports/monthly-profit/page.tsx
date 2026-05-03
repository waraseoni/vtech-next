"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, 
  ArrowUpRight, ArrowDownRight, Package, Users, Receipt, 
  ChevronLeft, ChevronRight, Printer, Download, Calculator, Loader2
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Cell, ComposedChart, Line
} from "recharts";
import { format, startOfYear, endOfYear, eachMonthOfInterval } from "date-fns";

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type MonthlyData = {
  month: string;
  monthNum: number;
  sales: number;
  parts: number;
  expenses: number;
  salaries: number;
  emi: number;
  discounts: number;
  profit: number;
  margin: number;
};

export default function MonthlyProfitReport() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const start = `${year}-01-01`;
        const end = `${year}-12-31 23:59:59`;

        const [
          { data: transactions },
          { data: transProducts },
          { data: clientPayments },
          { data: expenses },
          { data: loanPayments },
          { data: attendance },
          { data: mechanics }
        ] = await Promise.all([
          supabase.from("transaction_list").select("id, amount, date_created").eq("status", 5).gte("date_created", start).lte("date_created", end),
          supabase.from("transaction_products").select("transaction_id, price, qty"),
          supabase.from("client_payments").select("discount, created_at").gte("created_at", start).lte("created_at", end),
          supabase.from("expense_list").select("amount, date_created").gte("date_created", start).lte("date_created", end),
          supabase.from("loan_payments").select("amount_paid, payment_date").gte("payment_date", start).lte("payment_date", end),
          supabase.from("attendance_list").select("mechanic_id, curr_date, status").gte("curr_date", start).lte("curr_date", year + "-12-31"),
          supabase.from("mechanic_list").select("id, daily_salary")
        ]);

        const months = eachMonthOfInterval({ start: new Date(year, 0, 1), end: new Date(year, 11, 31) });
        
        const monthlyRecords: MonthlyData[] = months.map((mDate, idx) => {
          const mNum = idx + 1;
          const mStr = format(mDate, "MM");
          const mName = format(mDate, "MMMM");

          // 1. Sales
          const mTrans = (transactions || []).filter(t => t.date_created.startsWith(`${year}-${mStr}`));
          const sales = mTrans.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

          // 2. Parts Cost (70% estimated from linked products)
          const mTransIds = mTrans.map(t => t.id);
          const partsCostRaw = (transProducts || [])
            .filter(tp => mTransIds.includes(tp.transaction_id))
            .reduce((s, tp) => s + (parseFloat(tp.price) * parseFloat(tp.qty) || 0), 0);
          const parts = partsCostRaw * 0.7;

          // 3. Discounts
          const discounts = (clientPayments || [])
            .filter(p => p.created_at.startsWith(`${year}-${mStr}`))
            .reduce((s, p) => s + (parseFloat(p.discount) || 0), 0);

          // 4. Expenses
          const mExpenses = (expenses || [])
            .filter(e => e.date_created.startsWith(`${year}-${mStr}`))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

          // 5. EMI
          const emi = (loanPayments || [])
            .filter(lp => lp.payment_date.startsWith(`${year}-${mStr}`))
            .reduce((s, lp) => s + (parseFloat(lp.amount_paid) || 0), 0);

          // 6. Salaries
          const mAtt = (attendance || [])
            .filter(a => a.curr_date.startsWith(`${year}-${mStr}`));
          
          let salaries = 0;
          mAtt.forEach(att => {
            const mech = (mechanics || []).find(me => me.id === att.mechanic_id);
            const rate = mech?.daily_salary || 0;
            if (att.status === 1) salaries += rate;
            else if (att.status === 3) salaries += (rate / 2);
          });

          const totalDeductions = parts + discounts + mExpenses + emi + salaries;
          const profit = sales - totalDeductions;
          const margin = sales > 0 ? (profit / sales) * 100 : 0;

          return {
            month: mName,
            monthNum: mNum,
            sales,
            parts,
            expenses: mExpenses,
            salaries,
            emi,
            discounts,
            profit,
            margin
          };
        });

        setData(monthlyRecords);
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
      sales: acc.sales + m.sales,
      parts: acc.parts + m.parts,
      expenses: acc.expenses + m.expenses,
      salaries: acc.salaries + m.salaries,
      emi: acc.emi + m.emi,
      discounts: acc.discounts + m.discounts,
      profit: acc.profit + m.profit
    }), { sales: 0, parts: 0, expenses: 0, salaries: 0, emi: 0, discounts: 0, profit: 0 });
  }, [data]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Monthly Profit Trend</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Yearly Performance Analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={year} 
            onChange={e => setYear(parseInt(e.target.value))}
            className="bg-[#0d1117] border border-[#21293d] text-white px-4 py-2 rounded-xl font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
          >
            {[...Array(5)].map((_, i) => (
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
          <TrendingUp size={16} className="text-indigo-500" /> Sales vs Profit Growth
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #1f2937', borderRadius: '12px' }}
              itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              formatter={(v: number) => [inr(v), ""]}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 'bold' }} />
            <Bar dataKey="sales" name="Total Sales" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
            <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign/>} label="Total Sales" value={totals.sales} color="blue" />
        <StatCard icon={<Package/>} label="Parts Cost" value={totals.parts} color="amber" />
        <StatCard icon={<Receipt/>} label="Operating Exp" value={totals.expenses + totals.salaries + totals.emi} color="rose" />
        <StatCard icon={<TrendingUp/>} label="Total Profit" value={totals.profit} color="emerald" isProfit />
      </div>

      {/* Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#0d1117] border-b border-[#21293d] text-[10px] font-black uppercase text-slate-500 tracking-widest">
                <th className="px-6 py-4">Month</th>
                <th className="px-6 py-4 text-right">Sales</th>
                <th className="px-6 py-4 text-right text-amber-500">Parts (70%)</th>
                <th className="px-6 py-4 text-right">Expenses</th>
                <th className="px-6 py-4 text-right">Salaries</th>
                <th className="px-6 py-4 text-right text-indigo-400">EMI / Loans</th>
                <th className="px-6 py-4 text-right text-rose-500">Net Profit</th>
                <th className="px-6 py-4 text-center">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21293d]">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={8} className="px-6 py-8"><div className="h-4 bg-slate-800/50 rounded-full w-full"></div></td></tr>
                ))
              ) : data.map((row) => (
                <tr key={row.month} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-white font-black">{row.month}</td>
                  <td className="px-6 py-4 text-right font-bold">{inr(row.sales)}</td>
                  <td className="px-6 py-4 text-right font-bold text-amber-400/70">{inr(row.parts)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-400">{inr(row.expenses)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-400">{inr(row.salaries)}</td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-400/70">{inr(row.emi)}</td>
                  <td className={`px-6 py-4 text-right font-black ${row.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {inr(row.profit)}
                  </td>
                  <td className="px-6 py-4 text-center">
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
                <td className="px-6 py-5 text-slate-500 text-[10px] uppercase tracking-widest">Grand Total</td>
                <td className="px-6 py-5 text-right text-white">{inr(totals.sales)}</td>
                <td className="px-6 py-5 text-right text-amber-500">{inr(totals.parts)}</td>
                <td className="px-6 py-5 text-right text-slate-300">{inr(totals.expenses)}</td>
                <td className="px-6 py-5 text-right text-slate-300">{inr(totals.salaries)}</td>
                <td className="px-6 py-5 text-right text-indigo-400">{inr(totals.emi)}</td>
                <td className={`px-6 py-5 text-right text-lg ${totals.profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>{inr(totals.profit)}</td>
                <td className="px-6 py-5 text-center">
                  <span className="text-white text-lg">{totals.sales > 0 ? ((totals.profit / totals.sales) * 100).toFixed(1) : 0}%</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, isProfit }: { icon: any, label: string, value: number, color: string, isProfit?: boolean }) {
  const colors: any = {
    blue: "from-blue-500 to-blue-700 shadow-blue-500/20",
    amber: "from-amber-500 to-amber-700 shadow-amber-500/20",
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
