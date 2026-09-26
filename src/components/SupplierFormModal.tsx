"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { compressImage } from "@/lib/imageCompression";
import { openCamera } from "@/lib/nativeCamera";
import { useImageUpload } from "@/lib/useImageUpload";
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
  // P2 enrichment (migration 20260913_suppliers_gst_bank.sql)
  gstin?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  credit_limit?: number | string | null;
  payment_terms?: string | null;
  city?: string | null;
  state?: string | null;
};

export type ContactPhone = {
  id?: number;
  label: string;
  phone: string;
  is_primary: boolean;
};

export type ContactPerson = {
  id?: number;
  name: string;
  role: string;
  notes: string;
  is_primary: boolean;
  phones: ContactPhone[];
};

export const CONTACT_LABELS = ["Mobile", "Office", "WhatsApp", "Shop", "Other"];

const defaultPersons: ContactPerson[] = [
  { name: "", role: "", notes: "", is_primary: true, phones: [{ label: "Mobile", phone: "", is_primary: true }] },
];

type Props = {
  open: boolean;
  editing: SupplierRow | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function SupplierFormModal({ open, editing, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    gstin: "",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    creditLimit: "",
    paymentTerms: "",
    city: "",
    state: "",
  });
  const [contacts, setContacts] = useState<ContactPerson[]>(defaultPersons);
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
  const { openCropper, cropperEl } = useImageUpload();

  useEffect(() => {
    if (!open) return;
    setForm({
      name: editing?.name || "",
      email: editing?.email || "",
      address: editing?.address || "",
      gstin: editing?.gstin || "",
      bankName: editing?.bank_name || "",
      bankAccount: editing?.bank_account || "",
      bankIfsc: editing?.bank_ifsc || "",
      creditLimit: editing?.credit_limit?.toString() || "",
      paymentTerms: editing?.payment_terms || "",
      city: editing?.city || "",
      state: editing?.state || "",
    });
    setPhotoUrl(editing?.photo_url || "");
    setPhotoPreview("");
    setPhotoFile(null);
    setPhotoRemoved(false);
    setFormErr("");
    setImgPopup(false);
    setContacts(defaultPersons);

    if (editing) {
      supabase
        .from("supplier_contact_persons")
        .select("id, name, role, notes, is_primary")
        .eq("supplier_id", editing.id)
        .order("is_primary", { ascending: false })
        .then(async ({ data }) => {
          const persons = (data || []) as Array<{
            id: number;
            name: string;
            role: string | null;
            notes: string | null;
            is_primary: boolean;
          }>;
          if (persons.length === 0) {
            // Fallback: suppliers.contact (abhi tak person model save nahi hua)
            setContacts(
              editing.contact
                ? [
                    {
                      id: undefined,
                      name: "",
                      role: "",
                      notes: "",
                      is_primary: true,
                      phones: [{ label: "Mobile", phone: editing.contact, is_primary: true }],
                    },
                  ]
                : defaultPersons
            );
            return;
          }
          const { data: phoneRows } = await supabase
            .from("supplier_contact_phones")
            .select("id, person_id, label, phone, is_primary")
            .in("person_id", persons.map((p) => p.id));
          const phoneMap: Record<number, ContactPhone[]> = {};
          for (const ph of (phoneRows || []) as Array<ContactPhone & { person_id: number }>) {
            if (!phoneMap[ph.person_id]) phoneMap[ph.person_id] = [];
            phoneMap[ph.person_id].push(ph);
          }
          for (const id of Object.keys(phoneMap))
            phoneMap[Number(id)].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
          setContacts(
            persons.map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role || "",
              notes: p.notes || "",
              is_primary: p.is_primary,
              phones: phoneMap[p.id] || [],
            }))
          );
        });
    }
  }, [open, editing]);

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    // Visiting card landscape photo hoti hai — 3:2 crop editor kholo,
    // user crop ya "original rakho" choose kare.
    void openCropper(f, { aspect: 3 / 2, title: "Visiting Card — Crop" }).then((cropped) => {
      if (!cropped) return;
      setPhotoFile(cropped);
      setPhotoPreview(URL.createObjectURL(cropped));
      setPhotoRemoved(false);
    });
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

  const updatePerson = (i: number, patch: Partial<ContactPerson>) => {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const setPrimaryPerson = (i: number) => {
    setContacts((prev) => prev.map((c, idx) => ({ ...c, is_primary: idx === i })));
  };

  const addPerson = () => {
    setContacts((prev) => [
      ...prev,
      { name: "", role: "", notes: "", is_primary: prev.length === 0, phones: [{ label: "Mobile", phone: "", is_primary: true }] },
    ]);
  };

  const removePerson = (i: number) => {
    setContacts((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length > 0 && !next.some((p) => p.is_primary)) next[0].is_primary = true;
      return next;
    });
  };

  const updatePhone = (pi: number, phi: number, patch: Partial<ContactPhone>) => {
    setContacts((prev) =>
      prev.map((p, pi2) =>
        pi2 === pi
          ? { ...p, phones: p.phones.map((ph, phi2) => (phi2 === phi ? { ...ph, ...patch } : ph)) }
          : p
      )
    );
  };

  const setPrimaryPhone = (pi: number, phi: number) => {
    setContacts((prev) =>
      prev.map((p, pi2) =>
        pi2 === pi ? { ...p, phones: p.phones.map((ph, phi2) => ({ ...ph, is_primary: phi2 === phi })) } : p
      )
    );
  };

  const addPhone = (pi: number) => {
    setContacts((prev) =>
      prev.map((p, pi2) =>
        pi2 === pi
          ? { ...p, phones: [...p.phones, { label: "Mobile", phone: "", is_primary: p.phones.length === 0 }] }
          : p
      )
    );
  };

  const removePhone = (pi: number, phi: number) => {
    setContacts((prev) =>
      prev.map((p, pi2) => {
        if (pi2 !== pi) return p;
        const next = p.phones.filter((_, phi2) => phi2 !== phi);
        if (next.length > 0 && !next.some((ph) => ph.is_primary)) next[0].is_primary = true;
        return { ...p, phones: next };
      })
    );
  };

  const syncContactPersons = async (supplierId: number, persons: ContactPerson[]) => {
    const { data: existing } = await supabase
      .from("supplier_contact_persons")
      .select("id, name")
      .eq("supplier_id", supplierId);
    const existingRows = (existing || []) as { id: number; name: string }[];

    const personIds: (number | null)[] = [];
    for (const p of persons) {
      const fields = {
        name: p.name.trim(),
        role: p.role.trim() || null,
        notes: p.notes.trim() || null,
        is_primary: p.is_primary,
      };
      let pid = p.id ?? null;
      if (pid) {
        const { error } = await supabase
          .from("supplier_contact_persons")
          .update({ ...fields, date_updated: new Date().toISOString() })
          .eq("id", pid);
        if (error) throw error;
      } else {
        // Naya person — pehle se naam se koi ho to usi ko update karo (id preserve,
        // taaki purane PO/payment person-links tootein nahi)
        const match = existingRows.find(
          (e) => e.name.trim().toLowerCase() === p.name.trim().toLowerCase()
        );
        if (match) {
          pid = match.id;
          const { error } = await supabase
            .from("supplier_contact_persons")
            .update({ ...fields, date_updated: new Date().toISOString() })
            .eq("id", pid);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("supplier_contact_persons")
            .insert([{ supplier_id: supplierId, ...fields }])
            .select("id")
            .single();
          if (error) throw error;
          pid = data.id;
        }
      }
      personIds.push(pid);

      // Phones: delete + reinsert (koi aur FK phones ko point nahi karta)
      const { error: delErr } = await supabase
        .from("supplier_contact_phones")
        .delete()
        .eq("person_id", pid);
      if (delErr) throw delErr;
      if (p.phones.length > 0) {
        const { error } = await supabase.from("supplier_contact_phones").insert(
          p.phones.map((ph) => ({
            person_id: pid,
            label: ph.label.trim() || "Mobile",
            phone: ph.phone.trim(),
            is_primary: ph.is_primary,
          }))
        );
        if (error) throw error;
      }
    }

    // Form se hata diye gaye persons → delete (phones cascade, PO/payment refs
    // set null ho jate hain)
    const kept = new Set(personIds.filter((x): x is number => x != null));
    const stale = existingRows.filter((e) => !kept.has(e.id));
    if (stale.length > 0) {
      const { error } = await supabase
        .from("supplier_contact_persons")
        .delete()
        .in("id", stale.map((e) => e.id));
      if (error) throw error;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormErr("Supplier name zaroori hai!");
      return;
    }
    // Normalize + trim valid persons (each with valid phones)
    const validPersons = contacts
      .map((p) => ({
        name: p.name.trim(),
        role: p.role.trim(),
        notes: p.notes.trim(),
        is_primary: p.is_primary,
        phones: p.phones
          .map((ph) => ({
            label: ph.label.trim() || "Mobile",
            phone: ph.phone.trim(),
            is_primary: ph.is_primary,
          }))
          .filter((ph) => ph.phone !== ""),
      }))
      .filter((p) => p.name !== "");
    if (validPersons.length > 0 && !validPersons.some((p) => p.is_primary)) validPersons[0].is_primary = true;
    for (const p of validPersons) {
      if (p.phones.length > 0 && !p.phones.some((ph) => ph.is_primary)) p.phones[0].is_primary = true;
    }
    const primaryPerson = validPersons.find((p) => p.is_primary) || validPersons[0];
    const primary =
      primaryPerson?.phones.find((ph) => ph.is_primary)?.phone ||
      primaryPerson?.phones[0]?.phone ||
      "";

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: primary,
        email: form.email.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim() || null,
        bank_name: form.bankName.trim() || null,
        bank_account: form.bankAccount.trim() || null,
        bank_ifsc: form.bankIfsc.trim() || null,
        credit_limit: form.creditLimit.trim() ? parseFloat(form.creditLimit) : null,
        payment_terms: form.paymentTerms.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
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

      await syncContactPersons(supplierId, validPersons);

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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-panel border border-app rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-app">
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
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted transition"
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
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Visiting Card
            </label>
            <div className="bg-app rounded-xl border border-app p-4">
              <div className="flex items-center gap-4 flex-wrap">
                {previewSrc ? (
                  <Image
                    src={previewSrc}
                    alt="Visiting card"
                    width={112}
                    height={112}
                    className="w-28 h-28 rounded-xl object-cover border border-app"
                    
                  />
                ) : (
                  <div className="w-28 h-28 rounded-xl bg-white/5 border border-dashed border-app-2 flex items-center justify-center">
                    <ImageIcon size={28} className="text-muted-2" />
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
                        <div className="absolute top-full left-0 mt-1 z-50 bg-panel border border-app-2 rounded-xl shadow-2xl p-1.5 min-w-[120px]">
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
                  <p className="text-[10px] text-muted-2 mt-1.5">
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
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Supplier Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Raj Electronics, Patel Traders"
              className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
            />
          </div>

          {/* Contact persons */}
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted">
              Contact Persons{" "}
              <span className="text-app">(firm ke 1 se zyada person, har ke 1+ mobile)</span>
            </label>
            {contacts.map((p, pi) => (
              <div
                key={pi}
                className="bg-panel-2/60 border border-app rounded-xl p-3 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPrimaryPerson(pi)}
                    title={p.is_primary ? "Primary person" : "Primary person banao"}
                    className={`p-1.5 rounded-lg transition ${
                      p.is_primary
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-white/5 text-muted-2 hover:text-amber-400"
                    }`}
                  >
                    <Star size={14} fill={p.is_primary ? "currentColor" : "none"} />
                  </button>
                  <span className="flex-1 px-3 py-2 bg-app border border-app rounded-lg text-xs text-app-2 font-bold">
                    Person {pi + 1}
                    {p.is_primary ? " — Primary" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePerson(pi)}
                    disabled={contacts.length <= 1}
                    title="Person hatao"
                    className="p-1.5 rounded-lg bg-white/5 text-muted-2 hover:text-red-400 disabled:opacity-40 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={p.name}
                    onChange={(e) => updatePerson(pi, { name: e.target.value })}
                    placeholder="Person ka naam (e.g. Ramesh)"
                    className="w-full px-3 py-2 bg-app border border-app rounded-lg text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                  />
                  <input
                    value={p.role}
                    onChange={(e) => updatePerson(pi, { role: e.target.value })}
                    placeholder="Role (e.g. Manager)"
                    className="w-full px-3 py-2 bg-app border border-app rounded-lg text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  {p.phones.length === 0 && (
                    <p className="text-[11px] text-muted-2">
                      Koi phone nahi. Neeche apne numbers add karo.
                    </p>
                  )}
                  {p.phones.map((ph, phi) => (
                    <div key={phi} className="flex flex-wrap items-center gap-2">
                      <select
                        value={ph.label}
                        onChange={(e) => updatePhone(pi, phi, { label: e.target.value })}
                        className="px-2 py-2 bg-app border border-app rounded-lg text-xs text-app-2 outline-none focus:border-blue-500"
                      >
                        {CONTACT_LABELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input
                        value={ph.phone}
                        onChange={(e) => updatePhone(pi, phi, { phone: e.target.value })}
                        placeholder="Phone no."
                        className="flex-1 px-3 py-2 bg-app border border-app rounded-lg text-sm text-white placeholder:text-app outline-none focus:border-blue-500 min-w-[110px]"
                      />
                      <button
                        type="button"
                        onClick={() => setPrimaryPhone(pi, phi)}
                        title={ph.is_primary ? "Primary number" : "Primary number banao"}
                        className={`p-1.5 rounded-lg transition ${
                          ph.is_primary
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-white/5 text-muted-2 hover:text-amber-400"
                        }`}
                      >
                        <Star size={13} fill={ph.is_primary ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhone(pi, phi)}
                        className="p-1.5 rounded-lg bg-white/5 text-muted-2 hover:text-red-400 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPhone(pi)}
                    className="flex items-center gap-1 text-[11px] text-muted hover:text-blue-300 font-bold transition-colors"
                  >
                    <Plus size={12} /> Phone aur add karo
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addPerson}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors"
            >
              <Plus size={13} /> Add Person
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="supplier@example.com"
              className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
              Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Full address..."
              rows={2}
              className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* GST / Tax Details */}
          <div className="border border-app rounded-xl p-3.5 space-y-3 bg-panel-2/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              GST / Tax Details
            </p>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                GSTIN
              </label>
              <input
                value={form.gstin}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                placeholder="e.g. 27ABCDE1234F1Z5"
                maxLength={15}
                className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500 uppercase"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="border border-app rounded-xl p-3.5 space-y-3 bg-panel-2/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Bank Details
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                  Bank Name
                </label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  placeholder="e.g. HDFC Bank"
                  className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                  Account Number
                </label>
                <input
                  value={form.bankAccount}
                  onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))}
                  placeholder="Account no."
                  className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                  IFSC
                </label>
                <input
                  value={form.bankIfsc}
                  onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value }))}
                  placeholder="e.g. HDFC0001234"
                  maxLength={11}
                  className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500 uppercase"
                />
              </div>
            </div>
          </div>

          {/* Business Terms */}
          <div className="border border-app rounded-xl p-3.5 space-y-3 bg-panel-2/60">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              Business Terms
            </p>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                Credit Limit (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                Payment Terms
              </label>
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="">— Select —</option>
                <option value="COD">COD (Cash on Delivery)</option>
                <option value="Net 15">Net 15 days</option>
                <option value="Net 30">Net 30 days</option>
                <option value="Credit 15 days">Credit 15 days</option>
                <option value="Advance">Advance / Full payment</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                  City
                </label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-muted-2 mb-1.5">
                  State
                </label>
                <input
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="State"
                  className="w-full px-3 py-2.5 bg-app border border-app rounded-xl text-sm text-white placeholder:text-app outline-none focus:border-blue-500"
                />
              </div>
            </div>
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
              className="px-6 py-2.5 bg-panel-2 border border-app text-muted rounded-xl font-bold text-sm hover:bg-panel-2 transition"
            >
              Cancel
            </button>
          </div>
        </form>
        {cropperEl}
      </div>
    </div>
  );
}
