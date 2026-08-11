"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, X, Copy, Check, MessageCircle, Smartphone } from "lucide-react";
import { WHATSAPP_LINK } from "../site";

export function QrShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const { hostname, protocol, port } = window.location;
      let url = window.location.origin;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        try {
          const res = await fetch("/api/device-info");
          const { lanIp } = await res.json();
          if (lanIp) url = `${protocol}//${lanIp}${port ? `:${port}` : ""}`;
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      setSiteUrl(url);
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 260,
          margin: 2,
          color: { dark: "#0b0b1a", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = async () => {
    if (!siteUrl) return;
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm anim-fade" />
      <div
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0b1a] p-6 text-center shadow-2xl shadow-black/60 anim-scale"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={17} />
        </button>

        <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
          <QrCode size={24} className="text-white" />
        </div>
        <h3 className="font-display text-lg font-black">Website Scan &amp; Share</h3>
        <p className="text-[13px] text-slate-500 mt-1">Mobile se scan karo — website turant khul jayegi</p>

        <div className="relative mt-5 mx-auto w-48 h-48 rounded-2xl bg-white p-3 shadow-inner">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not a static asset
            <img src={qrDataUrl} alt="Website QR code" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-bold">Generating…</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500">
          <Smartphone size={13} className="text-cyan-400" /> Scan → Website khulegi
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5">
          <p className="flex-1 min-w-0 text-[12px] font-bold text-slate-300 text-left truncate">{siteUrl || "…"}</p>
          <button onClick={copyLink} aria-label="Copy link"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/10 transition-colors">
            {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          </button>
        </div>

        <div className="mt-3 flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold text-slate-300 active:scale-95 transition-transform">
            Close
          </button>
          <a href={WHATSAPP_LINK(`Namaste! Website link: ${siteUrl || ""}`)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 rounded-xl bg-[#25D366] text-[#04170c] text-[13px] font-black active:scale-95 transition-transform">
            <MessageCircle size={15} /> Share
          </a>
        </div>
      </div>
    </div>
  );
}
