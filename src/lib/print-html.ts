import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

// Print pages DB se aaye client/item/remark text ko HTML me interpolate karte
// hain. Har field escape karna 20+ templates me error-prone hai, isliye response
// level par nonce-based CSP lagate hain: injected <script>/onclick chal hi nahi
// sakta, apne print/close buttons nonce wale bridge se chalte hain.

function csp(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    "img-src data: https:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}

function clickBridge(nonce: string): string {
  return `<script nonce="${nonce}">document.addEventListener("click",function(e){var t=e.target instanceof Element?e.target.closest("[data-print],[data-close],[data-action]"):null;if(!t)return;if(t.hasAttribute("data-print")){window.print();return;}if(t.hasAttribute("data-close")){window.close();return;}var a=t.getAttribute("data-action");if(a&&typeof window[a]==="function"){window[a]();}});</script>`;
}

export function renderPrintHtml(html: string, nonce: string): string {
  const patched = html
    .replace(/<script>/g, `<script nonce="${nonce}">`)
    .replace(/onclick="window\.print\(\)"/g, "data-print")
    .replace(/onclick="window\.close\(\)"/g, "data-close")
    .replace(/onclick="savePDF\(\)"/g, 'data-action="savePDF"')
    .replace(/onclick="toggleTrackQR\(\)"/g, 'data-action="toggleTrackQR"');

  const bridge = clickBridge(nonce);
  return patched.includes("</body>")
    ? patched.replace("</body>", `${bridge}</body>`)
    : `${patched}${bridge}`;
}

export function printHtmlResponse(
  html: string,
  extraHeaders: Record<string, string> = {}
): NextResponse {
  const nonce = randomBytes(16).toString("base64");
  return new NextResponse(renderPrintHtml(html, nonce), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": csp(nonce),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
