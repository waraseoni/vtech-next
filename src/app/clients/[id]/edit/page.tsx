"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import {
  Save, ArrowLeft, UserPlus, Loader2, Edit3,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// STYLE CONSTANTS (dark theme)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-4 py-3 rounded-xl bg-[#111520] border border-[#21293d] text-white " +
  "placeholder:text-slate-700 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 " +
  "outline-none transition-all text-sm font-medium [color-scheme:dark]";
const labelCls =
  "block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5";
const errCls = "text-red-400 text-xs mt-1 font-medium";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type FormState = {
  firstname:       string;
  middlename:      string;
  lastname:        string;
  contact:         string;
  email:           string;
  address:         string;
  opening_balance: string;
};
type FieldErrors = Partial<Record<keyof FormState, string>>;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// Email is OPTIONAL — only validate format if user typed something
// ─────────────────────────────────────────────────────────────────────────────
function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!form.firstname.trim()) e.firstname = "First name is required";
  if (!form.lastname.trim())  e.lastname  = "Last name is required";

  if (!form.contact.trim()) {
    e.contact = "Contact number is required";
  } else if (!/^[0-9]{10}$/.test(form.contact.trim())) {
    e.contact = "Enter valid 10-digit number";
  }

  // BUG FIX — Email optional: only validate if user actually typed something
  if (form.email.trim()) {
    const emailRe  = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const mobileRe = /^[0-9]{10}$/;
    if (!emailRe.test(form.email.trim()) && !mobileRe.test(form.email.trim()))
      e.email = "Enter valid email or 10-digit mobile";
  }

  if (!form.address.trim()) e.address = "Address is required";
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ManageClientPage() {
  const router = useRouter();
  const params = useParams();

  // isEdit detection: useParams() on /clients/new returns {} (no 'id' key)
  // On /clients/[id]/edit it returns { id: "123" }
  const rawId   = params?.id as string | undefined;
  const clientId = rawId ? parseInt(rawId) : null;
  const isEdit   = !!clientId && !isNaN(clientId);

  const [loading,      setLoading]      = useState(false);  // submit spinner
  const [fetchLoading, setFetchLoading] = useState(isEdit); // initial data load
  const [errors,       setErrors]       = useState<FieldErrors>({});
  const [submitted,    setSubmitted]    = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [form, setForm] = useState<FormState>({
    firstname: "", middlename: "", lastname: "",
    contact: "", email: "", address: "", opening_balance: "0.00",
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FETCH EXISTING CLIENT (edit mode) ──────────────────────────────────
  useEffect(() => {
    if (!isEdit || !clientId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("client_list")
          .select("firstname, middlename, lastname, contact, email, address, opening_balance")
          .eq("id", clientId)
          .eq("delete_flag", 0)
          .single();
        if (error) throw error;
        if (data) setForm({
          firstname:       data.firstname       || "",
          middlename:      data.middlename      || "",
          lastname:        data.lastname        || "",
          contact:         data.contact         || "",
          email:           data.email           || "",
          address:         data.address         || "",
          opening_balance: data.opening_balance?.toString() || "0.00",
        });
      } catch (err) {
        console.error("fetch error:", err instanceof Error ? err.message : JSON.stringify(err));
        setToast({ type: "error", msg: "Client details load nahi ho paye!" });
        router.push("/clients");
      } finally {
        setFetchLoading(false);
      }
    })();
  }, [clientId, isEdit, router]);

  // ── FIELD CHANGE ────────────────────────────────────────────────────────
  const handleChange = (field: keyof FormState, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (submitted) setErrors(validate(updated));
  };

  // ── SUBMIT ──────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // BUG FIX — Double-submit guard: disable button immediately on first click
    if (loading) return;

    setSubmitted(true);
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    // Set loading BEFORE async call to prevent double-submit
    setLoading(true);

    try {
      const payload = {
        firstname:       form.firstname.trim(),
        middlename:      form.middlename.trim() || null,
        lastname:        form.lastname.trim(),
        contact:         form.contact.trim(),
        // BUG FIX — email NOT NULL in DB:
        // MySQL schema has `email text NOT NULL` — migrated to Supabase with same constraint.
        // Saving null crashes with NOT NULL violation.
        // Fix: save empty string "" when email is blank (DB accepts empty string).
        email:           form.email.trim(),   // empty string is safe, null is not
        address:         form.address.trim(),
        opening_balance: parseFloat(form.opening_balance) || 0,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("client_list")
          .update({ ...payload, date_updated: new Date().toISOString() })
          .eq("id", clientId);
        if (error) throw error;
        setToast({ type: "success", msg: "Client update ho gaya! ✅" });
        setTimeout(() => router.push("/clients"), 1000);
      } else {
        // BUG FIX — DUPLICATE KEY (client_list_pkey):
        // Root cause: MySQL had AUTO_INCREMENT=271 but Supabase sequence was NOT reset
        // after data import. So Supabase tries id=1, id=2... which already exist.
        //
        // PERMANENT FIX (run once in Supabase SQL Editor):
        //   SELECT setval(
        //     pg_get_serial_sequence('client_list', 'id'),
        //     (SELECT COALESCE(MAX(id), 0) + 1 FROM client_list)
        //   );
        //
        // Code-level safeguard: we do NOT pass any id in the insert payload —
        // let Supabase auto-generate it from the sequence.
        const { error } = await supabase
          .from("client_list")
          .insert([{
            ...payload,
            delete_flag:  0,
            date_created: new Date().toISOString(),
          }]);
        if (error) {
          // Give user a helpful message for the known sequence bug
          if (error.message?.includes("duplicate key") || error.code === "23505") {
            throw new Error(
              "Database sequence error! Supabase SQL Editor mein yeh run karo:\n" +
              "SELECT setval(pg_get_serial_sequence('client_list','id'), (SELECT MAX(id) FROM client_list));\n" +
              "Phir dobara try karo."
            );
          }
          throw error;
        }
        setToast({ type: "success", msg: "New client add ho gaya! ✅" });
        setTimeout(() => router.push("/clients"), 1000);
      }
    } catch (err) {
      console.error("save error:", err instanceof Error ? err.message : JSON.stringify(err));
      setToast({ type: "error", msg: err instanceof Error ? err.message : "Save karne mein galti!" });
    } finally {
      setLoading(false);
    }
  };

  // ── LOADING STATE ───────────────────────────────────────────────────────
  if (fetchLoading) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-slate-500 text-xs font-extrabold uppercase tracking-[0.3em]">
        Loading Client…
      </p>
    </div>
  );

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans p-4 md:p-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">

        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <Link
            href="/clients"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-medium"
          >
            All Clients
          </Link>
        </div>

        {/* Form Card */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">

          {/* Card Header */}
          <div className="px-6 py-5 border-b border-[#21293d] flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${
              isEdit
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-blue-500/10 border-blue-500/20"
            }`}>
              {isEdit
                ? <Edit3 size={22} className="text-amber-400" />
                : <UserPlus size={22} className="text-blue-400" />}
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                {isEdit ? "Edit Client" : "New Client"}
              </h1>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mt-0.5">
                {isEdit
                  ? `Editing Client #${clientId}`
                  : "Add a new client to the system"}
              </p>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} noValidate className="p-6 space-y-5">

            {/* First Name + Middle Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" placeholder="Enter first name"
                  value={form.firstname}
                  onChange={e => handleChange("firstname", e.target.value)}
                  className={`${inputCls} ${errors.firstname ? "border-red-500" : ""}`}
                />
                {errors.firstname && <p className={errCls}>{errors.firstname}</p>}
              </div>
              <div>
                <label className={labelCls}>
                  Middle Name{" "}
                  <span className="text-slate-600 normal-case font-semibold text-[9px]">
                    (optional)
                  </span>
                </label>
                <input
                  type="text" placeholder="Enter middle name"
                  value={form.middlename}
                  onChange={e => handleChange("middlename", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Last Name + Opening Balance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" placeholder="Enter last name"
                  value={form.lastname}
                  onChange={e => handleChange("lastname", e.target.value)}
                  className={`${inputCls} ${errors.lastname ? "border-red-500" : ""}`}
                />
                {errors.lastname && <p className={errCls}>{errors.lastname}</p>}
              </div>
              <div>
                <label className={labelCls}>Opening Balance</label>
                <input
                  type="number" step="0.01" placeholder="0.00"
                  value={form.opening_balance}
                  onChange={e => handleChange("opening_balance", e.target.value)}
                  className={`${inputCls} text-right`}
                />
                <p className="text-[9px] text-slate-600 mt-1">
                  Positive = Due from client · Negative = Advance paid
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className={labelCls}>
                WhatsApp / Contact <span className="text-red-500">*</span>
              </label>
              <input
                type="tel" placeholder="10-digit mobile number" maxLength={10}
                value={form.contact}
                onChange={e => handleChange("contact", e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} ${errors.contact ? "border-red-500" : ""}`}
              />
              {errors.contact && <p className={errCls}>{errors.contact}</p>}
            </div>

            {/* Email — OPTIONAL */}
            <div>
              <label className={labelCls}>
                Email or Secondary Mobile{" "}
                <span className="text-slate-600 normal-case font-semibold text-[9px]">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                placeholder="example@gmail.com ya secondary mobile"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                className={`${inputCls} ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && <p className={errCls}>{errors.email}</p>}
              {/* Hint that it's truly optional */}
              {!errors.email && (
                <p className="text-[9px] text-slate-700 mt-1">
                  Khali chhod sakte hain — zaruri nahi
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3} placeholder="Complete address..."
                value={form.address}
                onChange={e => handleChange("address", e.target.value)}
                className={`${inputCls} resize-none ${errors.address ? "border-red-500" : ""}`}
              />
              {errors.address && <p className={errCls}>{errors.address}</p>}
            </div>

            <div className="border-t border-[#21293d]" />

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  isEdit
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                }`}
              >
                {loading
                  ? <><Loader2 className="animate-spin" size={16} />Saving…</>
                  : <><Save size={16} />{isEdit ? "Update Client" : "Save Client"}</>}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 sm:flex-none sm:px-8 py-3 rounded-xl font-bold text-sm bg-[#21293d] hover:bg-[#2a3550] text-slate-300 transition-all"
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}