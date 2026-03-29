"use client";

import React from "react";

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  glowColor?: "blue" | "emerald" | "rose" | "amber" | "purple";
  hover?: boolean;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({ 
  children, 
  className = "", 
  glow = false,
  glowColor = "blue",
  hover = true
}) => {
  const glowColors = {
    blue: "from-blue-500 to-blue-700",
    emerald: "from-emerald-500 to-emerald-700",
    rose: "from-rose-500 to-rose-700",
    amber: "from-amber-500 to-amber-700",
    purple: "from-purple-500 to-purple-700",
  };

  return (
    <div className={`group relative h-full ${className}`}>
      {/* Background Glow */}
      {glow && (
        <div className={`absolute -inset-1 bg-gradient-to-br ${glowColors[glowColor]} transition-all duration-500 opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 rounded-[2rem] blur-lg`}></div>
      )}
      
      {/* Card Content */}
      <div className={`relative bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 h-full transition-all duration-500 shadow-sm dark:shadow-none ${
        hover ? "group-hover:-translate-y-1.5 group-hover:shadow-2xl dark:group-hover:shadow-[0_40px_100px_rgba(0,0,0,0.4)]" : ""
      }`}>
        {children}
      </div>
    </div>
  );
};
