"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  Clock,
  Copy,
  Check,
  Navigation,
} from "lucide-react";
import {
  buildDirectionsLink,
  buildLocationShareText,
  buildMapLink,
  buildWhatsAppLink,
  formatCoordinates,
} from "@/lib/public-site-defaults";
import { HighlightText } from "../components/highlight-text";
import { LocationShare } from "../components/location-share";
import { usePublicSiteContent } from "../components/public-content-provider";

export default function ContactPage() {
  const content = usePublicSiteContent();
  const { contact, contactPage } = content;
  const fallbackService = contactPage.serviceOptions[0] ?? "Other";
  const coordinates = formatCoordinates(content);
  const directionsHref = buildDirectionsLink(content);
  const mapHref = buildMapLink(content);
  const shareText = buildLocationShareText(content);

  const [form, setForm] = useState({
    fullname: "",
    contact: "",
    email: "",
    service: fallbackService,
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    fullname?: string;
    contact?: string;
    message?: string;
  }>({});
  const [company, setCompany] = useState("");
  const [copiedCoords, setCopiedCoords] = useState(false);

  const copyCoordinates = async () => {
    try {
      await navigator.clipboard.writeText(coordinates);
      setCopiedCoords(true);
      window.setTimeout(() => setCopiedCoords(false), 2000);
    } catch {
      /* clipboard blocked — text select-all se manual copy */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof fieldErrors = {};
    if (!form.fullname.trim()) nextErrors.fullname = "Naam zaroori hai.";
    if (!form.contact.trim()) nextErrors.contact = "Mobile number zaroori hai.";
    else if (!/^[0-9+\-\s]{7,15}$/.test(form.contact.trim())) {
      nextErrors.contact = "Valid mobile number daalein.";
    }
    if (!form.message.trim()) nextErrors.message = "Message zaroori hai.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("");
      return;
    }

    // Honeypot — bot ne hidden field bhara to DB tak kuch nahi jata.
    if (company.trim()) {
      setSent(true);
      return;
    }

    setSending(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("message_list").insert([
        {
          fullname: form.fullname.trim(),
          contact: form.contact.trim(),
          email: form.email.trim() || "not provided",
          message: `[${form.service}] ${form.message.trim()}`,
          status: 0,
        },
      ]);
      if (insertError) throw insertError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const waText = `Namaste ${content.brand.name}! Main ${form.fullname.trim()} (${form.contact.trim()}).\nService: ${form.service}\n${form.message.trim()}`;

  const inputCls =
    "w-full min-h-11 px-4 py-3 bg-white/[0.04] border border-white/[0.1] rounded-xl text-[14px] text-white font-medium placeholder:text-muted-2 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all";

  return (
    <>
      {/* ═══ HERO ═════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-4">
            <MessageCircle size={13} /> {contactPage.badge}
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] max-w-3xl">
            <HighlightText text={contactPage.title} highlight={contactPage.highlight} />
          </h1>
          <p className="mt-4 text-[14px] sm:text-base text-muted max-w-2xl">
            {contactPage.subtitle}
          </p>
        </div>
      </section>

      {/* ═══ BODY ═════════════════════════════════════════════════════════ */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Contact info */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08]">
                <h2 className="font-display text-lg font-black mb-5">Contact Information</h2>
                <div className="space-y-3">
                  <a
                    href={contact.phoneHref}
                    className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <Phone size={17} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted">
                        Call / WhatsApp
                      </p>
                      <p className="text-[14px] font-bold text-white mt-0.5">{contact.phone}</p>
                    </div>
                  </a>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06] active:scale-[0.99] transition-transform"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/15 flex items-center justify-center">
                      <Mail size={17} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted">
                        Email
                      </p>
                      <p className="text-[14px] font-bold text-white mt-0.5 break-all">
                        {contact.email}
                      </p>
                    </div>
                  </a>
                  <div className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                      <MapPin size={17} className="text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted">
                        Location
                      </p>
                      <p className="text-[13px] text-app-2 leading-relaxed mt-0.5">
                        {contact.address}
                      </p>
                      {coordinates && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="font-mono text-[11px] tabular-nums text-cyan-300/90 select-all">
                            GPS: {coordinates}
                          </p>
                          <button
                            type="button"
                            onClick={copyCoordinates}
                            aria-label="Copy GPS coordinates"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-muted active:scale-95 hover:text-white transition-colors"
                          >
                            {copiedCoords ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                          <span role="status" className="sr-only">
                            {copiedCoords ? "GPS coordinates copied" : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {directionsHref && (
                          <a
                            href={directionsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 text-[12px] font-bold text-emerald-300 active:scale-[0.98] transition-transform"
                          >
                            <Navigation size={13} /> Directions
                          </a>
                        )}
                        {mapHref && mapHref !== directionsHref && (
                          <a
                            href={mapHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3.5 text-[12px] font-bold text-cyan-300 active:scale-[0.98] transition-transform"
                          >
                            <MapPin size={13} /> Map
                          </a>
                        )}
                        <LocationShare
                          shareText={shareText}
                          directionsHref={directionsHref}
                          mapHref={mapHref}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3.5 rounded-2xl p-4 bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      <Clock size={17} className="text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-widest text-muted">
                        Timing
                      </p>
                      <p className="text-[13px] font-bold text-white mt-0.5">
                        {contact.businessHours}
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={buildWhatsAppLink(content)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/25 text-[#4ade80] text-[14px] font-black active:scale-[0.99] transition-transform"
                >
                  <MessageCircle size={17} /> WhatsApp par turant baat karein
                </a>
              </div>
            </div>

            {/* Inquiry form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl p-6 sm:p-8 bg-white/[0.03] border border-white/[0.08]">
                <h2 className="font-display text-lg font-black mb-1">Send Inquiry</h2>
                <p className="text-[13px] text-muted mb-6">
                  Bina login ke — form bharo, hum contact karenge.
                </p>

                {sent ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                      <CheckCircle size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="font-display text-xl font-black mb-2">Message Sent!</h3>
                    <p className="text-[14px] text-muted mb-6">
                      Hum 1 business day ke andar aapse sampark karenge. Urgent ho to WhatsApp par
                      bhi follow-up karo.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <a
                        href={buildWhatsAppLink(content, waText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-app text-[14px] font-black active:scale-95 transition-transform"
                      >
                        <MessageCircle size={16} /> WhatsApp Follow-up
                      </a>
                      <button
                        onClick={() => {
                          setSent(false);
                          setFieldErrors({});
                          setCompany("");
                          setForm({
                            fullname: "",
                            contact: "",
                            email: "",
                            service: fallbackService,
                            message: "",
                          });
                        }}
                        className="px-6 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-[14px] font-bold text-app-2 active:scale-95 transition-transform"
                      >
                        Naya inquiry bhejo
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="contact-company">Company</label>
                      <input
                        id="contact-company"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </div>
                    {error && (
                      <div
                        id="contact-form-error"
                        role="alert"
                        className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl"
                      >
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-[11px] font-black uppercase tracking-wider text-muted mb-1.5"
                        >
                          {contactPage.formCopy.name} *
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          autoComplete="name"
                          required
                          aria-required="true"
                          aria-invalid={!!fieldErrors.fullname}
                          aria-describedby={
                            fieldErrors.fullname
                              ? "contact-name-error"
                              : error
                                ? "contact-form-error"
                                : undefined
                          }
                          value={form.fullname}
                          onChange={(e) => setForm((p) => ({ ...p, fullname: e.target.value }))}
                          placeholder="e.g. Rahul Sharma"
                          className={inputCls}
                        />
                        {fieldErrors.fullname && (
                          <p
                            id="contact-name-error"
                            role="alert"
                            className="mt-1.5 text-[12px] font-semibold text-red-400"
                          >
                            {fieldErrors.fullname}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="contact-mobile"
                          className="block text-[11px] font-black uppercase tracking-wider text-muted mb-1.5"
                        >
                          {contactPage.formCopy.mobile} *
                        </label>
                        <input
                          id="contact-mobile"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          required
                          aria-required="true"
                          aria-invalid={!!fieldErrors.contact}
                          aria-describedby={
                            fieldErrors.contact
                              ? "contact-mobile-error"
                              : error
                                ? "contact-form-error"
                                : undefined
                          }
                          value={form.contact}
                          onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
                          placeholder="10-digit mobile number"
                          className={inputCls}
                        />
                        {fieldErrors.contact && (
                          <p
                            id="contact-mobile-error"
                            role="alert"
                            className="mt-1.5 text-[12px] font-semibold text-red-400"
                          >
                            {fieldErrors.contact}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-[11px] font-black uppercase tracking-wider text-muted mb-1.5"
                        >
                          {contactPage.formCopy.email}
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          autoComplete="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="aapka@email.com"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="contact-service"
                          className="block text-[11px] font-black uppercase tracking-wider text-muted mb-1.5"
                        >
                          {contactPage.formCopy.service} *
                        </label>
                        <select
                          id="contact-service"
                          value={form.service}
                          onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))}
                          className={`${inputCls} appearance-none bg-[#0b0b1a]`}
                        >
                          {contactPage.serviceOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-[11px] font-black uppercase tracking-wider text-muted mb-1.5"
                      >
                        {contactPage.formCopy.message} *
                      </label>
                      <textarea
                        id="contact-message"
                        required
                        aria-required="true"
                        aria-invalid={!!fieldErrors.message}
                        aria-describedby={
                          fieldErrors.message
                            ? "contact-message-error"
                            : error
                              ? "contact-form-error"
                              : undefined
                        }
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        rows={5}
                        placeholder="Kya problem hai? Item, brand, fault — jitna detail ho utna better."
                        className={`${inputCls} resize-none`}
                      />
                      {fieldErrors.message && (
                        <p
                          id="contact-message-error"
                          role="alert"
                          className="mt-1.5 text-[12px] font-semibold text-red-400"
                        >
                          {fieldErrors.message}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-[15px] font-black shadow-lg shadow-blue-600/25 disabled:opacity-60 active:scale-[0.99] transition-all"
                    >
                      {sending ? (
                        <>
                          <Loader2 size={17} className="animate-spin" /> Bhej rahe hain...
                        </>
                      ) : (
                        <>
                          <Send size={16} /> {contactPage.formCopy.submit}
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
