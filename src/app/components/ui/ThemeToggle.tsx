"use client";

import React, { useEffect, useRef, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";

// Theme selector dropdown — System / Dark / Light.
// Screen-aware: dropdown viewport se bahar nahi jata (boundary check + flip/clamp).
// Ek chhota icon button; click par 3-option menu khulta hai.
interface ThemeToggleProps {
  themePref: "system" | "dark" | "light";
  theme: "dark" | "light"; // effective (used) theme
  onSelect: (p: "system" | "dark" | "light") => void;
  buttonClassName?: string; // trigger button styling (default = sidebar style)
  size?: number; // icon size
}

type MenuPos = {
  top?: number;
  left?: number;
};

const MENU_WIDTH = 168; // px — dropdown fixed width
const MENU_HEIGHT = 170; // px — dropdown approx height (row estimation)
const GAP = 8;

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  themePref,
  theme,
  onSelect,
  buttonClassName = "p-1.5 text-slate-600 hover:text-amber-400 transition-colors",
  size = 14,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos>({});

  // trigger icon: system → Monitor, warna effective theme ke hisaab se Sun/Moon
  const TriggerIcon = themePref === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  // open hone par viewport-relative position compute (screen se bahar NA jaye).
  // HAMESHA only `left` use hota hai (left+right dono set karna width ko
  // stretch kar deta hai aur dropdown screen se bahar chala jata tha).
  const openMenu = () => {
    const el = wrapRef.current;
    if (!el) {
      setOpen(true);
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p: MenuPos = {};

    // horizontal: trigger ke left-aligned; viewport ke andar clamp karo
    let left = r.left;
    if (left + MENU_WIDTH > vw - GAP) left = vw - MENU_WIDTH - GAP;
    if (left < GAP) left = GAP;
    p.left = Math.round(left);

    // vertical: prefer below trigger hone par, agar neeche space na ho to upar
    if (r.bottom + GAP + MENU_HEIGHT > vh) {
      const top = r.top - MENU_HEIGHT - GAP;
      p.top = top < GAP ? GAP : top;
    } else {
      p.top = r.bottom + GAP;
    }
    setPos(p);
    setOpen(true);
  };

  const pick = (p: "system" | "dark" | "light") => {
    onSelect(p);
    setOpen(false);
  };

  // outside click / Escape / route-change par band karo
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const activeCls = "bg-blue-600 text-white";
  const idleCls =
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white";
  const labelCls =
    "text-slate-500 dark:text-slate-400";

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        onClick={open ? () => setOpen(false) : openMenu}
        title={themePref === "system" ? "Theme: System (auto)" : `Theme: ${theme === "dark" ? "Dark" : "Light"}`}
        aria-label="Theme options"
        aria-expanded={open}
        className={buttonClassName}
      >
        <TriggerIcon size={size} />
      </button>

      {open && (
        <div
          style={{ top: pos.top, left: pos.left, width: `${MENU_WIDTH}px` }}
          className="fixed z-[70] rounded-xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl py-1.5 dark:border-white/10 dark:bg-[#111827]/95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-3 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-wider ${labelCls}`}>
            Theme
          </div>
          <button
            onClick={() => pick("system")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${themePref === "system" ? activeCls : idleCls}`}
          >
            <Monitor size={14} /> System <span className="ml-auto text-[10px] font-medium opacity-70">Auto</span>
          </button>
          <button
            onClick={() => pick("light")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${themePref === "light" ? activeCls : idleCls}`}
          >
            <Sun size={14} /> Light
          </button>
          <button
            onClick={() => pick("dark")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold transition-colors ${themePref === "dark" ? activeCls : idleCls}`}
          >
            <Moon size={14} /> Dark
          </button>
        </div>
      )}
    </div>
  );
};
