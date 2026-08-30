"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminPage from "@/app/components/AdminPage";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Loader2,
  Check,
  AlertCircle,
  Layers,
  Grid3X3,
  Box,
  Package,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

type Tab = "zones" | "racks" | "bins" | "boxes";

type EntityRow = {
  id: number;
  name: string;
  status: number;
  delete_flag: number;
  created_at: string;
  childCount?: number;
  location_zones?: { id: number; name: string } | null;
  location_racks?: {
    id: number;
    name: string;
    zone_id: number;
    location_zones?: { id: number; name: string } | null;
  } | null;
  location_bins?: {
    id: number;
    name: string;
    rack_id: number;
    location_racks?: {
      id: number;
      name: string;
      zone_id: number;
      location_zones?: { id: number; name: string } | null;
    } | null;
  } | null;
};

type AllData = {
  zones: EntityRow[];
  racks: EntityRow[];
  bins: EntityRow[];
  boxes: EntityRow[];
};

const TABS: { key: Tab; label: string; icon: typeof Layers; parent: Tab | null }[] = [
  { key: "zones", label: "Zones", icon: Layers, parent: null },
  { key: "racks", label: "Racks", icon: Grid3X3, parent: "zones" },
  { key: "bins", label: "Bins", icon: Box, parent: "racks" },
  { key: "boxes", label: "Boxes", icon: Package, parent: "bins" },
];

// Har tab ke liye "saare parent" columns — sabse bade ancestor (Zone) se lekar
// ek-dam parent tak, taaki sequence hamesha Zone → Rack → Bin ho.
const PARENT_COLS: Record<Tab, { header: string; get: (r: EntityRow) => string }[]> = {
  zones: [],
  racks: [{ header: "Zone", get: (r) => r.location_zones?.name || "" }],
  bins: [
    { header: "Zone", get: (r) => r.location_racks?.location_zones?.name || "" },
    { header: "Rack", get: (r) => r.location_racks?.name || "" },
  ],
  boxes: [
    { header: "Zone", get: (r) => r.location_bins?.location_racks?.location_zones?.name || "" },
    { header: "Rack", get: (r) => r.location_bins?.location_racks?.name || "" },
    { header: "Bin", get: (r) => r.location_bins?.name || "" },
  ],
};

export default function ManageLocationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("zones");
  const [allData, setAllData] = useState<AllData>({ zones: [], racks: [], bins: [], boxes: [] });
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [parentId, setParentId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/locations/manage?tab=full");
    const json = await res.json();
    if (res.ok) setAllData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFiltered = () => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    let items = allData[activeTab] || [];

    if (tab.parent && parentId) {
      // Exact parent-id matching (row ke nested parent relation me parent ka id hota
      // hai). Name-based lookup duplicate names ke saath galat ho jata tha (e.g. do
      // "SELF 1" bins) — isliye id se match karte hain.
      const parentTable =
        tab.parent === "zones"
          ? "location_zones"
          : tab.parent === "racks"
            ? "location_racks"
            : "location_bins";
      items = items.filter(
        (r) =>
          ((r as Record<string, unknown>)[parentTable] as { id?: number } | null | undefined)?.id ===
          parentId
      );
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((r) => r.name.toLowerCase().includes(q));
    }
    return items;
  };

  const getParentOptions = () => {
    const tab = TABS.find((t) => t.key === activeTab)!;
    if (!tab.parent) return [];
    return allData[tab.parent] || [];
  };

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (row: EntityRow) => {
    setEditing(row);
    setFormName(row.name);
    setFormErr("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormErr("Name zaroori hai!");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch("/api/locations/manage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: activeTab, id: editing.id, name: formName }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
      } else {
        const body: Record<string, unknown> = { tab: activeTab, name: formName };
        if (parentId) {
          const parentTab = TABS.find((t) => t.key === activeTab)!.parent;
          const parentFk =
            parentTab === "zones" ? "zone_id" : parentTab === "racks" ? "rack_id" : "bin_id";
          body.parent_id = parentId;
          body[parentFk] = parentId;
        }
        const res = await fetch("/api/locations/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Create failed");
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: EntityRow) => {
    if (!confirm(`"${row.name}" ko delete karna hai?`)) return;
    await fetch("/api/locations/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab: activeTab, id: row.id, delete_flag: 1 }),
    });
    fetchData();
  };

  const toggleStatus = async (row: EntityRow) => {
    await fetch("/api/locations/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab: activeTab, id: row.id, status: row.status === 1 ? 0 : 1 }),
    });
    fetchData();
  };

  // Children sankhya par click → smart drill-down:
  // Zones→racks, racks→bins, bins→boxes same page par parent filter set karke;
  // boxes→products list (Spare Finder locate page) khol deta hai.
  const handleChildrenClick = (row: EntityRow) => {
    if (activeTab === "zones") {
      setActiveTab("racks");
      setParentId(row.id);
      setSearch("");
    } else if (activeTab === "racks") {
      setActiveTab("bins");
      setParentId(row.id);
      setSearch("");
    } else if (activeTab === "bins") {
      setActiveTab("boxes");
      setParentId(row.id);
      setSearch("");
    } else if (activeTab === "boxes" && row.childCount) {
      const parts = {
        zone: row.location_bins?.location_racks?.location_zones?.name || "",
        rack: row.location_bins?.location_racks?.name || "",
        bin: row.location_bins?.name || "",
        box: row.name || "",
      };
      const path = [parts.zone, parts.rack, parts.bin, parts.box].filter(Boolean).join(" ▸ ");
      if (!path) return;
      router.push(`/inventory/locate?loc=${encodeURIComponent(path)}`);
    }
  };

  const filtered = getFiltered();
  const tabInfo = TABS.find((t) => t.key === activeTab)!;
  const parentOptions = getParentOptions();

  return (
    <AdminPage
      title="Location Hierarchy"
      subtitle="Manage zones, racks, bins & boxes — the building blocks of your inventory locations"
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {TABS.map((t) => {
          const count = (allData[t.key] || []).length;
          const active = (allData[t.key] || []).filter((r) => r.status === 1).length;
          return (
            <div
              key={t.key}
              className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-3"
            >
              <div
                className={`p-2.5 rounded-xl bg-[#0d1117] ${activeTab === t.key ? "text-blue-400" : "text-slate-600"}`}
              >
                <t.icon size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {t.label}
                </p>
                <p className="text-xl font-black text-white">
                  {count}
                  <span className="text-xs text-slate-600 ml-1">({active} active)</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#21293d] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                setParentId(null);
                setSearch("");
              }}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === t.key
                  ? "border-blue-500 text-blue-400 bg-blue-500/5"
                  : "border-transparent text-slate-600 hover:text-slate-400"
              }`}
            >
              <t.icon size={14} />
              {t.label}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0d1117] text-slate-600">
                {(allData[t.key] || []).length}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tabInfo.label.toLowerCase()}...`}
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-56"
              />
            </div>
            {tabInfo.parent && (
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="">All {tabInfo.parent}</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {(allData[activeTab] || []).length}
            </span>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Plus size={14} /> Add {tabInfo.label.replace(/s$/, "")}
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">
              Loading...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">
            {search
              ? "No results found."
              : `No ${tabInfo.label.toLowerCase()} yet. Add one to get started.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {PARENT_COLS[activeTab].map((c) => (
                    <th key={c.header} className="text-left px-4 py-3">
                      {c.header}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-center px-4 py-3">Children</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map((row) => {
                  return (
                    <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                      {PARENT_COLS[activeTab].map((c) => (
                        <td key={c.header} className="px-4 py-3.5">
                          <span className="text-xs text-slate-400">{c.get(row) || "—"}</span>
                        </td>
                      ))}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-200 text-xs">{row.name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleChildrenClick(row)}
                          disabled={!row.childCount}
                          title={
                            activeTab === "boxes"
                              ? `${row.childCount || 0} products is box me assign — click karke dekhein`
                              : `${row.childCount || 0} children — click karke filter karein`
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/25 hover:border-violet-500/40 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-violet-500/10 disabled:hover:border-violet-500/20"
                        >
                          {row.childCount || 0}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleStatus(row)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                            row.status === 1
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-500/10 border-slate-500/20 text-slate-500"
                          }`}
                        >
                          {row.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {row.status === 1 ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? (
                  <>
                    <Edit3 size={16} className="text-blue-400" /> Edit{" "}
                    {tabInfo.label.replace(/s$/, "")}
                  </>
                ) : (
                  <>
                    <Plus size={16} className="text-blue-400" /> Add{" "}
                    {tabInfo.label.replace(/s$/, "")}
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  {tabInfo.label.replace(/s$/, "")} Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`e.g. ${activeTab === "zones" ? "Main Shop" : activeTab === "racks" ? "Rack 1" : activeTab === "bins" ? "Bin A" : "Box 01"}`}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> {editing ? "Update" : "Save"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
