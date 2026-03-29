"use client";

import React, { useState, useEffect } from "react";
import { 
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
} from "recharts";

interface ThemeChartProps {
  children: React.ReactElement | React.ReactElement[];
  height?: number | string;
  margin?: { top: number; right: number; left: number; bottom: number };
}

export const ThemeChart: React.FC<ThemeChartProps> = ({ 
  children, 
  height = 350, 
  margin = { top: 10, right: 10, left: -20, bottom: 0 } 
}) => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const checkTheme = () => {
      const t = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
      setTheme(t);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const chartColors = {
    grid: theme === "dark" ? "#ffffff05" : "#00000008",
    text: theme === "dark" ? "#64748b" : "#94a3b8",
    tooltipBg: theme === "dark" ? "#161b27" : "#ffffff",
    tooltipBorder: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
  };

  // Clone children to inject theme-aware props where applicable
  const themedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const childType = (child.type as any).displayName || (child.type as any).name;

    if (childType === "CartesianGrid") {
      return React.cloneElement(child as any, { stroke: chartColors.grid });
    }

    if (childType === "XAxis" || childType === "YAxis") {
      return React.cloneElement(child as any, { 
        tick: { fill: chartColors.text, fontSize: 10, fontWeight: 900 },
        axisLine: false,
        tickLine: false,
        ...(childType === "XAxis" ? { minTickGap: 30 } : { tickFormatter: (v: any) => `₹${Number(v)/1000}k` })
      });
    }

    if (childType === "Tooltip" || childType === "RechartsTooltip") {
      return React.cloneElement(child as any, {
        contentStyle: {
          backgroundColor: chartColors.tooltipBg,
          border: `1px solid ${chartColors.tooltipBorder}`,
          borderRadius: "16px",
          color: theme === "dark" ? "#fff" : "#0f172a",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          fontSize: "12px",
          fontWeight: "black",
          padding: "12px"
        },
        ...(child.props as any)
      });
    }

    return child;
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {themedChildren as any}
      </ResponsiveContainer>
    </div>
  );
};
