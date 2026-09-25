// ─── Sprint 4 #16: navbar search UI (thin — logic useNavbarSearch me) ───────
"use client";

import {
  Users,
  Wrench,
  Package,
  User,
  ShoppingCart,
  MapPin,
  LocateFixed,
  Search,
  Loader2,
  X,
  ChevronRight,
} from "lucide-react";
import { useNavbarSearch } from "@/hooks/useNavbarSearch";

const ICON_MAP = {
  client: <Users size={13} className="text-blue-400 flex-shrink-0" />,
  job: <Wrench size={13} className="text-muted flex-shrink-0" />,
  product: <Package size={13} className="text-amber-400 flex-shrink-0" />,
  mechanic: <User size={13} className="text-purple-400 flex-shrink-0" />,
  sale: <ShoppingCart size={13} className="text-pink-400 flex-shrink-0" />,
  location: <MapPin size={13} className="text-green-400 flex-shrink-0" />,
  spot: <LocateFixed size={13} className="text-orange-400 flex-shrink-0" />,
};

export function NavbarSearch() {
  const {
    query,
    results,
    loading,
    open,
    setOpen,
    wrapRef,
    handleChange,
    handleSelect,
    clearSearch,
  } = useNavbarSearch();

  return (
    <div ref={wrapRef} className="relative w-full group">
      {/* Input */}
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2 group-focus-within:text-blue-400 transition-colors pointer-events-none z-10"
      />
      {loading && (
        <Loader2
          size={13}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-blue-400 animate-spin pointer-events-none z-10"
        />
      )}
      {query && !loading && (
        <button
          onClick={clearSearch}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-muted-2 hover:text-muted transition-colors z-10"
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
        className="w-full pl-9 pr-24 py-2.5 sm:py-2 bg-panel-2 border border-app rounded-xl text-sm text-app-2 placeholder:text-muted-2 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all font-medium"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-panel-2 border border-app text-[10px] font-medium text-muted">
          Ctrl
        </kbd>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-panel-2 border border-app text-[10px] font-medium text-muted">
          K
        </kbd>
      </div>

      {/* Dropdown Results */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-panel-2 border border-app rounded-2xl shadow-2xl shadow-black/60 z-[200] overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-5 text-center text-muted-2 text-xs font-bold uppercase tracking-wider">
              No results found
            </div>
          ) : (
            <>
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[9px] font-black text-app uppercase tracking-widest">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[9px] text-app">
                  Clients · Jobs · Products · Mechanics · Sales · Locations · Spots
                </span>
              </div>
              <ul className="max-h-[400px] overflow-y-auto divide-y divide-[#1a2234]">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => handleSelect(r.href)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-panel-2 flex items-center justify-center flex-shrink-0">
                        {ICON_MAP[r.icon]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-app-2 truncate">
                            {r.title}
                          </span>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide ${r.tagColor}`}
                          >
                            {r.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-2 truncate mt-0.5">{r.subtitle}</p>
                      </div>
                      <ChevronRight size={12} className="text-app flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-3 py-2 border-t border-app-2 text-[9px] text-app text-center">
                Press Enter ya click karo to navigate
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
