"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/imageCompression";
import { openCamera } from "@/lib/nativeCamera";
import { openImageLightbox } from "@/components/ImageLightbox";
import {
  X,
  Camera,
  ImageIcon,
  Trash2,
  Loader2,
  AlertCircle,
  Plus,
  Check,
  Star,
} from "lucide-react";

export type SupplierRow = {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  address: string | null;
  status: number;
  delete_flag: number;
  date_created: string;
  photo_url?: string | null;
};

export type SupplierContact = {
  id?: number;
  label: string;
  phone: string;
  is_primary: boolean;
};

const CONTACT_LABELS = ["Mobile", "Office", "WhatsApp", "Shop", "Other"];

const defaultContacts: SupplierContact[] = [{ label: "Mobile", phone: "", is_primary: true }];

type Props = {
  open: boolean;
  editing: SupplierRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function SupplierFormModal({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ name: "", email: "", address: "" });
  const [contacts, setContacts] = useState<SupplierContact[]>(defaultContacts);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imgSaving, setImgSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [imgPopup, setImgPopup] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const imgCamRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: editing?.name || "",
      email: editing?.email || "",
      address: editing?.address || "",
    });
    setPhotoUrl(editing?.photo_url || "");
    setPhotoPreview("");
    setPhotoFile(null);
    setPhotoRemoved(false);
    setFormErr("");
    setImgPopup(false);
    setContacts(defaultContacts);

    if (editing) {
      supabase
        .from("supplier_contacts")
        .select("id, label, phone, is_primary")
        .eq("supplier_id", editing.id)
        .order("is_primary", { ascending: false })
        .then(({ data }) => {
          const list = (data || []) as SupplierContact[];
          if (list.length === 0) {
            // Fallback: suppliers.contact (migration seed ke baad shouldn't happen)
            setContacts(
              editing.contact ? [{ label: "Mobile", phone: editing.contact, is_primary: true }] : []
            );
          } else {
            setContacts(list);
          }
        });
    }
  }, [open, editing]);

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    setPhotoRemoved(false);
  };

  const removeImg = () => {
    if (photoFile) {
      setPhotoFile(null);
      setPhotoPreview("");
      setPhotoRemoved(!!photoUrl);
    } else if (photoUrl) {
      setPhotoFile(null);
      setPhotoPreview("");
      setPhotoRemoved(true);
    }
  };

  const uploadPhoto = async (supplierId: number) => {
    if (!photoFile) return;
    setImgSaving(true);
    try {
      // Visiting card pe text readable rahe — 1400px tak scale, canvas se
      // compress karke ≤100KB mein upload (imageCompression hard cap).
      const compressed = await compressImage(photoFile, 1400);
      const fd = new FormData();
      fd.append("file", compressed.file);
      fd.append("supplierId", String(supplierId));
      const res = await fetch("/api/supplier-photo", { method: "POST", body: fd });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.msg || "Upload failed");
      setPhotoUrl(json.url);
      setPhotoFile(null);
      setPhotoPreview("");
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : "Image upload fail");
    } finally {
      setImgSaving(false);
    }
  };

  const removePhoto = async (supplierId: number) => {
    if (!photoRemoved) return;
    if (photoFile) setPhotoFile(null);
    const fd = new FormData();
    fd.append("supplierId", String(supplierId));
    fd.append("delete", "1");
    await fetch("/api/supplier-photo", { method: "POST", body: fd });
    setPhotoUrl("");
    setPhotoPreview("");
    setPhotoRemoved(false);
  };

  const updateContact = (i: number, patch: Partial<SupplierContact>) => {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const setPrimary = (i: number) => {
    setContacts((prev) =>
      prev.map((c, idx) => ({ ...c, is_primary: idx === i }))
    );
  };

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { label: "Mobile", phone: "", is_primary: prev.length === 0 },
    ]);
  };

  const removeContact = (i: number) => {
    setContacts((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length > 0 && !next.some((c) => c.is_primary)) next[0].is_primary = true;
      return next;
    });
  };

  const syncContacts = async (supplierId: number, list: SupplierContact[]) => {
    await supabase.from("supplier_contacts").delete().eq("supplier_id", supplierId);
    if (list.length === 0) return;
    const { error } = await supabase.from("supplier_contacts").insert(
      list.map((c) => ({
        supplier_id: supplierId,
        label: c.label.trim() || "Mobile",
        phone: c.phone.trim(),
        is_primary: c.is_primary,
      }))
    );
    if (error) throw error;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormErr("Supplier name zaroori hai!");
      return;
    }
    // Normalize + trim valid contacts
    const valid = contacts
      .map((c) => ({
        label: c.label.trim() || "Mobile",
        phone: c.phone.trim(),
        is_primary: c.is_primary,
      }))
      .filter((c) => c.phone !== "");
    if (valid.length > 0 && !valid.some((c) => c.is_primary)) valid[0].is_primary = true;
    const primary = valid.find((c) => c.is_primary)?.phone || valid[0]?.phone || "";

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: primary,
        email: form.email.trim(),
        address: form.address.trim(),
        status: 1,
      };

      let supplierId = editing?.id ?? 0;
      if (editing) {
        const { error } = await supabase
          .from("suppliers")
          .update({ ...payload, date_updated: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("suppliers")
          .insert([{ ...payload, delete_flag: 0 }])
          .select("id")
          .single();
        if (error) throw error;
        supplierId = data.id;
      }

      await syncContacts(supplierId, valid);

      if (photoRemoved) await removePhoto(supplierId);
      if (photoFile) await uploadPhoto(supplierId);

      onClose();
      onSaved();
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const previewSrc = photoPreview || photoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#21293d]">
          <h3 className="font-bold text-white flex items-center gap-2">
            {editing ? (
              <>
                <Check size={16} className="text-blue-400" /> Edit Supplier
              </>
            ) : (
              <>
                <Plus size={16} className="text-blue-400" /> Add Supplier
              </>
            )}
          </h3>
          <button
            onClick={onClose}
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

          {/* Visiting card image */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Visiting Card
            </label>
            <div className="bg-[#0d1117] rounded-xl border border-[#21293d] p-4">
              <div className="flex items-center gap-4 flex-wrap">
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt="Visiting card"
                    width={112}
                    height={112}
                    className="w-28 h-28 rounded-xl object-cover border border-[#21293d] cursor-zoom-in"
                    onDoubleClick={() => openImageLightbox(previewSrc, "Visiting Card Preview")}
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-white/5 border border-dashed border-[#2a3450] flex items-center justify-center">
                    <ImageIcon size={28} className="text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-[160px]">
                  <input
                    ref={imgRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImgChange}
                    className="hidden"
                  />
                  <input
                    ref={imgCamRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="environment"
                    onChange={handleImgChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setImgPopup(!imgPopup)}
                      disabled={saving || imgSaving}
                      className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Camera size={12} /> Choose Image
                      </span>
                    </button>
                    {imgPopup && (
                      <div className="relative">
                        <div className="absolute top-full left-0 mt-1 z-50 bg-[#161b27] border border-[#2e3a55] rounded-xl shadow-2xl p-1.5 min-w-[120px]">
                          <button
                            type="button"
                            onClick={() => {
                              setImgPopup(false);
                              void openCamera(
                                (f) =>
                                  handleImgChange({
                                    target: { files: [f], value: "" },
                                  } as unknown as React.ChangeEvent<HTMLInputElement>),
                                imgCamRef
                              );
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white rounded-lg hover:bg-blue-600/20 transition-colors"
                          >
                            <Camera size={12} /> Camera
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImgPopup(false);
                              imgRef.current?.click();
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white rounded-lg hover:bg-blue-600/20 transition-colors"
                          >
                            <ImageIcon size={12} /> Gallery
                          </button>
                        </div>
                      </div>
                    )}
                    {previewSrc && (
                      <button
                        type="button"
                        onClick={removeImg}
                        disabled={saving || imgSaving}
                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-all disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Trash2 size={12} /> {photoFile ? "Cancel" : "Remove"}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5">
                    {imgSaving ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Uploading...
                      </span>
                    ) : (
                      "Visiting card photo (kamera ya gallery se)"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Supplier Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Raj Electronics, Patel Traders"
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
            />
          </div>

          {/* Contact numbers */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Contact Numbers <span className="text-slate-700">(ek se zyada ho sakein)</span>
            </label>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={c.label}
                    onChange={(e) => updateContact(i, { label: e.target.value })}
                    className="px-2 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-xs text-slate-300 outline-none focus:border-blue-500"
                  >
                    {CONTACT_LABELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <input
                    value={c.phone}
                    onChange={(e) => updateContact(i, { phone: e.target.value })}
                    placeholder="Phone no."
                    className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-lg text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => setPrimary(i)}
                    title={c.is_primary ? "Primary contact" : "Primary banao"}
                    className={`p-1.5 rounded-lg transition ${
                      c.is_primary
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-white/5 text-slate-600 hover:text-amber-400"
                    }`}
                  >
                    <Star size={14} fill={c.is_primary ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="p-1.5 rounded-lg bg-white/5 text-slate-600 hover:text-red-400 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors"
              >
                <Plus size={13} /> Add Contact
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="supplier@example.com"
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full address..."
              rows={2}
              className="w-full px-3 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500 resize-none"
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
              onClick={onClose}
              className="px-6 py-2.5 bg-[#111520] border border-[#21293d] text-slate-400 rounded-xl font-bold text-sm hover:bg-[#1a2234] transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}