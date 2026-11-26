"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminPage from "@/app/components/AdminPage";
import { supabase, getCachedUser } from "@/lib/supabase";
import { requireAdmin } from "@/lib/requireAdmin";
import { toast } from "@/lib/toast";
import { systemInfoKey, systemInfoOptions } from "@/lib/queries/system-info";
import {
  AlertCircle,
  Check,
  Edit3,
  Hash,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

/**
 * Settings → Service Center (P1).
 *
 * Brand / Model / Identifier / Service Type masters + 3 operating modes.
 * Purana plan §7 rule: hard DELETE nahi — sirf `is_active=false` (deactivate),
 * kyunki purane reports me group hui rows history se gayab ho jayengi.
 *
 * Browser me service-role NAHI — sab writes authenticated RLS se (anon deny).
 */

type Brand = {
  id: number;
  name: string;
  code: string | null;
  is_authorized: boolean;
  is_active: boolean;
};
type DeviceModel = { id: number; name: string; brand_id: number | null; is_active: boolean };
type Identifier = {
  id: number;
  value: string;
  note: string | null;
  is_active: boolean;
  last_used: string | null;
};
type ServiceType = {
  id: number;
  name: string;
  sort_order: number;
  /** NULL = fault required (purana behaviour). Sirf false optional mark karta hai. */
  expects_fault: boolean | null;
  is_active: boolean;
};

/** Har master row ka common shape — table renderer isi par chalata hai. */
type MasterRow = {
  id: number;
  name?: string;
  code?: string | null;
  is_authorized?: boolean;
  is_active: boolean;
  brand_id?: number | null;
  value?: string;
  note?: string | null;
  sort_order?: number;
  expects_fault?: boolean | null;
};

type Masters = {
  brands: Brand[];
  models: DeviceModel[];
  identifiers: Identifier[];
  serviceTypes: ServiceType[];
};

type Kind = keyof Masters;
const TABLE: Record<Kind, string> = {
  brands: "brands",
  models: "device_models",
  identifiers: "device_identifiers",
  serviceTypes: "service_types",
};
const LABEL: Record<Kind, string> = {
  brands: "Brands",
  models: "Models",
  identifiers: "Identifiers",
  serviceTypes: "Service Types",
};
const serviceCenterKey = ["service-center-masters"] as const;

const MODES = [
  {
    id: "autonomous",
    label: "Autonomous",
    desc: "Koi bhi device accept karo. Brand choose karna optional — sabse kam friction (default).",
  },
  {
    id: "single_brand",
    label: "Single Brand",
    desc: "Ek authorized brand center. Brand auto-fill hota hai, counter ko choose nahi karna padta.",
  },
  {
    id: "multi_brand",
    label: "Multi Brand",
    desc: "Brand + Model required. Har brand ka apna authorization / claim tracking.",
  },
] as const;
type Mode = (typeof MODES)[number]["id"];

const inputCls =
  "w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-app outline-none focus:border-blue-500/60 placeholder:text-muted-2";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5";

export default function ServiceCenterSettingsPage() {
  const queryClient = useQueryClient();

  // ── Mode (system_info KV) ──────────────────────────────────────────────────
  const { data: sysInfo = {} } = useQuery(systemInfoOptions());
  const [mode, setMode] = useState<Mode>("autonomous");
  const [modeSaving, setModeSaving] = useState(false);
  useEffect(() => {
    const saved = sysInfo.service_center_mode;
    if (saved === "autonomous" || saved === "single_brand" || saved === "multi_brand") {
      setMode(saved);
    }
  }, [sysInfo.service_center_mode]);

  const saveMode = async () => {
    setModeSaving(true);
    try {
      const { data: existing } = await supabase
        .from("system_info")
        .select("id")
        .eq("meta_field", "service_center_mode")
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("system_info")
          .update({ meta_value: mode })
          .eq("meta_field", "service_center_mode");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_info")
          .insert({ meta_field: "service_center_mode", meta_value: mode });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: systemInfoKey });
      toast.success("Service Center mode save ho gaya! ✅");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mode save failed!");
    } finally {
      setModeSaving(false);
    }
  };

  // ── Role (deactivate / edit gates) ─────────────────────────────────────────
  const [userRole, setUserRole] = useState("staff");
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

  // ── Masters (ek Promise.all, stale 30s) ────────────────────────────────────
  const fetchMasters = useCallback(async (): Promise<Masters> => {
    const [brands, models, identifiers, serviceTypes] = await Promise.all([
      supabase.from("brands").select("id, name, code, is_authorized, is_active").order("name"),
      supabase.from("device_models").select("id, name, brand_id, is_active").order("name"),
      supabase
        .from("device_identifiers")
        .select("id, value, note, is_active, last_used")
        .order("value"),
      supabase
        .from("service_types")
        .select("id, name, sort_order, expects_fault, is_active")
        .order("sort_order")
        .order("name"),
    ]);
    const err = brands.error ?? models.error ?? identifiers.error ?? serviceTypes.error;
    if (err) throw err;
    return {
      brands: (brands.data ?? []) as Brand[],
      models: (models.data ?? []) as DeviceModel[],
      identifiers: (identifiers.data ?? []) as Identifier[],
      serviceTypes: (serviceTypes.data ?? []) as ServiceType[],
    };
  }, []);

  const {
    data: masters,
    error: queryErr,
    isPending: loading,
    refetch,
  } = useQuery({
    queryKey: serviceCenterKey,
    queryFn: fetchMasters,
    staleTime: 30_000,
  });

  // ── Add / edit modal ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<Kind>("brands");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<{ kind: Kind; id: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    brandId: "",
    value: "",
    note: "",
    sortOrder: "0",
    isAuthorized: false,
    // NULL aur true dono ka matlab fault required — checked hi default hai.
    expectsFault: true,
  });

  const resetForm = () =>
    setForm({
      name: "",
      code: "",
      brandId: tab === "models" ? "" : "",
      value: "",
      note: "",
      sortOrder: "0",
      isAuthorized: false,
      expectsFault: true,
    });

  const openAdd = (kind: Kind) => {
    setEditing({ kind, id: null });
    setFormErr("");
    resetForm();
    setShowModal(true);
  };

  const openEdit = (kind: Kind, row: MasterRow) => {
    setEditing({ kind, id: row.id });
    setFormErr("");
    setForm({
      name: row.name ?? "",
      code: row.code ?? "",
      brandId: row.brand_id ? String(row.brand_id) : "",
      value: row.value ?? "",
      note: row.note ?? "",
      sortOrder: String(row.sort_order ?? 0),
      isAuthorized: Boolean(row.is_authorized),
      expectsFault: row.expects_fault !== false,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { kind, id } = editing;

    let table: string;
    let payload: Record<string, unknown>;
    let dedupeColumn: string;
    let dedupeValue: string;

    if (kind === "brands") {
      if (!form.name.trim()) return setFormErr("Brand naam zaroori hai!");
      table = TABLE.brands;
      payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase() || null,
        is_authorized: form.isAuthorized,
      };
      dedupeColumn = "name";
      dedupeValue = form.name.trim();
    } else if (kind === "models") {
      if (!form.name.trim()) return setFormErr("Model naam zaroori hai!");
      table = TABLE.models;
      payload = {
        name: form.name.trim(),
        brand_id: form.brandId ? Number(form.brandId) : null,
      };
      dedupeColumn = "name";
      dedupeValue = form.name.trim();
    } else if (kind === "identifiers") {
      const value = form.value.trim().toUpperCase();
      if (!value) return setFormErr("Identifier value zaroori hai!");
      table = TABLE.identifiers;
      payload = { value, note: form.note.trim() || null };
      dedupeColumn = "value";
      dedupeValue = value;
    } else {
      if (!form.name.trim()) return setFormErr("Service type naam zaroori hai!");
      table = TABLE.serviceTypes;
      // Checked → NULL (purana default preserved), unchecked → false. DB
      // `expects_fault boolean NULL` ka koi type/NOT NULL change nahi.
      payload = {
        name: form.name.trim(),
        sort_order: Number(form.sortOrder) || 0,
        expects_fault: form.expectsFault ? null : false,
      };
      dedupeColumn = "name";
      dedupeValue = form.name.trim();
    }

    setSaving(true);
    try {
      if (!id) {
        // JobSpotPicker pattern: pehle dedupe, phir insert, phir auto-select.
        let q = supabase.from(table).select("id").ilike(dedupeColumn, `%${dedupeValue}%`);
        if (kind === "models" && form.brandId) {
          q = q.eq("brand_id", Number(form.brandId));
        }
        const { data: existing } = await q.maybeSingle();
        if (existing?.id) {
          toast.info("Ye pehle se master me hai — naya duplicate nahi banaya.");
          setShowModal(false);
          return;
        }
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success(`${LABEL[kind].replace(/s$/, "")} master me add ho gaya! ✅`);
      } else {
        const { error } = await supabase.from(table).update(payload).eq("id", id);
        if (error) throw error;
        toast.success("Update ho gaya! ✅");
      }
      setShowModal(false);
      await refetch();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (kind: Kind, row: MasterRow) => {
    const willActivate = !row.is_active;
    if (!requireAdmin(userRole, willActivate ? "edit" : "delete")) return;
    if (!willActivate && !confirm(`"${row.name ?? row.value}" ko deactivate karna hai?`)) return;
    const { error } = await supabase
      .from(TABLE[kind])
      .update({ is_active: willActivate })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      willActivate ? "Master wapas active ho gaya." : "Master deactivate ho gaya (history safe)."
    );
    await refetch();
  };

  const rows = (masters?.[tab] ?? []) as MasterRow[];
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (r.name ?? "").toLowerCase().includes(q) ||
      (r.value ?? "").toLowerCase().includes(q) ||
      (r.code ?? "").toLowerCase().includes(q)
    );
  });

  const errText = queryErr instanceof Error ? queryErr.message : queryErr ? "Load failed" : "";

  return (
    <AdminPage
      title="Service Center"
      subtitle="Device identity masters + operating mode (Brand · Model · Identifier)"
    >
      {/* ── Operating mode ─────────────────────────────────────────────────── */}
      <div className="bg-panel border border-app rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-3.5 border-b border-app flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <Wrench size={16} className="text-violet-400" />
            <div>
              <h2 className="text-sm font-bold text-app">Operating Mode</h2>
              <p className="text-[11px] text-muted">
                Ek hi schema, teen behavior. Purane jobs par koi asar nahi.
              </p>
            </div>
          </div>
          <button
            onClick={saveMode}
            disabled={modeSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
          >
            {modeSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Mode Save karo
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                mode === m.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-app hover:border-blue-500/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-app">{m.label}</span>
                {mode === m.id && <Check size={15} className="text-blue-400" />}
              </div>
              <p className="text-[11px] text-muted leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Masters ────────────────────────────────────────────────────────── */}
      <div className="bg-panel border border-app rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-app flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <Layers size={16} className="text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-app">Device Masters</h2>
              <p className="text-[11px] text-muted">
                Dropdown yahin se aate hain. Delete nahi — sirf deactivate.
              </p>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Master dhoondein..."
              className="pl-9 pr-4 py-2 bg-app border border-app rounded-xl text-sm text-app placeholder:text-muted-2 outline-none focus:border-blue-500 w-56"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pt-4">
          {(Object.keys(LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setSearch("");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                tab === k
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-app border-app text-muted hover:text-app"
              }`}
            >
              {LABEL[k]}
              <span className="ml-1.5 opacity-70">{masters?.[k].length ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-2">
            {filtered.length} of {rows.length}
          </span>
          <button
            onClick={() => openAdd(tab)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
          >
            <Plus size={13} /> Naya {LABEL[tab].replace(/s$/, "")}
          </button>
        </div>

        {errText && (
          <p className="px-5 pb-3 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle size={13} /> {errText}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-2 border-y border-app">
                <th className="text-left px-5 py-2.5 font-bold">
                  {tab === "identifiers" ? "Identifier" : "Name"}
                </th>
                {tab === "brands" && <th className="text-left px-3 py-2.5 font-bold">Code</th>}
                {tab === "brands" && (
                  <th className="text-left px-3 py-2.5 font-bold">Authorized</th>
                )}
                {tab === "models" && <th className="text-left px-3 py-2.5 font-bold">Brand</th>}
                {tab === "identifiers" && <th className="text-left px-3 py-2.5 font-bold">Note</th>}
                {tab === "serviceTypes" && (
                  <th className="text-left px-3 py-2.5 font-bold">Sort</th>
                )}
                {tab === "serviceTypes" && (
                  <th className="text-left px-3 py-2.5 font-bold">Fault required?</th>
                )}
                <th className="text-left px-3 py-2.5 font-bold">Status</th>
                <th className="text-right px-5 py-2.5 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={tab === "serviceTypes" ? 8 : 7}
                    className="px-5 py-10 text-center text-muted"
                  >
                    <Loader2 size={18} className="animate-spin inline mr-2" /> Masters load ho rahe
                    hain...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={tab === "serviceTypes" ? 8 : 7}
                    className="px-5 py-10 text-center text-muted"
                  >
                    Koi master nahi mila. &quot;Naya {LABEL[tab].replace(/s$/, "")}&quot; se
                    banayein.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-app/60 hover:bg-app/40">
                    <td className="px-5 py-3 font-semibold text-app">
                      <span className="flex items-center gap-2">
                        {tab === "brands" ? (
                          <Tag size={13} className="text-blue-400" />
                        ) : tab === "identifiers" ? (
                          <Hash size={13} className="text-emerald-400" />
                        ) : (
                          <Wrench size={13} className="text-amber-400" />
                        )}
                        {r.name ?? r.value}
                      </span>
                    </td>
                    {tab === "brands" && (
                      <td className="px-3 py-3 text-muted font-mono text-xs">{r.code ?? "—"}</td>
                    )}
                    {tab === "brands" && (
                      <td className="px-3 py-3">
                        {r.is_authorized ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-blue-500/15 text-blue-300">
                            <ShieldCheck size={11} /> Authorized
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-2">—</span>
                        )}
                      </td>
                    )}
                    {tab === "models" && (
                      <td className="px-3 py-3 text-muted">
                        {masters?.brands.find((b) => b.id === r.brand_id)?.name ?? "General"}
                      </td>
                    )}
                    {tab === "identifiers" && (
                      <td className="px-3 py-3 text-muted text-xs truncate max-w-[220px]">
                        {r.note ?? "—"}
                      </td>
                    )}
                    {tab === "serviceTypes" && (
                      <td className="px-3 py-3 text-muted font-mono text-xs">
                        {r.sort_order ?? 0}
                      </td>
                    )}
                    {tab === "serviceTypes" && (
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                            r.expects_fault !== false
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {r.expects_fault !== false ? "Required" : "Optional"}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                          r.is_active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-500/15 text-muted"
                        }`}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(tab, r)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-app text-muted hover:text-app"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(tab, r)}
                          title={r.is_active ? "Deactivate" : "Reactivate"}
                          className="p-1.5 rounded-lg hover:bg-app text-muted hover:text-app"
                        >
                          {r.is_active ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / edit modal ───────────────────────────────────────────────── */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-panel border border-app rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <h3 className="font-bold text-app">
                {editing.id
                  ? "Master edit karo"
                  : `Naya ${LABEL[editing.kind].replace(/s$/, "")} banayein`}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-app text-muted"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {(editing.kind === "brands" ||
                editing.kind === "models" ||
                editing.kind === "serviceTypes") && (
                <div>
                  <label className={labelCls}>Name *</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={editing.kind === "brands" ? "e.g. Komaki" : "e.g. XGT"}
                    className={inputCls}
                  />
                </div>
              )}

              {editing.kind === "brands" && (
                <>
                  <div>
                    <label className={labelCls}>Code (optional, 2-4 chars)</label>
                    <input
                      value={form.code}
                      maxLength={10}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="KMK"
                      className={inputCls}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-app cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isAuthorized}
                      onChange={(e) => setForm({ ...form, isAuthorized: e.target.checked })}
                      className="accent-blue-500"
                    />
                    Is brand ke liye center authorized hai
                  </label>
                </>
              )}

              {editing.kind === "models" && (
                <div>
                  <label className={labelCls}>Brand (optional)</label>
                  <select
                    value={form.brandId}
                    onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">General / brand se alag</option>
                    {(masters?.brands ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editing.kind === "identifiers" && (
                <>
                  <div>
                    <label className={labelCls}>Identifier (Serial / IMEI) *</label>
                    <input
                      autoFocus
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value.toUpperCase() })}
                      placeholder="e.g. KMK123456789"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Note (optional)</label>
                    <input
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="e.g. Chassis number"
                      className={inputCls}
                    />
                  </div>
                </>
              )}

              {editing.kind === "serviceTypes" && (
                <>
                  <div>
                    <label className={labelCls}>Sort order</label>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-app cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.expectsFault}
                      onChange={(e) => setForm({ ...form, expectsFault: e.target.checked })}
                      className="accent-blue-500 mt-0.5"
                    />
                    <span>
                      Fault required hai?
                      <span className="block text-[10px] text-muted mt-0.5">
                        Uncheck karne par Fault field optional ho jayega — installation/PDI jaise
                        types ke liye. Purane jobs par asar nahi.
                      </span>
                    </span>
                  </label>
                </>
              )}

              {formErr && (
                <p className="text-xs text-red-400 flex items-start gap-1.5">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {formErr}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-app text-sm text-muted hover:text-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {editing.id ? "Save" : "Banao aur Select karo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
