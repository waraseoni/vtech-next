"use client";

import { Info, Percent, IndianRupee, ShieldCheck } from "lucide-react";
import {
  GST_RATES,
  lineAmount,
  type EstimateForm,
  type EstimateTotals as Totals,
} from "@/lib/estimate";
import { numberToWords } from "@/lib/numberToWords";

const inr = (n: number) => `₹${n.toFixed(2)}`;
const labelCls = "block text-[10px] font-black uppercase tracking-[0.18em] text-muted mb-1.5";
const inputCls =
  "w-full bg-panel-2 border border-app rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-muted-2";

type Props = {
  form: EstimateForm;
  totals: Totals;
  onChange: (patch: Partial<EstimateForm>) => void;
};

export default function EstimateTotals({ form, totals, onChange }: Props) {
  const lineCount = form.lines.filter((l) => l.name.trim() || lineAmount(l) > 0).length;

  return (
    <div className="bg-panel rounded-2xl border border-app p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Totals</p>
        <span className="text-[10px] font-bold text-muted-2">
          {lineCount} item{lineCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Discount */}
      <div>
        <label className={labelCls}>Discount</label>
        <div className="flex gap-2">
          <div className="flex rounded-xl border border-app overflow-hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => onChange({ discountType: "amount" })}
              className={`px-3 text-xs font-black inline-flex items-center gap-1 transition-colors ${
                form.discountType === "amount"
                  ? "bg-blue-600/20 text-blue-300"
                  : "bg-panel-2 text-muted hover:text-white"
              }`}
              title="Rupees me discount"
            >
              <IndianRupee size={12} /> ₹
            </button>
            <button
              type="button"
              onClick={() => onChange({ discountType: "percent" })}
              className={`px-3 text-xs font-black inline-flex items-center gap-1 border-l border-app transition-colors ${
                form.discountType === "percent"
                  ? "bg-blue-600/20 text-blue-300"
                  : "bg-panel-2 text-muted hover:text-white"
              }`}
              title="Percent me discount"
            >
              <Percent size={12} /> %
            </button>
          </div>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.discountValue}
            onChange={(e) => onChange({ discountValue: Math.max(0, Number(e.target.value) || 0) })}
            className={inputCls}
            placeholder="0"
          />
        </div>
      </div>

      {/* GST */}
      <div className="border-t border-app pt-4">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-bold text-white">GST lagao</span>
          <input
            type="checkbox"
            checked={form.gstEnabled}
            onChange={(e) => onChange({ gstEnabled: e.target.checked })}
            className="w-4 h-4 accent-emerald-500 cursor-pointer"
          />
        </label>
        {form.gstEnabled && (
          <div className="mt-2">
            <label className={labelCls}>GST rate</label>
            <div className="grid grid-cols-4 gap-1.5">
              {GST_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ gstRate: r })}
                  className={`py-2 rounded-lg text-xs font-black border transition-colors ${
                    form.gstRate === r
                      ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
                      : "bg-panel-2 text-muted border-app hover:text-white"
                  }`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Amount rows */}
      <div className="border-t border-app pt-3 space-y-1.5 text-sm">
        <Row label="Subtotal" value={inr(totals.subtotal)} />
        {totals.discountAmount > 0 && (
          <Row label="Discount" value={`− ${inr(totals.discountAmount)}`} muted />
        )}
        {(totals.discountAmount > 0 || form.gstEnabled) && (
          <Row label="Taxable" value={inr(totals.taxable)} muted />
        )}
        {form.gstEnabled && (
          <>
            <Row label={`CGST @ ${form.gstRate / 2}%`} value={inr(totals.cgst)} muted />
            <Row label={`SGST @ ${form.gstRate / 2}%`} value={inr(totals.sgst)} muted />
          </>
        )}
        {totals.roundOff !== 0 && (
          <Row
            label="Round off"
            value={`${totals.roundOff > 0 ? "+" : "−"} ${inr(Math.abs(totals.roundOff))}`}
            muted
          />
        )}
        <div className="flex items-center justify-between pt-2 border-t border-app">
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Grand Total
          </span>
          <span className="text-lg font-black text-emerald-400">{inr(totals.grandTotal)}</span>
        </div>
        <p className="text-[11px] text-muted-2 leading-relaxed pt-1">
          {numberToWords(totals.grandTotal)}
        </p>
      </div>

      <div className="rounded-xl bg-amber-500/10 border border-amber-600/35 dark:border-amber-500/25 px-3 py-2.5 space-y-1">
        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1.5">
          <Info size={12} /> Ye estimate hai
        </p>
        <p className="text-[11px] text-amber-700 dark:text-amber-200/80 leading-relaxed font-medium flex items-start gap-1.5">
          <ShieldCheck size={11} className="mt-0.5 flex-shrink-0" />
          Stock deduct nahi hota aur koi amount client ke khate me debit nahi hota.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? "text-muted" : "text-app-2"}`}>{label}</span>
      <span className={`text-xs font-bold ${muted ? "text-app-2" : "text-white"}`}>{value}</span>
    </div>
  );
}
