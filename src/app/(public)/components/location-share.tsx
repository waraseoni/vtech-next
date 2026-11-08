"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Keyboard,
  MapPin,
  MessageCircle,
  Navigation,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { buildWhatsAppShareLink, normalizeWhatsAppRecipient } from "@/lib/public-site-defaults";

type LocationShareProps = {
  shareText: string;
  directionsHref: string;
  mapHref?: string;
  label?: string;
  className?: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard blocked — textarea fallback neeche */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Office address + GPS + map share. Saved contact par OS share sheet (agar
 * available), naya number type karke direct WhatsApp, ya text copy.
 * Sirf user gesture par navigator/window access hote hain — hydration safe.
 */
export function LocationShare({
  shareText,
  directionsHref,
  mapHref,
  label = "Share",
  className,
}: LocationShareProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const inputId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setRecipient("");
      setCopied(false);
      setNotice("");
      return;
    }
    closeRef.current?.focus();
  }, [open]);

  const normalizedRecipient = normalizeWhatsAppRecipient(recipient);
  const recipientInvalid = recipient.trim().length > 0 && !normalizedRecipient;

  const openPanel = () => setOpen(true);

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Office location", text: shareText });
        setOpen(false);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    window.open(buildWhatsAppShareLink(shareText), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleSendToNumber = () => {
    if (!normalizedRecipient) {
      setNotice("10–15 digit valid mobile number daalein.");
      inputRef.current?.focus();
      return;
    }
    window.open(
      buildWhatsAppShareLink(shareText, normalizedRecipient),
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  };

  const handleCopy = async () => {
    const ok = await copyText(shareText);
    setCopied(ok);
    setNotice(ok ? "" : "Copy nahi ho paya — text manually select karein.");
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

  const triggerClass =
    className ??
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3.5 text-[12px] font-bold text-app-2 active:scale-[0.98] transition-transform";

  return (
    <>
      <button type="button" onClick={openPanel} className={triggerClass}>
        <Share2 size={13} /> {label}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
              onClick={() => setOpen(false)}
              role="presentation"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
                className="w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#0b0b1a] p-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id={titleId} className="font-display text-base font-black text-white">
                      Location share karein
                    </h2>
                    <p className="mt-1 text-[12px] text-muted">
                      Address, GPS aur map link ek saath jayenge.
                    </p>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close share dialog"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-muted active:scale-95"
                  >
                    <X size={16} />
                  </button>
                </div>

                <pre className="mt-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 font-sans text-[12px] leading-relaxed text-app-2">
                  {shareText}
                </pre>

                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-3.5 text-left active:scale-[0.99] transition-transform"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                      <Smartphone size={18} className="text-blue-400" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-white">
                        Saved contact par bhejein
                      </span>
                      <span className="block text-[11px] text-muted">
                        Phone ka share sheet khulega — WhatsApp/contact chunein
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-2">
                      ya naya number
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <label
                    htmlFor={inputId}
                    className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted"
                  >
                    <Keyboard size={12} /> WhatsApp number
                  </label>
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value);
                      setNotice("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSendToNumber();
                      }
                    }}
                    placeholder="10-digit mobile ya +91..."
                    aria-invalid={recipientInvalid}
                    aria-describedby={notice ? `${inputId}-notice` : undefined}
                    className="min-h-11 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-[14px] font-medium text-white outline-none placeholder:text-muted-2 focus:border-[#25D366]/60 focus:ring-1 focus:ring-[#25D366]/20"
                  />
                  {notice && (
                    <p
                      id={`${inputId}-notice`}
                      role="alert"
                      className="text-[12px] font-semibold text-amber-400"
                    >
                      {notice}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleSendToNumber}
                    disabled={!normalizedRecipient}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3.5 text-[14px] font-black text-[#04220f] disabled:opacity-50 active:scale-[0.99] transition-transform"
                  >
                    <MessageCircle size={16} /> WhatsApp par bhejein
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-[12px] font-bold text-app-2 active:scale-[0.98] transition-transform"
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-[12px] font-bold text-cyan-300 active:scale-[0.98] transition-transform"
                    >
                      <MapPin size={13} /> Map
                    </a>
                  ) : (
                    <span />
                  )}
                  {directionsHref ? (
                    <a
                      href={directionsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] text-[12px] font-bold text-emerald-300 active:scale-[0.98] transition-transform"
                    >
                      <Navigation size={13} /> Route
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
                <p className="mt-3 text-center text-[10px] text-muted-2">
                  Number sirf isi device par link banane ke liye use hota hai — save nahi hota.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
