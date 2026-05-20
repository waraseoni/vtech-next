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
import { X } from "lucide-react";

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
  const [rawData, setRawData] = useState<any>({});
  const [modalConfig, setModalConfig] = useState<{title: string, type: string, data: any[]} | null>(null);

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
          { data: mechanics },
          { data: clients },
          { data: lenders }
        ] = await Promise.all([
          supabase.from("transaction_list").select("id, amount, date_created").eq("status", 5).gte("date_created", start).lte("date_created", end),
          supabase.from("transaction_products").select("transaction_id, price, qty"),
          supabase.from("client_payments").select("client_id, amount, discount, remarks, payment_date, created_at").gte("created_at", start).lte("created_at", end),
          supabase.from("expense_list").select("amount, date_created, category, remarks, payment_mode").gte("date_created", start).lte("date_created", end),
          supabase.from("loan_payments").select("lender_id, amount_paid, payment_date, remarks").gte("payment_date", start).lte("payment_date", end),
          supabase.from("attendance_list").select("mechanic_id, curr_date, status").gte("curr_date", start).lte("curr_date", year + "-12-31"),
          supabase.from("mechanic_list").select("id, firstname, lastname, daily_salary"),
          supabase.from("client_list").select("id, firstname, lastname"),
          supabase.from("lender_list").select("id, fullname")
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
        setRawData({ transactions, transProducts, clientPayments, expenses, loanPayments, attendance, mechanics, clients, lenders });
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

  const openModal = (type: string, monthNum: number, monthName: string) => {
    const mStr = monthNum.toString().padStart(2, '0');
    const prefix = `${year}-${mStr}`;
    let detailData: any[] = [];
    let title = "";

    if (type === 'expenses') {
      title = `Expenses - ${monthName} ${year}`;
      detailData = (rawData.expenses || []).filter((e: any) => e.date_created.startsWith(prefix));
    } else if (type === 'salaries') {
      title = `Salaries - ${monthName} ${year}`;
      const mAtt = (rawData.attendance || []).filter((a: any) => a.curr_date.startsWith(prefix));
      const mechMap: any = {};
      mAtt.forEach((att: any) => {
        const mech = (rawData.mechanics || []).find((me: any) => me.id === att.mechanic_id);
        if (!mech) return;
        if (!mechMap[mech.id]) {
          mechMap[mech.id] = { name: mech.firstname ? `${mech.firstname} ${mech.lastname || ''}` : `Mechanic #${mech.id}`, full: 0, half: 0, rate: mech.daily_salary || 0 };
        }
        if (att.status === 1) mechMap[mech.id].full += 1;
        else if (att.status === 3) mechMap[mech.id].half += 1;
      });
      detailData = Object.values(mechMap).filter((m: any) => m.full > 0 || m.half > 0);
    } else if (type === 'emi') {
      title = `EMI & Loans - ${monthName} ${year}`;
      detailData = (rawData.loanPayments || []).map((lp: any) => {
        const lender = (rawData.lenders || []).find((l: any) => l.id === lp.lender_id);
        return { ...lp, lender_name: lender ? lender.fullname : 'Unknown Lender' };
      }).filter((lp: any) => lp.payment_date.startsWith(prefix));
    } else if (type === 'discounts') {
      title = `Discounts - ${monthName} ${year}`;
      detailData = (rawData.clientPayments || []).map((cp: any) => {
        const client = (rawData.clients || []).find((c: any) => c.id === cp.client_id);
        return { ...cp, client_name: client ? `${client.firstname} ${client.lastname || ''}` : 'Unknown Client' };
      }).filter((cp: any) => cp.created_at.startsWith(prefix) && parseFloat(cp.discount) > 0);
    }

    setModalConfig({ title, type, data: detailData });
  };

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
              formatter={(v: any) => [inr(Number(v) || 0), ""]}
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
                  <td className="px-6 py-4 text-right font-bold text-slate-400 cursor-pointer hover:text-white hover:underline decoration-slate-500 underline-offset-4" onClick={() => openModal('expenses', row.monthNum, row.month)} title="Click to view details">{inr(row.expenses)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-400 cursor-pointer hover:text-white hover:underline decoration-slate-500 underline-offset-4" onClick={() => openModal('salaries', row.monthNum, row.month)} title="Click to view details">{inr(row.salaries)}</td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-400/70 cursor-pointer hover:text-indigo-300 hover:underline decoration-indigo-500/50 underline-offset-4" onClick={() => openModal('emi', row.monthNum, row.month)} title="Click to view details">{inr(row.emi)}</td>
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
                      {modalConfig.data.map((row: any, i: number) => {
                        if (modalConfig.type === 'expenses') return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{row.date_created.split(' ')[0]}</td>
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
                            <td className="px-4 py-3 text-white">{row.payment_date.split(' ')[0]}</td>
                            <td className="px-4 py-3 text-indigo-300 font-bold">{row.lender_name}</td>
                            <td className="px-4 py-3 text-slate-400">{row.remarks || '-'}</td>
                            <td className="px-4 py-3 text-right text-rose-400 font-bold">{inr(parseFloat(row.amount_paid))}</td>
                          </tr>
                        );
                        if (modalConfig.type === 'discounts') return (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-white">{row.created_at.split('T')[0]}</td>
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
                        <td colSpan={modalConfig.type === 'salaries' ? 5 : modalConfig.type === 'expenses' ? 4 : 3} className="px-4 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-black">Total</td>
                        <td className="px-4 py-4 text-right text-rose-500 font-black text-base">
                          {inr(modalConfig.data.reduce((sum: number, row: any) => {
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
