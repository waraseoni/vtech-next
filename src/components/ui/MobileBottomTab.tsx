"use client";

import { usePathname } from "next/navigation";
import {
  ArrowLeft,
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
  { key: "more", icon: MoreHorizontal, label: "More" },
];

export function MobileBottomTab({ onMore, onBack }: { onMore?: () => void; onBack?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="flex items-center justify-around bg-panel border-t border-app backdrop-blur-xl px-2 py-1.5 pb-safe">
        {/* Back — floating FAB ki jagah (overlap fix): Dashboard se pehle */}
        <button
          key="back"
          onClick={() => onBack?.()}
          aria-label="Back"
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[52px] text-muted hover:text-app-2 hover:bg-white/[0.04] active:scale-95"
        >
          <ArrowLeft size={20} />
          <span className="text-[9px] font-bold">Back</span>
        </button>
        {TABS.map((tab) => {
          const isActive =
            tab.key === "dashboard"
              ? pathname === "/dashboard"
              : tab.href
              ? pathname.startsWith(tab.href)
              : false;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === "more") {
                  onMore?.();
                } else {
                  window.location.href = tab.href || "/";
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all min-w-[52px] ${
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
