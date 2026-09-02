"use client";
import PWAHead from "../components/PWAHead";
import LiveClock from "../components/LiveClock";
import LicenseGate from "../components/LicenseGate";
import { ImageLightbox, openImageLightbox } from "../components/ImageLightbox";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  Wrench,
  Search,
  User,
  LogOut,
  Sparkles,
  Loader2,
  ShieldCheck,
  CalendarCheck,
  HelpCircle,
  ShoppingCart,
  ClipboardList,
  PieChart,
  TrendingUp,
  DollarSign,
  Truck,
  CreditCard,
  Clock,
  Coins,
  Receipt,
  Toolbox,
  FolderOpen,
  UsersRound,
  Database,
  Settings2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  X,
  ArrowLeft,
  Menu,
  BarChart2,
  RefreshCw,
  History,
  Activity,
  BookOpen,
  CalendarClock,
  ShieldAlert,
  KeyRound,
  Code2,
  Images,
  FileText,
  Layers,
  MapPin,
  Terminal,
} from "lucide-react";
import { isModuleEnabled, isRouteDisabled } from "@/lib/modules";
import { Toaster } from "sonner";
import { logger } from "@/lib/logger";
import { useAppBoot } from "./useAppBoot";
import { hardReload } from "@/lib/hardRefresh";
import { App } from "@capacitor/app";
import PullToRefresh from "@/components/PullToRefresh";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";
import { TeamOnline } from "@/app/components/ui/TeamOnline";
import NativePrintPreview from "@/components/NativePrintPreview";
import SwipeNavigation from "@/components/SwipeNavigation";
import { fetchUnreadCount, getMyId } from "@/lib/messaging";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ctrl+K to open search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector("[data-search-input]") as HTMLInputElement;
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
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setOpen(true);
    const like = `%${q}%`;
    const num = parseInt(q);

    try {
      const [clientRes, jobRes, prodRes, mechRes, saleRes] = await Promise.all([
        // Clients — name, contact, address
        supabase
          .from("client_list")
          .select("id, firstname, middlename, lastname, contact, address")
          .eq("delete_flag", 0)
          .or(
            `firstname.ilike.${like},middlename.ilike.${like},lastname.ilike.${like},contact.ilike.${like},address.ilike.${like}`
          )
          .limit(5),

        // Jobs — item, fault, job_id, code, uniq_id
        supabase
          .from("transaction_list")
          .select("id, job_id, item, fault, status, date_created")
          .eq("del_status", 0)
          .or(
            `item.ilike.${like},fault.ilike.${like},job_id.ilike.${like},code.ilike.${like},uniq_id.ilike.${like}${!isNaN(num) ? `,job_id.eq.${q}` : ""}`
          )
          .limit(5),

        // Products
        supabase
          .from("product_list")
          .select("id, name, price")
          .eq("delete_flag", 0)
          .ilike("name", like)
          .limit(4),

        // Mechanics
        supabase
          .from("mechanic_list")
          .select("id, firstname, lastname, designation, contact")
          .eq("status", 1)
          .or(`firstname.ilike.${like},lastname.ilike.${like},contact.ilike.${like}`)
          .limit(3),

        // Direct Sales — sale_code, remarks
        supabase
          .from("direct_sales")
          .select("id, sale_code, total_amount, remarks, date_created")
          .or(`sale_code.ilike.${like},remarks.ilike.${like}`)
          .limit(3),
      ]);

      const STATUS_LABELS: Record<number, string> = {
        0: "Pending",
        1: "In Progress",
        2: "Done",
        3: "Paid",
        4: "Cancelled",
        5: "Delivered",
      };
      const STATUS_COLORS: Record<number, string> = {
        0: "bg-slate-500/20 text-slate-400",
        1: "bg-blue-500/20 text-blue-400",
        2: "bg-teal-500/20 text-teal-400",
        3: "bg-emerald-500/20 text-emerald-400",
        4: "bg-red-500/20 text-red-400",
        5: "bg-purple-500/20 text-purple-400",
      };

      const out: SearchResult[] = [];

      (clientRes.data || []).forEach((r) => {
        const name = [r.firstname, r.middlename, r.lastname].filter(Boolean).join(" ");
        out.push({
          id: r.id,
          title: name,
          subtitle: r.contact || r.address || "—",
          tag: "Client",
          tagColor: "bg-blue-500/20 text-blue-400",
          href: `/clients/${r.id}/view`,
          icon: "client",
        });
      });

      (jobRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: `Job #${r.job_id} — ${r.item}`,
          subtitle: r.fault || "—",
          tag: STATUS_LABELS[r.status] || "Job",
          tagColor: STATUS_COLORS[r.status] || "bg-slate-500/20 text-slate-400",
          href: `/jobs/${r.id}/view`,
          icon: "job",
        });
      });

      (prodRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: r.name,
          subtitle: `Rs.${r.price?.toFixed(2) || "0.00"}`,
          tag: "Product",
          tagColor: "bg-amber-500/20 text-amber-400",
          href: `/inventory`,
          icon: "product",
        });
      });

      (mechRes.data || []).forEach((r) => {
        const name = [r.firstname, r.lastname].filter(Boolean).join(" ");
        out.push({
          id: r.id,
          title: name,
          subtitle: `${r.designation || ""} ${r.contact ? "· " + r.contact : ""}`.trim(),
          tag: "Mechanic",
          tagColor: "bg-purple-500/20 text-purple-400",
          href: `/mechanics`,
          icon: "mechanic",
        });
      });

      (saleRes.data || []).forEach((r) => {
        out.push({
          id: r.id,
          title: `Sale ${r.sale_code}`,
          subtitle: r.remarks || `Rs.${r.total_amount?.toFixed(2)}`,
          tag: "Direct Sale",
          tagColor: "bg-pink-500/20 text-pink-400",
          href: `/direct-sales/${r.id}/view`,
          icon: "sale",
        });
      });

      setResults(out);
    } catch (e) {
      logger.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => runSearch(val), 300);
  };

  const handleSelect = (href: string) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(href);
  };

  const ICON_MAP = {
    client: <Users size={13} className="text-blue-400 flex-shrink-0" />,
    job: <Wrench size={13} className="text-slate-400 flex-shrink-0" />,
    product: <Package size={13} className="text-amber-400 flex-shrink-0" />,
    mechanic: <User size={13} className="text-purple-400 flex-shrink-0" />,
    sale: <ShoppingCart size={13} className="text-pink-400 flex-shrink-0" />,
  };

  return (
    <div ref={wrapRef} className="relative w-full group">
      {/* Input */}
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors pointer-events-none z-10"
      />
      {loading && (
        <Loader2
          size={13}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-blue-400 animate-spin pointer-events-none z-10"
        />
      )}
      {query && !loading && (
        <button
          onClick={() => {
            setQuery("");
            setResults([]);
            setOpen(false);
          }}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors z-10"
        >
          <X size={13} />
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
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1a2234] border border-[#21293d] text-[10px] font-medium text-slate-500">
          Ctrl
        </kbd>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#1a2234] border border-[#21293d] text-[10px] font-medium text-slate-500">
          K
        </kbd>
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
                <span className="text-[9px] text-slate-700">
                  Clients · Jobs · Products · Mechanics · Sales
                </span>
              </div>
              <ul className="max-h-[400px] overflow-y-auto divide-y divide-[#1a2234]">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r.href)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#1a2234] flex items-center justify-center flex-shrink-0">
                        {ICON_MAP[r.icon]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-200 truncate">
                            {r.title}
                          </span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${r.tagColor}`}
                          >
                            {r.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">{r.subtitle}</p>
                      </div>
                      <ChevronRight size={12} className="text-slate-700 flex-shrink-0" />
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
  title,
  icon,
  children,
  basePath,
  matchPaths,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  basePath?: string;
  matchPaths?: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (basePath && pathname.startsWith(basePath)) return true;
    return (matchPaths || []).some((p) => pathname === p || pathname.startsWith(p + "/"));
  });
  return (
    <li>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/[0.04] hover:text-slate-300 transition-all"
      >
        <div className="flex items-center gap-3">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        {open ? (
          <ChevronDown size={13} className="text-slate-600" />
        ) : (
          <ChevronRight size={13} className="text-slate-600" />
        )}
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
    active
      ? "text-blue-400 bg-blue-500/10"
      : "text-slate-600 hover:text-slate-200 hover:bg-white/[0.04]"
  }`;

// ─── Sidebar nav (shared by desktop + mobile drawer) ─────────────────────────
function SidebarNav({
  pathname,
  isAdmin,
  isClient,
  canSeeInventory,
  onNavClick,
  sellerEnabled,
  devEnabled,
  enabledModules,
  unreadCount,
}: {
  pathname: string;
  isAdmin: boolean;
  isClient?: boolean;
  canSeeInventory: boolean;
  onNavClick?: () => void;
  sellerEnabled?: boolean;
  devEnabled?: boolean;
  enabledModules?: string[] | null;
  unreadCount?: number;
}) {
  const lk = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  if (isClient) {
    return (
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/my-account"
              className={navLinkCls(lk("/my-account", true))}
              onClick={onNavClick}
            >
              <Wrench size={16} />
              <span>Meri Repairs</span>
            </Link>
          </li>
          <li>
            <Link
              href="/my-account/payments"
              className={navLinkCls(pathname === "/my-account/payments")}
              onClick={onNavClick}
            >
              <Receipt size={16} />
              <span>Meri Payments</span>
            </Link>
          </li>
          <li>
            <Link
              href="/my-account/ledger"
              className={navLinkCls(pathname === "/my-account/ledger")}
              onClick={onNavClick}
            >
              <BookOpen size={16} />
              <span>Meri Ledger</span>
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/dashboard"
            className={navLinkCls(pathname === "/dashboard")}
            onClick={onNavClick}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
        </li>
        <li>
          <Link
            href="/attendance"
            className={navLinkCls(lk("/attendance", true))}
            onClick={onNavClick}
          >
            <CalendarCheck size={16} />
            <span>Attendance</span>
          </Link>
        </li>
        <li>
          <Link href="/messages" className={navLinkCls(lk("/messages", true))} onClick={onNavClick}>
            <MessageSquare size={16} />
            <span>Messages</span>
            {!!unreadCount && (
              <span className="ml-auto flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </li>
        {isModuleEnabled(enabledModules, "jobs") && (
          <li>
            <Link href="/jobs" className={navLinkCls(lk("/jobs"))} onClick={onNavClick}>
              <ClipboardList size={16} />
              <span>Jobs</span>
            </Link>
          </li>
        )}
        {isModuleEnabled(enabledModules, "sales") && (
          <li>
            <Link
              href="/direct-sales"
              className={navLinkCls(lk("/direct-sales"))}
              onClick={onNavClick}
            >
              <ShoppingCart size={16} />
              <span>Sales</span>
            </Link>
          </li>
        )}
        {isModuleEnabled(enabledModules, "clients") && (
          <li>
            <Link href="/clients" className={navLinkCls(lk("/clients"))} onClick={onNavClick}>
              <Users size={16} />
              <span>Clients</span>
            </Link>
          </li>
        )}
        <li>
          <Link
            href="/inquiries"
            className={navLinkCls(lk("/inquiries", true))}
            onClick={onNavClick}
          >
            <HelpCircle size={16} />
            <span>Enquiries</span>
          </Link>
        </li>

        <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
          Customer
        </li>
        <SubMenu
          title="Customer Report"
          icon={<Users size={15} />}
          matchPaths={["/reports/top-customers", "/reports/delivered", "/reports/due-reminders"]}
        >
          <li>
            <Link
              href="/reports/top-customers"
              className={subLinkCls(pathname === "/reports/top-customers")}
              onClick={onNavClick}
            >
              <Users size={12} />
              Top Customers
            </Link>
          </li>
          <li>
            <Link
              href="/reports/delivered"
              className={subLinkCls(pathname === "/reports/delivered")}
              onClick={onNavClick}
            >
              <Truck size={12} />
              Delivered Report
            </Link>
          </li>
          <li>
            <Link
              href="/reports/due-reminders"
              className={subLinkCls(pathname === "/reports/due-reminders")}
              onClick={onNavClick}
            >
              <CalendarClock size={12} className="text-red-400" />
              Due Reminders
            </Link>
          </li>
        </SubMenu>
        <SubMenu
          title="Jobs in Shop"
          icon={<Wrench size={15} />}
          matchPaths={["/reports/pending-jobs", "/reports/daily-done"]}
        >
          <li>
            <Link
              href="/reports/pending-jobs"
              className={subLinkCls(pathname === "/reports/pending-jobs")}
              onClick={onNavClick}
            >
              <Clock size={12} className="text-amber-400" />
              Jobs in Shop
            </Link>
          </li>
          <li>
            <Link
              href="/reports/daily-done"
              className={subLinkCls(pathname === "/reports/daily-done")}
              onClick={onNavClick}
            >
              <ClipboardList size={12} />
              Daily Done Report
            </Link>
          </li>
        </SubMenu>

        {canSeeInventory &&
          isModuleEnabled(enabledModules, "inventory") && (
            <>
              <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
                Inventory
              </li>
              <SubMenu
                title="Inventory"
                icon={<Package size={15} />}
                basePath="/inventory"
                matchPaths={["/products", "/suppliers"]}
              >
                {isAdmin && (
                  <li>
                    <Link
                      href="/inventory"
                      className={subLinkCls(
                        pathname === "/inventory" ||
                          (pathname.startsWith("/inventory/") &&
                            !pathname.startsWith("/inventory/purchase-orders") &&
                            !pathname.startsWith("/inventory/locate"))
                      )}
                      onClick={onNavClick}
                    >
                      <Package size={12} className="text-emerald-400" />
                      Stock Overview
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href="/products"
                    className={subLinkCls(pathname === "/products")}
                    onClick={onNavClick}
                  >
                    <Layers size={12} className="text-orange-400" />
                    Products
                  </Link>
                </li>
                {isAdmin && (
                  <li>
                    <Link
                      href="/suppliers"
                      className={subLinkCls(pathname === "/suppliers")}
                      onClick={onNavClick}
                    >
                      <Truck size={12} className="text-sky-400" />
                      Suppliers
                    </Link>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <Link
                      href="/inventory/purchase-orders"
                      className={subLinkCls(pathname === "/inventory/purchase-orders")}
                      onClick={onNavClick}
                    >
                      <FileText size={12} className="text-teal-400" />
                      Purchase Orders
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href="/inventory/locations"
                    className={subLinkCls(pathname === "/inventory/locations")}
                    onClick={onNavClick}
                  >
                    <MapPin size={12} className="text-rose-400" />
                    Locations
                  </Link>
                </li>
                {isAdmin && (
                  <li>
                    <Link
                      href="/inventory/locations/manage"
                      className={subLinkCls(pathname === "/inventory/locations/manage")}
                      onClick={onNavClick}
                    >
                      <Settings2 size={12} className="text-slate-400" />
                      Location Hierarchy
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href="/inventory/locate"
                    className={subLinkCls(pathname === "/inventory/locate")}
                    onClick={onNavClick}
                  >
                    <MapPin size={12} className="text-amber-400" />
                    Spare Finder
                  </Link>
                </li>
              </SubMenu>
            </>
          )}

        {isAdmin && (
          <>
            {/* ══ FINANCE ══════════════════════════════════════════════════ */}
            {isModuleEnabled(enabledModules, "finance") && (
              <>
                <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
                  Finance
                </li>
                <SubMenu
                  title="Finance"
                  icon={<DollarSign size={15} />}
                  matchPaths={[
                    "/back-office",
                    "/payments",
                    "/expenses",
                    "/advance",
                    "/clients-admin",
                    "/client-loans",
                    "/lenders",
                    "/mechanics/salary",
                  ]}
                >
                  <li>
                    <Link
                      href="/back-office"
                      className={subLinkCls(pathname === "/back-office")}
                      onClick={onNavClick}
                    >
                      <Sparkles size={12} className="text-purple-400" />
                      Overview
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/payments"
                      className={subLinkCls(pathname === "/payments")}
                      onClick={onNavClick}
                    >
                      <Receipt size={12} />
                      Payments
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/expenses"
                      className={subLinkCls(pathname === "/expenses")}
                      onClick={onNavClick}
                    >
                      <DollarSign size={12} />
                      Expenses
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/mechanics/salary"
                      className={subLinkCls(pathname === "/mechanics/salary")}
                      onClick={onNavClick}
                    >
                      <Coins size={12} />
                      Salary
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/advance"
                      className={subLinkCls(pathname === "/advance")}
                      onClick={onNavClick}
                    >
                      <DollarSign size={12} />
                      Advance
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/clients-admin"
                      className={subLinkCls(pathname === "/clients-admin")}
                      onClick={onNavClick}
                    >
                      <FolderOpen size={12} />
                      Client Ledger
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/client-loans"
                      className={subLinkCls(pathname === "/client-loans")}
                      onClick={onNavClick}
                    >
                      <CreditCard size={12} />
                      Client Loans
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/lenders"
                      className={subLinkCls(pathname === "/lenders")}
                      onClick={onNavClick}
                    >
                      <History size={12} />
                      Lenders
                    </Link>
                  </li>
                </SubMenu>
              </>
            )}

            {/* ══ PEOPLE ═══════════════════════════════════════════════════ */}
            {isModuleEnabled(enabledModules, "people") && (
              <>
                <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
                  People
                </li>
                <SubMenu title="People" icon={<UsersRound size={15} />} matchPaths={["/services"]}>
                  <li>
                    <Link
                      href="/mechanics"
                      className={subLinkCls(
                        pathname.startsWith("/mechanics") &&
                          pathname !== "/mechanics/salary" &&
                          pathname !== "/mechanics/commission"
                      )}
                      onClick={onNavClick}
                    >
                      <UsersRound size={12} />
                      Staff
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/mechanics/commission"
                      className={subLinkCls(pathname === "/mechanics/commission")}
                      onClick={onNavClick}
                    >
                      <BarChart2 size={12} />
                      Commission
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/services"
                      className={subLinkCls(pathname === "/services")}
                      onClick={onNavClick}
                    >
                      <Toolbox size={12} />
                      Service Catalog
                    </Link>
                  </li>
                </SubMenu>
              </>
            )}

            {/* ══ REPORTS ══════════════════════════════════════════════════ */}
            {isModuleEnabled(enabledModules, "reports") && (
              <>
                <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
                  Reports
                </li>
                <SubMenu
                  title="Reports"
                  icon={<PieChart size={15} />}
                  basePath="/reports"
                  matchPaths={["/activity-logs"]}
                >
                  <li className="text-[8px] font-black uppercase text-slate-600 tracking-widest px-3 pt-2 pb-0.5 select-none">
                    Overview
                  </li>
                  <li>
                    <Link
                      href="/reports"
                      className={subLinkCls(pathname === "/reports")}
                      onClick={onNavClick}
                    >
                      <Sparkles size={12} className="text-blue-400" />
                      All Reports
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/vyapar-darpan"
                      className={subLinkCls(pathname === "/reports/vyapar-darpan")}
                      onClick={onNavClick}
                    >
                      <PieChart size={12} className="text-amber-400" />
                      Vyapar Darpan
                    </Link>
                  </li>

                  <li className="text-[8px] font-black uppercase text-slate-600 tracking-widest px-3 pt-3 pb-0.5 select-none">
                    Financial
                  </li>
                  <li>
                    <Link
                      href="/reports/balancesheet"
                      className={subLinkCls(pathname === "/reports/balancesheet")}
                      onClick={onNavClick}
                    >
                      <BarChart2 size={12} />
                      Balance Sheet
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/cash-flow"
                      className={subLinkCls(pathname === "/reports/cash-flow")}
                      onClick={onNavClick}
                    >
                      <TrendingUp size={12} />
                      Cash Flow
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/ledger"
                      className={subLinkCls(pathname === "/reports/ledger")}
                      onClick={onNavClick}
                    >
                      <DollarSign size={12} />
                      Business Ledger
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/monthly-profit"
                      className={subLinkCls(pathname === "/reports/monthly-profit")}
                      onClick={onNavClick}
                    >
                      <BarChart2 size={12} className="text-emerald-400" />
                      Monthly Profit
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/yearly"
                      className={subLinkCls(pathname === "/reports/yearly")}
                      onClick={onNavClick}
                    >
                      <Clock size={12} />
                      Yearly Report
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/loan"
                      className={subLinkCls(pathname === "/reports/loan")}
                      onClick={onNavClick}
                    >
                      <CreditCard size={12} />
                      Loan Report
                    </Link>
                  </li>

                  <li className="text-[8px] font-black uppercase text-slate-600 tracking-widest px-3 pt-3 pb-0.5 select-none">
                    Sales &amp; Service
                  </li>
                  <li>
                    <Link
                      href="/reports/daily-sales"
                      className={subLinkCls(pathname === "/reports/daily-sales")}
                      onClick={onNavClick}
                    >
                      <ShoppingCart size={12} />
                      Daily Sales
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/daily-service"
                      className={subLinkCls(pathname === "/reports/daily-service")}
                      onClick={onNavClick}
                    >
                      <Wrench size={12} />
                      Daily Service
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/monthly-sales"
                      className={subLinkCls(pathname === "/reports/monthly-sales")}
                      onClick={onNavClick}
                    >
                      <ShoppingCart size={12} />
                      Monthly Sales
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/custom-sales"
                      className={subLinkCls(pathname === "/reports/custom-sales")}
                      onClick={onNavClick}
                    >
                      <ShoppingCart size={12} />
                      Custom Sales
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/custom-service"
                      className={subLinkCls(pathname === "/reports/custom-service")}
                      onClick={onNavClick}
                    >
                      <Wrench size={12} />
                      Custom Service
                    </Link>
                  </li>

                  <li className="text-[8px] font-black uppercase text-slate-600 tracking-widest px-3 pt-3 pb-0.5 select-none">
                    Audit
                  </li>
                  <li>
                    <Link
                      href="/activity-logs"
                      className={subLinkCls(pathname === "/activity-logs")}
                      onClick={onNavClick}
                    >
                      <Activity size={12} />
                      Activity Log
                    </Link>
                  </li>
                </SubMenu>
              </>
            )}

            {/* ══ SYSTEM ═══════════════════════════════════════════════════ */}
            <li className="text-[9px] font-black uppercase text-slate-700 tracking-widest px-3 pt-5 pb-1.5 select-none">
              System
            </li>
            <SubMenu
              title="System"
              icon={<Settings2 size={15} />}
              matchPaths={["/users", "/settings", "/backup", "/back-office/db-tools"]}
            >
              <li>
                <Link
                  href="/users"
                  className={subLinkCls(pathname === "/users")}
                  onClick={onNavClick}
                >
                  <ShieldCheck size={12} />
                  Users
                </Link>
              </li>
              <li>
                <Link
                  href="/settings"
                  className={subLinkCls(pathname === "/settings")}
                  onClick={onNavClick}
                >
                  <Settings2 size={12} />
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/throttle"
                  className={subLinkCls(pathname === "/settings/throttle")}
                  onClick={onNavClick}
                >
                  <ShieldAlert size={12} className="text-red-400" />
                  Login Throttle
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/whatsapp-templates"
                  className={subLinkCls(pathname === "/settings/whatsapp-templates")}
                  onClick={onNavClick}
                >
                  <MessageSquare size={12} className="text-green-400" />
                  WA Templates
                </Link>
              </li>
              <li>
                <Link
                  href="/backup"
                  className={subLinkCls(pathname === "/backup")}
                  onClick={onNavClick}
                >
                  <Database size={12} />
                  Backup
                </Link>
              </li>
            </SubMenu>

            {/* ══ DEVELOPER ════════════════════════════════════════════════ */}
            {(sellerEnabled || devEnabled) && (
              <SubMenu
                title="Developer"
                icon={<Code2 size={15} />}
                matchPaths={["/developer", "/sync", "/images", "/seller", "/back-office/db-tools"]}
              >
                {sellerEnabled && (
                  <li>
                    <Link
                      href="/seller"
                      className={subLinkCls(pathname === "/seller")}
                      onClick={onNavClick}
                    >
                      <KeyRound size={12} className="text-amber-400" />
                      Seller Portal
                    </Link>
                  </li>
                )}
                {devEnabled && (
                  <>
                    <li>
                      <Link
                        href="/developer"
                        className={subLinkCls(pathname === "/developer")}
                        onClick={onNavClick}
                      >
                        <Code2 size={12} className="text-indigo-400" />
                        Developer
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/sync"
                        className={subLinkCls(pathname === "/sync")}
                        onClick={onNavClick}
                      >
                        <RefreshCw size={12} className="text-emerald-400" />
                        MariaDB Sync
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/images"
                        className={subLinkCls(pathname === "/images")}
                        onClick={onNavClick}
                      >
                        <Images size={12} className="text-amber-400" />
                        Images
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/back-office/db-tools"
                        className={subLinkCls(pathname === "/back-office/db-tools")}
                        onClick={onNavClick}
                      >
                        <Terminal size={12} className="text-orange-400" />
                        DB Tools
                      </Link>
                    </li>
                  </>
                )}
              </SubMenu>
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
  const router = useRouter();

  // G1 gate-split: saara auth/boot state + effects ab useAppBoot() hook me hai.
  // Ye component sirf shell render karta hai — behavior bilkul unchanged.
  const {
    isMobile,
    loading,
    profile,
    userEmail,
    dropdownOpen,
    setDropdownOpen,
    drawerOpen,
    setDrawerOpen,
    aiDrawerOpen,
    setAiDrawerOpen,
    theme,
    themePref,
    setThemePref,
    license,
    brandLogo,
    showIdleWarning,
    setShowIdleWarning,
    lastActiveRef,
    showIdleWarningRef,
    refreshLicense,
    handleLogout,
  } = useAppBoot();

  // ── Unread messages badge (sidebar Messages icon) ─────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let sub: ReturnType<typeof supabase.channel> | null = null;
    let me: string | null = null;

    const refresh = () => {
      fetchUnreadCount(me).then((n) => {
        if (!cancelled) setUnreadCount(n);
      });
    };

    // /messages par jaate hi read ho jaata hai — wapas aane par dobara count.
    // NOTE: unread count hamesha current user (me) ke recipient_id se filter hota
    // hai — isliye pehla refresh bhi me set hone ke BAAD hi hota hai (wana global
    // count dikh jaata tha: doosre users ke unread bhi badge me aa jaate the).

    // Chat me message padhne par (markRead ke baad) dispatch hota hai —
    // realtime UPDATE delivery flaky hone par bhi badge turant clear ho jaye.
    const onMessagesRead = () => {
      if (me) refresh();
    };
    window.addEventListener("vtech:messages-read", onMessagesRead as EventListener);

    (async () => {
      me = await getMyId();
      if (cancelled) return;
      // /messages par jaate hi read ho jaata hai — wapas aane par dobara count.
      if (!pathname.startsWith("/messages")) refresh();
      if (!me) return;
      sub = supabase
        .channel("vtech-unread-badge")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` },
          refresh
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` },
          refresh
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter: `recipient_id=eq.${me}` },
          refresh
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("vtech:messages-read", onMessagesRead as EventListener);
      sub?.unsubscribe();
    };
  }, [pathname, profile]);

  // Public pages — no sidebar, no dashboard chrome.
  const PUBLIC_PAGES = [
    "/login",
    "/setup",
    "/about",
    "/contact",
    "/job-status",
    "/stage-lighting",
    "/industrial",
    "/power-supply",
  ];
  const isPublicPage = PUBLIC_PAGES.includes(pathname) || pathname === "/";

  // Logged-in user /login aur /setup par nahi reh sakta (already authenticated).
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  useEffect(() => {
    if (profile && isAuthPage) router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pathname]);

  // In-app back: track visited paths so the mobile back button stays inside
  // the app instead of falling back to browser history (which can exit the site).
  const appHistoryRef = useRef<string[]>([]);
  useEffect(() => {
    const h = appHistoryRef.current;
    if (h[h.length - 1] !== pathname) {
      h.push(pathname);
      if (h.length > 20) h.shift();
    }
  }, [pathname]);

  const goInAppBack = useCallback(() => {
    const h = appHistoryRef.current;
    h.pop(); // drop current page, land on the previous distinct one
    const prev = h[h.length - 1];
    if (prev && prev !== pathname) {
      router.push(prev);
    } else {
      router.push("/dashboard");
    }
  }, [pathname, router]);

  // ── Android hardware back-button override ────────────────────────────────
  // Default me Capacitor WebView me phone ki back button app se bahar nikal
  // deti (ya ek khali black screen chhod deti) — jab app login/loader par hang
  // hua ho to user ke paas bahar jaane ke alawa koi rasta nahi hota. Isse
  // intercept karte hain:
  //   • Login / public pages par → login par hi rehkar hard refresh (agla load
  //     fresh mile). Back se app EXIT nahi hoti.
  //   • Baaki pages par → in-app back history (web UI ke back button jaisa).
  //   • History khatam → `/dashboard` par, app exit nahi.
  // NOTE: @capacitor/app ka `App.addListener("backButton")` register karne se
  // native side par `hasListeners` true ho jata hai, jisse default app-exit
  // (goBack/exit) USE nahi hota — event humare JS handler ko milta hai.
  useEffect(() => {
    const isPublicPath =
      pathname === "/login" ||
      pathname === "/setup" ||
      pathname === "/" ||
      ["/about", "/contact", "/job-status", "/stage-lighting", "/industrial", "/power-supply"].some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );

    let handler: { remove: () => void } | null = null;
    try {
      const unsub = App.addListener("backButton", () => {
        if (isPublicPath) {
          // Login/hang state → cache-clear hard refresh (app exit nahi).
          hardReload();
        } else {
          goInAppBack();
        }
      });
      unsub.then((h) => {
        handler = h;
      });
    } catch {
      /* plugin unavailable (web) → ignore */
    }
    return () => {
      try {
        handler?.remove();
      } catch {
        /* ignore */
      }
    };
  }, [pathname, goInAppBack]);

  if (isPublicPage) {
    // Auth pages par logged-in user ko flash na dikhe — blank while redirect.
    if (profile && isAuthPage) return <div className="min-h-screen bg-[#0d1117]" />;
    return <>{children}</>;
  }

  if (loading) {
    return (
      <PullToRefresh className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/60">
              <Sparkles size={26} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117] animate-ping" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-600">
            V-TECH Secure Boot
          </p>
        </div>
      </PullToRefresh>
    );
  }

  const isAdmin = profile?.role === "admin" || profile?.role === "developer";
  const isClient = profile?.role === "client";
  const isStaff = profile?.role === "staff";
  const canSeeInventory = isAdmin || isStaff;

  // ── LICENSE GATE ──
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

  // ── MODULE ROUTE GUARD ──
  if (isAdmin && license?.enabledModules && isRouteDisabled(pathname, license.enabledModules)) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 mx-auto bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center mb-5">
            <Package size={28} />
          </div>
          <h1 className="text-lg font-black text-white mb-2">Module Not Available</h1>
          <p className="text-sm text-slate-400 mb-6">
            Ye module aapke plan mein included nahi hai. Seller se contact karein ya{" "}
            <span className="font-bold text-slate-300">Settings &rarr; License</span> mein plan
            upgrade karein.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all"
          >
            Dashboard par jao
          </button>
        </div>
      </div>
    );
  }

  const isAiPage = pathname === "/ai";
  const displayName = profile?.full_name ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <PWAHead />
      <ImageLightbox />
      <Toaster theme="dark" position="top-right" richColors closeButton />
      <NativePrintPreview />
      <SwipeNavigation
        onBack={goInAppBack}
        onForward={() => {
          router.forward();
        }}
      />

      {/* ══════════════════════ DESKTOP SIDEBAR ══════════════════════ */}
      {isMobile === false && !isAiPage && (
        <aside className="fixed top-0 left-0 h-full w-[260px] glass border-r flex flex-col z-50">
          {/* Brand — click karo → public website (logged-in user bhi) */}
          <div className="relative overflow-hidden px-5 py-4 border-b border-[#1a2234]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700/15 to-transparent pointer-events-none" />
            <Link
              href="/"
              title="Public Website"
              className="relative flex items-center gap-3 group"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/50 transition-all group-hover:scale-105 ${brandLogo ? "bg-white" : "bg-gradient-to-br from-blue-500 to-blue-700 group-hover:from-blue-500 group-hover:to-cyan-600"}`}
              >
                {brandLogo ? (
                  <Image
                    src={brandLogo}
                    alt="Logo"
                    width={40}
                    height={40}
                    className="w-full h-full object-contain rounded-xl"
                  />
                ) : (
                  <Sparkles size={20} className="text-white" />
                )}
              </div>
              <div>
                <div className="text-lg font-black tracking-tight leading-none">
                  <span className="vtech-brand">V-TECH</span>{" "}
                  <span className="vtech-pro font-light">PRO</span>
                </div>
                <div className="text-[8px] text-slate-500 dark:text-slate-300 font-black uppercase tracking-widest mt-0.5">
                  Management System · Click → Website
                </div>
              </div>
            </Link>
          </div>

          <SidebarNav
            pathname={pathname}
            isAdmin={isAdmin}
            isClient={isClient}
            canSeeInventory={canSeeInventory}
            sellerEnabled={license?.sellerEnabled}
            devEnabled={license?.devEnabled}
            enabledModules={license?.enabledModules}
            unreadCount={unreadCount}
          />

          <div className="px-4 py-3 border-t border-[#1a2234] flex items-center justify-between">
            <span className="text-[9px] text-slate-500 dark:text-slate-300 font-black tracking-widest uppercase">
              V-TECH PRO v4.2
            </span>
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
            className={`fixed top-0 left-0 h-full w-[280px] glass border-r flex flex-col z-50 transition-transform duration-300 ease-out ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Drawer header — brand click → public website */}
            <div className="relative overflow-hidden px-4 py-4 border-b border-[#1a2234] flex items-center justify-between">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-700/15 to-transparent pointer-events-none" />
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                className="relative flex items-center gap-3 group"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 transition-all group-hover:scale-105 ${brandLogo ? "bg-white" : "bg-gradient-to-br from-blue-500 to-blue-700 group-hover:from-blue-500 group-hover:to-cyan-600"}`}
                >
                  {brandLogo ? (
                    <Image
                      src={brandLogo}
                      alt="Logo"
                      width={36}
                      height={36}
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <Sparkles size={18} className="text-white" />
                  )}
                </div>
                <div>
                  <div className="text-base font-black tracking-tight text-white leading-none">
                    V-TECH <span className="text-blue-400 font-light">PRO</span>
                  </div>
                  <div className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-0.5">
                    Management System · Website
                  </div>
                </div>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="relative w-8 h-8 flex items-center justify-center glass border rounded-lg text-slate-500 hover:text-white transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Same full nav as desktop */}
            <SidebarNav
              pathname={pathname}
              isAdmin={isAdmin}
              isClient={isClient}
              canSeeInventory={canSeeInventory}
              onNavClick={() => setDrawerOpen(false)}
              sellerEnabled={license?.sellerEnabled}
              devEnabled={license?.devEnabled}
              enabledModules={license?.enabledModules}
              unreadCount={unreadCount}
            />

            {!isClient && <TeamOnline />}

            {/* User info at drawer bottom */}
            <div className="px-3 py-3 border-t border-[#1a2234]">
              <div className="flex items-center gap-3 px-3 py-2.5 glass rounded-xl">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/10 cursor-zoom-in"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openImageLightbox(profile.avatar_url, displayName);
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white truncate">{displayName}</p>
                  <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">
                    {profile?.role}
                  </p>
                </div>
                {/* Theme selector — System / Dark / Light (screen-aware dropdown) */}
                <ThemeToggle themePref={themePref} theme={theme} onSelect={setThemePref} />
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ══════════════════════ MAIN CONTENT ══════════════════════ */}
      <div
        className={`${isMobile === false && !isAiPage ? "lg:ml-[260px]" : "ml-0"} flex-1 min-h-screen flex flex-col`}
      >
        {/* ── TOPBAR ── */}
        {!isAiPage && (
          <header className="sticky top-0 z-40 h-14 glass border-b flex items-center justify-between px-4 gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Mobile: hamburger menu */}
              {isMobile === true && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all"
                >
                  <Menu size={16} />
                </button>
              )}
              {/* Desktop: sidebar toggle */}
              {isMobile === false && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-slate-400 hover:text-white transition-all hidden lg:flex"
                >
                  <Menu size={16} />
                </button>
              )}
              <div className={isMobile === true ? "w-full px-2" : "flex-1 min-w-0"}>
                {!isClient && <NavbarSearch />}
              </div>
            </div>

            {/* Live IST clock — desktop/tablet (mobile shows it in a strip below) */}
            <LiveClock className="hidden md:flex" />

            {/* Refresh button — desktop */}
            {isMobile === false && (
              <button
                onClick={() => router.refresh()}
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-emerald-500/40 rounded-xl text-slate-500 hover:text-emerald-400 transition-all"
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

            {/* Theme - desktop topbar (screen-aware dropdown) */}
            {isMobile === false && (
              <ThemeToggle
                themePref={themePref}
                theme={theme}
                onSelect={setThemePref}
                size={16}
                buttonClassName="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-slate-500 hover:text-white transition-all"
              />
            )}

            {/* User dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-2.5 hover:bg-white/[0.04] px-2 py-1.5 rounded-xl transition-all"
              >
                <div className="hidden sm:block text-right leading-none">
                  <p className="text-[11px] font-black uppercase text-slate-200">{displayName}</p>
                  <p className="text-[9px] font-bold text-blue-400 uppercase mt-0.5">
                    {profile?.role}
                  </p>
                </div>
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-xl object-cover shadow-md flex-shrink-0 border border-white/10 cursor-zoom-in"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openImageLightbox(profile.avatar_url, displayName);
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-black shadow-md text-xs">
                    {initials}
                  </div>
                )}
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 glass border rounded-2xl shadow-2xl shadow-black/60 p-1.5 z-50">
                    <div className="px-3 py-2.5 border-b border-[#1a2234] mb-1">
                      <p className="text-[9px] font-black text-slate-700 uppercase tracking-wider">
                        Logged in as
                      </p>
                      <p className="text-xs font-bold text-slate-400 truncate mt-0.5">
                        {userEmail}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all"
                    >
                      <User size={13} /> My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all"
                      >
                        <Settings size={13} /> Settings
                      </Link>
                    )}
                    <div className="border-t border-[#1a2234] mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <LogOut size={13} /> Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>
        )}

        {/* ── Live IST clock — floating pill (mobile only, fixed top-right) ── */}
        {!isAiPage && (
          <div className="fixed top-16 right-3 z-30 md:hidden">
            <div className="shadow-lg shadow-black/40">
              <LiveClock />
            </div>
          </div>
        )}

        {/* ── PAGE CONTENT ── */}
        <main className={`flex-1 ${isAiPage ? "p-0" : "p-3 sm:p-5 theme-body"}`}>
          <PullToRefresh>
            {isClient && !pathname.startsWith("/my-account") ? (
              <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-600">
                <Loader2 size={22} className="animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Redirecting...</p>
              </div>
            ) : (
              children
            )}
          </PullToRefresh>
        </main>
      </div>

      {/* ── Floating in-app back button (mobile) ── */}
      {/* /messages par nahi — messenger input ke paperclip se overlap hota tha;
          chat pane me apna header back-button already hai. */}
      {!isClient && !isAiPage && !pathname.startsWith("/messages") && (
        <button
          onClick={goInAppBack}
          className="fixed bottom-5 left-4 z-40 md:hidden w-11 h-11 glass border rounded-full flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all shadow-lg"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
      )}

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
          <div
            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] glass border-l z-[100] transition-transform duration-300 ease-out ${aiDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b glass">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">AI Assistant</span>
                </div>
                <button
                  onClick={() => setAiDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center glass border rounded-lg text-slate-500 hover:text-white hover:border-red-500/40 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Iframe for AI Page */}
              <div className="flex-1">
                <iframe src="/ai" className="w-full h-full border-0" title="AI Assistant" />
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

      {/* ── Idle timeout warning (staff/admin/developer) ─────────────── */}
      {showIdleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-lg border rounded-2xl p-6 max-w-sm mx-4 shadow-2xl text-center">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-amber-400" />
            </div>
            <h3 className="text-white font-bold text-base mb-2">Session expiring soon</h3>
            <p className="text-slate-400 text-sm mb-1">Aap 30 minute se kuch nahi kar rahe.</p>
            <p className="text-slate-500 text-xs mb-5">
              Agar 2 minute mein kuch nahi kiya to aap automatically logout ho jayenge.
            </p>
            <button
              onClick={() => {
                lastActiveRef.current = Date.now();
                showIdleWarningRef.current = false;
                setShowIdleWarning(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-900/30"
            >
              Main hoon — Continue karo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
