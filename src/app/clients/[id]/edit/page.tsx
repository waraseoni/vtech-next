"use client";
import React, { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save, ArrowLeft, UserCheck, Loader2, Phone, MapPin, Mail,
  AlertCircle, CheckCircle2,
} from "lucide-react";

type Form = {
  firstname:  string;
  middlename: string;
  lastname:   string;
  contact:    string;
  email:      string;
  address:    string;
};

export default function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [form, setForm] = useState<Form>({
    firstname: "", middlename: "", lastname: "",
    contact: "", email: "", address: "",
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FETCH CLIENT ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchClient = async () => {
      try {
        // BUG FIX 1: Table is "client_list" — NOT "clients"
        // BUG FIX 5: Filter delete_flag=0 to exclude soft-deleted records
        const { data, error } = await supabase
          .from("client_list")                  // ← was "clients" (table doesn't exist)
          .select("firstname, middlename, lastname, contact, email, address")
          .eq("id", resolvedParams.id)
          .eq("delete_flag", 0)                 // ← was missing
          .single();

        // BUG FIX 4: Supabase error is a PostgREST object — NOT a plain JS Error.
        // console.error("Error:", err) prints {} because PostgREST props are non-enumerable.
        // Fix: always log err.message or JSON.stringify so you see the actual reason.
        if (error) throw error;

        // BUG FIX 2: Map to correct column names (firstname/contact — not name/mobile/gst)
        setForm({
          firstname:  data.firstname  ?? "",
          middlename: data.middlename ?? "",
          lastname:   data.lastname   ?? "",
          contact:    data.contact    ?? "",
          email:      data.email      ?? "",
          address:    data.address    ?? "",
        });
      } catch (err: any) {
        // BUG FIX 4: Print actual message — not the raw object
        console.error(
          "Error fetching client:",
          err?.message ?? err?.details ?? JSON.stringify(err)
        );
        setToast({ type: "error", msg: "Client details nahi mil payi!" });
        router.push("/clients");
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [resolvedParams.id, router]);

  // ── UPDATE ───────────────────────────────────────────────────────────────
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstname.trim()) { setToast({ type: "error", msg: "First name zaroori hai!" }); return; }
    if (!form.contact.trim())   { setToast({ type: "error", msg: "Contact number zaroori hai!" }); return; }

    setSaving(true);
    try {
      // BUG FIX 3: Update correct column names matching client_list schema
      const { error } = await supabase
        .from("client_list")                  // ← was "clients" (wrong)
        .update({
          firstname:    form.firstname.trim(),
          middlename:   form.middlename.trim() || null,
          lastname:     form.lastname.trim()   || null,
          contact:      form.contact.trim(),
          email:        form.email.trim()      || null,
          address:      form.address.trim()    || null,
          date_updated: new Date().toISOString(),
        })
        .eq("id", resolvedParams.id);

      if (error) throw error;

      setToast({ type: "success", msg: "Client details update ho gaye! ✅" });
      setTimeout(() => router.push(`/clients/${resolvedParams.id}/view`), 1200);
    } catch (err: any) {
      console.error("Update error:", err?.message ?? JSON.stringify(err));
      setToast({ type: "error", msg: err?.message ?? "Update mein galti hui!" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-[#0d1117]">
        <div className="relative">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-900/50">
            <UserCheck className="text-white" size={26} />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117] animate-ping" />
        </div>
        <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">
          Loading Client…
        </p>
      </div>
    );
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === "success"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="relative overflow-hidden bg-[#161b27] rounded-3xl border border-[#21293d] p-5">
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <Link
              href={`/clients/${resolvedParams.id}/view`}
              className="w-10 h-10 flex items-center justify-center bg-[#111520] border border-[#21293d] hover:border-blue-500/40 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
                <UserCheck className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white leading-none">Edit Customer</h1>
                <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em] mt-1">ID: #C-{resolvedParams.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-[#161b27] rounded-3xl border border-[#21293d] p-5 md:p-6">
          <form onSubmit={handleUpdate} className="space-y-4">

            {/* BUG FIX 6: 3 separate name fields matching client_list schema */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name" required icon={<UserCheck size={13} className="text-blue-400" />}>
                <input type="text" value={form.firstname} onChange={set("firstname")}
                  placeholder="e.g. Vikram" className={inputCls} required />
              </Field>
              <Field label="Middle Name" icon={<UserCheck size={13} className="text-slate-700" />}>
                <input type="text" value={form.middlename} onChange={set("middlename")}
                  placeholder="Optional" className={inputCls} />
              </Field>
            </div>

            <Field label="Last Name" icon={<UserCheck size={13} className="text-slate-700" />}>
              <input type="text" value={form.lastname} onChange={set("lastname")}
                placeholder="e.g. Singh" className={inputCls} />
            </Field>

            <Field label="Contact Number" required icon={<Phone size={13} className="text-blue-400" />}>
              <input type="tel" value={form.contact} onChange={set("contact")}
                placeholder="e.g. 9876543210" className={inputCls} required />
            </Field>

            <Field label="Email Address" icon={<Mail size={13} className="text-slate-700" />}>
              <input type="email" value={form.email} onChange={set("email")}
                placeholder="e.g. vikram@example.com" className={inputCls} />
            </Field>

            <Field label="Full Address" icon={<MapPin size={13} className="text-slate-700" />}>
              <textarea value={form.address} onChange={set("address")}
                placeholder="Shop ya ghar ka address…" rows={3}
                className={`${inputCls} resize-none`} />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 sm:flex-none sm:px-10 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 text-sm uppercase tracking-wide">
                {saving
                  ? <><Loader2 size={16} className="animate-spin" />Updating…</>
                  : <><Save size={16} strokeWidth={2.5} />Save Changes</>}
              </button>
              <Link href={`/clients/${resolvedParams.id}/view`}
                className="px-6 py-3 bg-[#111520] border border-[#21293d] hover:border-slate-500 text-slate-400 hover:text-white rounded-2xl font-bold text-sm transition-all no-underline">
                Cancel
              </Link>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────
function Field({ label, required, icon, children }: {
  label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
        {icon}{label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-2.5 bg-[#111520] border border-[#21293d] rounded-xl text-white font-bold text-sm placeholder:text-slate-700 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all [color-scheme:dark]";