"use client";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer } from "recharts";

interface ThemeChartProps {
  children: React.ReactElement | React.ReactElement[];
  height?: number | string;
  margin?: { top: number; right: number; left: number; bottom: number };
}

export const ThemeChart: React.FC<ThemeChartProps> = ({ children, height = 350 }) => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const checkTheme = () => {
      const t = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
      setTheme(t);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const chartColors = {
    grid: theme === "dark" ? "#ffffff0a" : "#00000010",
    text: theme === "dark" ? "#8899b0" : "#475569",
    tooltipBg: theme === "dark" ? "#121a2a" : "#ffffff",
    tooltipBorder: theme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
  };

  // Clone children to inject theme-aware props where applicable
  const themedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    const el = child as React.ReactElement<Record<string, unknown>>;
    const childType =
      (el.type as { displayName?: string; name?: string }).displayName ||
      (el.type as { displayName?: string; name?: string }).name;

    if (childType === "CartesianGrid") {
      return React.cloneElement(el, { stroke: chartColors.grid });
    }

    if (childType === "XAxis" || childType === "YAxis") {
      return React.cloneElement(el, {
        tick: { fill: chartColors.text, fontSize: 10, fontWeight: 900 },
        axisLine: false,
        tickLine: false,
        ...(childType === "XAxis"
          ? { minTickGap: 30 }
          : { tickFormatter: (v: number) => `₹${Number(v) / 1000}k` }),
      });
    }

    if (childType === "Tooltip" || childType === "RechartsTooltip") {
      return React.cloneElement(el, {
        contentStyle: {
          backgroundColor: chartColors.tooltipBg,
          border: `1px solid ${chartColors.tooltipBorder}`,
          borderRadius: "16px",
          color: theme === "dark" ? "#f0f4fa" : "#0a0f1a",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          fontSize: "12px",
          fontWeight: "black",
          padding: "12px",
        },
        ...el.props,
      });
    }

    return el;
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {themedChildren}
      </ResponsiveContainer>
    </div>
  );
};
