"use client";

// ─── DeviceIdentityFields — Item → Brand → Model → Identifier (shared) ───────
// P3: old forms (2 copies) aur bulk/bulk-edit me yahi block use hota hai —
// copy-paste drift na ho. Identifier HAR ITEM KE LIYE UNIQUE hota hai, isliye
// uska dropdown/master nahi — seedha type karne wala optional text input hai.

import { AlertCircle, Smartphone } from "lucide-react";
import DeviceFieldPicker, { type DeviceOption } from "@/components/DeviceFieldPicker";
import {
  clampJobItemLabel,
  composeJobItemLabel,
  labelShrinks,
  normalizeIdentifier,
  type DeviceFieldValues,
} from "@/lib/deviceIdentity";
import { toast } from "@/lib/toast";

type Props = {
  value: DeviceFieldValues;
  onChange: (next: DeviceFieldValues) => void;
  /** Server seed se options; na ho to picker khud active masters fetch karta hai. */
  brandOptions?: DeviceOption[];
  modelOptions?: DeviceOption[];
  /** Bulk jaise compact forms ke liye chhota padding. */
  compact?: boolean;
};

const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-muted mb-1";
const inputCls =
  "w-full px-2.5 py-2 bg-app border border-app rounded-lg text-xs text-white outline-none focus:border-blue-500/60";

export default function DeviceIdentityFields({
  value,
  onChange,
  brandOptions,
  modelOptions,
  compact = false,
}: Props) {
  const patch = (p: Partial<DeviceFieldValues>) => onChange({ ...value, ...p });

  const composed = composeJobItemLabel({
    item: value.itemName,
    brand: value.brandName,
    model: value.model,
    identifier: value.serial,
  });
  const finalItem = clampJobItemLabel(value.customMode ? value.item : composed || value.item);
  const shrink =
    !value.customMode &&
    labelShrinks({
      item: value.itemName,
      brand: value.brandName,
      model: value.model,
      identifier: value.serial,
      legacyItem: value.item,
    });

  return (
    <div className={`rounded-xl border border-app bg-panel-2/40 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300 flex items-center gap-1.5">
          <Smartphone size={13} /> Device Identity
        </p>
        <span className="text-[10px] text-muted-2">
          Item → Brand → Model → Identifier · list me na ho to &quot;+&quot; se add karo
        </span>
      </div>

      {/* 1) ITEM — kya cheez hai. Brand/model/identifier aur preview neeche. */}
      <div className="mb-3">
        <label className={labelCls}>
          <Smartphone size={12} className="inline mr-1 text-blue-400" /> Item *
        </label>
        <input
          value={value.itemName}
          onChange={(e) => patch({ itemName: e.target.value })}
          placeholder="Kya cheez hai? e.g. Ceiling Fan / Mobile / Charger"
          className={`${inputCls} mt-1.5`}
        />
      </div>

      {/* 2) BRAND → 3) MODEL → 4) IDENTIFIER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-app">
        <div>
          <label className={labelCls}>Brand</label>
          <DeviceFieldPicker
            kind="brand"
            value={value.brandId}
            options={brandOptions}
            onSelect={(id, label) => {
              const nextId = typeof id === "number" ? id : null;
              const clearModel = Boolean(value.brandId && nextId !== value.brandId && value.model);
              // Ek hi patch — do patch karne par doosra stale `value` se
              // overwrite kar deta hai aur model clear nahi hota.
              patch({
                brandId: nextId,
                brandName: label,
                model: clearModel ? "" : value.model,
              });
              if (clearModel) toast.info("Brand badla — model clear kar diya.");
            }}
          />
        </div>
        <div>
          <label className={labelCls}>Model</label>
          <DeviceFieldPicker
            kind="model"
            value={value.model}
            brandId={value.brandId}
            options={modelOptions}
            onSelect={(_v, label) => patch({ model: label })}
          />
        </div>
        <div>
          <label className={labelCls}>Identifier (Serial / IMEI) — optional</label>
          <input
            type="text"
            value={value.serial}
            onChange={(e) => patch({ serial: e.target.value })}
            onBlur={(e) => patch({ serial: normalizeIdentifier(e.target.value) })}
            placeholder="Type karein (har item ka unique)"
            maxLength={120}
            className={inputCls}
          />
        </div>
      </div>

      {/* Preview + advanced override — CHAR FIELDS KE BAAD, summary ki tarah. */}
      <div className="mt-3 rounded-lg border border-app bg-app/60 px-2.5 py-1.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-2">
            Final label (bill · WhatsApp · reports)
          </p>
          <button
            type="button"
            onClick={() => patch({ customMode: !value.customMode })}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {value.customMode ? "Wapas auto banayein" : "Advanced: khud ka label"}
          </button>
        </div>
        {value.customMode && (
          <div className="mt-2">
            <input
              value={value.item}
              onChange={(e) => patch({ item: e.target.value })}
              placeholder="Advanced: poora label likhein (identifier isme nahi aayega)"
              className={inputCls}
            />
            <p className="text-[10px] text-amber-400 mt-1">
              Advanced override: bill/WhatsApp par yahi text dikhega. Identifier DB aur Device
              Identity card me rahega, par label se chhoot jayega.
            </p>
          </div>
        )}
        <p className="mt-1 text-xs font-semibold text-white break-words" title={finalItem}>
          {finalItem || "—"}
        </p>
        {!value.customMode && (
          <p className="text-[10px] text-muted-2 mt-1">
            Item → Brand → Model → Identifier — sab ek hi label me.
          </p>
        )}
        {shrink && (
          <p className="text-[11px] text-amber-400 mt-1 flex items-start gap-1.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            Purana item text chhota ho jayega — zaroori dikhe to &quot;Advanced: khud ka label&quot;
            dabayein.
          </p>
        )}
      </div>
    </div>
  );
}
