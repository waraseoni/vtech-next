"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, X, Copy, Check, Share2, Smartphone, MessageCircle, Send, Mail, ArrowLeft, Globe, AtSign, Download } from "lucide-react";
import { SITE } from "../site";

export function QrShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pickShareOpen, setPickShareOpen] = useState(false);

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

  // data URL (base64 PNG) ko File mein convert karo taaki native share sheet mein image bhej sakein
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [meta, b64] = dataUrl.split(",");
    const mime = meta.match(/data:(.*?);/)?.[1] || "image/png";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  };

  // Native share sheet → user picks jis ko bhejna hai (WhatsApp contacts, apps, etc.)
  const handleShare = async () => {
    if (!siteUrl) return;
    if (navigator.share) {
      const textData: ShareData = {
        title: `${SITE.name} — Website`,
        text: "Scan karke website kholo ya link par tap karo. Repair & Service Experts, Jabalpur.",
        url: siteUrl,
      };
      // QR image file bhi share karo agar browser allow karta hai (Android Chrome / iOS Safari)
      const qrFile = qrDataUrl ? dataUrlToFile(qrDataUrl, "vtech-website.png") : undefined;
      const canShareFile = !!qrFile && !!navigator.canShare && navigator.canShare({ files: [qrFile] });
      const shareData: ShareData = canShareFile ? { ...textData, files: [qrFile!] } : textData;
      try {
        await navigator.share(shareData);
        return;
      } catch {
        return; // user ne cancel kiya — kuch mat karo
      }
    }
    // Desktop (Chrome/Firefox) me navigator.share nahi hota → apna app-picker dikhao
    setPickShareOpen(true);
  };

  const shareMsg = () => {
    const text = "Namaste! V-Technologies website — Repair & Service Experts, Jabalpur.";
    const url = siteUrl || window.location.origin;
    return { text, url };
  };

  const SHARE_TARGETS = [
    // WhatsApp Web / app → contact search & select (forward jaise)
    { key: "wa",   name: "WhatsApp", color: "#25D366", icon: <MessageCircle size={18} />,
      href: () => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareMsg().text}\n${shareMsg().url}`)}` },
    { key: "tg",   name: "Telegram", color: "#229ED9", icon: <Send size={18} />,
      href: () => `https://t.me/share/url?url=${encodeURIComponent(shareMsg().url)}&text=${encodeURIComponent(shareMsg().text)}` },
    { key: "fb",   name: "Facebook", color: "#1877F2", icon: <Globe size={18} />,
      href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareMsg().url)}` },
    { key: "x",    name: "X / Twitter", color: "#94a3b8", icon: <AtSign size={18} />,
      href: () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg().text)}&url=${encodeURIComponent(shareMsg().url)}` },
    { key: "mail", name: "Email", color: "#ea4335", icon: <Mail size={18} />,
      href: () => `mailto:?subject=${encodeURIComponent(`${SITE.name} — Website`)}&body=${encodeURIComponent(`${shareMsg().text}\n${shareMsg().url}`)}` },
  ];

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

        {pickShareOpen ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 anim-fade">
            <div className="flex items-center justify-between mb-2.5">
              <button onClick={() => setPickShareOpen(false)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.06] text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
                <ArrowLeft size={13} /> Back
              </button>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Share via…</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {SHARE_TARGETS.map((t) => (
                <a key={t.key} href={t.href()} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.06] hover:bg-white/[0.1] hover:border-white/15 transition-colors active:scale-95"
                  style={{ color: t.color }}>
                  {t.icon}
                  <span className="text-[9px] font-bold text-slate-400">{t.name}</span>
                </a>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={copyLink}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[12px] font-bold text-slate-300 hover:bg-white/[0.1] transition-colors">
                {copied ? <><Check size={14} className="text-emerald-400" /> Link Copied!</> : <><Copy size={14} /> Copy Link</>}
              </button>
              {qrDataUrl && (
                <a href={qrDataUrl} download="vtech-website.png"
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-[12px] font-bold text-slate-300 hover:bg-white/[0.1] transition-colors">
                  <Download size={14} /> Save QR Image
                </a>
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-600 leading-relaxed">
              WhatsApp par <span className="text-slate-400">contact chun kar forward</span> karo. QR image bhejne ke liye pehle <span className="text-slate-400">Save QR Image</span> dabao, phir WhatsApp mein attach karo.
            </p>
            <p className="mt-1 text-[10px] text-slate-700 leading-relaxed">
              Note: native mobile share sheet sirf <span className="text-slate-500">HTTPS (production)</span> par aati hai — LAN/HTTP par browser use block karta hai.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            <button onClick={handleShare}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-[14px] font-black shadow-lg shadow-blue-600/25 active:scale-95 transition-transform">
              <Share2 size={16} /> Share / Forward — kise bhi bhejo
            </button>
            <div className="flex gap-2.5">
              <button onClick={copyLink}
                className="flex items-center justify-center gap-1.5 flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold text-slate-300 active:scale-95 transition-transform">
                {copied ? <><Check size={14} className="text-emerald-400" /> Copied</> : <><Copy size={14} /> Copy Link</>}
              </button>
              <button onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] font-bold text-slate-300 active:scale-95 transition-transform">
                Close
              </button>
            </div>
            <p className="text-[11px] text-slate-600">Share dabao → app chuno (WhatsApp, Telegram, Email…). Mobile par native share sheet khulega.</p>
          </div>
        )}
      </div>
    </div>
  );
}
