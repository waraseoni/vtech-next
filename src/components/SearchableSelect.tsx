"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X } from "lucide-react";

export type SearchableOption = {
  id: string | number;
  label: string;
  sub?: string;
  disabled?: boolean;
  disabledNote?: string;
};

type Props = {
  /** Currently selected id (or null). Shown in the trigger button via renderSelected/label. */
  value: string | number | null;
  options: SearchableOption[];
  /** Called with the picked option's id (as string). Pass "" to clear (filter mode). */
  onSelect: (id: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** When set, shows a reset option at the top of the list that calls onSelect(""). */
  clearLabel?: string;
  /** Custom display for the selected option inside the trigger button. */
  renderSelected?: (opt: SearchableOption) => ReactNode;
};

/** Menu ki fixed hisse: p-3 (24) + search input (~46) + mb-2 (8) */
const MENU_CHROME = 78;
const VIEWPORT_MARGIN = 8;
const MIN_LIST_H = 88;
const MAX_LIST_H = 208;

type MenuPos = { top: number; left: number; width: number; maxListH: number };

export default function SearchableSelect({
  value,
  options,
  onSelect,
  placeholder,
  searchPlaceholder = "Search karo…",
  emptyText = "Koi option nahi mila",
  clearLabel,
  renderSelected,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => { setOpen(false); setSearch(""); };

  /**
   * Trigger ke around available space nikaal kar menu ko hamesha viewport ke
   * andar rakhta hai — niche jagah kam ho to upar flip, aur list ki height
   * available space se capped (mobile/modal dono cover).
   */
  const computePos = useCallback((): MenuPos | null => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r || typeof window === "undefined") return null;
    const vv = window.visualViewport;
    const vw = Math.round(vv?.width ?? window.innerWidth);
    const vh = Math.round(vv?.height ?? window.innerHeight);

    const width = Math.min(r.width, vw - VIEWPORT_MARGIN * 2);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left, vw - VIEWPORT_MARGIN - width));

    const spaceBelow = vh - VIEWPORT_MARGIN - r.bottom;
    const spaceAbove = r.top - VIEWPORT_MARGIN;

    let top: number;
    let maxListH: number;
    if (spaceBelow >= spaceAbove) {
      maxListH = Math.max(MIN_LIST_H, Math.min(MAX_LIST_H, spaceBelow - MENU_CHROME));
      top = r.bottom + VIEWPORT_MARGIN;
    } else {
      maxListH = Math.max(MIN_LIST_H, Math.min(MAX_LIST_H, spaceAbove - MENU_CHROME));
      top = r.top - VIEWPORT_MARGIN - MENU_CHROME - maxListH;
    }
    // Final safety clamp — menu kabhi screen se bahar na jaye
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - VIEWPORT_MARGIN - MENU_CHROME - maxListH));

    return { top, left, width, maxListH };
  }, []);

  const toggle = () => {
    if (!open) setPos(computePos());
    setOpen(v => !v);
    setSearch("");
  };

  // Open rehte hue scroll/resize/keyboard-open par menu ko trigger ke sath
  // reposition karo — warna fixed menu purani jagah atka rehta hai.
  useEffect(() => {
    if (!open) return;
    const reposition = () => setPos(computePos());
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    // capture: true — kisi bhi scrollable ancestor/container ke scroll par pakdo
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [open, computePos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => String(o.id) === String(value ?? ""));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter(o => `${o.label} ${o.sub || ""}`.toLowerCase().includes(q))
    : options;

  const pick = (id: string) => {
    onSelect(id);
    close();
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-[#111520] border rounded-xl text-sm transition-all outline-none text-left ${
          open ? "border-blue-500/60 ring-1 ring-blue-500/20" : "border-[#21293d] hover:border-slate-600"
        }`}
      >
        {selected ? (
          renderSelected ? (
            renderSelected(selected)
          ) : (
            <div className="font-bold text-white text-sm">{selected.label}</div>
          )
        ) : (
          <span className="text-slate-600 font-medium">{placeholder}</span>
        )}
        <ChevronDown size={16} className="text-slate-500 flex-shrink-0" />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-[100] bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl p-3"
        >
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
            <input
              /* Mobile par keyboard turant na khule — user khud search tap kare,
                 warna keyboard aate hi menu screen se bahar ho jata tha. */
              autoFocus={typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-white text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-700"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div
            className="overflow-y-auto space-y-0.5"
            style={{ maxHeight: pos.maxListH }}
          >
            {clearLabel && (
              <div
                onClick={() => pick("")}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group cursor-pointer hover:bg-white/5 ${
                  value === null || value === "" ? "text-blue-300" : "text-slate-400"
                }`}
              >
                <span className="text-sm font-bold group-hover:text-blue-300 transition-colors">
                  {clearLabel}
                </span>
                {value === null || value === "" ? (
                  <Check size={15} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <X size={14} className="text-slate-600 flex-shrink-0" />
                )}
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="text-slate-600 text-xs text-center py-4">{emptyText}</p>
            ) : (
              filtered.map(o => {
                const isSel = String(o.id) === String(value ?? "");
                return (
                  <div
                    key={o.id}
                    onClick={() => { if (!o.disabled) pick(String(o.id)); }}
                    title={o.disabled ? o.disabledNote || "Disabled" : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                      o.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-white/5 cursor-pointer"
                    }`}
                  >
                    <div>
                      <div className={`text-sm font-bold transition-colors ${
                        isSel ? "text-blue-300" : "text-white group-hover:text-blue-300"
                      }`}>
                        {o.label}
                      </div>
                      {o.sub && <div className="text-xs text-slate-600 mt-0.5">{o.sub}</div>}
                    </div>
                    {isSel && <Check size={15} className="text-emerald-400 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
