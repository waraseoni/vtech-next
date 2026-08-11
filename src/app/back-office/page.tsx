"use client";

import { useState, type ReactNode } from "react";
import { 
  Wrench, Package, Users, ShieldCheck, Database, Settings, 
  Search, DollarSign, Wallet, Percent, 
  Landmark, Handshake, ScrollText, Download,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

type OfficeItem = {
  name: string;
  href: string;
  icon: ReactNode;
  color: string;
  desc: string;
};

type Section = {
  title: string;
  icon: ReactNode;
  items: OfficeItem[];
};

export default function BackOfficeDashboard() {
  const [query, setQuery] = useState("");

  const sections: Section[] = [
    {
      title: "Accounts & Finance",
      icon: <DollarSign size={18} />,
      items: [
        { name: "Pay Outs", href: "/expenses", icon: <DollarSign />, color: "rose", desc: "Expense management" },
        { name: "Salary", href: "/salary", icon: <Wallet />, color: "emerald", desc: "Staff wages & payroll" },
        { name: "Commission", href: "/mechanics/commission", icon: <Percent />, color: "blue", desc: "Rate master & history" },
        { name: "Client Amt", href: "/clients-admin", icon: <Users />, color: "purple", desc: "Client balance management" },
        { name: "Lenders", href: "/lenders", icon: <Landmark />, color: "amber", desc: "Manage loan providers" },
        { name: "Client Loans", href: "/client-loans", icon: <Handshake />, color: "teal", desc: "Customer credit & EMIs" },
      ]
    },
    {
      title: "Masters & Setup",
      icon: <Database size={18} />,
      items: [
        { name: "Services", href: "/services", icon: <Wrench />, color: "pink", desc: "Service category master" },
        { name: "Products", href: "/products", icon: <Package />, color: "orange", desc: "Inventory master list" },
        { name: "Mechanics", href: "/mechanics", icon: <Users />, color: "indigo", desc: "Staff profile management" },
        { name: "Users", href: "/users", icon: <ShieldCheck />, color: "slate", desc: "System access control" },
      ]
    },
    {
      title: "System Maintenance",
      icon: <Settings size={18} />,
      items: [
        { name: "Backup", href: "/backup", icon: <Download />, color: "sky", desc: "Database exports" },
        { name: "Settings", href: "/settings", icon: <Settings />, color: "slate", desc: "Global configuration" },
        { name: "Activity Logs", href: "/activity-logs", icon: <ScrollText />, color: "cyan", desc: "Audit trail & history" },
      ]
    }
  ];

  const filteredSections = sections.map(s => ({
    ...s,
    items: s.items.filter(i => 
      i.name.toLowerCase().includes(query.toLowerCase()) || 
      i.desc.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(s => s.items.length > 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Hero Section */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full -ml-20 -mb-20 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} /> Administrator Command Center
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Back Office <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Dashboard</span>
            </h1>
            <p className="text-slate-500 max-w-lg font-medium leading-relaxed">
              Efficiently manage your system masters, financial accounts, and technical configurations from a unified interface.
            </p>
          </div>
          <div className="w-full md:w-80 group">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search masters (e.g. Salary, Backup)..." 
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-[#0d1117] border border-[#21293d] rounded-2xl text-white placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Modules */}
      <div className="space-y-12">
        {filteredSections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 border border-blue-500/20">
                {section.icon}
              </div>
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">{section.title}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {section.items.map((item, i) => (
                <ModuleCard key={i} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {query && filteredSections.length === 0 && (
        <div className="py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-[#161b27] border border-[#21293d] rounded-2xl flex items-center justify-center text-slate-700 mx-auto">
            <Search size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-400">No masters found for &quot;{query}&quot;</h3>
          <button onClick={() => setQuery("")} className="text-blue-500 font-bold hover:underline">Clear search filter</button>
        </div>
      )}
    </div>
  );
}

function ModuleCard({ item }: { item: OfficeItem }) {
  const colorMap: Record<string, string> = {
    rose: "from-rose-500 to-rose-700 shadow-rose-500/20 text-rose-400 border-rose-500/20",
    emerald: "from-emerald-500 to-emerald-700 shadow-emerald-500/20 text-emerald-400 border-emerald-500/20",
    blue: "from-blue-500 to-blue-700 shadow-blue-500/20 text-blue-400 border-blue-500/20",
    purple: "from-purple-500 to-purple-700 shadow-purple-500/20 text-purple-400 border-purple-500/20",
    amber: "from-amber-500 to-amber-700 shadow-amber-500/20 text-amber-400 border-amber-500/20",
    teal: "from-teal-500 to-teal-700 shadow-teal-500/20 text-teal-400 border-teal-500/20",
    pink: "from-pink-500 to-pink-700 shadow-pink-500/20 text-pink-400 border-pink-500/20",
    orange: "from-orange-500 to-orange-700 shadow-orange-500/20 text-orange-400 border-orange-500/20",
    indigo: "from-indigo-500 to-indigo-700 shadow-indigo-500/20 text-indigo-400 border-indigo-500/20",
    slate: "from-slate-500 to-slate-700 shadow-slate-500/20 text-slate-400 border-slate-500/20",
    sky: "from-sky-500 to-sky-700 shadow-sky-500/20 text-sky-400 border-sky-500/20",
    cyan: "from-cyan-500 to-cyan-700 shadow-cyan-500/20 text-cyan-400 border-cyan-500/20",
  };

  return (
    <Link 
      href={item.href}
      className="group block bg-[#161b27] border border-[#21293d] rounded-[2rem] p-6 hover:border-blue-500/30 hover:bg-white/[0.02] transition-all duration-300 shadow-lg no-underline"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[item.color].split(' shadow')[0]} rounded-2xl flex items-center justify-center text-white shadow-xl ${colorMap[item.color].split('text')[0].split('shadow')[1]} group-hover:scale-110 transition-transform duration-300`}>
          {item.icon}
        </div>
        <ArrowRight size={18} className="text-slate-700 group-hover:text-blue-400 transition-colors group-hover:translate-x-1" />
      </div>
      <h3 className="text-white font-black text-lg mb-1">{item.name}</h3>
      <p className="text-slate-500 text-xs font-medium leading-relaxed line-clamp-2">
        {item.desc}
      </p>
      
      <div className="mt-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-1 flex-1 bg-[#21293d] rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 w-1/3 group-hover:w-full transition-all duration-700 ease-out" />
        </div>
        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Manage</span>
      </div>
    </Link>
  );
}
