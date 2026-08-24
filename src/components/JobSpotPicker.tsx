"use client";

// ─── JobSpotPicker — job items ke temporary spots ka picker ───────────────
// locations table (kind='job') se spots + live occupancy counts dikhata hai.
// Sabse khali spot pehle (slot-suggestion). "+ Naya Spot" se turant naya
// counter/shelf add ho jaye. Dual-write ke liye onSelect me id + naam dono milte
// hain — parent `uniq_id` (readable path) khud likh lega.

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, X } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { supabase } from "@/lib/supabase";

export type JobSpot = { id: number; name: string };

type Props = {
  value: number | null;
  /** id=null → cleared. spot = selected row (naam dual-write ke liye). */
  onSelect: (id: number | null, spot: JobSpot | null) => void;
};

export default function JobSpotPicker({ value, onSelect }: Props) {
  const [spots, setSpots] = useState<JobSpot[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSpots = useCallback(async () => {
    setLoading(true);
    const [locRes, occRes] = await Promise.all([
      supabase.from("locations").select("id, rack").eq("kind", "job").eq("zone", "").order("rack"),
      // Live occupancy: delivered/cancelled items spot khaali maane jate hain
      supabase.from("transaction_list")
        .select("location_id")
        .eq("del_status", 0)
        .not("status", "in", "(4,5)")
        .not("location_id", "is", null),
    ]);
    const c: Record<number, number> = {};
    (occRes.data || []).forEach(r => {
      const lid = r.location_id as number;
      c[lid] = (c[lid] || 0) + 1;
    });
    const list: JobSpot[] = (locRes.data || []).map(l => ({ id: l.id, name: l.rack || "" }));
    setCounts(c);
    setSpots(list);
    setLoading(false);
  }, []);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  const options = [
    ...[...spots]
      .sort((a, b) => (counts[a.id] || 0) - (counts[b.id] || 0) || a.name.localeCompare(b.name))
      .map(s => ({
        id: s.id,
        label: s.name,
        sub: `${counts[s.id] || 0} item${(counts[s.id] || 0) === 1 ? "" : "s"}`,
      })),
  ];

  const createSpot = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    // Same-naam spot dobara na bane
    const { data: existing } = await supabase
      .from("locations")
      .select("id, rack")
      .eq("kind", "job")
      .ilike("rack", name)
      .eq("zone", "")
      .maybeSingle();
    if (existing) {
      onSelect(existing.id, { id: existing.id, name: existing.rack || name });
    } else {
      const { data: created, error } = await supabase
        .from("locations")
        .insert({ zone: "", rack: name, bin: "", box: "", kind: "job" })
        .select("id, rack")
        .single();
      if (error) {
        alert("Spot nahi bana: " + error.message);
        setSaving(false);
        return;
      }
      if (created) {
        setSpots(prev => [...prev, { id: created.id, name: created.rack || name }]);
        onSelect(created.id, { id: created.id, name: created.rack || name });
      }
    }
    setSaving(false);
    setNewOpen(false);
    setNewName("");
  };

  const selected = spots.find(s => s.id === value) || null;

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <SearchableSelect
          value={value}
          options={loading ? [] : options}
          onSelect={id => {
            if (!id) { onSelect(null, null); return; }
            const s = spots.find(x => x.id === Number(id)) || null;
            onSelect(s ? s.id : null, s);
          }}
          placeholder={loading ? "Loading…" : "— Spot chuno (Shelf A3…) —"}
          searchPlaceholder="Spot dhundo…"
          emptyText="Koi spot nahi — '+' se naya banao"
          clearLabel="Location hatao"
          renderSelected={() =>
            selected ? (
              <span className="flex items-center gap-1.5 truncate">
                <MapPin size={13} className="text-amber-400 flex-shrink-0" />
                <span className="truncate">{selected.name}</span>
              </span>
            ) : null
          }
        />
      </div>
      <button
        type="button"
        onClick={() => setNewOpen(true)}
        title="Naya spot banao"
        className="flex-shrink-0 w-10 self-stretch rounded-lg border border-[#21293d] bg-[#0d1117] hover:border-blue-500 flex items-center justify-center transition-colors"
      >
        <Plus size={15} className="text-blue-400" />
      </button>

      {newOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setNewOpen(false)}>
          <div className="w-full max-w-xs bg-[#161b27] border border-[#21293d] rounded-2xl p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-white text-sm">Naya Spot</p>
              <button onClick={() => !saving && setNewOpen(false)} className="text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !saving) createSpot(); }}
              placeholder="e.g. Counter 2, Shelf C1"
              className="w-full bg-[#0d1117] border border-[#21293d] rounded-lg px-3 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
            />
            <button
              onClick={createSpot}
              disabled={!newName.trim() || saving}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 !text-white font-bold text-xs py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Banao aur Select karo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
