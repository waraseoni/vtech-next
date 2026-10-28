import { describe, expect, it } from "vitest";

import { printHtmlResponse, renderPrintHtml } from "./print-html";

const NONCE = "dGVzdC1ub25jZQ==";

describe("renderPrintHtml", () => {
  it("adds the nonce to every script tag", () => {
    const html = "<html><body><script>a()</script><script>b()</script></body></html>";
    const out = renderPrintHtml(html, NONCE);
    expect(out).toContain(`<script nonce="${NONCE}">a()</script>`);
    expect(out).toContain(`<script nonce="${NONCE}">b()</script>`);
    expect(out).not.toContain("<script>");
  });

  it("converts inline print/close handlers to data attributes", () => {
    const html =
      '<html><body><button onclick="window.print()">Print</button><button onclick="window.close()">Close</button></body></html>';
    const out = renderPrintHtml(html, NONCE);
    expect(out).toContain("<button data-print>Print</button>");
    expect(out).toContain("<button data-close>Close</button>");
    expect(out).not.toContain("onclick=");
  });

  it("converts savePDF/toggleTrackQR handlers", () => {
    const html =
      '<button onclick="savePDF()">PDF</button><button onclick="toggleTrackQR()">QR</button>';
    const out = renderPrintHtml(html, NONCE);
    expect(out).toContain('data-action="savePDF"');
    expect(out).toContain('data-action="toggleTrackQR"');
  });

  it("appends the click bridge before </body>", () => {
    const out = renderPrintHtml("<html><body>x</body></html>", NONCE);
    const bridgeIndex = out.indexOf("data-print],[data-close]");
    expect(bridgeIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeLessThan(out.indexOf("</body>"));
  });

  it("keeps a hostile inline handler inert (left for CSP to block)", () => {
    const html = '<img src=x onerror="alert(1)">';
    const out = renderPrintHtml(html, NONCE);
    // Bridge only rewrites known handlers; CSP (script-src nonce) blocks the rest.
    expect(out).toContain('onerror="alert(1)"');
    expect(out).not.toContain(`nonce="${NONCE}" onerror`);
  });

  it("appends the bridge when the document has no body tag", () => {
    const out = renderPrintHtml("<div>x</div>", NONCE);
    expect(out.endsWith("</script>")).toBe(true);
  });
});

describe("printHtmlResponse", () => {
  it("sets a nonce-based CSP, no-store and nosniff", async () => {
    const res = printHtmlResponse("<html><body><script>ok()</script></body></html>");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const csp = res.headers.get("content-security-policy") || "";
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9+/=]+'/);

    const body = await res.text();
    const nonce = csp.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
    expect(nonce).toBeTruthy();
    expect(body).toContain(`<script nonce="${nonce}">ok()</script>`);
  });

  it("generates a fresh nonce per response", () => {
    const a = printHtmlResponse("<html></html>").headers.get("content-security-policy");
    const b = printHtmlResponse("<html></html>").headers.get("content-security-policy");
    expect(a).not.toBe(b);
  });

  it("honours extra headers", async () => {
    const res = printHtmlResponse("<html></html>", { "X-Robots-Tag": "noindex" });
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});
