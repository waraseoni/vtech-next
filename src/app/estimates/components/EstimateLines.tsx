"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { lineAmount, type EstimateLine } from "@/lib/estimate";

const KIND_LABEL: Record<EstimateLine["kind"], string> = {
  inventory: "Inventory",
  custom_part: "Part",
  service: "Service",
  custom_service: "Service",
};

const KIND_CLS: Record<EstimateLine["kind"], string> = {
  inventory: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  custom_part: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  service: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  custom_service: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const cellCls =
  "w-full bg-transparent text-sm text-white outline-none focus:text-blue-300 transition-colors placeholder:text-muted-2";

const numCellCls = `${cellCls} text-right font-black text-emerald-400 focus:text-emerald-300`;

const actionBtn =
  "w-7 h-7 inline-flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

const inr = (n: number) => `₹${n.toFixed(2)}`;

type Props = {
  lines: EstimateLine[];
  /** product_id → available stock (read-only display; estimate kabhi deduct nahi karta). */
  stock: Map<number, number>;
  onChange: (id: string, patch: Partial<EstimateLine>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
};

function stockNote(line: EstimateLine, stock: Map<number, number>) {
  if (line.kind !== "inventory" || line.product_id == null) return null;
  const avail = stock.get(line.product_id);
  if (avail === undefined) return null;
  const over = line.qty > avail;
  return (
    <p className={`text-[10px] mt-0.5 ${over ? "text-amber-400" : "text-muted-2"}`}>
      Stock: {avail}
      {over ? " — estimate stock reserve nahi karta" : ""}
    </p>
  );
}

export default function EstimateLines({ lines, stock, onChange, onRemove, onMove }: Props) {
  if (lines.length === 0) {
    return (
      <div className="border border-dashed border-app rounded-xl px-4 py-10 text-center">
        <p className="text-app text-sm font-bold">Koi item add nahi kiya</p>
        <p className="text-muted-2 text-xs mt-1">
          Upar se inventory item, service, custom part ya custom service add karo.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop table ── */}
      <div className="hidden md:block border border-app rounded-xl overflow-hidden">
        <div className="grid grid-cols-[24px_1fr_70px_100px_100px_84px] gap-2 bg-panel-2 px-3 py-2 items-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-2">#</span>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-2">Item</span>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-2 text-right">
            Qty
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-2 text-right">
            Rate
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-2 text-right">
            Amount
          </span>
          <span />
        </div>
        {lines.map((r, i) => (
          <div
            key={r.id}
            className="grid grid-cols-[24px_1fr_70px_100px_100px_84px] gap-2 items-center px-3 py-2 border-t border-app hover:bg-white/[0.02]"
          >
            <span className="text-[10px] text-muted-2 font-bold">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${KIND_CLS[r.kind]}`}
                >
                  {KIND_LABEL[r.kind]}
                </span>
                <input
                  value={r.name}
                  onChange={(e) => onChange(r.id, { name: e.target.value })}
                  placeholder="Item / service ka naam"
                  maxLength={200}
                  className={cellCls}
                />
              </div>
              {stockNote(r, stock)}
            </div>
            <input
              type="number"
              min={0}
              step="0.01"
              value={r.qty}
              onChange={(e) => onChange(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
              className={numCellCls}
            />
            <input
              type="number"
              min={0}
              step="0.01"
              value={r.rate}
              onChange={(e) => onChange(r.id, { rate: Math.max(0, Number(e.target.value) || 0) })}
              className={numCellCls}
            />
            <span className="text-emerald-400 text-xs font-black text-right pr-1">
              {inr(lineAmount(r))}
            </span>
            <div className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => onMove(r.id, -1)}
                disabled={i === 0}
                className={actionBtn}
                aria-label="Upar le jao"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => onMove(r.id, 1)}
                disabled={i === lines.length - 1}
                className={actionBtn}
                aria-label="Neeche le jao"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-app hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden space-y-2">
        {lines.map((r, i) => (
          <div key={r.id} className="border border-app rounded-xl bg-panel-2 p-3">
            <div className="flex items-start gap-2">
              <span
                className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 mt-1 ${KIND_CLS[r.kind]}`}
              >
                {KIND_LABEL[r.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <input
                  value={r.name}
                  onChange={(e) => onChange(r.id, { name: e.target.value })}
                  placeholder="Item / service ka naam"
                  maxLength={200}
                  className={`${cellCls} font-bold`}
                />
                {stockNote(r, stock)}
              </div>
              <span className="text-emerald-400 text-xs font-black">{inr(lineAmount(r))}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-2">
                  Qty
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.qty}
                  onChange={(e) =>
                    onChange(r.id, { qty: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={`${numCellCls} bg-panel border border-app rounded-lg px-2 py-1.5`}
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-2">
                  Rate
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.rate}
                  onChange={(e) =>
                    onChange(r.id, { rate: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className={`${numCellCls} bg-panel border border-app rounded-lg px-2 py-1.5`}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-1 mt-2">
              <button
                type="button"
                onClick={() => onMove(r.id, -1)}
                disabled={i === 0}
                className={actionBtn}
                aria-label="Upar le jao"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onMove(r.id, 1)}
                disabled={i === lines.length - 1}
                className={actionBtn}
                aria-label="Neeche le jao"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-app hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
