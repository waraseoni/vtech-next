"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

const rupee = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");

export type InflowDist = { name: string; value: number };

const COLORS = {
  inflow: ["#10b981", "#3b82f6"],
};

type Props = {
  data: InflowDist[];
  tooltipBg: string;
  tooltipBorder: string;
  tooltipColor: string;
};

export default function CashFlowDonut({ data, tooltipBg, tooltipBorder, tooltipColor }: Props) {
  return (
    <ResponsiveContainer width="100%" minHeight={200} height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={82}
          paddingAngle={8}
          dataKey="value"
          stroke="none"
          cornerRadius={4}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={COLORS.inflow[idx % COLORS.inflow.length]} />
          ))}
        </Pie>
        <RechartsTooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "12px",
            fontSize: "12px",
            color: tooltipColor,
          }}
          formatter={(v) => rupee(Number(v))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
