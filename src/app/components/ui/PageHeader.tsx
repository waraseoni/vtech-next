"use client";

import React from "react";
import { LucideIcon, Sparkles } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  badge = "System Active", 
  icon: Icon,
  actions
}) => {
  return (
    <div className="relative overflow-hidden mb-8 border-b border-black/[0.05] dark:border-white/[0.05] bg-gradient-to-b from-white dark:from-[#111114] to-slate-50 dark:to-[#09090b] rounded-[3rem] p-8 md:p-10 shadow-sm dark:shadow-none">
      {/* Glow Effects */}
      <div className="absolute -top-24 -left-20 w-64 h-64 bg-blue-600/5 dark:bg-blue-600/10 blur-[100px] rounded-full"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-10 dark:opacity-20 animate-pulse group-hover:opacity-40 transition-opacity"></div>
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white dark:bg-[#161b27] border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-xl dark:shadow-2xl relative z-10 transform group-hover:rotate-12 transition-transform duration-500">
              <Icon size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
              {title}
              <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-[0.2em] shadow-sm">
                <Sparkles size={10} className="inline mr-2" />
                {badge}
              </span>
            </h1>
            {subtitle && (
              <p className="text-slate-500 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-4 bg-white/[0.6] dark:bg-white/[0.02] p-2 rounded-2xl border border-black/[0.05] dark:border-white/[0.05] shadow-sm backdrop-blur-xl">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
