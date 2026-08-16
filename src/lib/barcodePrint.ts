import JsBarcode from "jsbarcode";

export interface BarcodeLabelItem {
  value: string;
  name: string;
  price?: number;
}

/**
 * JSX-free barcode SVG string generator (jsbarcode → svg element → outerHTML).
 * Deterministic & side-effect free, so it can be called from any client page.
 */
export function barcodeSvg(value: string, width = 120, height = 40): string {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  JsBarcode(el, value, {
    format: "CODE128",
    width: 1.4,
    height,
    displayValue: true,
    margin: 0,
    background: "#ffffff",
    lineColor: "#000000",
    fontSize: 13,
  });
  el.setAttribute("width", String(width));
  return el.outerHTML;
}

/** Guard: sanitise value so only safe Code128 characters pass through. */
export function safeBarcode(value: string | null | undefined): string {
  return (value || "").replace(/[^\x20-\x7E]/g, "").slice(0, 48).trim();
}

/**
 * Open print window with a sheet of barcode labels.
 * items: ordered list of { value, name, price? }.
 * cols: labels per row (thermal = 1-2, A4 = 3-4).
 */
export function printBarcodeLabels(items: BarcodeLabelItem[], cols = 3): void {
  const list = items.filter(i => safeBarcode(i.value));
  if (!list.length) return;

  const labels = list.map(item => {
    const price = typeof item.price === "number" && item.price > 0
      ? `<div class="price">₹${item.price.toLocaleString("en-IN")}</div>`
      : "";
    return `
      <div class="label">
        ${barcodeSvg(safeBarcode(item.value), 140, 44)}
        <div class="name">${escapeHtml(item.name)}</div>
        ${price}
      </div>`;
  }).join("");

  const single = list.length === 1;
  const gridCols = single ? 1 : cols;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("Popup blocked — popups allow kar ke dobara try karein."); return; }

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; padding: 8px; }
    .sheet { display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 8px; }
    .label {
      border: 1px dashed #999; border-radius: 4px; padding: 8px 10px;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      text-align: center; break-inside: avoid;
    }
    .label svg { max-width: 100%; height: auto; }
    .name { font-size: 11px; font-weight: 700; color: #111; line-height: 1.2; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .price { font-size: 12px; font-weight: 800; color: #000; margin-top: 1px; }
    ${single ? `
    /* Single label: compact fixed-width so it fits a thermal/label printer */
    .sheet { display: flex; justify-content: flex-start; }
    .label { width: 248px; border: 1px solid #999; }
    body { padding: 10px; }` : ""}
    @media print {
      body { padding: 0; }
      .sheet { gap: 6px; }
      .label { border: 1px solid #ddd; }
      ${single ? `body { padding: 0; } .label { width: 248px; }` : ""}
    }
  </style>
</head>
<body>
  <div class="sheet">${labels}</div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 250); };
  </script>
</body>
</html>`);
  w.document.close();
}

/** Minimal HTML escape for label text (XSS-safe for the print window). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
