"use client";
import PWAHead from "../components/PWAHead";
import LicenseGate from "../components/LicenseGate";
import type { LicenseStatus } from "@/lib/license";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Users, Package, Settings, Wrench, Search,
  User, LogOut, Sparkles, Loader2, ShieldCheck, CalendarCheck,
  HelpCircle, ShoppingCart, ClipboardList, PieChart, TrendingUp,
  DollarSign, Truck, CreditCard, Clock, Briefcase, Coins, Receipt,
  Toolbox, FolderOpen, UsersRound, Database, Settings2, MessageSquare,
  ChevronDown, ChevronRight, X, Menu, BarChart2, RefreshCw, Sun, Moon, History, Activity, BookOpen, CalendarClock, ShieldAlert, KeyRound, Code2,
} from "lucide-react";

// ─── Universal Search ────────────────────────────────────────────────────────
type SearchResult = {
  id: number | string;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  href: string;
  icon: "client" | "job" | "product" | "mechanic" | "sale";
};

function NavbarSearch() {
  const router                = useRouter();
  const [query,  setQuery]    = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const wrapRef               = useRef<HTMLDivElement>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ctrl+K to open search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (input) input.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    const like = `%${q}%`;
    const num  = parseInt(q);

    try {
      const [clientRes, jobRes, prodRes, mechRes, saleRes] = await Promise.all([
        // Clients — name, contact, address
        supabase.from("client_list")
          .select("id, firstname, middlename, lastname, contact, address")
          .eq("delete_flag", 0)
          .or(`firstname.ilike.${like},middlename.ilike.${like},lastname.ilike.${like},contact.ilike.${like},address.ilike.${like}`)
          .limit(5),

        // Jobs — item, fault, job_id, code, uniq_id
        supabase.from("transaction_list")
          .select("id, job_id, item, fault, status, date_created")
          .eq("del_status", 0)
          .or(`item.ilike.${like},fault.ilike.${like},job_id.ilike.${like},code.ilike.${like},uniq_id.ilike.${like}${!isNaN(num) ? `,job_id.eq.${q}` : ""}`)
          .limit(5),

        // Products
        supabase.from("product_list")
          .select("id, name, price")
          .eq("delete_flag", 0)
          .ilike("name", like)
          .limit(4),

        // Mechanics
        supabase.from("mechanic_list")
          .select("id, firstname, lastname, designation, contact")
          .eq("status", 1)
          .or(`firstname.ilike.${like},lastname.ilike.${like},contact.ilike.${like}`)
          .limit(3),

        // Direct Sales — sale_code, remarks
        supabase.from("direct_sales")
          .select("id, sale_code, total_amount, remarks, date_created")
          .or(`sale_code.ilike.${like},remarks.ilike.${like}`)
          .limit(3),
      ]);

      const STATUS_LABELS: Record<number, string> = {
        0:"Pending", 1:"In Progress", 2:"Done", 3:"Paid", 4:"Cancelled", 5:"Delivered",
      };
      const STATUS_COLORS: Record<number, string> = {
        0:"bg-slate-500/20 text-slate-400", 1:"bg-blue-500/20 text-blue-400",
        2:"bg-teal-500/20 text-teal-400",   3:"bg-emerald-500/20 text-emerald-400",
        4:"bg-red-500/20 text-red-400",     5:"bg-purple-500/20 text-purple-400",
      };

      const out: SearchResult[] = [];

      (clientRes.data || []).forEach(r => {
        const name = [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ");
        out.push({ id: r.id, title: name, subtitle: r.contact || r.address || "—",
          tag: "Client", tagColor: "bg-blue-500/20 text-blue-400",
          href: `/clients/${r.id}/view`, icon: "client" });
      });

      (jobRes.data || []).forEach(r => {
        out.push({ id: r.id, title: `Job #${r.job_id} — ${r.item}`, subtitle: r.fault || "—",
          tag: STATUS_LABELS[r.status] || "Job", tagColor: STATUS_COLORS[r.status] || "bg-slate-500/20 text-slate-400",
          href: `/jobs/${r.id}/view`, icon: "job" });
      });

      (prodRes.data || []).forEach(r => {
        out.push({ id: r.id, title: r.name, subtitle: `Rs.${r.price?.toFixed(2) || "0.00"}`,
          tag: "Product", tagColor: "bg-amber-500/20 text-amber-400",
          href: `/inventory`, icon: "product" });
      });

      (mechRes.data || []).forEach(r => {
        const name = [r.firstname, r.lastname].filter(Boolean).join(" ");
        out.push({ id: r.id, title: name, subtitle: `${r.designation || ""} ${r.contact ? "· " + r.contact : ""}`.trim(),
          tag: "Mechanic", tagColor: "bg-purple-500/20 text-purple-400",
          href: `/mechanics`, icon: "mechanic" });
      });

      (saleRes.data || []).forEach(r => {
        out.push({ id: r.id, title: `Sale ${r.sale_code}`, subtitle: r.remarks || `Rs.${r.total_amount?.toFixed(2)}`,
          tag: "Direct Sale", tagColor: "bg-pink-500/20 text-pink-400",
          href: `/direct-sales/${r.id}/view`, icon: "sale" });
      });

      setResults(out);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(() => runSearch(val), 300);
  };

  const handleSelect = (href: string) => {
    setQuery(""); setResults([]); setOpen(false);
    router.push(href);
  };

  const ICON_MAP = {
    client:   <Users size={13} className="text-blue-400 flex-shrink-0"/>,
    job:      <Wrench size={13} className="text-slate-400 flex-shrink-0"/>,
    product:  <Package size={13} className="text-amber-400 flex-shrink-0"/>,
    mechanic: <User size={13} className="text-purple-400 flex-shrink-0"/>,
    sale:     <ShoppingCart size={13} className="text-pink-400 flex-shrink-0"/>,
  };

  return (
    <div ref={wrapRef} className="relative w-full group">
      {/* Input */}
      <Search size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors pointer-events-none z-10"/>
      {loading && (
        <Loader2 size={13}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-blue-400 animate-spin pointer-events-none z-10"/>
      )}
      {query && !loading && (
        <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors z-10">
          <X size={13}/>
        </button>
      )}
      <input
        type="text"
        value={query}
        data-search-input
        onChange={handleChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search..."
        className="w-full pl-9 pr-24 py-2.5 sm:py-2 bg-[#111520] border border-[#21293d] rounded-xl text-sm text-slate-300 placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a2234] border border-[#21293d] text-[10px] font-medium text-slate-500">Ctrl</kbd>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#1a2234] border border-[#21293d] text-[10px] font-medium text-slate-500">K</kbd>
      </div>

      {/* Dropdown Results */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-[#111520] border border-[#21293d] rounded-2xl shadow-2xl shadow-black/60 z-[200] overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-5 text-center text-slate-600 text-xs font-bold uppercase tracking-wider">
              No results found
            </div>
          ) : (
            <>
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[9px] text-slate-700">Clients · Jobs · Products · Mechanics · Sales</span>
              </div>
              <ul className="max-h-[400px] overflow-y-auto divide-y divide-[#1a2234]">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r.href)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left">
                      <div className="w-7 h-7 rounded-lg bg-[#1a2234] flex items-center justify-center flex-shrink-0">
                        {ICON_MAP[r.icon]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-200 truncate">{r.title}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${r.tagColor}`}>
                            {r.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">{r.subtitle}</p>
                      </div>
                      <ChevronRight size={12} className="text-slate-700 flex-shrink-0"/>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-3 py-2 border-t border-[#1a2234] text-[9px] text-slate-700 text-center">
                Press Enter ya click karo to navigate
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Accordion sub-menu ───────────────────────────────────────────────────────
function SubMenu({
  title, icon, children, basePath,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode; basePath?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => !!(basePath && pathname.startsWith(basePath)));
  return (
    <li>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 transition-all"
      >
        <div className="flex items-center gap-3"><span>{icon}</span><span>{title}</span></div>
        {open
          ? <ChevronDown size={13} className="text-slate-600" />
          : <ChevronRight size={13} className="text-slate-600" />}
      </button>
      {open && <ul className="pl-3 mt-0.5 space-y-0.5">{children}</ul>}
    </li>
  );
}

// ─── Shared link style builders ───────────────────────────────────────────────
const navLinkCls = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 ${
    active
      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
  }`;

const subLinkCls = (active: boolean) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
    active ? "text-blue-400 bg-blue-500/10" : "text-slate-600 hover:text-slate-200 hover:bg-white/[0.04]"
  }`;

// ─── Sidebar nav (shared by desktop + mobile drawer) ─────────────────────────
function SidebarNav({
  pathname, isAdmin, isClient, onNavClick, sellerEnabled, devEnabled,
}: {
  pathname: string; isAdmin: boolean; isClient?: boolean; onNavClick?: () => void;
  sellerEnabled?: boolean; devEnabled?: boolean;
}) {
  const lk = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  if (isClient) {
    return (
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
        <ul className="space-y-0.5">
          <li>
            <Link href="/my-account" className={navLinkCls(lk("/my-account", true))} onClick={onNavClick}>
              <Wrench size={16} /><span>Meri Repairs</span>
            </Link>
          </li>
          <li>
            <Link href="/my-account/payments" className={navLinkCls(pathname === "/my-account/payments")} onClick={onNavClick}>
              <Receipt size={16} /><span>Meri Payments</span>
            </Link>
          </li>
          <li>
            <Link href="/my-account/ledger" className={navLinkCls(pathname === "/my-account/ledger")} onClick={onNavClick}>
              <BookOpen size={16} /><span>Meri Ledger</span>
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
      <ul className="space-y-0.5">
        <li>
          <Link href="/" className={navLinkCls(pathname === "/")} onClick={onNavClick}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </Link>
        </li>
        <li>
          <Link href="/attendance" className={navLinkCls(lk("/attendance", true))} onClick={onNavClick}>
            <CalendarCheck size={16} /><span>Attendance</span>
          </Link>
        </li>
        <li>
          <Link href="/clients" className={navLinkCls(lk("/clients"))} onClick={onNavClick}>
            <Users size={16} /><span>Clients</span>
          </Link>
        </li>
        <li>
          <Link href="/inquiries" className={navLinkCls(lk("/inquiries", true))} onClick={onNavClick}>
            <HelpCircle size={16} /><span>Inquiries</span>
          </Link>
        </li>
        <li>
          <Link href="/direct-sales" className={navLinkCls(lk("/direct-sales"))} onClick={onNavClick}>
            <ShoppingCart size={16} /><span>Direct Sales</span>
          </Link>
        </li>
        <li>
          <Link href="/inventory" className={navLinkCls(lk("/inventory"))} onClick={onNavClick}>
            <Package size={16} /><span>Inventory</span>
          </Link>
        </li>
        <li>
          <Link href="/jobs" className={navLinkCls(lk("/jobs"))} onClick={onNavClick}>
            <ClipboardList size={16} /><span>JobSheet</span>
          </Link>
        </li>

        <li className="text-[9px] font-black uppercase text-purple-500 tracking-widest px-3 pt-5 pb-1.5 select-none">
          AI Tools
        </li>
        <li>
          <Link href="/ai" className={navLinkCls(pathname === "/ai")} onClick={onNavClick}>
            <Sparkles size={16} /><span>AI Assistant</span>
          </Link>
        </li>

        {isAdmin && (
          <>
            <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
              Reports
            </li>
            <SubMenu title="Reports" icon={<PieChart size={15} />} basePath="/reports">
              <li><Link href="/reports"                 className={subLinkCls(pathname === "/reports")}                onClick={onNavClick}><Sparkles size={12} className="text-blue-400" />All Reports</Link></li>
              <li><Link href="/reports/balancesheet"    className={subLinkCls(pathname === "/reports/balancesheet")}    onClick={onNavClick}><BarChart2 size={12} />Balance Sheet</Link></li>
              <li><Link href="/reports/delivered"      className={subLinkCls(pathname === "/reports/delivered")}      onClick={onNavClick}><Truck size={12} />Delivered Report</Link></li>
              <li><Link href="/reports/due-reminders"  className={subLinkCls(pathname === "/reports/due-reminders")}  onClick={onNavClick}><CalendarClock size={12} className="text-red-400" />Due Reminders</Link></li>
              <li><Link href="/reports/monthly-profit" className={subLinkCls(pathname === "/reports/monthly-profit")} onClick={onNavClick}><BarChart2 size={12} className="text-emerald-400" />Monthly Profit</Link></li>
              <li><Link href="/reports/cash-flow"      className={subLinkCls(pathname === "/reports/cash-flow")}      onClick={onNavClick}><TrendingUp size={12} />Cash Flow</Link></li>
              <li><Link href="/reports/ledger"         className={subLinkCls(pathname === "/reports/ledger")}         onClick={onNavClick}><DollarSign size={12} />Business Ledger</Link></li>
              <li><Link href="/reports/yearly"         className={subLinkCls(pathname === "/reports/yearly")}         onClick={onNavClick}><Clock size={12} />Yearly Report</Link></li>

              <li><Link href="/reports/daily-sales"    className={subLinkCls(pathname === "/reports/daily-sales")}    onClick={onNavClick}><ShoppingCart size={12} />Daily Sales</Link></li>
              <li><Link href="/reports/daily-service"  className={subLinkCls(pathname === "/reports/daily-service")}  onClick={onNavClick}><Wrench size={12} />Daily Service</Link></li>
              <li><Link href="/reports/monthly-sales"   className={subLinkCls(pathname === "/reports/monthly-sales")}   onClick={onNavClick}><ShoppingCart size={12} />Monthly Sales</Link></li>
              <li><Link href="/reports/custom-sales"    className={subLinkCls(pathname === "/reports/custom-sales")}    onClick={onNavClick}><ShoppingCart size={12} />Custom Sales</Link></li>
              <li><Link href="/reports/custom-service"  className={subLinkCls(pathname === "/reports/custom-service")}  onClick={onNavClick}><Wrench size={12} />Custom Service</Link></li>
              <li><Link href="/reports/top-customers"  className={subLinkCls(pathname === "/reports/top-customers")}  onClick={onNavClick}><Users size={12} />Top Customers</Link></li>
              <li><Link href="/reports/loan"           className={subLinkCls(pathname === "/reports/loan")}           onClick={onNavClick}><CreditCard size={12} />Loan Report</Link></li>
               <li><Link href="/reports/pending-jobs"   className={subLinkCls(pathname === "/reports/pending-jobs")}   onClick={onNavClick}><Clock size={12} className="text-amber-400" />Pending Jobs</Link></li>
              <li><Link href="/reports/vyapar-darpan"   className={subLinkCls(pathname === "/reports/vyapar-darpan")}   onClick={onNavClick}><PieChart size={12} className="text-amber-400" />Vyapar Darpan</Link></li>
              <li><Link href="/activity-logs"          className={subLinkCls(pathname === "/activity-logs")}          onClick={onNavClick}><Activity size={12} />Activity Log</Link></li>
            </SubMenu>

            <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
              Back Office
            </li>
            <SubMenu title="Back Office" icon={<Briefcase size={15} />} basePath="/back-office">
              <li><Link href="/back-office"   className={subLinkCls(pathname === "/back-office")}   onClick={onNavClick}><Sparkles size={12} className="text-purple-400" />Overview</Link></li>
              <li><Link href="/expenses"      className={subLinkCls(pathname === "/expenses")}      onClick={onNavClick}><DollarSign size={12} />Pay Outs</Link></li>
              <li><Link href="/payments"      className={subLinkCls(pathname === "/payments")}      onClick={onNavClick}><Receipt size={12} />Payments</Link></li>
              <li><Link href="/salary"        className={subLinkCls(pathname === "/salary")}        onClick={onNavClick}><Coins size={12} />Salary</Link></li>
              <li><Link href="/advance"       className={subLinkCls(pathname === "/advance")}       onClick={onNavClick}><DollarSign size={12} />Advance</Link></li>
              <li><Link href="/services"      className={subLinkCls(pathname === "/services")}      onClick={onNavClick}><Toolbox size={12} />Services</Link></li>
              <li><Link href="/products"      className={subLinkCls(pathname === "/products")}      onClick={onNavClick}><Package size={12} />Products</Link></li>
              <li><Link href="/suppliers"    className={subLinkCls(pathname === "/suppliers")}    onClick={onNavClick}><Truck size={12} />Suppliers</Link></li>
              <li><Link href="/mechanics"     className={subLinkCls(pathname.startsWith("/mechanics"))}     onClick={onNavClick}><UsersRound size={12} />Mechanics</Link></li>
              <li><Link href="/mechanics/commission" className={subLinkCls(pathname === "/mechanics/commission")} onClick={onNavClick}><BarChart2 size={12} />Commission History</Link></li>
              <li><Link href="/clients-admin" className={subLinkCls(pathname === "/clients-admin")} onClick={onNavClick}><FolderOpen size={12} />Client Amt</Link></li>
              <li><Link href="/client-loans" className={subLinkCls(pathname === "/client-loans")} onClick={onNavClick}><CreditCard size={12} />Client Loans</Link></li>
              <li><Link href="/lenders"        className={subLinkCls(pathname === "/lenders")}        onClick={onNavClick}><History size={12} />Lenders</Link></li>
              <li><Link href="/users"         className={subLinkCls(pathname === "/users")}         onClick={onNavClick}><ShieldCheck size={12} />Users</Link></li>
              <li><Link href="/backup"        className={subLinkCls(pathname === "/backup")}        onClick={onNavClick}><Database size={12} />Backup</Link></li>
              <li><Link href="/settings"      className={subLinkCls(pathname === "/settings")}      onClick={onNavClick}><Settings2 size={12} />Settings</Link></li>
              <li><Link href="/settings/throttle" className={subLinkCls(pathname === "/settings/throttle")} onClick={onNavClick}><ShieldAlert size={12} className="text-red-400" />Login Throttle</Link></li>
              <li><Link href="/settings/whatsapp-templates" className={subLinkCls(pathname === "/settings/whatsapp-templates")} onClick={onNavClick}><MessageSquare size={12} className="text-green-400" />WA Templates</Link></li>
            </SubMenu>

            {(sellerEnabled || devEnabled) && (
              <>
                <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
                  Licensing
                </li>
                {sellerEnabled && (
                  <li>
                    <Link href="/seller" className={navLinkCls(pathname === "/seller")} onClick={onNavClick}>
                      <KeyRound size={16} className="text-amber-400" /><span>Seller Portal</span>
                    </Link>
                  </li>
                )}
                {devEnabled && (
                  <li>
                    <Link href="/developer" className={navLinkCls(pathname === "/developer")} onClick={onNavClick}>
                      <Code2 size={16} className="text-indigo-400" /><span>Developer</span>
                    </Link>
                  </li>
                )}
              </>
            )}
          </>
        )}
      </ul>
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT
// ════════════════════════════════════════════════════════════════════════════
export default function RootClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  // BUG FIX 1: null prevents SSR↔client hydration mismatch.
  // Server always renders null-state → no sidebar flicker.
  const [isMobile,     setIsMobile]     = useState<boolean | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [profile,      setProfile]      = useState<{ full_name: string; role: string; avatar_url?: string | null } | null>(null);
  const [userEmail,    setUserEmail]    = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [theme,        setTheme]        = useState<"dark" | "light" | null>(null);
  const [license,      setLicense]      = useState<LicenseStatus | null>(null);

  // License status fetch — login ke baad har non-public page par.
  // Gate (LicenseGate) isi state ko dekh kar render hota hai.
  const refreshLicense = useCallback(async () => {
    try {
      const res = await fetch("/api/license/status", { cache: "no-store" });
      if (!res.ok) { setLicense(null); return; }
      setLicense(await res.json());
    } catch {
      setLicense(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    // Intentional full reload: RootClient ke stale in-memory state ko puri tarah reset karta hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }, []);

  // BUG FIX 2: Auth runs ONCE on mount — NOT on pathname change.
  // Original code: useEffect[pathname, router] → re-auth every navigation = slow + wasteful.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Public routes — redirect mat karo
        const PUBLIC_PAGES = ["/", "/about", "/contact", "/job-status", "/login", "/setup", "/stage-lighting", "/industrial", "/power-supply"];
        const isPublicPage = PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + "/"));

        // BUG FIX: getUser() kabhi-kabhi network par hang ho jata hai → "V-TECH
        // Secure Boot" loader hamesha ke liye atak jata tha. 6s timeout: public
        // page par bina user ke bhi render ho jao (proxy server-side guard hai).
        const AUTH_TIMEOUT_MS = 6000;
        const { data: { user } } = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null } }>(resolve =>
            setTimeout(() => resolve({ data: { user: null } }), AUTH_TIMEOUT_MS)
          ),
        ]);
        if (cancelled) return;
        if (!user) {
          if (!isPublicPage) router.push("/login");
          setLoading(false);
          return;
        }
        setUserEmail(user.email ?? null);
        const { data: pd } = await supabase
          .from("profiles").select("full_name, role, avatar_url").eq("id", user.id).maybeSingle();
        if (cancelled) return;
        setProfile({
          full_name: pd?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          role:      pd?.role || "staff",
          avatar_url: pd?.avatar_url || null,
        });
      } catch (e) {
        console.error("Auth error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: intentional, auth only on mount

  // BUG FIX: Boot-guard inline script ko signal — React mount/hydrate ho gaya,
  // loader isliye atka nahi hai. (8s watchdog tabhi reload karta hai jab ye
  // set NAHIN hota — matlab hydration hi fail ho gaya tha.)
  useEffect(() => {
    try { (window as unknown as { __VTECH_BOOTED__: boolean }).__VTECH_BOOTED__ = true; } catch { /* ignore */ }
  }, []);

  // BUG FIX: loader (V-TECH Secure Boot) atak jata hai jab stale SW cache purana
  // HTML/chunk serve karta hai ya auth call hang ho jati hai. Manual Ctrl+F5 ke
  // bina auto-recover: 6s tak loader atka raha → ek baar auto hard reload.
  // sessionStorage cooldown → reloads repeat ho sakte hain (har 30s me max ek),
  // par tight infinite loop nahi. (Pehle "ek baar per tab session" guard tha —
  // logout ke baad wahi tab me dobara hang hone par recover nahi hota tha.)
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      try {
        const k = "vtech_boot_reloaded";
        const last = Number(sessionStorage.getItem(k) || "0");
        if (Date.now() - last < 30000) return; // 30s cooldown — loop guard
        sessionStorage.setItem(k, String(Date.now()));
      } catch { /* ignore */ }
      window.location.reload();
    }, 6000);
    return () => clearTimeout(t);
  }, [loading]);

  // BUG FIX: Next.js kabhi-kabhi chunk load fail hone par router stuck chhod deta
  // hai (loader hamesha ke liye). Chunk error → cooldown ke saath auto hard reload.
  useEffect(() => {
    const reloadWithCooldown = () => {
      try {
        const k = "vtech_chunk_reload";
        const last = Number(sessionStorage.getItem(k) || "0");
        if (Date.now() - last < 30000) return; // 30s cooldown — loop guard
        sessionStorage.setItem(k, String(Date.now()));
      } catch { /* ignore */ }
      window.location.reload();
    };

    const onErr = (e: ErrorEvent) => {
      // 1) Dynamic import / module script failures (ErrorEvent with a message)
      const m = e.message || "";
      if (/Failed to fetch dynamically imported module|ChunkLoadError|loading chunk|Importing a module script failed/i.test(m)) {
        reloadWithCooldown();
        return;
      }
      // 2) Classic <script>/<link> resource load failures ("Loading failed for
      //    the <script>...") — in dev (Turbopack) stale HTML purane chunk URLs
      //    reference karta hai jo recompile ke baad missing ho jate hain. Ye
      //    error events bubble nahi karte, sirf CAPTURE phase me window tak
      //    pahuchte hain — isliye addEventListener(..., true) zaroori hai.
      //    favicon/icons ko skip (unka fail harmless hai).
      if (e.target instanceof HTMLScriptElement) {
        reloadWithCooldown();
        return;
      }
      if (e.target instanceof HTMLLinkElement) {
        const rel = e.target.rel || "";
        if (/stylesheet|modulepreload/i.test(rel)) reloadWithCooldown();
      }
    };
    window.addEventListener("error", onErr, true);
    return () => window.removeEventListener("error", onErr, true);
  }, []);

  // Client role → sirf /my-account/* access. Baaki pages par redirect.
  useEffect(() => {
    if (profile?.role === "client" && !pathname.startsWith("/my-account")) {
      router.replace("/my-account");
    }
  }, [profile?.role, pathname, router]);

  // LICENSE GATE: profile milne ke baad non-public page par license status fetch.
  // Login hamesha allowed hai — isliye har baar profile set hone par chalta hai.
  useEffect(() => {
    if (!profile) return;
    const pub = pathname === "/" ||
      ["/login", "/about", "/contact", "/job-status", "/stage-lighting", "/industrial", "/power-supply"]
        .some(p => pathname === p || pathname.startsWith(p + "/"));
    if (pub) return;
    refreshLicense();
  }, [profile, pathname, refreshLicense]);

  // ── Client portal session security ──────────────────────────────────────
  // 1) Access revoked (login_allowed=false) → auto-logoff.
  // 2) Idle timeout → kuchh der browser na chalane par auto-logoff.
  const forceClientLogout = useCallback(async (reason: "revoked" | "idle") => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    // Intentional full reload: client session state clean karna zaroori hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?reason=" + reason;
  }, []);

  const CLIENT_IDLE_MIN = 10; // minutes of inactivity → logoff
  const CLIENT_CHECK_MS = 30_000; // access re-check interval

  useEffect(() => {
    if (profile?.role !== "client") return;
    const IDLE_MS = CLIENT_IDLE_MIN * 60 * 1000;
    const bump = () => { try { sessionStorage.setItem("vtech_client_last_active", String(Date.now())); } catch { /* ignore */ } };
    bump();
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const interval = setInterval(() => {
      try {
        const last = Number(sessionStorage.getItem("vtech_client_last_active") || "0");
        if (last && Date.now() - last > IDLE_MS) forceClientLogout("idle");
      } catch { /* ignore */ }
    }, 15_000);
    return () => {
      events.forEach(e => window.removeEventListener(e, bump));
      clearInterval(interval);
    };
  }, [profile?.role, forceClientLogout]);

  useEffect(() => {
    if (profile?.role !== "client") return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/client/me", { cache: "no-store" });
        if (res.status === 401 && !cancelled) forceClientLogout("revoked");
      } catch { /* ignore */ }
    };
    check();
    const interval = setInterval(check, CLIENT_CHECK_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [profile?.role, forceClientLogout]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Theme init + persist + set body bg
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vtech_theme") as "dark" | "light" | null;
      const initial = saved || null;
      setTheme(initial);
      if (initial) {
        document.documentElement.setAttribute("data-theme", initial);
        document.body.style.backgroundColor = initial === "dark" ? "#0d1117" : "#f8f9fc";
        document.body.style.color = initial === "dark" ? "#e2e8f0" : "#0f172a";
      } else {
        document.documentElement.removeAttribute("data-theme");
        document.body.style.backgroundColor = "#0d1117";
        document.body.style.color = "#e2e8f0";
      }
    } catch {
      // ignore
    }
  }, []);

  // Public site is hardcoded dark-only. Yahan app ka saved light theme apply
  // mat karo — warna globals.css ke `html[data-theme="light"]` overrides public
  // ke dark colors par chal jate hain (text near-black on dark navy = unreadable,
  // sirf un browsers me dikhta hai jahan `vtech_theme=light` saved hai).
  useEffect(() => {
    const pub = pathname === "/" ||
      ["/login", "/setup", "/about", "/contact", "/job-status", "/stage-lighting", "/industrial", "/power-supply"]
        .some(p => pathname === p || pathname.startsWith(p + "/"));
    try {
      if (pub) {
        document.documentElement.removeAttribute("data-theme");
        document.body.style.backgroundColor = "#070714";
        document.body.style.color = "#e2e8f0";
        setTheme("dark");
      } else {
        const saved = localStorage.getItem("vtech_theme") as "dark" | "light" | null;
        if (saved) {
          document.documentElement.setAttribute("data-theme", saved);
          document.body.style.backgroundColor = saved === "dark" ? "#0d1117" : "#f8f9fc";
          document.body.style.color = saved === "dark" ? "#e2e8f0" : "#0f172a";
          setTheme(saved);
        }
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = (prev || "dark") === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("vtech_theme", next);
      } catch {
        // ignore
      }
      document.documentElement.setAttribute("data-theme", next);
      // Set body inline styles for guaranteed effect
      document.body.style.backgroundColor = next === "dark" ? "#0d1117" : "#f8f9fc";
      document.body.style.color = next === "dark" ? "#e2e8f0" : "#0f172a";
      return next;
    });
  }, []);

  // Auto-close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Public pages — no sidebar, no dashboard chrome
  const PUBLIC_PAGES = ["/login", "/setup", "/about", "/contact", "/job-status", "/stage-lighting", "/industrial", "/power-supply"];
  const isPublicPage = PUBLIC_PAGES.includes(pathname) || pathname === "/";

  // Logged-in user on a public page → dashboard (public site logged-in users ke liye nahi)
  useEffect(() => {
    if (profile && isPublicPage) router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pathname]);

  if (isPublicPage) {
    if (!profile) return <>{children}</>;
    // Logged in — redirect effect `/dashboard` par bhejega; flash avoid karo
    return <div className="min-h-screen bg-[#0d1117]" />;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/60">
              <Sparkles size={26} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117] animate-ping" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-600">V-TECH Secure Boot</p>
        </div>
      </div>
    );
  }

  const isAdmin  = profile?.role === "admin" || profile?.role === "developer";
  const isClient = profile?.role === "client";

  // ── LICENSE GATE ──
  // License invalid (trial mode / expired / disabled) → pura dashboard block,
  // full-screen gate dikhao jisme admin naya key daal sake. Login hamesha
  // allowed hai, isliye yahan kabhi deadlock nahi hota.
  if (license && !license.valid) {
    return (
      <LicenseGate
        status={license}
        isAdmin={isAdmin}
        onActivated={refreshLicense}
        onLogout={handleLogout}
      />
    );
  }

  const isAiPage    = pathname === "/ai";
  const displayName = profile?.full_name ?? "User";
  const initials    = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <PWAHead />

      {/* ══════════════════════ DESKTOP SIDEBAR ══════════════════════ */}
        {isMobile === false && !isAiPage && (
          <aside className="fixed top-0 left-0 h-full w-[260px] theme-sidebar border-r border-[#21293d] flex flex-col z-50 theme-sidebar">
            {/* Brand */}
            <div className="relative overflow-hidden px-5 py-4 border-b border-[#1a2234]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-700/15 to-transparent pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 flex-shrink-0">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-tight leading-none">
  <span className="vtech-brand">V-TECH</span>{' '}
  <span className="vtech-pro font-light">PRO</span>
</div>
                  <div className="text-[8px] text-slate-500 dark:text-slate-300 font-black uppercase tracking-widest mt-0.5">Management System</div>
                </div>
              </div>
            </div>

            <SidebarNav pathname={pathname} isAdmin={isAdmin} isClient={isClient} sellerEnabled={license?.sellerEnabled} devEnabled={license?.devEnabled} />

            <div className="px-4 py-3 border-t border-[#1a2234] flex items-center justify-between">
              <span className="text-[9px] text-slate-500 dark:text-slate-300 font-black tracking-widest uppercase">V-TECH PRO v4.2</span>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            </div>
          </aside>
        )}

        {/* ══════════════════════ MOBILE DRAWER ══════════════════════ */}
        {isMobile === true && !isAiPage && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setDrawerOpen(false)}
            />
            {/* Full sidebar drawer — same content as desktop */}
            <aside
              className={`fixed top-0 left-0 h-full w-[280px] theme-sidebar border-r border-[#21293d] flex flex-col z-50 transition-transform duration-300 ease-out ${
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              {/* Drawer header */}
              <div className="relative overflow-hidden px-4 py-4 border-b border-[#1a2234] flex items-center justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-700/15 to-transparent pointer-events-none" />
                <div className="relative flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
                    <Sparkles size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="text-base font-black tracking-tight text-white leading-none">
                      V-TECH <span className="text-blue-400 font-light">PRO</span>
                    </div>
                    <div className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-0.5">Management System</div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="relative w-8 h-8 flex items-center justify-center bg-[#1a2234] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Same full nav as desktop */}
              <SidebarNav pathname={pathname} isAdmin={isAdmin} isClient={isClient} onNavClick={() => setDrawerOpen(false)} sellerEnabled={license?.sellerEnabled} devEnabled={license?.devEnabled} />

              {/* User info at drawer bottom */}
              <div className="px-3 py-3 border-t border-[#1a2234]">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111520] rounded-xl">
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt={displayName}
                      width={32} height={32} unoptimized
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/10"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">{displayName}</p>
                    <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">{profile?.role}</p>
                  </div>
                  <button onClick={toggleTheme} className="p-1.5 text-slate-600 hover:text-amber-400 transition-colors" title="Toggle Theme">
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                  </button>
                  <button onClick={handleLogout} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Logout">
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* ══════════════════════ MAIN CONTENT ══════════════════════ */}
        <div className={`${isMobile === false && !isAiPage ? "lg:ml-[260px]" : "ml-0"} flex-1 min-h-screen flex flex-col`}>

          {/* ── TOPBAR ── */}
          {!isAiPage && (
          <header className="sticky top-0 z-40 h-14 theme-topbar backdrop-blur border-b border-[#21293d] flex items-center justify-between px-4 gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Mobile: hamburger menu */}
              {isMobile === true && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all"
                >
                  <Menu size={16} />
                </button>
              )}
              {/* Desktop: sidebar toggle */}
              {isMobile === false && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all hidden lg:flex"
                >
                  <Menu size={16} />
                </button>
              )}
              <div className={isMobile === true ? "w-full px-2" : "flex-1 min-w-0"}>
                {!isClient && <NavbarSearch />}
              </div>
            </div>

            {/* Refresh button — desktop */}
            {isMobile === false && (
              <button
                onClick={() => router.refresh()}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-emerald-500/40 rounded-xl text-slate-500 hover:text-emerald-400 transition-all"
                title="Refresh page"
              >
                <RefreshCw size={15} />
              </button>
            )}

            {/* AI Assistant - Desktop */}
            {isMobile === false && !isClient && (
              <Link
                href="/ai"
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-purple-400 hover:text-purple-300 transition-all"
                title="AI Assistant"
              >
                <Sparkles size={15} />
              </Link>
            )}

            {/* Theme toggle - desktop only */}
            {isMobile === false && (
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-500 hover:text-white transition-all"
                title={theme === "light" ? "Switch to Dark" : "Switch to Light"}
              >
                {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              </button>
            )}

            {/* User dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setDropdownOpen(p => !p)}
                className="flex items-center gap-2.5 hover:bg-white/[0.04] px-2 py-1.5 rounded-xl transition-all"
              >
                <div className="hidden sm:block text-right leading-none">
                  <p className="text-[11px] font-black uppercase text-slate-200">{displayName}</p>
                  <p className="text-[9px] font-bold text-blue-400 uppercase mt-0.5">{profile?.role}</p>
                </div>
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt={displayName}
                    width={36} height={36} unoptimized
                    className="w-9 h-9 rounded-xl object-cover shadow-md flex-shrink-0 border border-white/10"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-black shadow-md text-xs">
                    {initials}
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-[#111520] border border-[#1a2234] rounded-2xl shadow-2xl shadow-black/60 p-1.5 z-50">
                    <div className="px-3 py-2.5 border-b border-[#1a2234] mb-1">
                      <p className="text-[9px] font-black text-slate-700 uppercase tracking-wider">Logged in as</p>
                      <p className="text-xs font-bold text-slate-400 truncate mt-0.5">{userEmail}</p>
                    </div>
                    <Link href="/profile" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all">
                      <User size={13} /> My Profile
                    </Link>
                    {isAdmin && (
                      <Link href="/settings" onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all">
                        <Settings size={13} /> Settings
                      </Link>
                    )}
                    <div className="border-t border-[#1a2234] mt-1 pt-1">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                        <LogOut size={13} /> Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>
          )}

          {/* ── PAGE CONTENT ── */}
          <main className={`flex-1 ${isAiPage ? "p-0" : "p-3 sm:p-5 theme-body"}`}>
            {isClient && !pathname.startsWith("/my-account")
              ? (
                <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Loader2 size={22} className="animate-spin" />
                  <p className="text-xs font-bold uppercase tracking-widest">Redirecting...</p>
                </div>
              )
              : children}
          </main>
        </div>

        {/* ── AI ASSISTANT RIGHT DRAWER ── */}
        {!isClient && (
          <>
            {/* Floating Button Group - Bottom Right (hidden while AI window is open) */}
            {!aiDrawerOpen && !isAiPage && (
              <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-3">
                {/* AI Assistant Button - positioned above Jobs FAB */}
                <button
                  onClick={() => setAiDrawerOpen(true)}
                  className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform"
                  title="AI Assistant"
                >
                  <Sparkles size={20} />
                </button>
              </div>
            )}

            {/* Right Drawer */}
            <div className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[#0d1117] border-l border-[#21293d] z-[100] transition-transform duration-300 ease-out ${aiDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
              <div className="flex flex-col h-full">
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#21293d] bg-[#161b27]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <span className="text-sm font-bold text-white">AI Assistant</span>
                  </div>
                  <button
                    onClick={() => setAiDrawerOpen(false)}
                    className="w-8 h-8 flex items-center justify-center bg-[#111520] border border-[#21293d] rounded-lg text-slate-500 hover:text-white hover:border-red-500/40 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Iframe for AI Page */}
                <div className="flex-1">
                  <iframe
                    src="/ai"
                    className="w-full h-full border-0"
                    title="AI Assistant"
                  />
                </div>
              </div>
            </div>

            {/* Backdrop */}
            {aiDrawerOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-[90]"
                onClick={() => setAiDrawerOpen(false)}
              />
            )}
          </>
        )}
    </>
  );
}