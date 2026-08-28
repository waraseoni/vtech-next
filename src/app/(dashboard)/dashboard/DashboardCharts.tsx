"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
} from "recharts";

export type RevenuePoint = { month: string; revenue: number };
export type StatusPoint = { name: string; value: number; color: string };

type TooltipItem = { value?: number | string; payload?: unknown };

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : Number(v);
  return isNaN(x) ? 0 : x;
};
const inr = (v: number, digits = 0) =>
  "₹" +
  (v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center">
      <p className="text-slate-500 text-xs font-bold">{label}</p>
    </div>
  );
}

const RevTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-100 dark:bg-[#111520] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-500 mb-0.5 font-bold">{label}</p>
      <p className="text-blue-400 font-black text-sm">{inr(n(payload[0]?.value), 2)}</p>
    </div>
  );
};
const StatusTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as StatusPoint;
  return (
    <div className="bg-slate-100 dark:bg-[#111520] border border-slate-200 dark:border-[#21293d] rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-bold mb-0.5" style={{ color: d.color }}>
        {d.name}
      </p>
      <p className="text-slate-900 dark:text-white font-black">{d.value} jobs</p>
    </div>
  );
};

type Props = {
  revenueData: RevenuePoint[];
  statusData: StatusPoint[];
  totalJobs: number;
  isDark: boolean;
};

export default function DashboardCharts({ revenueData, statusData, totalJobs, isDark }: Props) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Revenue Bar Chart */}
      <div className="lg:col-span-2 glass rounded-3xl border theme-border p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Monthly Revenue</h3>
            <p className="text-slate-600 text-[10px] mt-0.5 font-bold uppercase tracking-wider">
              Last 12 months · Repair + Direct Sales
            </p>
          </div>
          <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-xl px-3 py-1 uppercase tracking-wider">
            ₹ Revenue
          </span>
        </div>
        {revenueData.every((d) => d.revenue === 0) ? (
          <EmptyChart label="Is period mein koi revenue nahi" />
        ) : (
          <ResponsiveContainer width="100%" minHeight={180} height={250}>
            <BarChart
              data={revenueData}
              margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
              barCategoryGap="25%"
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? "#1a2234" : "#e2e8f0"}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: isDark ? "#475569" : "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 100000
                    ? `₹${(v / 100000).toFixed(1)}L`
                    : v >= 1000
                      ? `₹${(v / 1000).toFixed(0)}k`
                      : `₹${v}`
                }
                tick={{ fill: isDark ? "#475569" : "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<RevTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
              <Bar dataKey="revenue" fill="url(#revGrad)" radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status Donut */}
      <div className="glass rounded-3xl border theme-border p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Job Status</h3>
            <p className="text-slate-600 text-[10px] mt-0.5 font-bold uppercase tracking-wider">
              {totalJobs} total active jobs
            </p>
          </div>
          <span className="bg-slate-100 dark:bg-[#111520] text-slate-600 text-[10px] font-black rounded-xl px-3 py-1 uppercase tracking-wider">
            All Time
          </span>
        </div>
        {statusData.length === 0 ? (
          <EmptyChart label="Koi job nahi mili" />
        ) : (
          <>
            <ResponsiveContainer width="100%" minHeight={150} height={180}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-slate-500">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-black">{d.value}</span>
                    <span className="text-slate-700 text-[10px] w-7 text-right">
                      {totalJobs > 0 ? ((d.value / totalJobs) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
