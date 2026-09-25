"use client";
import PWAHead from "../components/PWAHead";
import LiveClock from "../components/LiveClock";
import LicenseGate from "../components/LicenseGate";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { APP_VERSION_LABEL, APP_COMMIT } from "@/lib/app-version";
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  Wrench,
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
  ListChecks,
  PackageX,
  Boxes,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { isModuleEnabled, isRouteDisabled } from "@/lib/modules";
import { LITE_MODE, LITE_MODULES, isLiteRouteAllowed } from "@/lib/lite";
import { Toaster } from "sonner";
import { useAppBoot } from "./useAppBoot";
import { hardReload } from "@/lib/hardRefresh";
import { App } from "@capacitor/app";
import PullToRefresh from "@/components/PullToRefresh";
import { ThemeToggle } from "@/app/components/ui/ThemeToggle";
import { DensityToggle } from "@/app/components/ui/DensityToggle";
import { useDensity } from "@/hooks/useDensity";
import { TeamOnline } from "@/app/components/ui/TeamOnline";
import dynamic from "next/dynamic";

// NativePrintPreview sirf native print preview routes par dikhta hai (opens
// null). Dynamic chunk: capgo printer + nativePrint bridge shell ke critical
// JS me nahi khinchte — first paint + parse kam hota hai.
const NativePrintPreview = dynamic(
  () => import("@/components/NativePrintPreview"),
  { ssr: false }
);
import SwipeNavigation from "@/components/SwipeNavigation";
import { ShortcutHelpOverlay } from "@/app/components/ui/ShortcutHelpOverlay";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
// Sprint 4 #16: shortcut routes central nav.config se
import { SHORTCUT_ROUTES } from "@/config/nav.config";
import { fetchUnreadCount, getMyId } from "@/lib/messaging";
import { MobileBottomTab } from "@/components/ui/MobileBottomTab";

// (Universal search — components/NavbarSearch + hooks/useNavbarSearch me.
// Sprint 4 #16 split.)
import { NavbarSearch } from "@/components/NavbarSearch";

// (NavbarSearch body components/NavbarSearch.tsx me — Sprint 4 #16.)

// ─── Accordion sub-menu ───────────────────────────────────────────────────────
function SubMenu({
  title,
  icon,
  children,
  basePath,
  matchPaths,
  collapsed,
  onExpand,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  basePath?: string;
  matchPaths?: string[];
  collapsed?: boolean;
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() => {
    if (basePath && pathname.startsWith(basePath)) return true;
    return (matchPaths || []).some((p) => pathname === p || pathname.startsWith(p + "/"));
  });
  return (
    <li>
      <button
        onClick={() => {
          // Collapsed (icons-only) me click karne par sidebar expand karo —
          // pillay sub-items nahi dikhte, expand karna zyada natural UX hai.
          if (collapsed && onExpand) {
            onExpand();
            return;
          }
          setOpen((p) => !p);
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold text-muted hover:bg-white/[0.04] hover:text-app-2 transition-all"
      >
        <div className="flex items-center gap-3">
          <span>{icon}</span>
          {/* Title span hamesha render hota hai; collapsed mode me CSS
              (`> div > span:last-child`) ise hide karta hai taaki icon span
              pehla child rahe aur visible rahe. */}
          <span>{title}</span>
        </div>
        {!collapsed &&
          (open ? (
            <ChevronDown size={13} className="text-muted-2" />
          ) : (
            <ChevronRight size={13} className="text-muted-2" />
          ))}
      </button>
      {open && !collapsed && <ul className="pl-3 mt-0.5 space-y-0.5">{children}</ul>}
    </li>
  );
}

// ─── Shared link style builders ───────────────────────────────────────────────
const navLinkCls = (active: boolean) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 ${
    active
      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
      : "text-muted hover:bg-white/[0.04] hover:text-app-2"
  }`;

const subLinkCls = (active: boolean) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-150 ${
    active
      ? "text-blue-400 bg-blue-500/10"
      : "text-muted-2 hover:text-app-2 hover:bg-white/[0.04]"
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
  collapsed,
  onExpand,
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
  collapsed?: boolean;
  onExpand?: () => void;
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
        {!LITE_MODE && (
          <li>
            <Link
              href="/messages"
              className={navLinkCls(lk("/messages", true))}
              onClick={onNavClick}
            >
              <MessageSquare size={16} />
              <span>Messages</span>
              {!!unreadCount && (
                <span className="ml-auto flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </li>
        )}
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

        <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
          Customer
        </li>
        <SubMenu
          collapsed={collapsed}
          onExpand={onExpand}
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
          collapsed={collapsed}
          onExpand={onExpand}
          title="Jobs in Shop"
          icon={<Wrench size={15} />}
          matchPaths={[
            "/reports/pending-jobs",
            "/reports/daily-done",
            "/reports/parts-pending",
            "/reports/supplier-dues",
          ]}
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
              href="/reports/parts-pending"
              className={subLinkCls(pathname === "/reports/parts-pending")}
              onClick={onNavClick}
            >
              <Boxes size={12} className="text-amber-400" />
              Waiting for Parts
            </Link>
          </li>
          <li>
            <Link
              href="/reports/supplier-dues"
              className={subLinkCls(pathname === "/reports/supplier-dues")}
              onClick={onNavClick}
            >
              <Landmark size={12} className="text-emerald-400" />
              Supplier Dues
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

        {canSeeInventory && isModuleEnabled(enabledModules, "inventory") && (
          <>
            <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
              Inventory
            </li>
            <SubMenu
              collapsed={collapsed}
              onExpand={onExpand}
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
                          !pathname.startsWith("/inventory/locate") &&
                          !pathname.startsWith("/inventory/stocktake") &&
                          !pathname.startsWith("/inventory/bom-check"))
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
              {isAdmin && (
                <li>
                  <Link
                    href="/inventory/stocktake"
                    className={subLinkCls(pathname === "/inventory/stocktake")}
                    onClick={onNavClick}
                  >
                    <ClipboardList size={12} className="text-cyan-400" />
                    Stocktake
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/inventory/bom-check"
                  className={subLinkCls(pathname === "/inventory/bom-check")}
                  onClick={onNavClick}
                >
                  <ListChecks size={12} className="text-violet-400" />
                  BOM Check
                </Link>
              </li>
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
                    <Settings2 size={12} className="text-muted" />
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
              {isAdmin && (
                <li>
                  <Link
                    href="/reports/requirement-list"
                    className={subLinkCls(pathname === "/reports/requirement-list")}
                    onClick={onNavClick}
                  >
                    <PackageX size={12} className="text-amber-400" />
                    Requirement List
                  </Link>
                </li>
              )}
            </SubMenu>
          </>
        )}

        {isAdmin && (
          <>
            {/* ══ FINANCE ══════════════════════════════════════════════════ */}
            {isModuleEnabled(enabledModules, "finance") && (
              <>
                <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
                  Finance
                </li>
                <SubMenu
                  collapsed={collapsed}
                  onExpand={onExpand}
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
                <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
                  People
                </li>
                <SubMenu title="People" icon={<UsersRound size={15} />} matchPaths={["/services"]} collapsed={collapsed} onExpand={onExpand}>
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
                <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
                  Reports
                </li>
                <SubMenu
                  collapsed={collapsed}
                  onExpand={onExpand}
                  title="Reports"
                  icon={<PieChart size={15} />}
                  basePath="/reports"
                  matchPaths={["/activity-logs"]}
                >
                  <li className="text-[8px] font-black uppercase text-muted-2 tracking-widest px-3 pt-2 pb-0.5 select-none">
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

                  <li className="text-[8px] font-black uppercase text-muted-2 tracking-widest px-3 pt-3 pb-0.5 select-none">
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

                  <li className="text-[8px] font-black uppercase text-muted-2 tracking-widest px-3 pt-3 pb-0.5 select-none">
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
                  <li>
                    <Link
                      href="/reports/parts-pending"
                      className={subLinkCls(pathname === "/reports/parts-pending")}
                      onClick={onNavClick}
                    >
                      <Boxes size={12} />
                      Waiting for Parts
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/reports/supplier-dues"
                      className={subLinkCls(pathname === "/reports/supplier-dues")}
                      onClick={onNavClick}
                    >
                      <Landmark size={12} />
                      Supplier Dues
                    </Link>
                  </li>

                  <li className="text-[8px] font-black uppercase text-muted-2 tracking-widest px-3 pt-3 pb-0.5 select-none">
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
            <li className="text-[9px] font-black uppercase text-app tracking-widest px-3 pt-5 pb-1.5 select-none">
              System
            </li>
            <SubMenu
              collapsed={collapsed}
              onExpand={onExpand}
              title="System"
              icon={<Settings2 size={15} />}
              matchPaths={["/users", "/settings", "/backup", "/back-office/db-tools", "/images"]}
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
            </SubMenu>

            {/* ══ DEVELOPER ════════════════════════════════════════════════ */}
            {(sellerEnabled || devEnabled) && (
              <SubMenu
                collapsed={collapsed}
                onExpand={onExpand}
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
  // AI drawer: iframe har app page par mount rehta tha → har load par poora /ai
  // route (≈540KB JS + dobara auth boot) load hota tha. Ab iframe ka src sirf
  // first open par set hota hai — pehle load par koi /ai fetch nahi hota.
  const [aiOpenedOnce, setAiOpenedOnce] = useState(false);

  // G1 gate-split: saara auth/boot state + effects ab useAppBoot() hook me hai.
  // Ye component sirf shell render karta hai — behavior bilkul unchanged.
  const {
    isMobile,
    authReady,
    profile,
    userEmail,
    dropdownOpen,
    setDropdownOpen,
    drawerOpen,
    setDrawerOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapse,
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
    idleLogoutMin,
    idleWarnMin,
    refreshLicense,
    handleLogout,
  } = useAppBoot();

  // Keyboard shortcuts (g-prefix + ? help + Escape)
  const { helpOpen, setHelpOpen } = useKeyboardShortcuts(SHORTCUT_ROUTES);

  // Sprint 4 #19: density (compact/comfortable, persisted)
  const { density, setDensity } = useDensity();

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
  //
  // IMPORTANT: listener SIRF EK BAAR (mount par) register hota hai. Pehle isse
  // `[pathname, goInAppBack]` par re-register karte the, par `addListener` ek
  // Promise return karta hai aur cleanup async `then` se pehle chal jata tha —
  // isliye purane listeners remove nahi hote the aur accumulate ho jaate the.
  // Phir EK back press par MULTIPLE handlers fire karte the → app multiple
  // screens (yahi to bahar) jump karti thi. Ab pathname/goInAppBack ko refs se
  // track karte hain taaki listener dobara add kiye bina hamesha latest mile.
  const pathnameRef = useRef(pathname);
  const goInAppBackRef = useRef(goInAppBack);
  useEffect(() => {
    pathnameRef.current = pathname;
    goInAppBackRef.current = goInAppBack;
  }, [pathname, goInAppBack]);

  useEffect(() => {
    let resolvedHandler: { remove: () => void } | null = null;
    let disposed = false;
    try {
      const unsub = App.addListener("backButton", () => {
        if (disposed) return;
        const p = pathnameRef.current;
        const isPublicPath =
          p === "/login" ||
          p === "/setup" ||
          p === "/" ||
          [
            "/about",
            "/contact",
            "/job-status",
            "/stage-lighting",
            "/industrial",
            "/power-supply",
          ].some((pp) => p === pp || p.startsWith(pp + "/"));
        if (isPublicPath) {
          // Login/hang state → cache-clear hard refresh (app exit nahi).
          hardReload();
        } else {
          goInAppBackRef.current();
        }
      });
      unsub.then((h) => {
        if (disposed) {
          // Mount ke baad hi cleanup hua (rare) — listener ko turant hata do.
          try {
            h.remove();
          } catch {
            /* ignore */
          }
        } else {
          resolvedHandler = h;
        }
      });
    } catch {
      /* plugin unavailable (web) → ignore */
    }
    return () => {
      disposed = true;
      try {
        resolvedHandler?.remove();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ── Sprint 4 #20: bfcache restore ─────────────────────────────────────────
  // Back/forward se page bfcache se zinda wapas aaye (event.persisted) to
  // server data revalidate karo. Client form state same rehta hai (RSC refresh
  // client state nahi mitata) — sirf taza server data aata hai. unload
  // listeners kahin nahi hain isliye bfcache block nahi hota.
  useEffect(() => {
    const h = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    window.addEventListener("pageshow", h);
    return () => window.removeEventListener("pageshow", h);
  }, [router]);

  if (isPublicPage) {
    // Auth pages par logged-in user ko flash na dikhe — blank while redirect.
    if (profile && isAuthPage) return <div className="min-h-screen bg-app" />;
    return <>{children}</>;
  }

  if (!authReady) {
    return (
      <PullToRefresh className="h-screen flex items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/60">
              <Sparkles size={26} className="text-white" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-app animate-ping" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-2">
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

  // LITE MODE: sidebar me sirf allowed modules dikhao (license ki jagah).
  // Full mode me license?.enabledModules hi chalta hai (jaise pehle).
  const navEnabledModules = LITE_MODE ? LITE_MODULES : (license?.enabledModules ?? null);

  // ── LICENSE GATE ──
  if (license && !license.valid) {
    return (
      <LicenseGate
        status={license}
        isAdmin={isAdmin}
        onActivated={() => refreshLicense(true)}
        onLogout={handleLogout}
      />
    );
  }

  // ── LITE MODE ROUTE GUARD ──
  // (Middleware server par bhi block karta hai; ye client-side backup hai —
  // client-side navigation middleware se kabhi nahi guzarti.)
  if (LITE_MODE && !isLiteRouteAllowed(pathname)) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 mx-auto bg-muted/15 text-muted rounded-2xl flex items-center justify-center mb-5">
            <Package size={28} />
          </div>
          <h1 className="text-lg font-black text-white mb-2">Feature Not Available</h1>
          <p className="text-sm text-muted mb-6">
            Is lite version me sirf Dashboard, Attendance aur Staff modules hain.
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

  // ── MODULE ROUTE GUARD ──
  if (isAdmin && license?.enabledModules && isRouteDisabled(pathname, license.enabledModules)) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <div className="text-center max-w-sm mx-auto px-6">
          <div className="w-16 h-16 mx-auto bg-amber-500/15 text-amber-400 rounded-2xl flex items-center justify-center mb-5">
            <Package size={28} />
          </div>
          <h1 className="text-lg font-black text-white mb-2">Module Not Available</h1>
          <p className="text-sm text-muted mb-6">
            Ye module aapke plan mein included nahi hai. Seller se contact karein ya{" "}
            <span className="font-bold text-app-2">Settings &rarr; License</span> mein plan
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
        <aside
          className={`fixed top-0 left-0 h-full ${
            sidebarCollapsed ? "w-16" : "w-[260px]"
          } glass border-r flex flex-col z-50 transition-[width] duration-200 ease-out ${
            sidebarCollapsed ? "sidebar-collapsed" : ""
          }`}
        >
          {/* Brand — click karo → public website (logged-in user bhi) */}
          <div
            className={`relative overflow-hidden ${
              sidebarCollapsed ? "px-1" : "px-5"
            } py-4 border-b border-app-2`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-700/15 to-transparent pointer-events-none" />
            <Link
              href="/"
              title="Public Website"
              className={`relative flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"} group`}
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
              {!sidebarCollapsed && (
                <div>
                  <div className="text-lg font-black tracking-tight leading-none">
                    <span className="vtech-brand">V-TECH</span>{" "}
                    <span className="vtech-pro font-light">PRO</span>
                  </div>
                  <div className="text-[8px] text-muted dark:text-app-2 font-black uppercase tracking-widest mt-0.5">
                    Management System · Click → Website
                  </div>
                </div>
              )}
            </Link>
          </div>

          <SidebarNav
            pathname={pathname}
            isAdmin={isAdmin}
            isClient={isClient}
            canSeeInventory={canSeeInventory}
            sellerEnabled={license?.sellerEnabled}
            devEnabled={license?.devEnabled}
            enabledModules={navEnabledModules}
            unreadCount={unreadCount}
            collapsed={sidebarCollapsed}
            onExpand={() => setSidebarCollapsed(false)}
          />

          <div
            className={`${
              sidebarCollapsed ? "px-0 justify-center" : "px-4 justify-between"
            } py-3 border-t border-app-2 flex items-center`}
          >
            {!sidebarCollapsed && (
              <span
                className="text-[9px] text-muted dark:text-app-2 font-black tracking-widest uppercase"
                title={APP_COMMIT ? `Build ${APP_COMMIT.slice(0, 7)}` : undefined}
              >
                V-TECH PRO {APP_VERSION_LABEL}
              </span>
            )}
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
            className={`fixed top-0 left-0 h-[calc(100dvh-56px)] w-[280px] glass border-r flex flex-col z-50 transition-transform duration-300 ease-out ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Drawer header — brand click → public website */}
            <div className="relative overflow-hidden px-4 py-4 border-b border-app-2 flex items-center justify-between">
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
                  <div className="text-[8px] text-muted-2 font-black uppercase tracking-widest mt-0.5">
                    Management System · Website
                  </div>
                </div>
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                className="relative w-8 h-8 flex items-center justify-center glass border rounded-lg text-muted hover:text-white transition-all"
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
              enabledModules={navEnabledModules}
              unreadCount={unreadCount}
            />

            {!isClient && <TeamOnline />}

            {/* Version footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-app-2">
              <span
                className="text-[9px] text-muted font-black tracking-widest uppercase"
                title={APP_COMMIT ? `Build ${APP_COMMIT.slice(0, 7)}` : undefined}
              >
                V-TECH PRO {APP_VERSION_LABEL}
              </span>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            </div>

            {/* User info at drawer bottom */}
            <div className="px-3 py-3 border-t border-app-2">
              <div className="flex items-center gap-3 px-3 py-2.5 glass rounded-xl">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/10"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
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
                  className="p-1.5 text-muted-2 hover:text-red-400 transition-colors"
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
        className={`${
          isMobile === false && !isAiPage
            ? sidebarCollapsed
              ? "lg:ml-16"
              : "lg:ml-[260px]"
            : "ml-0"
        } flex-1 min-h-screen flex flex-col`}
      >
        {/* ── TOPBAR ── */}
        {!isAiPage && (
          <header className="sticky top-0 z-40 h-14 glass border-b flex items-center justify-between px-4 gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Mobile: hamburger menu */}
              {isMobile === true && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-muted hover:text-white transition-all"
                >
                  <Menu size={16} />
                </button>
              )}
              {/* Desktop: sidebar collapse/expand toggle */}
              {isMobile === false && (
                <button
                  onClick={toggleSidebarCollapse}
                  title={sidebarCollapsed ? "Sidebar kholo" : "Sidebar collapse karo"}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-muted hover:text-white transition-all hidden lg:flex"
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-emerald-500/40 rounded-xl text-muted hover:text-emerald-400 transition-all"
                title="Refresh page"
              >
                <RefreshCw size={15} />
              </button>
            )}

            {/* AI Assistant - Desktop */}
            {isMobile === false && !isClient && !LITE_MODE && (
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
                buttonClassName="w-9 h-9 flex-shrink-0 flex items-center justify-center glass border hover:border-blue-500/40 rounded-xl text-muted hover:text-white transition-all"
              />
            )}

            {/* Density - desktop topbar (Sprint 4 #19) */}
            {isMobile === false && <DensityToggle density={density} onSelect={setDensity} />}

            {/* User dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setDropdownOpen((p) => !p)}
                className="flex items-center gap-2.5 hover:bg-white/[0.04] px-2 py-1.5 rounded-xl transition-all"
              >
                <div className="hidden sm:block text-right leading-none">
                  <p className="text-[11px] font-black uppercase text-app-2">{displayName}</p>
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
                    className="w-9 h-9 rounded-xl object-cover shadow-md flex-shrink-0 border border-white/10"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
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
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-panel border border-app-2 dark:border-app rounded-2xl shadow-2xl shadow-black/60 p-1.5 z-50">
                    <div className="px-3 py-2.5 border-b border-app-2 dark:border-app-2 mb-1">
                      <p className="text-[9px] font-black text-app dark:text-muted uppercase tracking-wider">
                        Logged in as
                      </p>
                      <p className="text-xs font-bold text-muted-2 dark:text-muted truncate mt-0.5">
                        {userEmail}
                      </p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-app dark:text-app-2 hover:bg-panel-2 dark:hover:bg-white/[0.05] hover:text-app dark:hover:text-white rounded-xl transition-all"
                    >
                      <User size={13} /> My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-app dark:text-app-2 hover:bg-panel-2 dark:hover:bg-white/[0.05] hover:text-app dark:hover:text-white rounded-xl transition-all"
                      >
                        <Settings size={13} /> Settings
                      </Link>
                    )}
                    <div className="border-t border-app-2 dark:border-app-2 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
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
              <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-2">
                <Loader2 size={22} className="animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Redirecting...</p>
              </div>
            ) : (
              children
            )}
          </PullToRefresh>
        </main>

        {/* ── Bottom-bar spacer (mobile) ──
            Tab bar fixed hai — bina spacer ke har page ka bottom uske peeche
            dabta tha. AI (/ai) aur /messages ke fitted layouts alag handle
            hote hain (neeche), isliye yahan exclude. */}
        {!isAiPage && !pathname.startsWith("/messages") && (
          <div aria-hidden className="h-[72px] pb-safe md:hidden shrink-0" />
        )}
      </div>

      {/* Floating back FAB hata diya — bottom bar me Back tab hai (overlap fix) */}

      {/* ── AI ASSISTANT RIGHT DRAWER ── */}
      {!isClient && !LITE_MODE && (
        <>
          {/* Floating Button Group - Bottom Right (hidden while AI window is open) */}
          {!aiDrawerOpen && !isAiPage && (
            <div className="fixed bottom-20 right-4 z-60 flex flex-col gap-3">
              {/* AI Assistant Button - positioned above Jobs FAB */}
              <button
                onClick={() => {
                  setAiOpenedOnce(true);
                  setAiDrawerOpen(true);
                }}
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
                  className="w-8 h-8 flex items-center justify-center glass border rounded-lg text-muted hover:text-white hover:border-red-500/40 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Iframe for AI Page */}
              <div className="flex-1">
                {aiOpenedOnce && (
                  <iframe src="/ai" className="w-full h-full border-0" title="AI Assistant" />
                )}
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
            <p className="text-muted text-sm mb-1">
              Aap {idleLogoutMin} minute se kuch nahi kar rahe.
            </p>
            <p className="text-muted text-xs mb-5">
              Agar {idleWarnMin} minute mein kuch nahi kiya to aap automatically logout ho jayenge.
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
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <ShortcutHelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <MobileBottomTab onMore={() => setDrawerOpen(true)} onBack={goInAppBack} />
    </>
  );
}
