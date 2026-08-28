"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { formatIST } from "@/lib/dateUtils";

const rupee = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");

export type TrendPoint = { date: string; inflow: number; outflow: number; net: number };

type Props = {
  data: TrendPoint[];
  isDark: boolean;
  chartGrid: string;
  chartAxis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipColor: string;
};

export default function CashFlowTrendChart({
  data,
  isDark,
  chartGrid,
  chartAxis,
  tooltipBg,
  tooltipBorder,
  tooltipColor,
}: Props) {
  return (
    <ResponsiveContainer width="100%" minHeight={200} height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={isDark ? 0.3 : 0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={isDark ? 0.3 : 0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatIST(d, { day: "2-digit", month: "short" })}
          axisLine={false}
          tickLine={false}
          tick={{ fill: chartAxis, fontSize: 10, fontWeight: 700 }}
          minTickGap={30}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: chartAxis, fontSize: 10, fontWeight: 700 }}
          tickFormatter={(v) => `₹${v / 1000}k`}
        />
        <RechartsTooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "14px",
            color: tooltipColor,
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          }}
          labelFormatter={(l) => formatIST(String(l), { dateStyle: "medium" })}
          formatter={(v) => [rupee(Number(v)), ""]}
        />
        <Area
          type="monotone"
          dataKey="inflow"
          stroke="#10b981"
          fillOpacity={1}
          fill="url(#colorInflow)"
          strokeWidth={3}
          dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
        <Area
          type="monotone"
          dataKey="net"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorNet)"
          strokeWidth={3}
          dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
