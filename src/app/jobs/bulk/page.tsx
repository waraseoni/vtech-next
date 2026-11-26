"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Plus,
  Wrench,
  Loader2,
  AlertTriangle,
  Hash,
  Trash2,
  ClipboardList,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import SearchableSelect from "@/components/SearchableSelect";
import { getNextJobId, peekNextJobId, bumpJobCounter } from "@/lib/jobIdCounter";
import { toast } from "@/lib/toast";
import DeviceFieldPicker from "@/components/DeviceFieldPicker";
import { clampJobItemLabel, composeJobItemLabel, normalizeIdentifier } from "@/lib/deviceIdentity";
import {
  defaultServiceTypeId,
  expectsFault,
  faultFieldLabel,
  faultHint,
  serviceTypeOptions,
  type ServiceTypeOption,
} from "@/lib/serviceType";
import { validateBulkRows, validBulkRows, type BulkValidatableRow } from "@/lib/bulkJobValidation";
import { useJobAuxSeed } from "../JobAuxSeed";

// ─── IST Helper ───────────────────────────────────────────────────────────────
function nowIST(): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}+05:30`;
}
async function genCode(offset = 0): Promise<string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  parts.forEach((x) => {
    p[x.type] = x.value;
  });
  const prefix = `${p.year}${p.month}${p.day}`;
  const { data } = await supabase
    .from("transaction_list")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);
  const lastSeq = data?.[0]?.code ? parseInt(data[0].code.slice(8)) || 0 : 0;
  return `${prefix}${String(lastSeq + 1 + offset).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
}
interface Mechanic {
  id: number;
  firstname: string;
  middlename: string;
  lastname: string;
}
interface BulkRow {
  id: number; // local key only
  estJobId: number; // estimated job id (display)
  /** Item = kya cheez hai (structured `item_name`); final label isme baaki fields jude hain. */
  itemName: string;
  /** Advanced custom label (bulk me UI nahi — compose fallback ke liye rakha hai). */
  item: string;
  brandId: number | null;
  brandName: string;
  model: string;
  serial: string;
  customItem: boolean;
  /** Service Type (NULL = legacy). Global default se aata hai, per-row override ho sakta hai. */
  serviceTypeId: number | null;
  /** True = user ne is row ka type khud chuna (global change se overwrite nahi). */
  serviceTypeOverridden: boolean;
  fault: string;
  mechanic_id: string;
  uniq_id: string;
  remark: string;
}

/** Har nayi row ka empty shape — ek hi jagah se (seed/fetch/add deto same). */
const emptyBulkRow = (
  id: number,
  estJobId: number,
  mechanicId = "",
  serviceTypeId: number | null = null
): BulkRow => ({
  id,
  estJobId,
  itemName: "",
  item: "",
  brandId: null,
  brandName: "",
  model: "",
  serial: "",
  customItem: false,
  serviceTypeId,
  serviceTypeOverridden: false,
  fault: "",
  mechanic_id: mechanicId,
  uniq_id: "",
  remark: "",
});

// Sabhi controls (input / SearchableSelect / DeviceFieldPicker) ki height aur
// radius ek hi jaisa — isi se row ke boxes symmetrical dikhte hain.
const iCls =
  "w-full min-h-[42px] px-3 py-2.5 bg-app border border-app rounded-xl text-xs text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-muted-2";
const iClsErr =
  "w-full min-h-[42px] px-3 py-2.5 bg-app border border-red-500/60 rounded-xl text-xs text-white outline-none focus:border-red-400 transition-all placeholder:text-red-300/60";
const lCls = "block min-h-[14px] text-[9px] font-black uppercase tracking-wider text-muted mb-1.5";
const fieldErr = (fields: string[] | undefined, key: string) => fields?.includes(key);

/** Label + control ka ek hi wrapper — har field me label same jagah. */
function BulkField({
  label,
  required,
  error,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <label className={lCls}>
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
          {error && <span className="text-red-400 ml-1 normal-case">· missing</span>}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkJobPage() {
  const router = useRouter();

  // Server seed: masters + next job id pehle render me. Seed `null` par niche
  // wala purana fetchMaster() chalta hai.
  const seed = useJobAuxSeed("bulk");

  const [clients, setClients] = useState<Client[]>(seed?.clients ?? []);
  const [mechanics, setMechanics] = useState<Mechanic[]>(seed?.mechanics ?? []);
  const [clientId, setClientId] = useState("");
  // Device identity ab per-row hai — global override nahi. Har job ke liye
  // alag Item → Brand → Model → Identifier (user ka maanga hua kram).
  const [globalMech, setGlobalMech] = useState("");
  // Global mechanic ka hamesha-fresh mirror — searchable dropdown se select ke
  // baad addRow ko latest value mile (stale closure se bachne ke liye).
  const globalMechRef = useRef("");
  // Service Type: global default (Repair) + per-row override.
  const [fallbackServiceTypes, setFallbackServiceTypes] = useState<ServiceTypeOption[]>([]);
  const serviceTypeSeed: ServiceTypeOption[] = useMemo(
    () => seed?.deviceMasters?.serviceTypes ?? fallbackServiceTypes,
    [seed, fallbackServiceTypes]
  );
  const defaultServiceType = useMemo(
    () => defaultServiceTypeId(serviceTypeSeed),
    [serviceTypeSeed]
  );
  const [globalServiceType, setGlobalServiceType] = useState<number | null>(null);
  const globalServiceTypeRef = useRef<number | null>(null);
  const globalTypeInitialized = useRef(false);
  const [baseJobId, setBaseJobId] = useState(seed?.nextJobId ?? 0);
  const [rows, setRows] = useState<BulkRow[]>(
    seed ? [0, 1, 2].map((i) => emptyBulkRow(i, seed.nextJobId + i)) : []
  );
  const [rowKey, setRowKey] = useState(seed ? 3 : 100); // unique key counter
  const [loading, setLoading] = useState(!seed);
  const [saving, setSaving] = useState(false);
  // Re-entrancy guard — double click / slow network par bulk save do baar na
  // chale (har baar fresh getNextJobId aur duplicate rows ki possibility).
  const savingRef = useRef(false);
  // Row-wise validation errors (missing fields) — save-block warning ke liye
  const [rowErrs, setRowErrs] = useState<Record<number, string[]>>({});

  // Default type (Repair) seed milte hi sab non-overridden rows me lagao.
  useEffect(() => {
    if (globalTypeInitialized.current || defaultServiceType == null) return;
    globalTypeInitialized.current = true;
    globalServiceTypeRef.current = defaultServiceType;
    setGlobalServiceType(defaultServiceType);
    setRows((prev) =>
      prev.map((r) => (r.serviceTypeOverridden ? r : { ...r, serviceTypeId: defaultServiceType }))
    );
  }, [defaultServiceType]);

  // Device masters — brand dropdown + row-wala model (brand-linked) options.
  const deviceMasters = seed?.deviceMasters;
  const brandOptions = (deviceMasters?.brands ?? []).map((b) => ({
    id: b.id,
    label: b.name,
    sub: b.code ?? undefined,
  }));
  const modelOptionsFor = (brandId: number | null) =>
    (deviceMasters?.models ?? [])
      .filter((m) => !brandId || m.brand_id === brandId)
      .map((m) => ({
        id: m.id,
        label: m.name,
        sub: deviceMasters?.brands.find((b) => b.id === m.brand_id)?.name,
      }));

  /** Row ka final `item` — new/edit ke saath ek hi compose rule. */
  const itemOf = (r: BulkRow) =>
    clampJobItemLabel(
      composeJobItemLabel({
        item: r.itemName,
        brand: r.brandName,
        model: r.model,
        identifier: r.serial,
        legacyItem: r.item,
      })
    );

  const serviceTypeOpts = (selectedId: number | null) =>
    serviceTypeOptions(serviceTypeSeed, selectedId);
  const rowFaultRequired = (r: BulkRow) =>
    expectsFault(serviceTypeSeed.find((t) => t.id === r.serviceTypeId));
  const toValidatable = (r: BulkRow): BulkValidatableRow => ({
    id: r.id,
    itemLabel: itemOf(r),
    fault: r.fault,
    serviceTypeId: r.serviceTypeId,
    mechanicId: r.mechanic_id,
  });

  // ── Fetch master data ──────────────────────────────────────────────────────
  const fetchMaster = useCallback(async () => {
    setLoading(true);
    const [cRes, mRes, sRes] = await Promise.all([
      supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("delete_flag", 0)
        .order("firstname"),
      supabase
        .from("mechanic_list")
        .select("id, firstname, middlename, lastname")
        .eq("status", 1)
        .order("firstname"),
      supabase
        .from("service_types")
        .select("id, name, sort_order, expects_fault, is_active")
        .order("sort_order"),
    ]);
    setClients(cRes.data || []);
    setMechanics(mRes.data || []);
    const types = (sRes.data || []) as ServiceTypeOption[];
    setFallbackServiceTypes(types);
    const fallbackDefault = defaultServiceTypeId(types);
    globalServiceTypeRef.current = fallbackDefault;
    setGlobalServiceType(fallbackDefault);
    globalTypeInitialized.current = true;
    const nextId = await peekNextJobId(); // preview only — no claim
    setBaseJobId(nextId);
    // Start with 3 empty rows
    const initial: BulkRow[] = [0, 1, 2].map((i) =>
      emptyBulkRow(i, nextId + i, "", fallbackDefault)
    );
    setRows(initial);
    setRowKey(3);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (seed) return;
    fetchMaster();
  }, [fetchMaster, seed]);

  // ── Add row ────────────────────────────────────────────────────────────────
  const addRow = () => {
    const newEstJobId = baseJobId + rows.length;
    setRows((prev) => [
      ...prev,
      emptyBulkRow(rowKey, newEstJobId, globalMechRef.current, globalServiceTypeRef.current),
    ]);
    setRowKey((k) => k + 1);
  };

  // ── Remove row ─────────────────────────────────────────────────────────────
  const removeRow = (id: number) => {
    if (rows.length <= 1) {
      toast.warning("Kam se kam ek row zaroori hai!");
      return;
    }
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      // Re-calculate estimated job IDs
      return filtered.map((r, i) => ({ ...r, estJobId: baseJobId + i }));
    });
  };

  // ── Update row field ───────────────────────────────────────────────────────
  const updateRow = (id: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // Live re-validate — field bharte hi us row ka error turant hat jaye
    setRowErrs((prevErrs) => {
      if (!prevErrs[id]) return prevErrs;
      const updatedRows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
      const single = buildRowValidation(updatedRows)[id];
      const next = { ...prevErrs };
      if (single) next[id] = single;
      else delete next[id];
      return next;
    });
  };

  // ── Apply global mechanic to all empty rows ────────────────────────────────
  const applyGlobalMech = (mechId: string) => {
    setGlobalMech(mechId);
    globalMechRef.current = mechId;
    setRows((prev) => prev.map((r) => (r.mechanic_id === "" ? { ...r, mechanic_id: mechId } : r)));
    // Live re-validate — mechanic milte hi mechanic-less errors turant hat jaye
    setRowErrs((prevErrs) => {
      if (!Object.keys(prevErrs).length) return prevErrs;
      const updatedRows = rows.map((r) =>
        r.mechanic_id === "" ? { ...r, mechanic_id: mechId } : r
      );
      return buildRowValidation(updatedRows);
    });
  };

  // ── Global Service Type (sirf un rows jo user ne override nahi kiye) ────
  const applyGlobalServiceType = (id: string) => {
    const nextId = id ? parseInt(id, 10) : null;
    setGlobalServiceType(nextId);
    globalServiceTypeRef.current = nextId;
    setRows((prev) =>
      prev.map((r) => (r.serviceTypeOverridden ? r : { ...r, serviceTypeId: nextId }))
    );
    setRowErrs((prevErrs) => {
      if (!Object.keys(prevErrs).length) return prevErrs;
      const updatedRows = rows.map((r) =>
        r.serviceTypeOverridden ? r : { ...r, serviceTypeId: nextId }
      );
      return validateBulkRows(updatedRows.map(toValidatable), serviceTypeSeed);
    });
  };

  const setRowServiceType = (rowId: number, typeId: number | null) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, serviceTypeId: typeId, serviceTypeOverridden: true } : r
      )
    );
    setRowErrs((prevErrs) => {
      if (!prevErrs[rowId]) return prevErrs;
      const updatedRows = rows.map((r) => (r.id === rowId ? { ...r, serviceTypeId: typeId } : r));
      return validateBulkRows(updatedRows.map(toValidatable), serviceTypeSeed);
    });
  };

  // ── Row validation — pure helper (save-filter bhi isi se aata hai) ─────
  const buildRowValidation = (list: BulkRow[]): Record<number, string[]> =>
    validateBulkRows(list.map(toValidatable), serviceTypeSeed);

  // ── Save all ───────────────────────────────────────────────────────────────
  const handleSaveAll = async () => {
    if (savingRef.current) return;
    if (!clientId) {
      toast.error("Pehle client select karo!");
      return;
    }

    // Pehle validation — koi bhi row adhuri/mechanic-less hai to save band, warning + highlight
    const errs = buildRowValidation(rows);
    const missingIds = Object.keys(errs).length > 0;
    if (missingIds) {
      setRowErrs(errs);
      const labels = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => errs[r.id])
        .map(({ r, i }) => `Row ${i + 1} (#${r.estJobId}): ${errs[r.id].join(", ")}`);
      const short = labels.slice(0, 2).join(" | ");
      const countSuffix = labels.length > 2 ? ` ... aur ${labels.length - 2} rows` : "";
      toast.warning(`${labels.length} rows adhuri hain — ${short}${countSuffix}`);
      // Pehli adhuri row par smooth scroll + focus
      requestAnimationFrame(() => scrollToRowError(errs));
      return;
    }
    setRowErrs({});

    // Filter valid rows — validation aur filter ek hi source (silent drop nahi).
    const validRows = validBulkRows(rows, errs);
    if (validRows.length === 0) {
      toast.error("Kam se kam ek row mein item, mechanic aur zaroori fault fill karo!");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await getCachedUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("mechanic_id")
        .eq("id", user!.id)
        .single();
      const userId = profile?.mechanic_id || 0;

      // Get fresh job counter
      const nextJobId = await getNextJobId();

      // PERF: pehle per-row `genCode(i)` (1 select) + `insert` (1 insert) awaited
      // tha → N rows = 2N serial round-trips (10 rows ≈ 20 RTT, save seconds
      // leta tha). Ab ek code lookup + ek multi-row insert = 2 RTT.
      const baseCode = await genCode(0);
      const codePrefix = baseCode.slice(0, 8);
      const baseSeq = parseInt(baseCode.slice(8), 10) || 0;
      const ts = nowIST();

      const inserts = validRows.map((row, i) => ({
        client_name: String(clientId),
        job_id: String(nextJobId + i),
        code: `${codePrefix}${String(baseSeq + i).padStart(2, "0")}`,
        item: itemOf(row),
        item_name: row.itemName.trim() || null,
        brand_id: row.brandId,
        model: row.model.trim() || null,
        serial_no: normalizeIdentifier(row.serial) || null,
        service_type_id: row.serviceTypeId,
        // fault NOT NULL — faultless type par "" hi save hota hai.
        fault: row.fault.trim(),
        remark: row.remark.trim() || "",
        uniq_id: row.uniq_id.trim() || "",
        amount: 0,
        status: 0,
        del_status: 0,
        mechanic_id: row.mechanic_id ? parseInt(row.mechanic_id) : null,
        mechanic_amount: 0,
        mechanic_commission_amount: 0,
        user_id: userId,
        date_created: ts,
        date_updated: ts,
      }));

      const { error } = await supabase.from("transaction_list").insert(inserts);
      if (error) throw new Error(`Bulk save failed: ${error.message}`);

      // Update job_id_counter
      await bumpJobCounter(nextJobId + validRows.length - 1);

      toast.success(`${inserts.length} jobs saved successfully!`);
      router.replace("/jobs");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed!";
      toast.error(msg);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // ── Save-block par pehli adhuri row par scroll + focus karo ─────────────
  // Dhyan rahe: desktop table + mobile cards dono DOM me exist karte hain —
  // isliye sirf VISIBLE row/field select karna zaroori hai (offsetParent check).
  const visibleEls = (sel: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((e) => e.offsetParent !== null);

  const scrollToRowError = (errs: Record<number, string[]>) => {
    const firstId = Number(Object.keys(errs)[0]);
    if (!firstId) return;
    const el = visibleEls(`[data-bulk-row="${firstId}"]`)[0];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Pehla missing field focus karo (item → brand → fault → mechanic)
    // Item auto-label hai — uski jagah Brand picker focus karna zyada useful hai.
    const errFields = errs[firstId] || [];
    setTimeout(() => {
      const sel = errFields.includes("Item / Model")
        ? `[data-bulk-input-brand="${firstId}"] button`
        : errFields.includes("Fault Reported")
          ? `[data-bulk-input-fault="${firstId}"]`
          : errFields.includes("Mechanic")
            ? `[data-bulk-mech="${firstId}"]`
            : null;
      if (!sel) return;
      const host = visibleEls(sel)[0];
      if (!host) return;
      if (sel.includes("bulk-mech")) {
        const btn = host.querySelector<HTMLElement>("button");
        btn?.focus({ preventScroll: true });
        btn?.click(); // SearchableSelect dropdown open
      } else {
        host.focus({ preventScroll: true });
      }
    }, 350);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <PageLoader icon={ClipboardList} label="loading..." tone="blue" />;

  const mechOptions = mechanics.map((m) => ({
    id: m.id,
    name: [m.firstname, m.middlename, m.lastname].filter(Boolean).join(" "),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {/* ── Header ── */}
        <div className="bg-panel border border-app rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
              <Wrench size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">Bulk Job Sheet Entry</h1>
              <p className="text-[10px] text-muted uppercase tracking-wider">
                Multi-item entry · Start Job ID:
                <span className="ml-1 text-amber-400 font-black">#{baseJobId}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/jobs"
              className="flex items-center gap-1.5 px-4 py-2 bg-panel-2 border border-app-2 hover:bg-panel-2 text-app-2 rounded-xl text-xs font-bold no-underline transition-all"
            >
              <ArrowLeft size={13} /> Cancel
            </Link>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={13} /> Save All Items
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Client + Global Mechanic ── */}
        <div className="bg-panel border border-app rounded-2xl p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <SearchableSelect
                value={clientId || null}
                options={clients.map((c) => {
                  const name = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ");
                  return { id: c.id, label: name, sub: c.contact ? `(${c.contact})` : undefined };
                })}
                onSelect={(v) => setClientId(v)}
                placeholder="Search Client..."
                clearLabel="Search Client..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Default Mechanic (sabhi rows ke liye)
              </label>
              <SearchableSelect
                value={globalMech || null}
                options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                onSelect={(v) => applyGlobalMech(v)}
                placeholder="Select Default Mechanic"
                clearLabel="Select Default Mechanic"
              />
              <p className="text-[9px] text-muted-2 mt-1.5">
                Select karne par sabhi rows (purani aur nayi dono) me apply hota hai
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                Default Service Type
              </label>
              <SearchableSelect
                value={globalServiceType ?? null}
                options={serviceTypeOpts(globalServiceType)}
                onSelect={applyGlobalServiceType}
                placeholder="Select Default Service Type"
              />
              <p className="text-[9px] text-muted-2 mt-1.5">
                Repair default hai. Per-row badalne par us row ka choice enforce hota hai.
              </p>
            </div>
          </div>
        </div>

        {/* ── Device identity ab per-row hai (global override hata diya) ── */}
        <div className="bg-panel/60 border border-app rounded-xl px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Device details har row me alag-alag bharo — kram: Item → Brand → Model → Identifier
          </p>
          <p className="text-[9px] text-muted-2 mt-0.5">
            Final label = Item · Brand · Model · Identifier. Item me kya cheez hai wo type karo;
            identifier optional hai — har item ka unique hota hai, isliye type karke bharo.
          </p>
        </div>

        {/* ── Validation Warning Banner ── */}
        {Object.keys(rowErrs).length > 0 && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-300 font-medium">
              Save nahi hoga — neeche red-marked fields check karo:
              <span className="block mt-0.5 text-red-400 font-bold">
                {rows
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => rowErrs[r.id])
                  .map(
                    ({ r, i }) =>
                      `Row ${i + 1} (#${r.estJobId}): ${rowErrs[r.id].join(", ")} missing`
                  )
                  .join("  |  ")}
              </span>
            </div>
          </div>
        )}

        {/* ── Rows — ek hi uniform grid (desktop 2×4, mobile 4×2) ── */}
        <div className="space-y-3">
          {rows.map((row, i) => {
            const rErrs = rowErrs[row.id];
            const itemErr = fieldErr(rErrs, "Item / Model");
            const faultErr = fieldErr(rErrs, "Fault Reported");
            const mechErr = fieldErr(rErrs, "Mechanic");
            return (
              <div
                key={row.id}
                data-bulk-row={row.id}
                className={`bg-panel border rounded-2xl overflow-hidden ${
                  rErrs ? "border-red-500/50" : "border-app"
                }`}
              >
                {/* Row header */}
                <div
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${
                    rErrs ? "bg-red-500/10 border-red-500/30" : "bg-panel-2/50 border-app"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center text-[11px] font-black">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-wider text-muted-2">
                        Job ID (Est.)
                      </p>
                      <p className="flex items-center gap-1 text-xs font-black text-amber-400">
                        <Hash size={10} /> {row.estJobId}
                      </p>
                    </div>
                    {rErrs && (
                      <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1 truncate">
                        {rErrs.join(", ")} missing
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    title="Is row ko hatao"
                    className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} />
                    <span className="hidden sm:inline text-[10px] font-bold">Remove</span>
                  </button>
                </div>

                {/* 4 identity fields — Item → Brand → Model → Identifier, har row me yahi kram */}
                <div className="px-4 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1) ITEM — kya cheez hai; final label neeche preview me. */}
                  <BulkField label="Item" required error={itemErr}>
                    <input
                      type="text"
                      data-bulk-input-item={row.id}
                      value={row.itemName}
                      onChange={(e) => updateRow(row.id, { itemName: e.target.value })}
                      placeholder="e.g. Ceiling Fan"
                      className={itemErr ? iClsErr : iCls}
                    />
                  </BulkField>

                  {/* 2) BRAND */}
                  <BulkField label="Brand" error={itemErr}>
                    <div data-bulk-input-brand={row.id}>
                      <DeviceFieldPicker
                        kind="brand"
                        value={row.brandId}
                        options={brandOptions}
                        onSelect={(id, label) => {
                          const nextId = typeof id === "number" ? id : null;
                          updateRow(row.id, {
                            brandId: nextId,
                            brandName: label,
                            model: row.brandId && nextId !== row.brandId ? "" : row.model,
                          });
                        }}
                      />
                    </div>
                  </BulkField>

                  {/* 3) MODEL */}
                  <BulkField label="Model">
                    <DeviceFieldPicker
                      kind="model"
                      value={row.model}
                      brandId={row.brandId}
                      options={modelOptionsFor(row.brandId)}
                      onSelect={(_v, label) => updateRow(row.id, { model: label })}
                    />
                  </BulkField>

                  {/* 4) IDENTIFIER — optional free text */}
                  <BulkField label="Identifier">
                    <input
                      type="text"
                      value={row.serial}
                      onChange={(e) => updateRow(row.id, { serial: e.target.value })}
                      onBlur={(e) =>
                        updateRow(row.id, { serial: normalizeIdentifier(e.target.value) })
                      }
                      placeholder="Optional · S/N / IMEI"
                      maxLength={120}
                      className={iCls}
                    />
                  </BulkField>
                </div>

                {/* Preview identity fields ke baad — sab card me yahi jagah. */}
                <div className="px-4 pt-2">
                  <p
                    className="text-[9px] text-muted-2 truncate"
                    title={itemOf(row) || "Item · Brand · Model · Identifier"}
                  >
                    Final label: {itemOf(row) || "—"}
                  </p>
                </div>

                {/* Baaki fields — same label + same control height */}
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 5) SERVICE TYPE — default global, per-row override */}
                  <BulkField label="Service Type" required>
                    <div data-bulk-service-type={row.id}>
                      <SearchableSelect
                        value={row.serviceTypeId ?? null}
                        options={serviceTypeOpts(row.serviceTypeId)}
                        onSelect={(id) => setRowServiceType(row.id, id ? parseInt(id, 10) : null)}
                        placeholder="Select service type"
                      />
                    </div>
                  </BulkField>

                  {/* 6) FAULT / WORK DESCRIPTION — type ke hisaab se label */}
                  <BulkField label={faultFieldLabel(rowFaultRequired(row))} error={faultErr}>
                    <input
                      type="text"
                      data-bulk-input-fault={row.id}
                      value={row.fault}
                      onChange={(e) => updateRow(row.id, { fault: e.target.value })}
                      placeholder={
                        rowFaultRequired(row) ? "Reported fault" : "Kaam ka scope (optional)"
                      }
                      className={faultErr ? iClsErr : iCls}
                    />
                    {faultHint(rowFaultRequired(row)) && (
                      <p className="text-[9px] text-muted-2 mt-1">
                        {faultHint(rowFaultRequired(row))}
                      </p>
                    )}
                  </BulkField>

                  {/* 6) ASSIGN TO */}
                  <BulkField label="Assign To" error={mechErr}>
                    <div
                      data-bulk-mech={row.id}
                      className={mechErr ? "rounded-xl ring-2 ring-red-500/60" : ""}
                    >
                      <SearchableSelect
                        value={row.mechanic_id}
                        options={mechOptions.map((m) => ({ id: m.id, label: m.name }))}
                        onSelect={(v) => updateRow(row.id, { mechanic_id: v })}
                        placeholder="Select mechanic"
                        clearLabel="Select mechanic"
                      />
                    </div>
                  </BulkField>

                  {/* 7) UNIQUE ID */}
                  <BulkField label="Unique ID">
                    <input
                      type="text"
                      value={row.uniq_id}
                      onChange={(e) => updateRow(row.id, { uniq_id: e.target.value })}
                      placeholder="Location / ID"
                      className={iCls}
                    />
                  </BulkField>

                  {/* 8) REMARKS */}
                  <BulkField label="Remarks">
                    <input
                      type="text"
                      value={row.remark}
                      onChange={(e) => updateRow(row.id, { remark: e.target.value })}
                      placeholder="Additional notes"
                      className={iCls}
                    />
                  </BulkField>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 py-2">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-5 py-2.5 bg-panel-2 border border-app-2 hover:bg-panel-2 text-app-2 rounded-xl text-sm font-bold transition-all"
          >
            <Plus size={15} /> Add New Row
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-2">
              {rows.filter((r) => itemOf(r) && (!rowFaultRequired(r) || r.fault.trim())).length} /{" "}
              {rows.length} rows filled
            </span>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/30"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save All Items
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
