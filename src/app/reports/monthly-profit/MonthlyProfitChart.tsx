"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
} from "recharts";

const inr = (n: number) =>
  "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type MonthlyData = {
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

export default function MonthlyProfitChart({ data }: { data: MonthlyData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="#6b7280"
          fontSize={10}
          fontWeight="bold"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={10}
          fontWeight="bold"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₹${v / 1000}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0d1117",
            border: "1px solid #1f2937",
            borderRadius: "12px",
          }}
          itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
          formatter={(v) => [inr(Number(v) || 0), ""]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          wrapperStyle={{ paddingBottom: "20px", fontSize: "12px", fontWeight: "bold" }}
        />
        <Bar
          dataKey="revenue"
          name="Total Revenue"
          fill="#3b82f6"
          radius={[6, 6, 0, 0]}
          barSize={40}
        />
        <Line
          type="monotone"
          dataKey="profit"
          name="Net Profit"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ r: 4, fill: "#10b981", strokeWidth: 2 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
