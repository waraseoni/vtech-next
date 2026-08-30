"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminPage from "@/app/components/AdminPage";
import { supabase, getCachedUser } from "@/lib/supabase";
import { LocationParts, locPath, encodeLocationToken } from "@/lib/locations";
import { logActivity } from "@/lib/activity";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  Check,
  AlertCircle,
  MapPin,
  QrCode,
  ChevronDown,
  ChevronUp,
  Printer,
  Box,
  Layers,
  Package,
  Grid3X3,
  Settings2,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────────────── */

type LocRow = {
  id: number;
  code: string | null;
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
  label: string | null;
  status: number;
  delete_flag: number;
  created_at: string;
  zone_id: number | null;
  rack_id: number | null;
  bin_id: number | null;
  box_id: number | null;
};

type EntityRow = { id: number; name: string; status: number; delete_flag: number };

type ProductRow = { id: number; name: string };

type LocationWithCount = LocRow & { productCount: number; products: ProductRow[] };

type HierarchyData = {
  zones: EntityRow[];
  racks: EntityRow[];
  bins: EntityRow[];
  boxes: EntityRow[];
};

type FormState = {
  zone_id: number | null;
  rack_id: number | null;
  bin_id: number | null;
  box_id: number | null;
  label: string;
};

/* ─── helpers ───────────────────────────────────────────────────────────── */

const toParts = (r: {
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
}): Partial<LocationParts> => ({
  zone: r.zone ?? undefined,
  rack: r.rack ?? undefined,
  bin: r.bin ?? undefined,
  box: r.box ?? undefined,
});

const genCode = (ids: {
  zone_id?: number | null;
  rack_id?: number | null;
  bin_id?: number | null;
  box_id?: number | null;
}) => {
  const segs: string[] = [];
  if (ids.zone_id) segs.push(`Z${ids.zone_id}`);
  if (ids.rack_id) segs.push(`R${ids.rack_id}`);
  if (ids.bin_id) segs.push(`B${ids.bin_id}`);
  if (ids.box_id) segs.push(`X${ids.box_id}`);
  return segs.join("-");
};

const defaultForm: FormState = {
  zone_id: null,
  rack_id: null,
  bin_id: null,
  box_id: null,
  label: "",
};

/* ─── page ──────────────────────────────────────────────────────────────── */

export default function LocationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LocationWithCount[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyData>({
    zones: [],
    racks: [],
    bins: [],
    boxes: [],
  });
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LocRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [formErr, setFormErr] = useState("");

  const [qrModalLoc, setQrModalLoc] = useState<LocationWithCount | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ─── role check ────────────────────────────────────────────────────── */

  useEffect(() => {
    getCachedUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setUserRole(data?.role ?? "staff"));
    });
  }, []);

  /* ─── fetch data ────────────────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [locRes, hierRes] = await Promise.all([
      fetch("/api/locations"),
      fetch("/api/locations/manage?tab=full"),
    ]);

    const locJson = await locRes.json();
    const hierJson = await hierRes.json();

    if (!locRes.ok) {
      setErr(locJson.error || "Failed to fetch");
      setLoading(false);
      return;
    }

    const locations = (locJson.locations || []) as LocRow[];
    const plData = locJson.productLocations || [];

    const countMap: Record<number, ProductRow[]> = {};
    plData.forEach((row: Record<string, unknown>) => {
      const lid = row.location_id as number;
      const product = row.product_list as ProductRow | null;
      if (!countMap[lid]) countMap[lid] = [];
      if (product) countMap[lid].push(product);
    });

    const merged: LocationWithCount[] = locations.map((loc) => ({
      ...loc,
      products: countMap[loc.id] || [],
      productCount: (countMap[loc.id] || []).length,
    }));

    setRows(merged);
    if (hierRes.ok) setHierarchy(hierJson);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── stats ─────────────────────────────────────────────────────────── */

  const totalLocations = rows.length;
  const activeZones = new Set(rows.map((r) => r.zone).filter(Boolean)).size;
  const productsAssigned = rows.reduce((sum, r) => sum + r.productCount, 0);
  const locationsWithProducts = rows.filter((r) => r.productCount > 0).length;

  /* ─── search filter ─────────────────────────────────────────────────── */

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.code || "").toLowerCase().includes(q) ||
      (r.zone || "").toLowerCase().includes(q) ||
      (r.rack || "").toLowerCase().includes(q) ||
      (r.bin || "").toLowerCase().includes(q) ||
      (r.box || "").toLowerCase().includes(q) ||
      (r.label || "").toLowerCase().includes(q)
    );
  });

  /* ─── modal helpers ─────────────────────────────────────────────────── */

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setFormErr("");
    setShowModal(true);
  };

  const openEdit = (loc: LocRow) => {
    setEditing(loc);
    setForm({
      zone_id: loc.zone_id || null,
      rack_id: loc.rack_id || null,
      bin_id: loc.bin_id || null,
      box_id: loc.box_id || null,
      label: loc.label || "",
    });
    setFormErr("");
    setShowModal(true);
  };

  /* ─── save ──────────────────────────────────────────────────────────── */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.zone_id) {
      setFormErr("Zone zaroori hai!");
      return;
    }

    setSaving(true);
    try {
      const zone = hierarchy.zones.find((z) => z.id === form.zone_id);
      const rack = hierarchy.racks.find((r) => r.id === form.rack_id);
      const bin = hierarchy.bins.find((b) => b.id === form.bin_id);
      const box = hierarchy.boxes.find((b) => b.id === form.box_id);

      const payload = {
        zone: zone?.name || null,
        rack: rack?.name || null,
        bin: bin?.name || null,
        box: box?.name || null,
        label: form.label.trim() || null,
        zone_id: form.zone_id,
        rack_id: form.rack_id,
        bin_id: form.bin_id,
        box_id: form.box_id,
      };

      if (editing) {
        const res = await fetch("/api/locations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");

        await logActivity(
          "Updated Location",
          "Inventory",
          editing.id,
          `Location: ${locPath(toParts(payload))} | Code: ${json.code} | ID: ${editing.id}`
        );
      } else {
        const res = await fetch("/api/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Create failed");

        await logActivity(
          "Created Location",
          "Inventory",
          json.id,
          `Location: ${locPath(toParts(payload))} | Code: ${json.code} | New`
        );
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      setFormErr(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  /* ─── delete ────────────────────────────────────────────────────────── */

  const handleDelete = async (loc: LocRow) => {
    if (userRole !== "admin") {
      alert("Sirf Admin delete kar sakta hai!");
      return;
    }
    const path = locPath(toParts(loc));
    if (!confirm(`"${path || "Untitled"}" ko delete karna hai?`)) return;

    await fetch("/api/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: loc.id, delete_flag: 1 }),
    });
    await logActivity("Deleted Location", "Inventory", loc.id, `Location: ${path} | ID: ${loc.id}`);
    fetchData();
  };

  /* ─── toggle status ─────────────────────────────────────────────────── */

  const toggleStatus = async (loc: LocRow) => {
    if (userRole !== "admin") {
      alert("Sirf Admin status change kar sakta hai!");
      return;
    }
    await fetch("/api/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: loc.id, status: loc.status === 1 ? 0 : 1 }),
    });
    fetchData();
  };

  /* ─── QR helpers ────────────────────────────────────────────────────── */

  const qrToken = (loc: Partial<LocationParts>) => encodeLocationToken(loc);
  const qrUrl = (loc: Partial<LocationParts>) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrToken(loc))}`;

  const printQR = () => {
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win || !qrModalLoc) return;
    const parts = toParts(qrModalLoc);
    const token = qrToken(parts);
    const path = locPath(parts);
    win.document.write(`
      <html><head><title>QR - ${path}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:30px;}
      img{margin:10px auto;} h2{margin-top:16px;font-size:14px;}
      p{font-size:12px;color:#666;word-break:break-all;}</style></head>
      <body>
        <img src="${qrUrl(parts)}" width="200" height="200" />
        <h2>${path}</h2>
        <p>${token}</p>
        <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  /* ─── preview code ──────────────────────────────────────────────────── */

  const previewCode = genCode(form);

  /* ─── render ────────────────────────────────────────────────────────── */

  return (
    <AdminPage
      title="Location Master"
      subtitle="Manage inventory locations — zones, racks, bins & boxes"
    >
      {/* ─── Stats Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Locations", value: totalLocations, icon: MapPin, color: "text-blue-400" },
          { label: "Active Zones", value: activeZones, icon: Layers, color: "text-violet-400" },
          {
            label: "Products Assigned",
            value: productsAssigned,
            icon: Package,
            color: "text-emerald-400",
          },
          {
            label: "Locations with Products",
            value: locationsWithProducts,
            icon: Grid3X3,
            color: "text-amber-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-3"
          >
            <div className={`p-2.5 rounded-xl bg-[#0d1117] ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {s.label}
              </p>
              <p className="text-xl font-black text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Main Table Card ─────────────────────────────────────────── */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#21293d] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search locations..."
                className="pl-9 pr-4 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-700 outline-none focus:border-blue-500 w-64"
              />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/inventory/locations/manage")}
              className="flex items-center gap-2 px-4 py-2 bg-[#111520] border border-[#21293d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
            >
              <Settings2 size={14} /> Manage Hierarchy
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Plus size={14} /> Add Location
            </button>
          </div>
        </div>

        {err && (
          <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            {err}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">
              Loading...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No locations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <th className="text-left px-4 py-3 w-24">Code</th>
                  <th className="text-left px-4 py-3">Zone</th>
                  <th className="text-left px-4 py-3">Rack</th>
                  <th className="text-left px-4 py-3">Bin</th>
                  <th className="text-left px-4 py-3">Box</th>
                  <th className="text-left px-4 py-3">Label</th>
                  <th className="text-center px-4 py-3">Products</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a2234]">
                {filtered.map((loc) => (
                  <LocationRow
                    key={loc.id}
                    loc={loc}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    openEdit={openEdit}
                    handleDelete={handleDelete}
                    toggleStatus={toggleStatus}
                    setQrModalLoc={setQrModalLoc}
                    userRole={userRole}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add / Edit Modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                {editing ? (
                  <>
                    <Edit3 size={16} className="text-blue-400" /> Edit Location
                  </>
                ) : (
                  <>
                    <Plus size={16} className="text-blue-400" /> Add Location
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
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              {formErr && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                  <AlertCircle size={14} /> {formErr}
                </div>
              )}

              {/* Zone */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Zone <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.zone_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setForm((f) => ({
                      ...f,
                      zone_id: v,
                      rack_id: null,
                      bin_id: null,
                      box_id: null,
                    }));
                  }}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="">Select Zone...</option>
                  {hierarchy.zones
                    .filter((z) => z.status === 1)
                    .map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Rack */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Rack
                </label>
                <select
                  value={form.rack_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setForm((f) => ({ ...f, rack_id: v, bin_id: null, box_id: null }));
                  }}
                  disabled={!form.zone_id}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">Select Rack...</option>
                  {hierarchy.racks
                    .filter((r) => r.status === 1)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Bin */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Bin / Drawer
                </label>
                <select
                  value={form.bin_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    setForm((f) => ({ ...f, bin_id: v, box_id: null }));
                  }}
                  disabled={!form.rack_id}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">Select Bin...</option>
                  {hierarchy.bins
                    .filter((b) => b.status === 1)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Box */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Box{" "}
                  <span className="text-slate-700 normal-case tracking-normal font-normal">
                    (optional)
                  </span>
                </label>
                <select
                  value={form.box_id ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      box_id: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  disabled={!form.bin_id}
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">Select Box...</option>
                  {hierarchy.boxes
                    .filter((b) => b.status === 1)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Label */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Label{" "}
                  <span className="text-slate-700 normal-case tracking-normal font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Near entrance, Top shelf"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                />
              </div>

              {/* Code Preview */}
              {previewCode && (
                <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Code:
                  </span>
                  <span className="text-sm font-mono font-bold text-blue-400">{previewCode}</span>
                </div>
              )}

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

      {/* ─── QR Code Modal ───────────────────────────────────────────── */}
      {qrModalLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <QrCode size={16} className="text-blue-400" /> Location QR Code
              </h3>
              <button
                onClick={() => setQrModalLoc(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl(toParts(qrModalLoc))}
                alt="Location QR"
                width={200}
                height={200}
                className="rounded-xl bg-white p-2"
              />
              <div className="text-center">
                {qrModalLoc.code && (
                  <p className="text-xs font-mono font-bold text-blue-400 mb-1">
                    {qrModalLoc.code}
                  </p>
                )}
                <p className="text-sm font-bold text-white">{locPath(toParts(qrModalLoc))}</p>
                {qrModalLoc.label && (
                  <p className="text-xs text-slate-500 mt-0.5">{qrModalLoc.label}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-1 font-mono break-all">
                  {qrToken(toParts(qrModalLoc))}
                </p>
              </div>
              <button
                onClick={printQR}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                <Printer size={14} /> Print QR
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
}

/* ─── Location row sub-component ──────────────────────────────────────── */

function LocationRow({
  loc,
  expandedId,
  setExpandedId,
  openEdit,
  handleDelete,
  toggleStatus,
  setQrModalLoc,
  userRole,
}: {
  loc: LocationWithCount;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  openEdit: (loc: LocRow) => void;
  handleDelete: (loc: LocRow) => void;
  toggleStatus: (loc: LocRow) => void;
  setQrModalLoc: (loc: LocationWithCount) => void;
  userRole: string;
}) {
  const isExpanded = expandedId === loc.id;

  return (
    <>
      <tr className="hover:bg-white/[0.02] transition-colors">
        <td className="px-4 py-3.5">
          {loc.code ? (
            <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-0.5">
              {loc.code}
            </span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          {loc.zone ? (
            <span className="font-bold text-slate-200 text-xs">{loc.zone}</span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          {loc.rack ? (
            <span className="text-slate-300 text-xs">{loc.rack}</span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          {loc.bin ? (
            <span className="text-slate-300 text-xs">{loc.bin}</span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          {loc.box ? (
            <span className="text-slate-300 text-xs">{loc.box}</span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          {loc.label ? (
            <span className="text-slate-400 text-xs">{loc.label}</span>
          ) : (
            <span className="text-slate-700 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3.5 text-center">
          <button
            onClick={() => setExpandedId(isExpanded ? null : loc.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition cursor-pointer"
          >
            <Box size={12} />
            {loc.productCount}
            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </td>
        <td className="px-4 py-3.5 text-center">
          <button
            onClick={() => toggleStatus(loc)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
              loc.status === 1
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-slate-500/10 border-slate-500/20 text-slate-500 hover:bg-slate-500/20"
            }`}
          >
            {loc.status === 1 ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {loc.status === 1 ? "Active" : "Inactive"}
          </button>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => openEdit(loc)}
              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={() => setQrModalLoc(loc)}
              className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition"
            >
              <QrCode size={13} />
            </button>
            {userRole === "admin" && (
              <button
                onClick={() => handleDelete(loc)}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && loc.products.length > 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-3 bg-[#111520]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2">
              Products at this location
            </p>
            <div className="flex flex-wrap gap-2">
              {loc.products.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161b27] border border-[#21293d] text-xs text-slate-300"
                >
                  <Package size={11} className="text-violet-500" />
                  {p.name}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
      {isExpanded && loc.products.length === 0 && (
        <tr>
          <td colSpan={9} className="px-6 py-3 bg-[#111520]">
            <p className="text-xs text-slate-600 italic">No products assigned to this location.</p>
          </td>
        </tr>
      )}
    </>
  );
}
