"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MapPin, History, ChevronDown, Check, Settings2, Hash, AlertTriangle } from "lucide-react";
import { locPath, type LocationParts } from "@/lib/locations";

export type Hierarchy = {
  zones: { id: number; name: string }[];
  racks: { id: number; name: string; zone_id: number }[];
  bins: { id: number; name: string; rack_id: number }[];
  boxes: { id: number; name: string; bin_id: number }[];
};

const EMPTY_HIERARCHY: Hierarchy = { zones: [], racks: [], bins: [], boxes: [] };

interface LocationPickerProps {
  value: LocationParts;
  onChange: (p: LocationParts) => void;
  /** Normalized hierarchy (zone→rack→bin→box) with parent links — cascading ke liye. */
  hierarchy?: Hierarchy | null;
  /** Last location is product pe istemal hui — "Use last" chip ke liye. */
  lastUsed?: LocationParts | null;
  /** Compact variant (QuickScan modal jaise chhote dialogs). */
  compact?: boolean;
}

type FieldKey = keyof LocationParts;

const FIELD_META: { key: FieldKey; label: string; placeholder: string; weight?: string }[] = [
  { key: "zone", label: "Zone / Area", placeholder: "Type to search zone...", weight: "sm:col-span-2" },
  { key: "rack", label: "Rack / Shelf", placeholder: "Type to search rack...", weight: "" },
  { key: "bin", label: "Bin / Section", placeholder: "Type to search bin...", weight: "" },
  { key: "box", label: "Box / Drawer", placeholder: "Type to search box...", weight: "sm:col-span-2" },
];

/** Hierarchy IDs se code banata hai — Z1-R3-B2-X5 format me. */
function genCode(ids: { zone?: number; rack?: number; bin?: number; box?: number }): string {
  const segs: string[] = [];
  if (ids.zone) segs.push(`Z${ids.zone}`);
  if (ids.rack) segs.push(`R${ids.rack}`);
  if (ids.bin) segs.push(`B${ids.bin}`);
  if (ids.box) segs.push(`X${ids.box}`);
  return segs.join("-");
}

/**
 * Structured cascading location picker: Zone ▸ Rack ▸ Bin ▸ Box.
 *
 *  • Type-to-search: har selector me type karke options filter kar sakte ho.
 *  • Parent → Child: parent select karo to uske children dikhenge.
 *  • Child → Parent: seedha child chuno to uske parents auto-fill ho jayenge.
 *  • Code: selected location ka code (Z1-R3-B2-X5) hamesha dikhega.
 *  • Hierarchy me jo nahi hai usko select nahi kar sakte — "Manage Hierarchy" link se banao.
 */
export default function LocationPicker({
  value,
  onChange,
  hierarchy = null,
  lastUsed = null,
  compact = false,
}: LocationPickerProps) {
  const hier = hierarchy || EMPTY_HIERARCHY;
  const lastPath = lastUsed && locPath(lastUsed);

  const [queries, setQueries] = useState<Record<FieldKey, string>>({
    zone: "",
    rack: "",
    bin: "",
    box: "",
  });
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [disambiguate, setDisambiguate] = useState<{
    key: FieldKey;
    name: string;
    options: LocationParts[];
  } | null>(null);
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
  const boxId = hier.boxes.find((x) => x.name === value.box.trim())?.id;

  /** Code from selected hierarchy IDs */
  const locationCode = genCode({ zone: zoneId, rack: rackId, bin: binId, box: boxId });

  /** Selected parent ke hisab se children filter; koi parent na ho to SARE hierarchy options. */
  const childrenFor = (key: FieldKey): string[] => {
    if (key === "zone") {
      return [...new Set(hier.zones.map((z) => z.name))];
    }
    if (key === "rack") {
      const list = zoneId != null ? hier.racks.filter((r) => r.zone_id === zoneId) : hier.racks;
      return [...new Set(list.map((r) => r.name))];
    }
    if (key === "bin") {
      const list = rackId != null ? hier.bins.filter((b) => b.rack_id === rackId) : hier.bins;
      return [...new Set(list.map((b) => b.name))];
    }
    const list = binId != null ? hier.boxes.filter((x) => x.bin_id === binId) : hier.boxes;
    return [...new Set(list.map((x) => x.name))];
  };

  const filtered = (key: FieldKey) => {
    const all = childrenFor(key).sort((a, b) => a.localeCompare(b));
    const q = queries[key].trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => o.toLowerCase().includes(q));
  };

  /** Niche ka item chunne par uski ancestry (zone→rack→bin) auto-fill karo. */
  const withAncestry = (patch: Partial<LocationParts>): LocationParts => {
    let zone = patch.zone ?? value.zone;
    let rack = patch.rack ?? value.rack;
    let bin = patch.bin ?? value.bin;
    const box = patch.box ?? value.box ?? "";

    if (box) {
      const curBinId = bin ? hier.bins.find((b) => b.name === bin)?.id : undefined;
      let boxRec = curBinId != null
        ? hier.boxes.find((x) => x.name === box && x.bin_id === curBinId)
        : undefined;
      if (!boxRec) boxRec = hier.boxes.find((x) => x.name === box);
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
      const curRackId = rack ? hier.racks.find((r) => r.name === rack)?.id : undefined;
      let binRec = curRackId != null
        ? hier.bins.find((b) => b.name === bin && b.rack_id === curRackId)
        : undefined;
      if (!binRec) binRec = hier.bins.find((b) => b.name === bin);
      if (binRec) {
        const rackRec = hier.racks.find((r) => r.id === binRec.rack_id);
        if (rackRec) {
          rack = rackRec.name;
          const zoneRec = hier.zones.find((z) => z.id === rackRec.zone_id);
          if (zoneRec) zone = zoneRec.name;
        }
      }
    } else if (rack) {
      const curZoneId = zone ? hier.zones.find((z) => z.name === zone)?.id : undefined;
      let rackRec = curZoneId != null
        ? hier.racks.find((r) => r.name === rack && r.zone_id === curZoneId)
        : undefined;
      if (!rackRec) rackRec = hier.racks.find((r) => r.name === rack);
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
      onChange(next);
      setQueries((q) => ({ ...q, [key]: "" }));
      setOpen(null);
      return;
    }

    // Ambiguity check: kya ye naam multiple parents ke under hai?
    if (!isClearAll) {
      let matches: LocationParts[] = [];
      if (key === "rack") {
        const racks = hier.racks.filter((r) => r.name === name);
        if (zoneId) {
          // Parent selected — exact match check
          const exact = racks.find((r) => r.zone_id === zoneId);
          if (!exact && racks.length > 0) {
            // Name exists but not under selected zone — disambiguate
            matches = racks.map((r) => {
              const z = hier.zones.find((zz) => zz.id === r.zone_id);
              return { zone: z?.name || "", rack: name, bin: "", box: "" };
            });
          }
        } else if (racks.length > 1) {
          // No parent selected, multiple matches
          matches = racks.map((r) => {
            const z = hier.zones.find((zz) => zz.id === r.zone_id);
            return { zone: z?.name || "", rack: name, bin: "", box: "" };
          });
        }
      } else if (key === "bin") {
        const bins = hier.bins.filter((b) => b.name === name);
        if (rackId) {
          const exact = bins.find((b) => b.rack_id === rackId);
          if (!exact && bins.length > 0) {
            matches = bins.map((b) => {
              const r = hier.racks.find((rr) => rr.id === b.rack_id);
              const z = r ? hier.zones.find((zz) => zz.id === r.zone_id) : undefined;
              return { zone: z?.name || "", rack: r?.name || "", bin: name, box: "" };
            });
          }
        } else if (bins.length > 1) {
          matches = bins.map((b) => {
            const r = hier.racks.find((rr) => rr.id === b.rack_id);
            const z = r ? hier.zones.find((zz) => zz.id === r.zone_id) : undefined;
            return { zone: z?.name || "", rack: r?.name || "", bin: name, box: "" };
          });
        }
      } else if (key === "box") {
        const boxes = hier.boxes.filter((x) => x.name === name);
        if (binId) {
          const exact = boxes.find((x) => x.bin_id === binId);
          if (!exact && boxes.length > 0) {
            matches = boxes.map((x) => {
              const b = hier.bins.find((bb) => bb.id === x.bin_id);
              const r = b ? hier.racks.find((rr) => rr.id === b.rack_id) : undefined;
              const z = r ? hier.zones.find((zz) => zz.id === r.zone_id) : undefined;
              return { zone: z?.name || "", rack: r?.name || "", bin: b?.name || "", box: name };
            });
          }
        } else if (boxes.length > 1) {
          matches = boxes.map((x) => {
            const b = hier.bins.find((bb) => bb.id === x.bin_id);
            const r = b ? hier.racks.find((rr) => rr.id === b.rack_id) : undefined;
            const z = r ? hier.zones.find((zz) => zz.id === r.zone_id) : undefined;
            return { zone: z?.name || "", rack: r?.name || "", bin: b?.name || "", box: name };
          });
        }
      }

      if (matches.length > 1) {
        // Ambiguous — disambiguation modal dikhao
        setDisambiguate({ key, name, options: matches });
        setQueries((q) => ({ ...q, [key]: "" }));
        setOpen(null);
        return;
      }
    }

    // Not ambiguous — apply directly
    if (key === "rack") {
      next = withAncestry({ rack: name, bin: "", box: "" });
      next = { ...next, bin: "", box: "" };
    } else if (key === "bin") {
      next = withAncestry({ bin: name, box: "" });
      next = { ...next, box: "" };
    } else {
      next = withAncestry({ box: name });
    }
    onChange(next);
    setQueries((q) => ({ ...q, [key]: "" }));
    setOpen(null);
  };

  /** Disambiguation modal se parent choose karne par */
  const resolveAmbiguity = (chosen: LocationParts) => {
    if (!disambiguate) return;
    const { key } = disambiguate;
    let next: LocationParts;
    if (key === "rack") {
      next = withAncestry({ zone: chosen.zone, rack: chosen.rack, bin: "", box: "" });
      next = { ...next, bin: "", box: "" };
    } else if (key === "bin") {
      next = withAncestry({ zone: chosen.zone, rack: chosen.rack, bin: chosen.bin, box: "" });
      next = { ...next, box: "" };
    } else {
      next = withAncestry({ zone: chosen.zone, rack: chosen.rack, bin: chosen.bin, box: chosen.box });
    }
    onChange(next);
    setDisambiguate(null);
  };

  return (
    <div className="space-y-2.5">
      {/* Preview + last-used chip + manage link */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={12} className="text-emerald-500 flex-shrink-0" />
          <span
            className={`font-bold truncate ${locPath(value) ? "text-emerald-400" : "text-slate-600"}`}
          >
            {locPath(value) || "Location abhi set nahi hai"}
          </span>
          {locationCode && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex-shrink-0">
              <Hash size={9} /> {locationCode}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <Link
            href="/inventory/locations/manage"
            target="_blank"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[10px] font-extrabold hover:bg-blue-500/20 transition-all"
            title="Naya zone/rack/bin/box yahan se banao"
          >
            <Settings2 size={10} /> Manage Hierarchy
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-4 gap-2 ${compact ? "" : "gap-2.5"}`}>
        {FIELD_META.map(({ key, label, placeholder, weight }) => {
          const listId = `${listIdBase}-${key}`;
          const options = filtered(key);
          const isOpen = open === key;
          const q = queries[key];
          const displayValue = isOpen && q ? q : value[key];
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
                  value={displayValue}
                  onChange={(e) => {
                    setQueries((q) => ({ ...q, [key]: e.target.value }));
                    if (!isOpen) setOpen(key);
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
                    {/* Clear option */}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(key, "");
                      }}
                      className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-left text-slate-500 hover:bg-white/5 transition-all"
                    >
                      — Clear —
                    </button>
                    {options.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-slate-600">
                        {q ? `"${q}" jaisa koi option nahi` : "Hierarchy me koi entry nahi hai"}
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
          {locationCode && (
            <> | Code: <span className="text-emerald-400 font-mono">{locationCode}</span></>
          )}
        </p>
      )}

      {/* ── Disambiguation Modal ── */}
      {disambiguate && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#21293d]">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Multiple locations found</h3>
                <p className="text-[10px] text-slate-600 font-bold">
                  &quot;{disambiguate.name}&quot; multiple jagah hai — sahi chuno:
                </p>
              </div>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
              {disambiguate.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => resolveAmbiguity(opt)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin size={12} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-200">{locPath(opt)}</span>
                  </div>
                  <ChevronDown size={12} className="text-slate-700 rotate-[-90deg] flex-shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-[#21293d]">
              <button
                onClick={() => setDisambiguate(null)}
                className="w-full py-2 bg-[#111520] hover:bg-white/5 border border-[#21293d] text-slate-500 hover:text-slate-300 rounded-xl font-bold text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
