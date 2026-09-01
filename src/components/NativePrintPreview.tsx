"use client";

// Native print preview — Android WebView me `/api/print-*` routes browser ki
// tarah popup-nahi khulte (onCreateWindow n/a). Isliye print HTML ek full-screen
// iframe preview me dikhate hain taaki page ke apne GST/Retail (bill_type)
// selector se compare karke Print dabaya ja sake — phir native print dialog.
// Web (browser) par ye component kabhi nahi dikhta (bridge sirf native par
// activate hota hai).

import React, { useEffect, useRef, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { Printer as CapPrinter } from "@capgo/capacitor-printer";
import { onNativePrintPreview } from "@/lib/nativePrint";

function ensureBaseHref(html: string): string {
  if (/<base\b/i.test(html)) return html;
  try {
    const origin = window.location.origin;
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${origin}/">`);
  } catch {
    return html;
  }
}

export default function NativePrintPreview() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const close = () => {
    setOpen(false);
    setUrl("");
    setErr("");
  };

  const printCurrent = async () => {
    // Current bill_type ke hisaab se fresh HTML fetch karke native print karo.
    // iframe me page ka apna selector (GST/Retail link) pehle hi urls swap kar
    // chuka hoga — isliye iframe current URL se hi print karte hain.
    const win = iframeRef.current?.contentWindow;
    let current = iframeRef.current?.src || url;
    try {
      if (win?.location?.href) current = win.location.href;
    } catch {
      /* cross-origin guard — iframe.src par bharosa */
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(current);
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      await CapPrinter.printHtml({ html: ensureBaseHref(html), name: "V-Tech PRO" });
    } catch {
      setErr("Print fail hua.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const un = onNativePrintPreview((u) => {
      setUrl(u);
      setErr("");
      setOpen(true);
    });
    return un;
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Top control bar */}
      <div className="flex items-center gap-2 bg-[#161b27] border-b border-[#21293d] px-3 py-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-xs truncate">Print Preview</div>
          <div className="text-[10px] text-slate-500 truncate">{url}</div>
        </div>
        <button
          onClick={printCurrent}
          disabled={loading}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          Print
        </button>
        <button
          onClick={close}
          className="flex items-center gap-1 bg-[#21293d] hover:bg-[#2a3550] text-slate-300 px-3 py-2 rounded-lg text-xs font-bold"
        >
          <X size={14} /> Close
        </button>
      </div>

      {/* Print page preview — page ke apne GST/Retail selector kaam karte hain */}
      <div className="flex-1 relative bg-white">
        {err && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg">
            {err}
          </div>
        )}
        {url ? (
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : null}
      </div>
    </div>
  );
}
