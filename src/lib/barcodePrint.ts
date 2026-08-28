import JsBarcode from "jsbarcode";

export type LabelSize = "medium" | "small" | "compact";
export type Orientation = "portrait" | "landscape";
export type PrintMargin = "narrow" | "normal" | "wide";

export interface BarcodeLabelItem {
  value: string;
  name: string;
}

export interface PrintOptions {
  size: LabelSize;
  orientation: Orientation;
  margin: PrintMargin;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  size: "medium",
  orientation: "portrait",
  margin: "normal",
};

const LABEL_PRESETS: Record<LabelSize, { w: number; h: number; nameSize: number; svgH: number }> = {
  medium: { w: 63.5, h: 38.1, nameSize: 8, svgH: 15 },
  small: { w: 63.5, h: 25.4, nameSize: 6.5, svgH: 10 },
  compact: { w: 50, h: 20, nameSize: 5.5, svgH: 8 },
};

const PRINT_MARGINS: Record<PrintMargin, number> = {
  narrow: 3,
  normal: 8,
  wide: 14,
};

const GAP_MM = 1.5;

const PAGE_MM: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
};

/**
 * Compute how many labels fit on a single A4 sheet for the given options.
 * Used both by the UI (sheet estimate) and the print window (grid sizing).
 */
export function labelSheetCapacity(opts: PrintOptions = DEFAULT_PRINT_OPTIONS) {
  const preset = LABEL_PRESETS[opts.size];
  const page = PAGE_MM[opts.orientation];
  const m = PRINT_MARGINS[opts.margin];
  const cols = Math.max(1, Math.floor((page.w - 2 * m + GAP_MM) / (preset.w + GAP_MM)));
  const rows = Math.max(1, Math.floor((page.h - 2 * m + GAP_MM) / (preset.h + GAP_MM)));
  return { cols, rows, perSheet: cols * rows };
}

/**
 * JSX-free barcode SVG string generator (jsbarcode → svg element → outerHTML).
 * Deterministic & side-effect free, so it can be called from any client page.
 */
export function barcodeSvg(value: string, width = 140, height = 44): string {
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
  return (value || "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 48)
    .trim();
}

/**
 * Open print window with an A4 grid of barcode labels.
 * Designed for inkjet/laser A4 printers (no thermal printer needed).
 * items: ordered list of { value, name }. Price intentionally NOT printed.
 * opts: label size, page orientation, page margin — grid auto-fills the page
 * so the maximum number of labels prints per sheet.
 */
export function printBarcodeLabels(
  items: BarcodeLabelItem[],
  opts: PrintOptions = DEFAULT_PRINT_OPTIONS
): void {
  const list = items.filter((i) => safeBarcode(i.value));
  if (!list.length) return;

  const preset = LABEL_PRESETS[opts.size];
  const m = PRINT_MARGINS[opts.margin];
  const { cols } = labelSheetCapacity(opts);
  const lw = `${preset.w}mm`;
  const lh = `${preset.h}mm`;

  const labels = list
    .map(
      (item) => `
      <div class="label">
        ${barcodeSvg(safeBarcode(item.value))}
        <div class="name">${escapeHtml(item.name)}</div>
      </div>`
    )
    .join("");

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Popup blocked — popups allow kar ke dobara try karein.");
    return;
  }

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Labels (A4)</title>
  <style>
    @page { size: A4 ${opts.orientation}; margin: ${m}mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; padding: 0; }
    .sheet {
      display: grid;
      grid-template-columns: repeat(${cols}, ${lw});
      grid-auto-rows: ${lh};
      gap: ${GAP_MM}mm;
      justify-content: start;
    }
    .label {
      width: ${lw}; height: ${lh};
      border: 1px dashed #aaa; border-radius: 1.5mm;
      padding: 1mm 1.5mm;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.8mm;
      text-align: center; overflow: hidden;
      break-inside: avoid; page-break-inside: avoid;
    }
    .label svg { max-width: 100%; max-height: ${preset.svgH}mm; height: auto; }
    .name {
      font-size: ${preset.nameSize}pt; font-weight: 700; line-height: 1.15;
      width: 100%; word-break: break-word;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    @media print {
      .label { border: 1px dashed #ddd; }
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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
