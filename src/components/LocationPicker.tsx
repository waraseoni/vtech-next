"use client";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin, History, ChevronDown, Check, Plus } from "lucide-react";
import { locPath, type LocationParts } from "@/lib/locations";

type Suggestions = { zone: string[]; rack: string[]; bin: string[]; box: string[] };

export type Hierarchy = {
  zones: { id: number; name: string }[];
  racks: { id: number; name: string; zone_id: number }[];
  bins: { id: number; name: string; rack_id: number }[];
  boxes: { id: number; name: string; bin_id: number }[];
};

const EMPTY_SUGGESTIONS: Suggestions = { zone: [], rack: [], bin: [], box: [] };
const EMPTY_HIERARCHY: Hierarchy = { zones: [], racks: [], bins: [], boxes: [] };

interface LocationPickerProps {
  value: LocationParts;
  onChange: (p: LocationParts) => void;
  suggestions?: Suggestions | null;
  /** Normalized hierarchy (zone→rack→bin→box) with parent links — cascading ke liye. */
  hierarchy?: Hierarchy | null;
  /** Last location is product pe istemal hui — "Use last" chip ke liye. */
  lastUsed?: LocationParts | null;
  /** Compact variant (QuickScan modal jaise chhote dialogs). */
  compact?: boolean;
}

type FieldKey = keyof LocationParts;

const FIELD_META: { key: FieldKey; label: string; placeholder: string; weight?: string }[] = [
  { key: "zone", label: "Zone / Area", placeholder: "e.g. Main Shop, Store Room", weight: "sm:col-span-2" },
  { key: "rack", label: "Rack / Shelf", placeholder: "e.g. Rack 1, Shelf A", weight: "" },
  { key: "bin", label: "Bin / Section", placeholder: "e.g. Bin 3", weight: "" },
  { key: "box", label: "Box / Drawer", placeholder: "e.g. Box B2", weight: "sm:col-span-2" },
];

/**
 * Structured cascading location picker: Zone ▸ Rack ▸ Bin ▸ Box.
 *
 *  • Hierarchy se jo parent select ho jaye, usi ke children dropdown me dikhte hain.
 *  • Agar koi parent select nahi kiya to SARE options dikhte hain (fallback).
 *  • Niche ka item select karne par uski poori ancestry auto-fill ho jaati hai —
 *    sirf box "TTL 1" chuno to zone/rack/bin khud set (agar pehle kuch nahi tha).
 *  • Naya value bhi type kiya ja sakta hai (free-text, save par wahi use hota hai).
 */
export default function LocationPicker({
  value,
  onChange,
  suggestions = null,
  hierarchy = null,
  lastUsed = null,
  compact = false,
}: LocationPickerProps) {
  const sug = suggestions || EMPTY_SUGGESTIONS;
  const hier = hierarchy || EMPTY_HIERARCHY;
  const lastPath = lastUsed && locPath(lastUsed);

  const [queries, setQueries] = useState<Record<FieldKey, string>>({
    zone: "",
    rack: "",
    bin: "",
    box: "",
  });
  const [open, setOpen] = useState<FieldKey | null>(null);
  const menuRefs = useRef<Record<FieldKey, HTMLDivElement | null>>({
    zone: null,
    rack: null,
    bin: null,
    box: null,
  });
  const listIdBase = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const menu = menuRefs.current[open];
      if (menu && menu.contains(e.target as Node)) return;
      setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // ── Hierarchy lookups ────────────────────────────────────────────────
  const zoneId = hier.zones.find((z) => z.name === value.zone.trim())?.id;
  const rackId = hier.racks.find((r) => r.name === value.rack.trim())?.id;
  const binId = hier.bins.find((b) => b.name === value.bin.trim())?.id;

  /** Selected parent ke hisab se children filter; koi parent na ho to SARE. */
  const childrenFor = (key: FieldKey): string[] => {
    if (key === "zone") {
      const fromHierarchy = hier.zones.map((z) => z.name);
      return [...new Set([...fromHierarchy, ...(sug.zone || [])])];
    }
    if (key === "rack") {
      const list = zoneId != null ? hier.racks.filter((r) => r.zone_id === zoneId) : hier.racks;
      return [...new Set([...list.map((r) => r.name), ...(sug.rack || [])])];
    }
    if (key === "bin") {
      const list = rackId != null ? hier.bins.filter((b) => b.rack_id === rackId) : hier.bins;
      return [...new Set([...list.map((b) => b.name), ...(sug.bin || [])])];
    }
    const list = binId != null ? hier.boxes.filter((x) => x.bin_id === binId) : hier.boxes;
    return [...new Set([...list.map((x) => x.name), ...(sug.box || [])])];
  };

  const filtered = (key: FieldKey) => {
    const all = childrenFor(key).sort((a, b) => a.localeCompare(b));
    const q = queries[key].trim().toLowerCase();
    if (!q) return all.slice(0, 24);
    return all.filter((o) => o.toLowerCase().includes(q)).slice(0, 24);
  };

  /** Niche ka item chunne par uski ancestry (zone→rack→bin) auto-fill karo. */
  const withAncestry = (patch: Partial<LocationParts>): LocationParts => {
    let zone = patch.zone ?? value.zone;
    let rack = patch.rack ?? value.rack;
    let bin = patch.bin ?? value.bin;
    const box = patch.box ?? value.box ?? "";

    if (box) {
      const boxRec = hier.boxes.find((x) => x.name === box);
      const binRec = boxRec ? hier.bins.find((b) => b.id === boxRec.bin_id) : undefined;
      if (binRec) {
        bin = binRec.name;
        const rackRec = hier.racks.find((r) => r.id === binRec.rack_id);
        if (rackRec) {
          rack = rackRec.name;
          const zoneRec = hier.zones.find((z) => z.id === rackRec.zone_id);
          if (zoneRec) zone = zoneRec.name;
        }
      }
    } else if (bin) {
      const binRec = hier.bins.find((b) => b.name === bin);
      if (binRec) {
        const rackRec = hier.racks.find((r) => r.id === binRec.rack_id);
        if (rackRec) {
          rack = rackRec.name;
          const zoneRec = hier.zones.find((z) => z.id === rackRec.zone_id);
          if (zoneRec) zone = zoneRec.name;
        }
      }
    } else if (rack) {
      const rackRec = hier.racks.find((r) => r.name === rack);
      if (rackRec) {
        const zoneRec = hier.zones.find((z) => z.id === rackRec.zone_id);
        if (zoneRec) zone = zoneRec.name;
      }
    }

    return { zone: zone || "", rack: rack || "", bin: bin || "", box };
  };

  /** Upar ka item choose karne par niche ka (dependent) saaf karo. */
  const pick = (key: FieldKey, name: string) => {
    const isClearAll = name === "";
    let next: LocationParts;
    if (key === "zone") {
      next = { zone: name, rack: "", bin: "", box: "" };
      if (!isClearAll) next = withAncestry({ zone: name });
    } else if (key === "rack") {
      next = withAncestry({ rack: name });
      next = { ...next, bin: "", box: "" };
    } else if (key === "bin") {
      next = withAncestry({ bin: name });
      next = { ...next, box: "" };
    } else {
      next = withAncestry({ box: name });
    }
    onChange(next);
    setQueries((q) => ({ ...q, [key]: "" }));
    setOpen(null);
  };

  const isNewValue = (key: FieldKey, list: string[]) =>
    value[key].trim() !== "" && !list.some((o) => o.toLowerCase() === value[key].trim().toLowerCase());

  return (
    <div className="space-y-2.5">
      {/* Preview + last-used chip */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={12} className="text-emerald-500 flex-shrink-0" />
          <span
            className={`font-bold truncate ${locPath(value) ? "text-emerald-400" : "text-slate-600"}`}
          >
            {locPath(value) || "Location abhi set nahi hai"}
          </span>
        </div>
        {lastPath && lastPath !== locPath(value) && (
          <button
            type="button"
            onClick={() => onChange(lastUsed!)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-extrabold hover:bg-emerald-500/20 transition-all"
            title="Same location jo is product par aakhri baar use hui thi"
          >
            <History size={10} /> Use last: {lastPath}
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-4 gap-2 ${compact ? "" : "gap-2.5"}`}>
        {FIELD_META.map(({ key, label, placeholder, weight }) => {
          const listId = `${listIdBase}-${key}`;
          const options = filtered(key);
          const isOpen = open === key;
          const isNew = isNewValue(key, options);
          return (
            <div key={key} className={`relative ${weight || ""}`}>
              <label
                className={`block font-extrabold uppercase tracking-widest text-slate-600 ${compact ? "text-[8px] mb-1" : "text-[9px] mb-1.5"}`}
              >
                {label}
              </label>

              <div className="relative">
                <input
                  id={listId}
                  type="text"
                  value={value[key]}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({ ...value, [key]: raw });
                    setQueries((q) => ({ ...q, [key]: raw }));
                    setOpen(key);
                  }}
                  onFocus={() => {
                    setQueries((q) => ({ ...q, [key]: value[key] }));
                    setOpen(key);
                  }}
                  onBlur={() => {
                    setTimeout(() => setOpen((o) => (o === key ? null : o)), 120);
                  }}
                  placeholder={placeholder}
                  className={`w-full bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm pr-9 ${
                    compact ? "px-3 py-2" : "px-3.5 py-2.5"
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                  aria-label={`${label} options`}
                >
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    ref={(el) => {
                      menuRefs.current[key] = el;
                    }}
                    className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto bg-[#161b27] border border-[#21293d] rounded-xl shadow-2xl shadow-black/60 p-1.5"
                  >
                    {options.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-slate-600">
                        Koi existing option nahi
                      </p>
                    ) : (
                      options.map((o) => {
                        const isSel = o.toLowerCase() === value[key].trim().toLowerCase();
                        return (
                          <button
                            key={o}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              pick(key, o);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-all ${
                              isSel
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "text-slate-300 hover:bg-white/5"
                            }`}
                          >
                            <span className="truncate">{o}</span>
                            {isSel && <Check size={13} className="text-emerald-400 flex-shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    )}
                    {isNew && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onChange({ ...value });
                          setOpen(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left text-emerald-400 font-bold bg-emerald-500/5 hover:bg-emerald-500/10 transition-all border-t border-[#21293d] mt-1"
                      >
                        <Plus size={13} className="flex-shrink-0" />
                        <span className="truncate">Add &quot;{value[key].trim()}&quot;</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {locPath(value) && (
        <p className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
          <ChevronDown size={11} className="text-emerald-500/60 rotate-180" />
          Save hone par label: <span className="text-slate-400 font-mono">{locPath(value)}</span>
        </p>
      )}
    </div>
  );
}
