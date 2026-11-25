"use client";

// ─── DeviceFieldPicker — dropdown + inline "add new" ───────────────────────
// UX plan §4.2: repo ka existing JobSpotPicker pattern (dedupe → insert →
// local append → auto-select → toast) bilkul copy. SearchableSelect hi base
// hai, naya custom combobox nahi banaya.
//
// Brand → `brand_id` (FK id) return karta hai.
// Model / Identifier → TEXT value return karte hain (DB columns text hain).

import { useEffect, useMemo, useState } from "react";
import { Box, Hash, Loader2, Plus, Tag, X } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import { normalizeIdentifier } from "@/lib/deviceIdentity";

export type DeviceOption = { id: number; label: string; sub?: string };

type Kind = "brand" | "model" | "identifier";

/**
 * Dynamic table/column naam Supabase ke generated types me parser error banate
 * hain. Tinyoon table ka same shape hai — isliye yahan loose (par typed) client.
 */
type LooseRow = Record<string, unknown>;
type LooseListResult = { data: LooseRow[] | null; error: { message: string } | null };
type LooseSingleResult = { data: LooseRow | null; error: { message: string } | null };
type LooseBuilder = {
  select: (cols: string) => LooseBuilder;
  eq: (col: string, val: unknown) => LooseBuilder;
  ilike: (col: string, val: string) => LooseBuilder;
  order: (col: string) => LooseBuilder;
  insert: (payload: Record<string, unknown>) => LooseBuilder;
  maybeSingle: () => Promise<LooseSingleResult>;
  single: () => Promise<LooseSingleResult>;
  then: (onfulfilled: (value: LooseListResult) => unknown) => PromiseLike<unknown>;
};
const db = supabase as unknown as { from: (table: string) => LooseBuilder };

type Props = {
  kind: Kind;
  /** Brand = numeric id; model/identifier = text value. */
  value: string | number | null;
  /** Model add karte waqt brand link (optional). */
  brandId?: number | null;
  /** Server seed se preloaded options (jobs/new + edit). Empty ho to self-fetch. */
  options?: DeviceOption[];
  onSelect: (value: string | number | null, label: string) => void;
  placeholder?: string;
};

const TABLE: Record<Kind, string> = {
  brand: "brands",
  model: "device_models",
  identifier: "device_identifiers",
};
const COLUMN: Record<Kind, string> = {
  brand: "name",
  model: "name",
  identifier: "value",
};
const LABEL: Record<Kind, string> = {
  brand: "Brand",
  model: "Model",
  identifier: "Identifier",
};
const PLACEHOLDER: Record<Kind, string> = {
  brand: "— Brand chuno —",
  model: "— Model chuno —",
  identifier: "— Identifier chuno —",
};

export default function DeviceFieldPicker({
  kind,
  value,
  brandId,
  options = [],
  onSelect,
  placeholder,
}: Props) {
  const [fetched, setFetched] = useState<DeviceOption[]>([]);
  const [created, setCreated] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(options.length === 0);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed na mile (quick-create / bulk) to component khud active masters laata hai.
  // Table abhi migrate na hui ho to error ignore — forms purane jaisa chalte hain.
  useEffect(() => {
    if (options.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await db
        .from(TABLE[kind])
        .select(`id, ${COLUMN[kind]}`)
        .eq("is_active", true)
        .order(COLUMN[kind]);
      if (!error && !cancelled) {
        setFetched(
          (data ?? []).map((r) => ({
            id: Number(r.id),
            label: String(r[COLUMN[kind]] ?? ""),
          }))
        );
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, options.length]);

  const all = useMemo(() => {
    const map = new Map<number, DeviceOption>();
    [...options, ...fetched, ...created].forEach((o) => map.set(o.id, o));
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [options, fetched, created]);

  const selectValue =
    kind === "brand"
      ? typeof value === "number"
        ? value
        : null
      : typeof value === "string"
        ? value
        : null;

  const selectOptions = all.map((o) => ({
    id: kind === "brand" ? o.id : o.label,
    label: o.label,
  }));
  // Legacy/custom text jo master me nahi — dropdown khali na dikhe.
  if (kind !== "brand" && selectValue && !selectOptions.some((o) => o.id === selectValue)) {
    selectOptions.unshift({ id: selectValue, label: String(selectValue) });
  }

  const createOption = async () => {
    const raw = newName.trim();
    if (!raw) return;
    const name = kind === "identifier" ? normalizeIdentifier(raw) : raw;
    setSaving(true);
    try {
      // JobSpotPicker:73-81 — pehle dedupe, duplicate insert mat karo.
      let q = db.from(TABLE[kind]).select(`id, ${COLUMN[kind]}`).ilike(COLUMN[kind], `%${name}%`);
      if (kind === "model" && brandId) q = q.eq("brand_id", brandId);
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        const label = String(existing[COLUMN[kind]] ?? name);
        onSelect(kind === "brand" ? Number(existing.id) : label, label);
        toast.info("Ye pehle se master me hai — naya duplicate nahi banaya.");
      } else {
        const payload: Record<string, unknown> =
          kind === "brand"
            ? { name }
            : kind === "model"
              ? { name, brand_id: brandId ?? null }
              : { value: name, note: null };
        const { data: row, error } = await db
          .from(TABLE[kind])
          .insert(payload)
          .select(`id, ${COLUMN[kind]}`)
          .single();
        if (error) throw error;
        if (row) {
          const label = String(row[COLUMN[kind]] ?? name);
          setCreated((prev) => [...prev, { id: Number(row.id), label }]);
          onSelect(kind === "brand" ? Number(row.id) : label, label);
          toast.success(`${LABEL[kind]} add ho gaya aur select ho gaya! ✅`);
        }
      }
      setNewOpen(false);
      setNewName("");
    } catch (err) {
      // Office ke bahar writeGuard block karta hai — clear message zaroohi.
      toast.error(
        `${LABEL[kind]} nahi bana: ` + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setSaving(false);
    }
  };

  const Icon = kind === "brand" ? Tag : kind === "model" ? Box : Hash;

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <SearchableSelect
          value={selectValue}
          options={loading ? [] : selectOptions}
          onSelect={(id) => {
            if (!id) {
              onSelect(null, "");
              return;
            }
            if (kind === "brand") {
              const picked = all.find((o) => o.id === Number(id));
              onSelect(picked?.id ?? null, picked?.label ?? "");
            } else {
              onSelect(String(id), String(id));
            }
          }}
          placeholder={loading ? "Loading…" : (placeholder ?? PLACEHOLDER[kind])}
          searchPlaceholder={`${LABEL[kind]} dhundo…`}
          emptyText={`Koi ${LABEL[kind].toLowerCase()} nahi — '+' se naya banao`}
          clearLabel={`${LABEL[kind]} hatao`}
          renderSelected={(opt) =>
            selectValue ? (
              <span className="flex items-center gap-1.5 truncate">
                <Icon size={13} className="text-blue-400 flex-shrink-0" />
                {/* Brand ka value numeric FK id hai — trigger par naam dikhe. */}
                <span className="truncate">{opt.label}</span>
              </span>
            ) : null
          }
        />
      </div>
      <button
        type="button"
        onClick={() => setNewOpen(true)}
        title={`Naya ${LABEL[kind]} banao`}
        className="flex-shrink-0 w-10 self-stretch rounded-lg border border-app bg-app hover:border-blue-500 flex items-center justify-center transition-colors"
      >
        <Plus size={15} className="text-blue-400" />
      </button>

      {newOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setNewOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-panel border border-app rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-white text-sm">Naya {LABEL[kind]}</p>
              <button
                type="button"
                onClick={() => !saving && setNewOpen(false)}
                className="text-muted hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) createOption();
              }}
              placeholder={
                kind === "identifier"
                  ? "e.g. KMK123456789"
                  : kind === "brand"
                    ? "e.g. Komaki"
                    : "e.g. XGT"
              }
              className="w-full bg-app border border-app rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={createOption}
              disabled={!newName.trim() || saving}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 !text-white font-bold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Saving…" : "Banao aur Select karo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
