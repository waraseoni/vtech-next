// ─────────────────────────────────────────────────────────────────────────────
// NATIVE PRINT / DOWNLOAD BRIDGE — Capacitor Android WebView ke liye.
// ─────────────────────────────────────────────────────────────────────────────
// Browser me `window.print()` computer ke print dialog kholta hai lekin
// Capacitor WebView me wo KAAM NAHI karta (silently no-op ya block).
// Isliye poore codebase ka print/export:
//   • window.print()                      → Printer.printWebView() (Android print dialog)
//   • window.open("/api/print-*") popups  → fetch + printHtml() (native dialog)
//   • blob download (CSV/XLS/JSON)        → Filesystem/Share native flow
//
// Design: web (browser) par sab kuch EXACTLY pehle jaisa chalta hai —
// ye bridge sirf native platform par active hota hai. `window.print` aur
// `window.open` ke global patches ek hi jagah hote hain taaki baaki 22 print
// routes / popup patterns / on-page prints bina kisi badlav ke native dialog
// kholen.
// ─────────────────────────────────────────────────────────────────────────────

import { Capacitor } from "@capacitor/core";
import { Printer } from "@capgo/capacitor-printer";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

let initialized = false;

// ── Native print preview event bus ─────────────────────────────────────────
// Non-interactive `/api/print-*` routes seedha native dialog me jate hain.
// Interactive routes (jinke paas GST/Retail "Select Bill Type" selector hai —
// print-bill, print-combined-invoice) ko browser-ki-tarah ek in-app preview
// (full-screen iframe) me kholte hain taaki page ke apne buttons se compare
// karke Print dabaya ja sake. `onNativePrintPreview` se NativePrintPreview
// component ko URL milta hai.
type PrintPreviewListener = (url: string) => void;
let printPreviewListener: PrintPreviewListener | null = null;

export function onNativePrintPreview(l: PrintPreviewListener): () => void {
  printPreviewListener = l;
  return () => {
    if (printPreviewListener === l) printPreviewListener = null;
  };
}

function openNativePrintPreview(url: string): void {
  try {
    printPreviewListener?.(url);
  } catch {
    /* ignore */
  }
}

/** Interactive print routes — pahele selector (GST/Retail) compare, fir print. */
function printRouteNeedsSelector(pathname: string): boolean {
  return pathname === "/api/print-bill" || pathname === "/api/print-combined-invoice";
}

export function isNativePlatform(): boolean {
  try {
    return typeof Capacitor !== "undefined" && !!Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Fetched print-page HTML me relative resources (images/CSS) ko resolve karo. */
function ensureBaseHref(html: string): string {
  if (/<base\b/i.test(html)) return html;
  try {
    const origin = window.location.origin;
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${origin}/">`);
  } catch {
    return html;
  }
}

/** Print route ya nahi? (window.open + anchor clicks dono ke liye). */
function isPrintRoute(u: string): boolean {
  if (u.startsWith("/api/print")) return true;
  try {
    if (u.startsWith("http")) {
      const url = new URL(u, window.location.href);
      return url.origin === window.location.origin && url.pathname.startsWith("/api/print");
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** External http(s) link? Same-origin nahi → native me external app/browser me khulega. */
function isExternalUrl(u: string): boolean {
  try {
    if (u.startsWith("http://") || u.startsWith("https://")) {
      return new URL(u, window.location.href).origin !== window.location.origin;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Top-level navigation → Capacitor `launchIntent` (host mismatch) → external app/browser. */
function openExternalUrl(u: string): void {
  try {
    window.location.href = u;
  } catch {
    /* ignore */
  }
}

/** WebView me Clipboard API undefined/fail ho to legacy copy fallback. */
function copyViaExecCommand(text: string): void {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    /* ignore */
  }
}

/**
 * Global bridge — SIRF native par run hota hai:
 *   1. `window.print()`  → Printer.printWebView() (Android native print dialog)
 *   2. `window.open(url)` jahan url `/api/print-*` se shuru ho → fetch + printHtml.
 *      Ye bulk invoice, print-bill, aur 20+ report print pages ko web popup ke
 *      bina, seedha native dialog se kholta hai.
 * Baaki `window.open` (wa.me, sms:, auth popups, blank document.write) untouched.
 */
export function initNativeBridge(): void {
  if (!isNativePlatform() || initialized) return;
  initialized = true;

  try {
    const originalPrint = window.print.bind(window);

    // Capacitor WebView me legacy bridge bhi ho sakta hai — typed override.
    window.print = async () => {
      try {
        await Printer.printWebView({ name: document.title || "V-Tech PRO" });
      } catch {
        originalPrint(); // browser fallback
      }
    };
  } catch {
    /* ignore */
  }

  try {
    const originalOpen = window.open.bind(window);

    // `document.write` popup pattern ke liye fake window — code usually:
    //   const w = window.open("", "_blank");
    //   w.document.write(html); w.document.close(); setTimeout(()=>w.print(), N);
    // Ya written HTML me `<script>window.onload=...print()</script>` hota hai
    // (auto-print). Fake window HTML accumulate karta hai aur close()/print()
    // par native printHtml kholta hai — double-print se bachta hai.
    const createPrintProxy = (
      title = "V-Tech PRO"
    ): {
      document: {
        write: (s: string) => void;
        close: () => void;
        open: () => void;
      };
      print: () => void;
      close: () => void;
      focus: () => void;
    } => {
      let html = "<html><head></head><body>";
      let closed = false;
      let printed = false;
      let autoTimer: ReturnType<typeof setTimeout> | null = null;
      const doPrint = () => {
        if (printed) return;
        printed = true;
        if (autoTimer) {
          clearTimeout(autoTimer);
          autoTimer = null;
        }
        nativePrintHtml(html, title);
      };
      return {
        document: {
          write: (s: string) => {
            if (!closed) html += s;
          },
          open: () => {
            html = "<html><head></head><body>";
            closed = false;
            printed = false;
          },
          close: () => {
            closed = true;
            // Auto-print: onload script ke barabar (yakayak print bhi sakta hai).
            // Delay taaki caller ka explicit setTimeout(print) cancel ho sake.
            if (!autoTimer) {
              autoTimer = setTimeout(() => {
                autoTimer = null;
                doPrint();
              }, 500);
            }
          },
        },
        print: () => {
          doPrint();
        },
        close: () => {
          /* noop — native dialog apne aap band hoga */
        },
        focus: () => {
          /* noop */
        },
      };
    };

    // @ts-expect-error — typed replacement of global window.open
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const u = typeof url === "string" ? url : url?.toString?.() ?? "";
      // Popup print pattern: target "_blank" with empty/blank URL → fake window.
      if (u === "" || u === "about:blank") {
        return createPrintProxy(typeof target === "string" ? target : "V-Tech PRO");
      }
      if (isPrintRoute(u)) {
        let pathname = u;
        try {
          pathname = new URL(u, window.location.href).pathname;
        } catch {
          /* ignore */
        }
        if (printRouteNeedsSelector(pathname) && typeof printPreviewListener === "function") {
          // GST/Retail "Select Bill Type" wale print routes (print-bill, combined
          // invoice) — browser-ki-tarah in-app preview me kholo (compare + print).
          openNativePrintPreview(u);
          return null;
        }
        // Baaki print routes (single report pages) seedha native print dialog.
        // Popup block ho jata hai WebView me, aur window.print() bhi nahi chalta.
        // Asli kaam: HTML fetch karke native print dialog kholna.
        fetch(u, { credentials: "same-origin" })
          .then((r) => r.text())
          .then((html) =>
            Printer.printHtml({
              html: ensureBaseHref(html),
              name: "V-Tech PRO",
            })
          )
          .catch(() => {
            // Network error → fallback to normal window.open (web view tab)
            originalOpen(u, target, features);
          });
        return null;
      }
      // External http(s) (wa.me, api.whatsapp.com, etc.) — WebView me window.open
      // onCreateWindow support nahi karta (silently null). Native app/browser me kholo.
      if (isExternalUrl(u)) {
        openExternalUrl(u);
        return null;
      }
      return originalOpen(u, target, features);
    };
  } catch {
    /* ignore */
  }

  // Clipboard API WebView me missing/fail ho to legacy `execCommand("copy")`
  // fallback de — browser me koi change nahi (sirf native par wrap hota hai).
  try {
    if (typeof navigator.clipboard === "undefined") {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => copyViaExecCommand(text),
        },
      });
    } else if (typeof navigator.clipboard.writeText === "function") {
      const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = async (text: string) => {
        try {
          await origWrite(text);
        } catch {
          copyViaExecCommand(text);
        }
      };
    }
  } catch {
    /* ignore */
  }

  // `<a href="/api/print-*">` anchors (jaise GST Bill buttons) — browser me new tab
  // khulta hai, WebView me WebView hi page par navigate ho jata hai (invoice raw page).
  // Native par selector wale routes preview me, baaki fetch + printHtml.
  try {
    document.addEventListener(
      "click",
      (e) => {
        const el = (e.target as Element | null)?.closest?.("a");
        const href = el?.getAttribute?.("href") || "";
        if (isPrintRoute(href)) {
          e.preventDefault();
          e.stopPropagation();
          let pathname = href;
          try {
            pathname = new URL(href, window.location.href).pathname;
          } catch {
            /* ignore */
          }
          if (printRouteNeedsSelector(pathname) && typeof printPreviewListener === "function") {
            openNativePrintPreview(href);
            return;
          }
          fetch(href, { credentials: "same-origin" })
            .then((r) => r.text())
            .then((html) =>
              Printer.printHtml({ html: ensureBaseHref(html), name: "V-Tech PRO" })
            )
            .catch(() => openExternalUrl(href));
        }
      },
      true
    );
  } catch {
    /* ignore */
  }
}

/**
 * Popup `document.write` print pattern (`window.open("", ...)` + write + print)
 * native par directly nahi khulta — is liye HTML string native dialog kholti hai.
 * (Browser me hidden-iframe print fallback.)
 */
export async function nativePrintHtml(html: string, title?: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      await Printer.printHtml({ html: ensureBaseHref(html), name: title || "V-Tech PRO" });
      return;
    } catch {
      /* fall through to browser path */
    }
  }
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
  iframe.contentDocument?.open();
  iframe.contentDocument?.write(html);
  iframe.contentDocument?.close();
  await new Promise((r) => setTimeout(r, 200));
  try {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  }, 1000);
}

/**
 * Download bridge — CSV/XLS/JSON exports native par Filesystem write + Share
 * sheet kholte hain. Browser par normal `a.download` (unchanged).
 */
export async function nativeDownload(blob: Blob, filename: string): Promise<void> {
  if (!isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  try {
    const dataUrl = await blobToDataUrl(blob);
    const base64 = dataUrl.split(",")[1];
    const path = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      // encoding omitted → base64 decode → binary bytes (text aur zip dono sahi).
    });
    try {
      await Share.share({
        title: filename,
        text: filename,
        url: path.uri,
        dialogTitle: "Export karo / Share karo",
      });
    } catch {
      /* share dismissed */
    }
  } catch {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Common download helper — pehle bridge, phir browser fallback. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  await nativeDownload(blob, filename);
}