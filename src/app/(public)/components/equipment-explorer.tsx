"use client";

import { useMemo, useState } from "react";
import { CalendarClock, IndianRupee, Search, ShieldCheck } from "lucide-react";
import ZoomableImage from "@/components/ZoomableImage";
import type { EquipmentItem } from "@/lib/public-site-defaults";
import { EquipmentArt } from "./equipment-art";

type Filter = "all" | "available" | "coming";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All repairs" },
  { id: "available", label: "Available now" },
  { id: "coming", label: "Coming soon" },
];

const GROUPS: { id: Filter; title: string }[] = [
  { id: "available", title: "Available Now" },
  { id: "coming", title: "Coming Soon" },
  { id: "all", title: "Other Repairs" },
];

function groupOf(item: EquipmentItem): Filter {
  return item.badge ?? "all";
}

function EquipmentCard({ item }: { item: EquipmentItem }) {
  return (
    <div className="group rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/40 transition-all active:scale-[0.98]">
      <div className="relative h-32 sm:h-36 overflow-hidden bg-app">
        {item.image ? (
          <ZoomableImage
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <EquipmentArt
            kind={item.art}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {item.badge && (
          <span
            className={`absolute top-3 right-3 z-10 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm ${
              item.badge === "available"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-amber-500/15 border-amber-500/30 text-amber-400"
            }`}
          >
            {item.badge === "available" ? "Available Now" : "Coming Soon"}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-[15px] font-bold mb-1">{item.name}</h3>
        <p className="text-[13px] text-muted leading-relaxed">{item.detail}</p>
        {(item.turnaround || item.startingPrice || item.warranty) && (
          <dl className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
            {item.turnaround && (
              <div className="flex items-center gap-2 text-[12px] text-app-2">
                <CalendarClock size={13} className="shrink-0 text-cyan-400" />
                <dt className="sr-only">Turnaround</dt>
                <dd>{item.turnaround}</dd>
              </div>
            )}
            {item.startingPrice ? (
              <div className="flex items-center gap-2 text-[12px] text-app-2">
                <IndianRupee size={13} className="shrink-0 text-emerald-400" />
                <dt className="sr-only">Starting price</dt>
                <dd>From ₹{item.startingPrice.toLocaleString("en-IN")}</dd>
              </div>
            ) : null}
            {item.warranty && (
              <div className="flex items-center gap-2 text-[12px] text-app-2">
                <ShieldCheck size={13} className="shrink-0 text-blue-400" />
                <dt className="sr-only">Warranty</dt>
                <dd>{item.warranty}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  );
}

export function EquipmentExplorer({ items }: { items: EquipmentItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => ({
      all: items.length,
      available: items.filter((item) => groupOf(item) === "available").length,
      coming: items.filter((item) => groupOf(item) === "coming").length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && groupOf(item) !== filter) return false;
      if (!needle) return true;
      return `${item.name} ${item.detail}`.toLowerCase().includes(needle);
    });
  }, [items, filter, query]);

  const groups =
    filter === "all"
      ? GROUPS.map((group) => ({
          ...group,
          items: visible.filter((item) => groupOf(item) === group.id),
        })).filter((group) => group.items.length > 0)
      : [{ id: filter, title: "", items: visible }];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment availability">
          {FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                  active
                    ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                    : "border-white/10 bg-white/[0.03] text-muted hover:text-white"
                }`}
              >
                {option.label} ({counts[option.id]})
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-64">
          <span className="sr-only">Equipment search karein</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Equipment search…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13px] text-white placeholder:text-muted-2 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center text-[13px] text-muted">
          Is filter par koi equipment nahi mila. Doosra filter ya search try karein.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.id}>
              {group.title && (
                <h3 className="mb-3 text-[12px] font-black uppercase tracking-widest text-muted">
                  {group.title} <span className="text-muted-2">({group.items.length})</span>
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {group.items.map((item, index) => (
                  <EquipmentCard key={`${item.name}-${index}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
