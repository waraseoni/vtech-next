"use client";
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import {
  Save,
  ArrowLeft,
  UserPlus,
  Loader2,
  Edit3,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { logActivity } from "@/lib/activity";
import { safeBack } from "@/lib/utils";
import { toast } from "@/lib/toast";
import PageLoader from "@/components/PageLoader";
import {
  clientFormSchema,
  emptyClientForm,
  type ClientFormValues,
} from "@/lib/validation/schemas/client";

// ── DARK THEME CONSTANTS ──────────────────────────────────
const inputCls =
  "w-full px-4 py-3 rounded-xl bg-app border border-app text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all text-sm font-medium";
const labelCls = "block text-[10px] font-extrabold uppercase tracking-wider text-muted mb-1.5";
const errCls = "text-red-400 text-xs mt-1 font-medium";

// ── MAIN COMPONENT ────────────────────────────────────────
export default function ManageClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id ? parseInt(params.id as string) : null;
  const isEdit = !!clientId;

  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [duplicateClients, setDuplicateClients] = useState<
    { id: number; name: string; contact: string }[]
  >([]);
  const [checkingDup, setCheckingDup] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: emptyClientForm,
  });

  // ── FETCH EXISTING CLIENT (edit mode) ──────────────────
  useEffect(() => {
    if (!isEdit || !clientId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("client_list")
          .select("firstname, middlename, lastname, contact, email, address, opening_balance")
          .eq("id", clientId)
          .single();
        if (error) throw error;
        if (data)
          reset({
            firstname: data.firstname || "",
            middlename: data.middlename || "",
            lastname: data.lastname || "",
            contact: data.contact || "",
            email: data.email || "",
            address: data.address || "",
            opening_balance: data.opening_balance?.toString() || "0.00",
          });
      } catch (err) {
        toast.error("Error loading client: " + (err instanceof Error ? err.message : String(err)));
        safeBack(router, "/clients");
      } finally {
        setFetchLoading(false);
      }
    })();
  }, [clientId, isEdit, reset, router]);

  // ── DUPLICATE CHECKS ───────────────────────────────────
  const checkDuplicateContact = useCallback(async (contact: string) => {
    setCheckingDup(true);
    try {
      const { data, error } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, contact")
        .eq("contact", contact)
        .eq("delete_flag", 0)
        .limit(5);
      if (!error && data && data.length > 0) {
        setDuplicateClients(
          data.map((c) => ({
            id: c.id,
            name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
            contact: c.contact || "",
          }))
        );
      } else {
        setDuplicateClients([]);
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
      setDuplicateClients([]);
    } finally {
      setCheckingDup(false);
    }
  }, []);

  const checkDuplicateEmail = useCallback(async (email: string) => {
    setCheckingDup(true);
    try {
      const { data, error } = await supabase
        .from("client_list")
        .select("id, firstname, middlename, lastname, email")
        .eq("email", email)
        .eq("delete_flag", 0)
        .limit(5);
      if (!error && data && data.length > 0) {
        setDuplicateClients(
          data.map((c) => ({
            id: c.id,
            name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(" ").trim(),
            contact: c.email || "",
          }))
        );
      } else {
        setDuplicateClients([]);
      }
    } catch (err) {
      console.error("Duplicate email check error:", err);
      setDuplicateClients([]);
    } finally {
      setCheckingDup(false);
    }
  }, []);

  // Purana behaviour preserve: contact 10 digit hote hi check, email type karte
  // waqt check (edit mode me nahi). RHF ka `watch()` subscription React Compiler
  // ke saath incompatible hai, isliye field-level onChange se trigger karte hain.

  // ── SUBMIT ─────────────────────────────────────────────
  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = {
        firstname: values.firstname.trim(),
        middlename: values.middlename.trim() || null,
        lastname: values.lastname.trim(),
        contact: values.contact.trim(),
        email: values.email.trim() || null,
        address: values.address.trim(),
        opening_balance: parseFloat(values.opening_balance) || 0,
      };
      const clientName = [payload.firstname, payload.lastname].filter(Boolean).join(" ");
      if (isEdit) {
        const { error } = await supabase
          .from("client_list")
          .update({ ...payload, date_updated: new Date().toISOString() })
          .eq("id", clientId);
        if (error) throw error;
        await logActivity("Updated Client Details", "Clients", clientId, `Client: ${clientName}`);
      } else {
        const { data, error } = await supabase
          .from("client_list")
          .insert([{ ...payload, delete_flag: 0 }])
          .select("id")
          .single();
        if (error) throw error;
        await logActivity("Created New Client", "Clients", data.id, `Client: ${clientName}`);
      }
      router.replace("/clients");
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : String(err)));
    }
  });

  // ── LOADING ────────────────────────────────────────────
  if (fetchLoading) return <PageLoader icon={UserPlus} label="loading client..." tone="cyan" />;

  // ── RENDER ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app text-white font-sans p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* ── TOP BAR ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => safeBack(router, "/clients")}
            className="flex items-center gap-2 text-muted hover:text-white transition-colors text-sm font-bold"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <Link
            href="/clients"
            className="text-xs text-muted-2 hover:text-muted transition-colors font-medium"
          >
            All Clients
          </Link>
        </div>

        {/* ── FORM CARD ── */}
        <div className="bg-panel border border-app rounded-2xl overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-5 border-b border-app flex items-center gap-4">
            <div
              className={`p-3 rounded-xl border ${isEdit ? "bg-amber-500/10 border-amber-500/20" : "bg-blue-500/10 border-blue-500/20"}`}
            >
              {isEdit ? (
                <Edit3 size={22} className="text-amber-400" />
              ) : (
                <UserPlus size={22} className="text-blue-400" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                {isEdit ? "Edit Client" : "New Client"}
              </h1>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-2 mt-0.5">
                {isEdit ? `Editing Client #${clientId}` : "Add a new client to the system"}
              </p>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={onSubmit} noValidate className="p-6 space-y-5">
            {/* First Name + Middle Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter first name"
                  {...register("firstname")}
                  className={`${inputCls} ${errors.firstname ? "border-red-500" : ""}`}
                />
                {errors.firstname && <p className={errCls}>{errors.firstname.message}</p>}
              </div>
              <div>
                <label className={labelCls}>
                  Middle Name{" "}
                  <span className="text-muted-2 normal-case font-semibold text-[9px]">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Enter middle name"
                  {...register("middlename")}
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
                  type="text"
                  placeholder="Enter last name"
                  {...register("lastname")}
                  className={`${inputCls} ${errors.lastname ? "border-red-500" : ""}`}
                />
                {errors.lastname && <p className={errCls}>{errors.lastname.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("opening_balance")}
                  className={`${inputCls} text-right`}
                />
                <p className="text-[9px] text-muted-2 mt-1">
                  Positive = Due from client &nbsp;·&nbsp; Negative = Advance paid
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className={labelCls}>
                WhatsApp / Contact <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Controller
                  name="contact"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="tel"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      value={field.value}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        field.onChange(v);
                        if (v.length === 10 && !isEdit) void checkDuplicateContact(v);
                        if (v.length < 10) setDuplicateClients([]);
                      }}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      className={`${inputCls} ${errors.contact ? "border-red-500" : duplicateClients.length > 0 ? "border-amber-500" : ""}`}
                    />
                  )}
                />
                {checkingDup && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="animate-spin text-muted" />
                  </div>
                )}
              </div>
              {errors.contact && <p className={errCls}>{errors.contact.message}</p>}
              {duplicateClients.length > 0 && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <AlertTriangle size={14} />
                    <span>⚠️ Duplicate contact found! These clients already exist:</span>
                  </div>
                  {duplicateClients.map((dup) => (
                    <div
                      key={dup.id}
                      className="flex items-center justify-between bg-app rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} className="text-amber-500" />
                        <span className="text-white text-xs font-medium">{dup.name}</span>
                        <span className="text-muted text-[10px]">#{dup.id}</span>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`/clients/${dup.id}/view`}
                          target="_blank"
                          className="text-blue-400 hover:text-blue-300 text-[10px] font-bold no-underline"
                        >
                          View →
                        </a>
                        <a
                          href={`/clients/${dup.id}/edit`}
                          target="_blank"
                          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold no-underline"
                        >
                          Edit →
                        </a>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-amber-500/70">
                    Still want to add? This will create a duplicate entry.
                  </p>
                </div>
              )}
            </div>

            {/* Email (optional) */}
            <div>
              <label className={labelCls}>
                Email or Secondary Mobile{" "}
                <span className="text-muted-2 normal-case font-semibold text-[9px]">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                placeholder="example@gmail.com or 98xxxxxxxx"
                {...register("email", {
                  onChange: (e) => {
                    const v = String(e.target.value ?? "").trim();
                    if (v.length > 0 && !isEdit) void checkDuplicateEmail(v);
                    if (v.length === 0) setDuplicateClients([]);
                  },
                })}
                className={`${inputCls} ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Complete address..."
                {...register("address")}
                className={`${inputCls} resize-none ${errors.address ? "border-red-500" : ""}`}
              />
              {errors.address && <p className={errCls}>{errors.address.message}</p>}
            </div>

            {/* Divider */}
            <div className="border-t border-app" />

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  isEdit
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} /> {isEdit ? "Update Client" : "Save Client"}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => safeBack(router, "/clients")}
                className="flex-1 sm:flex-none sm:px-8 py-3 rounded-xl font-bold text-sm bg-panel-2 dark:hover:bg-[#2a3550] text-app-2 transition-all"
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
