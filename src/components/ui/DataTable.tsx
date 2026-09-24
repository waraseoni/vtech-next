"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { EmptyState } from "./EmptyState";
import { ClipboardList } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: string;
  loading?: boolean;
  emptyMessage?: string;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  sortField?: string;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
  totalItems?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const alignClass = (align?: string) =>
  align === "right"
    ? "text-right"
    : align === "center"
    ? "text-center"
    : "text-left";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Component ────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  keyField,
  loading = false,
  emptyMessage = "Koi data nahi mila.",
  searchQuery,
  setSearchQuery,
  sortField,
  sortDir = "asc",
  onSort,
  totalItems,
  page = 1,
  pageSize = 25,
  onPageChange,
  className = "",
}: DataTableProps<T>) {
  const [localPage, setLocalPage] = useState(page);
  const [localPageSize, setLocalPageSize] = useState(pageSize);

  const effectiveTotal = totalItems ?? data.length;
  const pageCount = Math.max(1, Math.ceil(effectiveTotal / localPageSize));
  const safePage = Math.min(Math.max(1, localPage), pageCount);

  // Sync external page changes
  useMemo(() => {
    setLocalPage(page);
  }, [page]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      const p = Math.min(Math.max(1, newPage), pageCount);
      setLocalPage(p);
      onPageChange?.(p, localPageSize);
    },
    [pageCount, localPageSize, onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setLocalPageSize(newSize);
      setLocalPage(1);
      onPageChange?.(1, newSize);
    },
    [onPageChange]
  );

  const handleSort = useCallback(
    (field: string) => {
      if (!onSort) return;
      if (sortField === field) {
        onSort(sortDir === "asc" ? "desc" : "asc");
      } else {
        onSort(field);
      }
    },
    [onSort, sortField, sortDir]
  );

  // Pagination buttons (window of 5)
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(pageCount, start + 4);
    const pages: (number | string)[] = [];
    if (start > 1) pages.push(1, "...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < pageCount) pages.push("...", pageCount);
    return pages;
  }, [safePage, pageCount]);

  const containerCls = `bg-panel border border-app rounded-2xl overflow-hidden ${className}`;

  return (
    <div className={containerCls}>
      {/* Search bar */}
      {setSearchQuery && (
        <div className="px-4 py-3 border-b border-app flex items-center gap-2">
          <input
            type="text"
            value={searchQuery ?? ""}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            placeholder="Search..."
            className="w-full max-w-xs px-3 py-1.5 bg-app border border-app rounded-lg text-sm text-app-2 placeholder:text-muted-2 outline-none focus:border-blue-500/50 transition"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-muted-2" />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={emptyMessage}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-panel-2">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${alignClass(col.align)} px-4 py-3 cursor-pointer select-none hover:bg-white/[0.03] transition-colors ${
                      col.sortable ? "" : ""
                    }`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="flex-shrink-0">
                          {sortField === col.key ? (
                            sortDir === "asc" ? (
                              <ArrowUp size={12} className="text-blue-400" />
                            ) : (
                              <ArrowDown size={12} className="text-blue-400" />
                            )
                          ) : (
                            <ArrowUpDown size={12} className="text-muted-2" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a2234]">
              {data.map((item, index) => (
                <tr
                  key={String((item as Record<string, unknown>)[keyField] ?? index)}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 ${alignClass(col.align)}`}
                    >
                      {col.render
                        ? col.render(item, index)
                        : String((item as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(onPageChange || totalItems !== undefined) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-app">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span>Show</span>
            <select
              value={localPageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-app border border-app rounded-lg px-1.5 py-0.5 text-[11px] font-bold outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="px-2 py-1.5 bg-app border border-app hover:border-blue-500/40 text-muted hover:text-app-2 rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNumbers.map((p, i) =>
              typeof p === "string" ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-muted text-xs">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${
                    p === safePage
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                      : "bg-app border border-app text-muted hover:text-app-2"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage >= pageCount}
              className="px-2 py-1.5 bg-app border border-app hover:border-blue-500/40 text-muted hover:text-app-2 rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="text-[11px] text-muted">
            Showing {(safePage - 1) * localPageSize + 1}–
            {Math.min(safePage * localPageSize, effectiveTotal)} of {effectiveTotal}
          </div>
        </div>
      )}
    </div>
  );
}
