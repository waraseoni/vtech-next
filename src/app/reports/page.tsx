"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText, TrendingUp, PieChart, BarChart2, DollarSign,
  ShoppingCart, Wrench, Truck, Clock, Users, Database,
  Activity, Briefcase, Store, Calculator, Scale, FileSearch,
  Search, ChevronRight, Sparkles, Filter, Info, CheckCircle,
  CalendarClock, PackageX
} from "lucide-react";

// --- Types ---
type ReportCategory = "Job Reports" | "Finance & Accounts" | "Sales & Services" | "Other Reports";

interface ReportItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  category: ReportCategory;
  color: string;
  isNew?: boolean;
}

const REPORTS: ReportItem[] = [
  // Job Reports
  {
    title: "Daily Done Report",
    description: "Daily snapshot of all jobs marked as done.",
    href: "/reports/daily-done",
    icon: <CheckCircle size={16} />,
    category: "Job Reports",
    color: "from-teal-500 to-emerald-600",
    isNew: true
  },
  {
    title: "Pending Jobs",
    description: "Track all service jobs currently in progress.",
    href: "/reports/pending-jobs",
    icon: <Clock size={16} />,
    category: "Job Reports",
    color: "from-amber-500 to-orange-600",
    isNew: true
  },
  {
    title: "Delivered Report",
    description: "Summary of all jobs delivered to customers.",
    href: "/reports/delivered",
    icon: <Truck size={16} />,
    category: "Job Reports",
    color: "from-emerald-500 to-teal-600"
  },
  {
    title: "Due Reminders",
    description: "Promised payment dues — overdue, due today, upcoming.",
    href: "/reports/due-reminders",
    icon: <CalendarClock size={16} />,
    category: "Job Reports",
    color: "from-red-500 to-orange-600",
    isNew: true
  },
  {
    title: "Requirement List",
    description: "Low-stock spares with linked suppliers and order quantity.",
    href: "/reports/requirement-list",
    icon: <PackageX size={16} />,
    category: "Job Reports",
    color: "from-amber-500 to-orange-600",
    isNew: true
  },

  // Finance & Accounts
  {
    title: "Accounting",
    description: "Visual overview of business financial health.",
    href: "/reports/accounting-dashboard",
    icon: <Calculator size={16} />,
    category: "Finance & Accounts",
    color: "from-purple-500 to-indigo-600",
    isNew: true
  },
  {
    title: "Balance Sheet",
    description: "Statement of assets, liabilities, and equity.",
    href: "/reports/balancesheet",
    icon: <Scale size={16} />,
    category: "Finance & Accounts",
    color: "from-red-500 to-rose-600"
  },
  {
    title: "Business Ledger",
    description: "Record of all business transactions.",
    href: "/reports/ledger",
    icon: <Database size={16} />,
    category: "Finance & Accounts",
    color: "from-blue-500 to-cyan-600"
  },
  {
    title: "Cash Flow",
    description: "Monitor the movement of money in and out.",
    href: "/reports/cash-flow",
    icon: <TrendingUp size={16} />,
    category: "Finance & Accounts",
    color: "from-teal-500 to-emerald-600"
  },
  {
    title: "Daily Income",
    description: "Summary of total income received today.",
    href: "/reports/daily-income",
    icon: <DollarSign size={16} />,
    category: "Finance & Accounts",
    color: "from-cyan-500 to-blue-600",
    isNew: true
  },
  {
    title: "Financial Report",
    description: "Comprehensive end-of-period analysis.",
    href: "/reports/financial-report",
    icon: <FileText size={16} />,
    category: "Finance & Accounts",
    color: "from-blue-600 to-indigo-700",
    isNew: true
  },
  {
    title: "Monthly Profit",
    description: "Yearly trend of sales vs net profit.",
    href: "/reports/monthly-profit",
    icon: <BarChart2 size={16} />,
    category: "Finance & Accounts",
    color: "from-emerald-600 to-teal-700",
    isNew: true
  },

  // Sales & Services
  {
    title: "Daily Sales",
    description: "Product and part sales for the day.",
    href: "/reports/daily-sales",
    icon: <ShoppingCart size={16} />,
    category: "Sales & Services",
    color: "from-blue-500 to-blue-700"
  },
  {
    title: "Monthly Sales",
    description: "Aggregate sales data organized by month.",
    href: "/reports/monthly-sales",
    icon: <BarChart2 size={16} />,
    category: "Sales & Services",
    color: "from-indigo-500 to-purple-700"
  },
  {
    title: "Daily Service",
    description: "Overview of all service tasks completed today.",
    href: "/reports/daily-service",
    icon: <Wrench size={16} />,
    category: "Sales & Services",
    color: "from-olive-500 to-green-700"
  },
  {
    title: "Custom Sales",
    description: "Sales reports for custom date ranges.",
    href: "/reports/custom-sales",
    icon: <Filter size={16} />,
    category: "Sales & Services",
    color: "from-orange-500 to-red-600"
  },
  {
    title: "Custom Service",
    description: "Filter service reports by date or mechanic.",
    href: "/reports/custom-service",
    icon: <FileSearch size={16} />,
    category: "Sales & Services",
    color: "from-lime-500 to-green-600"
  },

  // Others
  {
    title: "Loan Report",
    description: "Status of active and pending client loans.",
    href: "/reports/loan",
    icon: <PieChart size={16} />,
    category: "Other Reports",
    color: "from-slate-600 to-slate-800"
  },
  {
    title: "Business Summary",
    description: "Snapshot of total revenue and growth.",
    href: "/reports/vyapar-darpan",
    icon: <Briefcase size={16} />,
    category: "Other Reports",
    color: "from-sky-500 to-blue-600",
    isNew: true
  },
  {
    title: "Vyapar Darpan",
    description: "Bird's eye view of daily performance.",
    href: "/reports/vyapar-darpan",
    icon: <Store size={16} />,
    category: "Other Reports",
    color: "from-indigo-600 to-blue-900",
    isNew: true
  },
  {
    title: "Activity Log",
    description: "Audit trail of all actions in the system.",
    href: "/activity-logs",
    icon: <Activity size={16} />,
    category: "Other Reports",
    color: "from-rose-500 to-red-700"
  },
  {
    title: "Top Customers",
    description: "Identify and reward frequent clients.",
    href: "/reports/top-customers",
    icon: <Users size={16} />,
    category: "Other Reports",
    color: "from-purple-500 to-pink-600"
  }
];

const CATEGORIES: { name: ReportCategory; icon: React.ReactNode }[] = [
  { name: "Job Reports", icon: <Wrench size={14} /> },
  { name: "Finance & Accounts", icon: <DollarSign size={14} /> },
  { name: "Sales & Services", icon: <ShoppingCart size={14} /> },
  { name: "Other Reports", icon: <Info size={14} /> },
];

export default function ReportsCenter() {
  const [search, setSearch] = useState("");

  const filteredReports = REPORTS.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in duration-500 px-2 md:px-4">
      {/* Compact Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <PieChart className="text-blue-400" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-none">
              Reports <span className="text-blue-500">Center</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Business Intelligence Dashboard</p>
          </div>
        </div>

        <div className="relative group w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search all reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[#111520] border border-white/5 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-xl"
          />
        </div>
      </div>

      {/* Optimized Grid Content */}
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const catReports = filteredReports.filter(r => r.category === cat.name);
          if (catReports.length === 0) return null;

          return (
            <section key={cat.name} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 pr-4 py-1 border-r border-white/5">
                  <span className="text-blue-400">{cat.icon}</span>
                  <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {cat.name}
                  </h2>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {catReports.map((report) => (
                  <Link 
                    key={report.title} 
                    href={report.href}
                    className="group relative flex flex-col p-3.5 bg-[#111520]/60 border border-white/5 rounded-2xl hover:bg-white/[0.04] hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden shadow-lg shadow-black/20"
                  >
                    {/* Compact Accent */}
                    <div className={`absolute -right-4 -top-4 w-12 h-12 bg-gradient-to-br ${report.color} opacity-[0.04] group-hover:opacity-[0.12] blur-xl transition-opacity rounded-full`} />
                    
                    <div className="flex items-start justify-between mb-2.5">
                      <div className={`p-2 rounded-xl bg-gradient-to-br ${report.color} shadow-lg shadow-black/40 group-hover:scale-105 transition-transform duration-300`}>
                        <div className="text-white">
                          {report.icon}
                        </div>
                      </div>
                      
                      {report.isNew && (
                        <div className="px-1.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-1">
                          <Sparkles size={7} className="text-blue-400" />
                          <span className="text-[7px] font-black uppercase tracking-tighter text-blue-400 italic">NEW</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 relative">
                      <h3 className="text-[12px] font-black text-slate-100 group-hover:text-blue-400 transition-colors truncate">
                        {report.title}
                      </h3>
                      <p className="text-[10px] leading-tight text-slate-500 font-medium line-clamp-2 h-6">
                        {report.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.03] flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Analyze</span>
                      <ChevronRight size={12} className="text-blue-500 translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="p-4 bg-white/5 rounded-full border border-white/5 opacity-50">
            <Search size={32} className="text-slate-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-400">No matching reports</h3>
            <p className="text-[11px] text-slate-600 italic">Try a different keyword or category.</p>
          </div>
        </div>
      )}

      {/* Slim Footer */}
      <div className="pt-8 pb-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-700">
          V-TECH PRO · INTELLIGENCE v4.2
        </p>
        <div className="flex items-center gap-4">
          <Link href="/help" className="text-[9px] font-bold text-slate-600 hover:text-blue-400 transition-colors uppercase">Help</Link>
          <div className="w-1 h-1 bg-slate-800 rounded-full" />
          <Link href="/settings" className="text-[9px] font-bold text-slate-600 hover:text-blue-400 transition-colors uppercase">Layout</Link>
        </div>
      </div>
    </div>
  );
}
