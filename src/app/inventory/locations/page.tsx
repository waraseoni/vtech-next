"use client";

import { useEffect, useState, useCallback } from "react";
import AdminPage from "@/app/components/AdminPage";
import { supabase } from "@/lib/supabase";
import {
  LocationParts,
  EMPTY_LOCATION,
  locPath,
  encodeLocationToken,
} from "@/lib/locations";
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
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────────────── */

type LocRow = {
  id: number;
  zone: string | null;
  rack: string | null;
  bin: string | null;
  box: string | null;
  label: string | null;
  status: number;
  delete_flag: number;
  created_at: string;
};

type ProductRow = {
  id: number;
  name: string;
};

type LocationWithCount = LocRow & { productCount: number; products: ProductRow[] };

type FormState = LocationParts & { label: string };

/* ─── helpers ───────────────────────────────────────────────────────────── */

/** Convert nullable Supabase fields to Partial<LocationParts> (null→undefined). */
const toParts = (r: { zone: string | null; rack: string | null; bin: string | null; box: string | null }): Partial<LocationParts> => ({
  zone: r.zone ?? undefined,
  rack: r.rack ?? undefined,
  bin: r.bin ?? undefined,
  box: r.box ?? undefined,
});

/* ─── defaults ──────────────────────────────────────────────────────────── */

const defaultForm: FormState = { ...EMPTY_LOCATION, label: "" };

/* ─── page ──────────────────────────────────────────────────────────────── */

export default function LocationsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LocationWithCount[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LocRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [userRole, setUserRole] = useState("staff");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [formErr, setFormErr] = useState("");

  /* QR state */
  const [qrModalLoc, setQrModalLoc] = useState<LocationWithCount | null>(null);

  /* expand product list */
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ─── role check ────────────────────────────────────────────────────── */

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
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

    const { data: locData, error: locErr } = await supabase
      .from("locations")
      .select("*")
      .eq("delete_flag", 0)
      .order("zone")
      .order("rack")
      .order("bin")
      .order("box");

    if (locErr) {
      setErr(locErr.message);
      setLoading(false);
      return;
    }

    const locations = (locData || []) as LocRow[];

    /* fetch product counts via junction table */
    const { data: plData } = await supabase
      .from("product_locations")
      .select("location_id, product_id, product_list(name)");

    const countMap: Record<number, ProductRow[]> = {};
    (plData || []).forEach((row: Record<string, unknown>) => {
      const lid = row.location_id as number;
      const product = (row.product_list as ProductRow | null);
      if (!countMap[lid]) countMap[lid] = [];
      if (product) countMap[lid].push(product);
    });

    const merged: LocationWithCount[] = locations.map((loc) => ({
      ...loc,
      products: countMap[loc.id] || [],
      productCount: (countMap[loc.id] || []).length,
    }));

    setRows(merged);
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
      zone: loc.zone || "",
      rack: loc.rack || "",
      bin: loc.bin || "",
      box: loc.box || "",
      label: loc.label || "",
    });
    setFormErr("");
    setShowModal(true);
  };

  /* ─── save ──────────────────────────────────────────────────────────── */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.zone.trim() && !form.rack.trim() && !form.bin.trim() && !form.box.trim()) {
      setFormErr("Kam se kam ek location field (Zone/Rack/Bin/Box) zaroori hai!");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        zone: form.zone.trim() || null,
        rack: form.rack.trim() || null,
        bin: form.bin.trim() || null,
        box: form.box.trim() || null,
        label: form.label.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("locations")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;

        await logActivity(
          "Updated Location",
          "Inventory",
          editing.id,
          `Location: ${locPath(toParts(payload))} | ID: ${editing.id}`
        );
      } else {
        const { data, error } = await supabase
          .from("locations")
          .insert([{ ...payload, status: 1, delete_flag: 0 }])
          .select("id")
          .single();
        if (error) throw error;

        await logActivity(
          "Created Location",
          "Inventory",
          data?.id,
          `Location: ${locPath(toParts(payload))} | New`
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

    await supabase.from("locations").update({ delete_flag: 1 }).eq("id", loc.id);
    await logActivity("Deleted Location", "Inventory", loc.id, `Location: ${path} | ID: ${loc.id}`);
    fetchData();
  };

  /* ─── toggle status ─────────────────────────────────────────────────── */

  const toggleStatus = async (loc: LocRow) => {
    if (userRole !== "admin") {
      alert("Sirf Admin status change kar sakta hai!");
      return;
    }
    await supabase
      .from("locations")
      .update({ status: loc.status === 1 ? 0 : 1 })
      .eq("id", loc.id);
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

  /* ─── render ────────────────────────────────────────────────────────── */

  return (
    <AdminPage title="Location Master" subtitle="Manage inventory locations — zones, racks, bins & boxes">
      {/* ─── Stats Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Locations", value: totalLocations, icon: MapPin, color: "text-blue-400" },
          { label: "Active Zones", value: activeZones, icon: Layers, color: "text-violet-400" },
          { label: "Products Assigned", value: productsAssigned, icon: Package, color: "text-emerald-400" },
          { label: "Locations with Products", value: locationsWithProducts, icon: Grid3X3, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-[#0d1117] ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{s.label}</p>
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
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
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
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Plus size={14} /> Add Location
          </button>
        </div>

        {err && (
          <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
            {err}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-12 text-center">
            <Loader2 size={24} className="animate-spin text-slate-600 mx-auto mb-2" />
            <p className="text-slate-600 text-xs font-extrabold uppercase tracking-widest">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-600 text-sm">No locations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111520]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-600">
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

              {(["zone", "rack", "bin", "box"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                    {field.charAt(0).toUpperCase() + field.slice(1)}{" "}
                    {field === "zone" && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    placeholder={`e.g. ${field === "zone" ? "Main Shop" : field === "rack" ? "Rack 1" : field === "bin" ? "Bin A" : "Box 01"}`}
                    className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Label <span className="text-slate-700 normal-case tracking-normal font-normal">(optional)</span>
                </label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Near entrance, Top shelf"
                  className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
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
              <img
                src={qrUrl(toParts(qrModalLoc))}
                alt="Location QR"
                width={200}
                height={200}
                className="rounded-xl bg-white p-2"
              />
              <div className="text-center">
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
          <td colSpan={8} className="px-6 py-3 bg-[#111520]">
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
          <td colSpan={8} className="px-6 py-3 bg-[#111520]">
            <p className="text-xs text-slate-600 italic">No products assigned to this location.</p>
          </td>
        </tr>
      )}
    </>
  );
}
