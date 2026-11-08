"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

export const inputCls =
  "w-full min-h-10 px-3.5 py-2.5 bg-app border border-app rounded-xl text-[13px] text-white font-medium placeholder:text-muted-2 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all";
export const labelCls = "block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
      {hint && <p className="text-[10px] text-muted-2 mt-1">{hint}</p>}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${inputCls} resize-y`}
      />
      {hint && <p className="text-[10px] text-muted-2 mt-1">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  hint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint && <p className="text-[10px] text-muted-2 mt-1">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-app bg-app/40 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-blue-500"
      />
      <span>
        <span className="block text-[12px] font-bold text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-[10px] text-muted-2">{hint}</span>}
      </span>
    </label>
  );
}

export function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-app bg-panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-black uppercase tracking-widest text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AddButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold disabled:opacity-40"
    >
      <Plus size={12} /> {label}
    </button>
  );
}

export function ListCard({
  index,
  count,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel,
  children,
}: {
  index: number;
  count: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-app bg-app/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-2">
          #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-lg border border-white/10 p-1.5 text-muted disabled:opacity-30"
            aria-label={`Move ${removeLabel} up`}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === count - 1}
            className="rounded-lg border border-white/10 p-1.5 text-muted disabled:opacity-30"
            aria-label={`Move ${removeLabel} down`}
          >
            <ChevronDown size={12} />
          </button>
          <button
            onClick={onRemove}
            className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-400"
            aria-label={`Remove ${removeLabel}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
