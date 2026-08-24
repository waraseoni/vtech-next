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

// Mobile → bottom sheet, desktop → anchored dropdown
const DESKTOP_QUERY = "(min-width: 640px)";

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
  const [isDesktop, setIsDesktop] = useState(true);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    if (!open && isDesktop) setPos(computePos());
    setOpen(v => !v);
    setSearch("");
  };

  // Open rehte hue scroll/resize/keyboard-open par menu ko trigger ke sath
  // reposition karo — warna fixed menu purani jagah atka rehta hai.
  useEffect(() => {
    if (!open || !isDesktop) return;
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
  }, [open, isDesktop, computePos]);

  // Outside click + Escape close
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lock body scroll while the mobile sheet is open
  useEffect(() => {
    if (!open || isDesktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isDesktop]);

  const selected = options.find(o => String(o.id) === String(value ?? ""));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter(o => `${o.label} ${o.sub || ""}`.toLowerCase().includes(q))
    : options;

  const pick = (id: string) => {
    onSelect(id);
    close();
  };

  const listContent = (
    <>
      {clearLabel && (
        <div
          onClick={() => pick("")}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group cursor-pointer hover:bg-white/5 active:bg-white/10 ${
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
        <p className="text-slate-600 text-xs text-center py-6">{emptyText}</p>
      ) : (
        filtered.map(o => {
          const isSel = String(o.id) === String(value ?? "");
          return (
            <div
              key={o.id}
              onClick={() => { if (!o.disabled) pick(String(o.id)); }}
              title={o.disabled ? o.disabledNote || "Disabled" : undefined}
              className={`flex items-center justify-between px-3 min-h-[44px] py-2 rounded-xl transition-all group ${
                o.disabled
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-white/5 active:bg-blue-500/10 cursor-pointer"
              }`}
            >
              <div className="min-w-0">
                <div className={`text-sm font-bold truncate transition-colors ${
                  isSel ? "text-blue-300" : "text-white group-hover:text-blue-300"
                }`}>
                  {o.label}
                </div>
                {o.sub && <div className="text-xs text-slate-600 mt-0.5">{o.sub}</div>}
              </div>
              {isSel && <Check size={15} className="text-emerald-400 flex-shrink-0 ml-2" />}
            </div>
          );
        })
      )}
    </>
  );

  const searchBox = (
    <div className="relative mb-2">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={15} />
      <input
        ref={searchRef}
        /* Mobile par keyboard turant na khule — user khud search tap kare,
           warna keyboard aate hi menu screen se bahar ho jata tha. */
        autoFocus={typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={searchPlaceholder}
        className="w-full pl-9 pr-9 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-white text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-700"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {search && (
        <button
          type="button"
          onClick={() => { setSearch(""); searchRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[#21293d] text-slate-400 hover:text-white transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2.5 bg-[#111520] border rounded-xl text-sm transition-all outline-none text-left ${
          open ? "border-blue-500/60 ring-1 ring-blue-500/20" : "border-[#21293d] hover:border-slate-600"
        }`}
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            renderSelected ? (
              renderSelected(selected)
            ) : (
              <span className="block font-bold text-white text-sm truncate">{selected.label}</span>
            )
          ) : (
            <span className="text-slate-600 font-medium">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && typeof document !== "undefined" && !isDesktop && createPortal(
        /* ── MOBILE: bottom sheet ── */
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 animate-[fade-in_150ms_ease-out]"
            onClick={close}
          />
          {/* Sheet */}
          <div
            ref={menuRef}
            className="absolute bottom-0 left-0 right-0 bg-[#161b27] border-t border-[#21293d] rounded-t-2xl shadow-2xl flex flex-col max-h-[82vh] pb-[max(env(safe-area-inset-bottom),0.75rem)] animate-[sheet-up_220ms_cubic-bezier(0.22,1,0.36,1)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0" onClick={close}>
              <div className="w-10 h-1 rounded-full bg-slate-600" />
            </div>

            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 mb-2">
                {placeholder.replace(/[—-]/g, "").trim()}
              </p>
              {searchBox}
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 space-y-0.5">
              {listContent}
            </div>
          </div>
        </div>,
        document.body
      )}

      {open && pos && isDesktop && typeof document !== "undefined" && createPortal(
        /* ── DESKTOP: anchored dropdown ── */
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-[100] bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl p-3 animate-[fade-in_120ms_ease-out]"
        >
          {searchBox}
          <div
            className="overflow-y-auto space-y-0.5"
            style={{ maxHeight: pos.maxListH }}
          >
            {listContent}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
