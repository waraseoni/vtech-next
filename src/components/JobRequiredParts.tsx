"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { openImageLightbox } from "@/components/ImageLightbox";
import { safeImageSrc } from "@/lib/image-utils";
import {
  Plus,
  X,
  Camera,
  Trash2,
  CheckCircle2,
  Loader2,
  Package,
  Truck,
  Clock,
  PackagePlus,
} from "lucide-react";
import {
  listRequiredParts,
  addRequiredPart,
  setRequiredPartStatus,
  receiveRequiredPartQty,
  removeRequiredPart,
  updateRequiredPart,
  type RequiredPart,
  type RequiredPartStatus,
} from "@/lib/requiredParts";

const inputCls =
  "w-full px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white outline-none focus:border-blue-500/60 transition-all placeholder:text-slate-700";
const labelCls = "block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";

interface Props {
  numId: number;
  jobStatus: number;
  onToast: (t: { type: "success" | "error"; msg: string }) => void;
}

const STATUS_CHIP: Record<RequiredPartStatus, string> = {
  0: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  2: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};
const STATUS_LABEL: Record<RequiredPartStatus, string> = {
  0: "Waiting",
  1: "Ordered",
  2: "Arrived",
};

function daysOld(d: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}

export default function JobRequiredParts({ numId, jobStatus, onToast }: Props) {
  const closed = jobStatus === 4 || jobStatus === 5;
  const [parts, setParts] = useState<RequiredPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Master data
  const [suppliers, setSuppliers] = useState<{ id: number; name: string; contact: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string; price: string | number }[]>(
    []
  );

  // Add form
  const [useCustom, setUseCustom] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [supplierId, setSupplierId] = useState<string>("");
  const [sourceName, setSourceName] = useState("");
  const [phone, setPhone] = useState("");
  const [eta, setEta] = useState("");
  const [remark, setRemark] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [p, sup, prod] = await Promise.all([
        listRequiredParts(numId, true),
        supabase.from("suppliers").select("id, name, contact").eq("delete_flag", 0).eq("status", 1),
        supabase
          .from("product_list")
          .select("id, name, price")
          .eq("delete_flag", 0)
          .eq("status", 1),
      ]);
      setParts(p);
      setSuppliers((sup.data || []) as { id: number; name: string; contact: string }[]);
      setProducts((prod.data || []) as { id: number; name: string; price: string | number }[]);
    } catch (e) {
      onToast({ type: "error", msg: e instanceof Error ? e.message : "Parts load fail" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numId]);

  const filtered = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products.slice(0, 20);

  const pickProduct = (id: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setPicked(id);
    setName(p.name);
    setSearch(p.name);
  };

  const resetForm = () => {
    setUseCustom(true);
    setSearch("");
    setPicked(null);
    setName("");
    setQty("1");
    setSupplierId("");
    setSourceName("");
    setPhone("");
    setEta("");
    setRemark("");
    setShowForm(false);
  };

  const submit = async () => {
    const finalName = (name || "").trim();
    if (!finalName) {
      onToast({ type: "error", msg: "Spare ka naam do!" });
      return;
    }
    setSaving(true);
    try {
      await addRequiredPart({
        transaction_id: numId,
        product_id: useCustom ? null : picked,
        product_name: finalName,
        qty_needed: parseInt(qty) || 1,
        supplier_id: supplierId ? parseInt(supplierId) : null,
        source_name: sourceName.trim() || (supplierId ? undefined : null),
        phone: phone.trim() || null,
        eta: eta || null,
        remark: remark.trim() || null,
      });
      onToast({ type: "success", msg: "Required spare add ho gaya! ✅" });
      resetForm();
      await load();
    } catch (e) {
      onToast({ type: "error", msg: e instanceof Error ? e.message : "Add fail" });
    } finally {
      setSaving(false);
    }
  };

  // ── Photo upload (spare-photos API, URL → job_required_parts.photo_url) ──
  const uploadPhoto = async (part: RequiredPart, file: File) => {
    setUploading(part.id);
    try {
      if (part.photo_url?.includes("/spare-photos/")) {
        await fetch("/api/spare-photos", {
          method: "POST",
          body: (() => {
            const f = new FormData();
            f.append("action", "delete");
            f.append("imagePath", part.photo_url);
            return f;
          })(),
        }).catch(() => {});
      }
      const fd = new FormData();
      fd.append("action", "upload");
      fd.append("file", file);
      const res = await fetch("/api/spare-photos", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.msg || "Photo upload fail");
      await updateRequiredPart(part.id, numId, { photo_url: json.url });
      await load();
      onToast({ type: "success", msg: "Spare photo save ho gayi ✅" });
    } catch (e) {
      onToast({ type: "error", msg: e instanceof Error ? e.message : "Photo fail" });
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (part: RequiredPart) => {
    try {
      if (part.photo_url?.includes("/spare-photos/")) {
        await fetch("/api/spare-photos", {
          method: "POST",
          body: (() => {
            const f = new FormData();
            f.append("action", "delete");
            f.append("imagePath", part.photo_url);
            return f;
          })(),
        }).catch(() => {});
      }
      await updateRequiredPart(part.id, numId, { photo_url: null });
      await load();
    } catch (e) {
      onToast({ type: "error", msg: e instanceof Error ? e.message : "Photo remove fail" });
    }
  };

  if (loading)
    return (
      <div className="bg-[#111520] border border-[#21293d] rounded-lg p-4 flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 size={14} className="animate-spin" /> Required saman load ho raha hai...
      </div>
    );

  const openCount = parts.filter((p) => p.status < 2).length;

  return (
    <fieldset className="border-2 border-amber-500/30 rounded-lg bg-[#111520] mb-4">
      <legend className="px-3 py-1 text-sm font-bold text-amber-400 ml-3 flex items-center gap-1.5">
        <Package size={14} />
        Required Saman (Waiting Parts)
        {openCount > 0 && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/15 text-amber-300">
            {openCount}
          </span>
        )}
      </legend>
      <div className="px-4 pb-4 pt-1">
        {parts.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            Abhi koi required spare nahi hai.{" "}
            {closed
              ? "(Job delivered/cancelled ho chuki hai)"
              : "Job ko kis spare ke liye ruka hai wo add karo."}
          </p>
        ) : (
          <div className="space-y-3">
            {parts.map((part) => (
              <div
                key={part.id}
                className="border border-[#21293d] rounded-lg bg-[#0d1117] p-3 flex flex-col sm:flex-row gap-3"
              >
                {/* Photo */}
                <div className="w-16 h-16 shrink-0">
                  {part.photo_url ? (
                    <div className="relative group">
                      <Image
                        src={safeImageSrc(part.photo_url)}
                        alt="Spare"
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover rounded-lg border border-[#21293d] cursor-zoom-in"
                        onDoubleClick={() => openImageLightbox(part.photo_url!, "Required Spare")}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                      {!closed && (
                        <button
                          onClick={() => removePhoto(part)}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          title="Photo hatayein"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ) : !closed ? (
                    <>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading !== null}
                        className="w-16 h-16 rounded-lg border border-dashed border-[#2a3450] flex flex-col items-center justify-center text-slate-500 hover:text-amber-300 hover:border-amber-500/40 transition-all"
                      >
                        <Camera size={16} />
                        <span className="text-[9px] mt-0.5">Photo</span>
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto(part, f);
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#161b27] border border-[#21293d] flex items-center justify-center text-slate-600">
                      <X size={14} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-200 text-sm">{part.product_name}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${STATUS_CHIP[part.status]}`}
                    >
                      {STATUS_LABEL[part.status]}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock size={10} /> {daysOld(part.date_created)} din se waiting
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400 mt-1">
                    <span>
                      Qty:{" "}
                      <b className="text-slate-200">
                        {part.qty_received}/{part.qty_needed}
                      </b>
                    </span>
                    {part.source_name && (
                      <span className="flex items-center gap-1">
                        <Truck size={11} /> {part.source_name}
                        {part.phone && ` · ${part.phone}`}
                      </span>
                    )}
                    {part.eta && <span>ETA: {part.eta}</span>}
                    {part.remark && (
                      <span className="italic text-slate-500">&ldquo;{part.remark}&rdquo;</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!closed && (
                  <div className="flex flex-row sm:flex-col gap-2 flex-wrap">
                    {part.status === 0 && (
                      <button
                        onClick={async () => {
                          try {
                            await setRequiredPartStatus(part.id, numId, 1);
                            onToast({ type: "success", msg: "Ordered ✅" });
                            await load();
                          } catch (e) {
                            onToast({
                              type: "error",
                              msg: e instanceof Error ? e.message : "Fail",
                            });
                          }
                        }}
                        className="text-xs bg-blue-600/15 text-blue-300 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/25 transition-all inline-flex items-center gap-1"
                      >
                        <Truck size={12} /> Ordered
                      </button>
                    )}
                    {part.status !== 2 && (
                      <button
                        onClick={async () => {
                          try {
                            await setRequiredPartStatus(part.id, numId, 2);
                            onToast({ type: "success", msg: "Spare aa gaya ✅" });
                            await load();
                          } catch (e) {
                            onToast({
                              type: "error",
                              msg: e instanceof Error ? e.message : "Fail",
                            });
                          }
                        }}
                        className="text-xs bg-emerald-600/15 text-emerald-300 border border-emerald-600/30 px-3 py-1.5 rounded-lg hover:bg-emerald-600/25 transition-all inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Arrived
                      </button>
                    )}
                    {part.status === 1 && (
                      <button
                        onClick={async () => {
                          const v = window.prompt(
                            `Received qty (max ${part.qty_needed}):`,
                            String(part.qty_received)
                          );
                          if (v === null) return;
                          try {
                            await receiveRequiredPartQty(part.id, numId, parseInt(v) || 0);
                            onToast({ type: "success", msg: "Qty update ✅" });
                            await load();
                          } catch (e) {
                            onToast({
                              type: "error",
                              msg: e instanceof Error ? e.message : "Fail",
                            });
                          }
                        }}
                        className="text-xs bg-cyan-600/15 text-cyan-300 border border-cyan-600/30 px-3 py-1.5 rounded-lg hover:bg-cyan-600/25 transition-all"
                      >
                        Partial
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!window.confirm(`${part.product_name} delete karein?`)) return;
                        try {
                          await removeRequiredPart(part.id, numId);
                          onToast({ type: "success", msg: "Removed ✅" });
                          await load();
                        } catch (e) {
                          onToast({ type: "error", msg: e instanceof Error ? e.message : "Fail" });
                        }
                      }}
                      className="text-xs bg-red-600/10 text-red-400 border border-red-600/30 px-3 py-1.5 rounded-lg hover:bg-red-600/20 transition-all inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!closed && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-xs bg-amber-600/15 text-amber-300 border border-amber-600/30 px-4 py-2 rounded-xl hover:bg-amber-600/25 transition-all inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Required saman add karo
          </button>
        )}

        {!closed && showForm && (
          <div className="mt-3 border border-[#21293d] rounded-xl bg-[#161b27] p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setUseCustom(false);
                  setSearch("");
                  setPicked(null);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  !useCustom
                    ? "bg-blue-500/15 text-blue-300 border-blue-500/50"
                    : "bg-[#0d1117] text-slate-400 border-[#21293d]"
                }`}
              >
                Inventory product
              </button>
              <button
                onClick={() => {
                  setUseCustom(true);
                  setPicked(null);
                }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  useCustom
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/50"
                    : "bg-[#0d1117] text-slate-400 border-[#21293d]"
                }`}
              >
                Custom spare
              </button>
            </div>

            {!useCustom ? (
              <div>
                <label className={labelCls}>Product search</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search product..."
                  className={inputCls}
                />
                <div className="mt-1.5 max-h-40 overflow-y-auto border border-[#21293d] rounded-lg divide-y divide-[#21293d]">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p.id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#1a2030] transition-all ${
                        picked === p.id ? "bg-amber-500/10 text-amber-300" : "text-slate-300"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-600">No product found</div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelCls}>Spare naam *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SMPS Board, Belt A-42..."
                  className={inputCls}
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Qty</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Kahan se mangwana? (Supplier)</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Chuno / khoj —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.contact ? ` (${s.contact})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>ETA (kab tak)</label>
                <input
                  type="date"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Source (agar supplier list me nahi)</label>
                <input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Ranital Bazar, Mr. Sharma"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Vendor/supplier phone"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Remark</label>
              <input
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional note..."
                className={inputCls}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="text-xs bg-amber-600/20 text-amber-300 border border-amber-600/40 px-4 py-2 rounded-xl hover:bg-amber-600/30 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <PackagePlus size={14} />
                )}
                Add karo
              </button>
              <button
                onClick={resetForm}
                className="text-xs bg-slate-600/10 text-slate-400 border border-slate-600/30 px-4 py-2 rounded-xl hover:bg-slate-600/20 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
