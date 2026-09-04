"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, Plus, Loader2 } from "lucide-react";
import { useSuppliers } from "@/lib/useSuppliers";
import { supabase } from "@/lib/supabase";

type Props = {
  /** Single-select mode */
  value?: string | null;
  onSelect?: (id: string | null) => void;
  /** Multi-select mode */
  multi?: boolean;
  selected?: number[];
  onMultiSelect?: (ids: number[]) => void;
  /** Common */
  placeholder?: string;
  clearLabel?: string;
  /** StockModal: hide entire field if no suppliers exist */
  hideIfEmpty?: boolean;
  /** Disable the "+ Naya Supplier" inline creation */
  disableCreate?: boolean;
};

const DESKTOP_QUERY = "(min-width: 640px)";
const VIEWPORT_MARGIN = 8;
const MENU_CHROME = 78;
const MIN_LIST_H = 88;
const MAX_LIST_H = 208;

export default function SupplierPicker({
  value,
  onSelect,
  multi = false,
  selected = [],
  onMultiSelect,
  placeholder = "Supplier select karein...",
  clearLabel,
  hideIfEmpty = false,
  disableCreate = false,
}: Props) {
  const { suppliers, loading, refresh } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxListH: number } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    setShowCreate(false);
    setNewName("");
    setNewContact("");
    setCreateErr("");
  }, []);

  const computePos = useCallback(() => {
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
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - VIEWPORT_MARGIN - MENU_CHROME - maxListH));
    return { top, left, width, maxListH };
  }, []);

  const toggle = useCallback(() => {
    if (!open && isDesktop) setPos(computePos());
    setOpen((v) => !v);
    setSearch("");
    setShowCreate(false);
    setCreateErr("");
  }, [open, isDesktop, computePos]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open || !isDesktop) return;
    const reposition = () => setPos(computePos());
    window.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [open, isDesktop, computePos]);

  // Outside click + Escape
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
  }, [open, close]);

  // Lock body scroll on mobile
  useEffect(() => {
    if (!open || isDesktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isDesktop]);

  // Focus create name input when form opens
  useEffect(() => {
    if (showCreate) {
      setTimeout(() => createNameRef.current?.focus(), 50);
    }
  }, [showCreate]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? suppliers.filter((s) => s.name.toLowerCase().includes(q))
    : suppliers;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setCreateErr("Supplier name zaroori hai!"); return; }
    setCreating(true);
    setCreateErr("");
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert([{ name, contact: newContact.trim() || null, email: null, address: null, status: 1, delete_flag: 0 }])
        .select("id, name")
        .single();
      if (error) throw error;
      await refresh();
      // Auto-select the new supplier
      if (multi && onMultiSelect && data) {
        onMultiSelect([...selected, data.id]);
      } else if (!multi && onSelect && data) {
        onSelect(String(data.id));
      }
      close();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleMulti = (id: number) => {
    if (!onMultiSelect) return;
    onMultiSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  // Single-select: find selected option
  const selectedOpt = suppliers.find((s) => String(s.id) === String(value ?? ""));
  // Multi-select: find selected options
  const selectedOpts = multi ? suppliers.filter((s) => selected.includes(s.id)) : [];

  if (hideIfEmpty && !loading && suppliers.length === 0) return null;

  const searchBox = (
    <div className="relative mb-2">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={15} />
      <input
        ref={searchRef}
        autoFocus={typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Supplier dhoondein..."
        className="w-full pl-9 pr-9 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-white text-sm outline-none focus:border-blue-500/60 placeholder:text-slate-700"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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

  const createForm = showCreate && (
    <div className="border-t border-[#21293d] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
          Naya Supplier
        </span>
        <button
          type="button"
          onClick={() => { setShowCreate(false); setNewName(""); setNewContact(""); setCreateErr(""); }}
          className="text-slate-600 hover:text-slate-400"
        >
          <X size={14} />
        </button>
      </div>
      <input
        ref={createNameRef}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Supplier name *"
        className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
      />
      <input
        value={newContact}
        onChange={(e) => setNewContact(e.target.value)}
        placeholder="Contact (optional)"
        className="w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
      />
      {createErr && <p className="text-red-400 text-xs">{createErr}</p>}
      <button
        type="button"
        disabled={creating || !newName.trim()}
        onClick={handleCreate}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
      >
        {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        {creating ? "Adding..." : "Supplier Add Karo"}
      </button>
    </div>
  );

  const listContent = (
    <>
      {/* Multi-select: show selected tags */}
      {multi && selectedOpts.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1">
          {selectedOpts.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold"
            >
              {s.name}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); toggleMulti(s.id); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleMulti(s.id); } }}
                className="hover:text-emerald-200 cursor-pointer"
              >
                <X size={10} />
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Clear option (single-select) */}
      {!multi && clearLabel && (
        <div
          onClick={() => { onSelect?.(null); close(); }}
          className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group cursor-pointer hover:bg-white/5 active:bg-white/10 ${
            value === null || value === "" ? "text-blue-300" : "text-slate-400"
          }`}
        >
          <span className="text-sm font-bold group-hover:text-blue-300 transition-colors">{clearLabel}</span>
          {value === null || value === "" ? (
            <Check size={15} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <X size={14} className="text-slate-600 flex-shrink-0" />
          )}
        </div>
      )}

      {/* Supplier list */}
      {filtered.length === 0 ? (
        <p className="text-slate-600 text-xs text-center py-4">Koi supplier nahi mila</p>
      ) : (
        filtered.map((s) => {
          const isSel = multi ? selected.includes(s.id) : String(s.id) === String(value ?? "");
          return (
            <div
              key={s.id}
              onClick={() => multi ? toggleMulti(s.id) : (() => { onSelect?.(String(s.id)); close(); })()}
              className={`flex items-center justify-between px-3 min-h-[44px] py-2 rounded-xl transition-all group cursor-pointer ${
                "hover:bg-white/5 active:bg-blue-500/10"
              }`}
            >
              <div className="min-w-0">
                <div className={`text-sm font-bold truncate transition-colors ${
                  isSel ? "text-blue-300" : "text-white group-hover:text-blue-300"
                }`}>
                  {s.name}
                </div>
              </div>
              {multi ? (
                <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                  isSel ? "bg-emerald-500 border-emerald-500 text-white" : "border-[#2a3550]"
                }`}>
                  {isSel && <Check size={11} />}
                </span>
              ) : (
                isSel && <Check size={15} className="text-emerald-400 flex-shrink-0 ml-2" />
              )}
            </div>
          );
        })
      )}

      {/* Inline create button */}
      {!disableCreate && (
        <div className="border-t border-[#21293d] mt-1 pt-1">
          {showCreate ? (
            createForm
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-blue-400 hover:bg-blue-500/10 transition-all group"
            >
              <Plus size={14} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold">Naya Supplier add karo</span>
            </button>
          )}
        </div>
      )}
    </>
  );

  // Single-select trigger
  const triggerLabel = multi ? null : selectedOpt;

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
          {multi ? (
            selectedOpts.length === 0 ? (
              <span className="text-slate-600 font-medium">{placeholder}</span>
            ) : (
              <span className="flex items-center gap-1.5 flex-wrap">
                {selectedOpts.slice(0, 3).map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                    {s.name}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleMulti(s.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleMulti(s.id); } }}
                      className="hover:text-emerald-200 cursor-pointer"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
                {selectedOpts.length > 3 && (
                  <span className="text-[10px] font-bold text-slate-500">+{selectedOpts.length - 3} aur</span>
                )}
              </span>
            )
          ) : triggerLabel ? (
            <span className="block font-bold text-white text-sm truncate">{triggerLabel.name}</span>
          ) : (
            <span className="text-slate-600 font-medium">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Mobile: centered bottom sheet */}
      {open && typeof document !== "undefined" && !isDesktop && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 animate-[fade-in_150ms_ease-out]" onClick={close} />
          <div
            ref={menuRef}
            className="relative w-full max-w-md bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl flex flex-col max-h-[82vh] animate-[sheet-up_220ms_cubic-bezier(0.22,1,0.36,1)]"
          >
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

      {/* Desktop: anchored dropdown */}
      {open && pos && isDesktop && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-[100] bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl p-3 animate-[fade-in_120ms_ease-out]"
        >
          {searchBox}
          <div className="overflow-y-auto space-y-0.5" style={{ maxHeight: pos.maxListH }}>
            {listContent}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
