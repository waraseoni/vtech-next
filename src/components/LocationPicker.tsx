"use client";
import { useId } from "react";
import { MapPin, History, ChevronRight } from "lucide-react";
import { locPath, type LocationParts } from "@/lib/locations";

type Suggestions = { zone: string[]; rack: string[]; bin: string[]; box: string[] };

const EMPTY_SUGGESTIONS: Suggestions = { zone: [], rack: [], bin: [], box: [] };

interface LocationPickerProps {
  value: LocationParts;
  onChange: (p: LocationParts) => void;
  suggestions?: Suggestions | null;
  /** Last location is product pe istemal hui — "Use last" chip ke liye. */
  lastUsed?: LocationParts | null;
  /** Compact variant (QuickScan modal jaise chhote dialogs). */
  compact?: boolean;
}

/**
 * Structured location picker: Zone ▸ Rack ▸ Bin ▸ Box.
 * Har field pe datalist se pehle use hue options dikhte hain.
 */
export default function LocationPicker({
  value,
  onChange,
  suggestions = null,
  lastUsed = null,
  compact = false,
}: LocationPickerProps) {
  const baseId = useId();
  const sug = suggestions || EMPTY_SUGGESTIONS;
  const lastPath = lastUsed && locPath(lastUsed);

  const set = (key: keyof LocationParts) => (raw: string) =>
    onChange({ ...value, [key]: raw });

  const fields: { key: keyof LocationParts; label: string; placeholder: string; weight?: string }[] = [
    { key: "zone", label: "Zone / Area", placeholder: "e.g. Main Shop, Store Room", weight: "sm:col-span-2" },
    { key: "rack", label: "Rack / Shelf", placeholder: "e.g. Rack 1, Shelf A", weight: "" },
    { key: "bin",  label: "Bin / Section", placeholder: "e.g. Bin 3", weight: "" },
    { key: "box",  label: "Box / Drawer", placeholder: "e.g. Box B2", weight: "sm:col-span-2" },
  ];

  return (
    <div className="space-y-2.5">
      {/* Preview + last-used chip */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={12} className="text-emerald-500 flex-shrink-0" />
          <span className={`font-bold truncate ${locPath(value) ? "text-emerald-400" : "text-slate-600"}`}>
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
        {fields.map(({ key, label, placeholder, weight }) => {
          const listId = `${baseId}-${key}`;
          const opts = (sug[key] || []).filter(o => o && o.toLowerCase() !== value[key].toLowerCase());
          return (
            <div key={key} className={weight}>
              <label className={`block font-extrabold uppercase tracking-widest text-slate-600 ${compact ? "text-[8px] mb-1" : "text-[9px] mb-1.5"}`}>
                {label}
              </label>
              <input
                list={listId}
                type="text"
                value={value[key]}
                onChange={e => set(key)(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-[#111520] border border-[#21293d] text-slate-200 placeholder-slate-700 rounded-xl outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all text-sm ${
                  compact ? "px-3 py-2" : "px-3.5 py-2.5"
                }`}
              />
              <datalist id={listId}>
                {opts.slice(0, 12).map(o => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
          );
        })}
      </div>

      {locPath(value) && (
        <p className="flex items-center gap-1 text-[10px] text-slate-600 font-bold">
          <ChevronRight size={11} className="text-emerald-500/60" />
          Save hone par label: <span className="text-slate-400 font-mono">{locPath(value)}</span>
        </p>
      )}
    </div>
  );
}
