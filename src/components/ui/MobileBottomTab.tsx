"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingCart,
  Users,
  MoreHorizontal,
} from "lucide-react";

const TABS = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "jobs", href: "/jobs", icon: ClipboardList, label: "Jobs" },
  { key: "sales", href: "/direct-sales", icon: ShoppingCart, label: "Sales" },
  { key: "clients", href: "/clients", icon: Users, label: "Clients" },
  { key: "more", href: "/messages", icon: MoreHorizontal, label: "More" },
];

export function MobileBottomTab() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="flex items-center justify-around bg-panel border-t border-app backdrop-blur-xl px-2 py-1.5 pb-safe">
        {TABS.map((tab) => {
          const isActive =
            tab.key === "dashboard"
              ? pathname === "/dashboard"
              : tab.key === "more"
              ? !["/dashboard", "/jobs", "/direct-sales", "/clients"].some((p) =>
                  pathname.startsWith(p)
                )
              : pathname.startsWith(tab.href);
          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] ${
                isActive
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-muted hover:text-app-2 hover:bg-white/[0.04]"
              }`}
            >
              <tab.icon size={20} />
              <span className="text-[9px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
