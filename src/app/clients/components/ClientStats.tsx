import { IndianRupee, Users, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  isAmount?: boolean;
};

const StatCard = ({ label, value, icon, color }: StatCardProps) => (
  <div className={`bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-4`}>
    <div className={`w-9 h-9 rounded-lg bg-${color}-500/20 text-${color}-400 flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-white leading-tight">{value}</p>
    </div>
  </div>
);

export function ClientStats({ clients, totalOutstanding, clientsWithDue, highRiskCount, totalCleared }: { clients: unknown[]; totalOutstanding: string; clientsWithDue: number; highRiskCount: number; totalCleared: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard label="Total Clients"  value={clients.length}        icon={<Users size={19}/>}          color="blue"    />
      <StatCard label="With Due"       value={clientsWithDue}        icon={<IndianRupee size={19}/>}    color="amber"   />
      <StatCard label="High Risk"      value={highRiskCount}         icon={<AlertTriangle size={19}/>}  color="red"     />
      <StatCard label="Cleared"        value={totalCleared}          icon={<CheckCircle size={19}/>}    color="emerald" />
      <StatCard label="Outstanding"    value={totalOutstanding} icon={<TrendingUp size={19}/>}     color="indigo"  isAmount/>
    </div>
  );
}