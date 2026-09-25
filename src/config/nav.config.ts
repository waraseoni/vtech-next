// ─── Sprint 4 #16: central nav config ───────────────────────────────────────
// Shortcut routes (keyboard g-prefix) + mobile bottom-bar tabs — ek jagah,
// taaki naya route jodne par 3 files na kholni padein.
// NOTE: SidebarNav ka bespoke JSX (badges/role-gates/submenus) data me nahi
// aata — wahan component move hota hai (components/SidebarNav.tsx).
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Users,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

/** g-prefix keyboard shortcuts → routes (useKeyboardShortcuts me jata hai) */
export const SHORTCUT_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  jobs: "/jobs",
  clients: "/clients",
  sales: "/direct-sales",
};

export interface MobileTab {
  key: string;
  href?: string;
  icon: LucideIcon;
  label: string;
}

/** Mobile bottom-bar tabs (Back action + More drawer component me rehte hain) */
export const MOBILE_TABS: MobileTab[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "jobs", href: "/jobs", icon: ClipboardList, label: "Jobs" },
  { key: "sales", href: "/direct-sales", icon: ShoppingCart, label: "Sales" },
  { key: "clients", href: "/clients", icon: Users, label: "Clients" },
  { key: "more", icon: MoreHorizontal, label: "More" },
];
