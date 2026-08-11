import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string | number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dark:bg-[#1a2035] bg-white dark:border-[#2e3a55] border-gray-200 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[11px] font-bold dark:text-slate-400 text-slate-600 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-black dark:text-blue-400 text-blue-600">{payload[0].value}</p>
    </div>
  );
};

type Client = { id: number; name: string; balance: number };

export function ClientChart({ clients }: { clients: Client[] }) {
  const chartData=useMemo(()=>[...clients].filter(c=>c.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,8).map(c=>({name:c.name.split(" ")[0],balance:c.balance,full:c.name})),[clients]);
  const CHART_COLORS=["#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#06b6d4","#3b82f6"];

  if (chartData.length === 0) return null;

  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-widest">Top Due Clients</h3>
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Highest balance first</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" minHeight={150} height="100%">
          <BarChart data={chartData} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false}/>
            <XAxis dataKey="name" tick={{fontSize:11,fontWeight:700,fill:"#64748b"}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={(v)=>`₹${(v/1000).toFixed(0)}k`} tick={{fontSize:10,fill:"#475569"}} axisLine={false} tickLine={false}/>
            <Tooltip content={<BarTooltip/>} cursor={{fill:"#ffffff06"}}/>
            <Bar dataKey="balance" radius={[6,6,0,0]}>
              {chartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}