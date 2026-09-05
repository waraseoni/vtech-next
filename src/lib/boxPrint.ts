import QRCode from "qrcode";
import { encodeLocationToken, type LocationParts } from "@/lib/locations";

export interface BoxLabelItem {
  name: string;
}

export interface BoxLabelData {
  boxId: string;
  items: BoxLabelItem[];
  locationPath?: string;
}

export interface BoxPrintOptions {
  widthMm: number;
  heightMm: number;
  cols: number;
  rows: number;
  gapMm: number;
  /** Items grid ke dynamic columns on/off. off ho to 3 fixed. */
  autoCols: boolean;
  /** Contents font ka max (pt). Auto-shrink sirf tabhi jab rows na baithe. */
  maxFont: number;
  /** Contents grid ke fixed columns. 0 = auto (itemsLayout decide karta hai). */
  contentCols: number;
  /** Contents grid ke max visible rows. 0 = auto (sab fit). Extra items hide. */
  contentRows: number;
  /** Fixed content font size (pt). 0 = auto. */
  fontSizePt: number;
}

export const DEFAULT_BOX_PRINT_OPTIONS: BoxPrintOptions = {
  widthMm: 80,
  heightMm: 40,
  cols: 2,
  rows: 6,
  gapMm: 4,
  autoCols: false,
  maxFont: 8,
  contentCols: 2,
  contentRows: 0,
  fontSizePt: 0,
};

async function boxQrDataUrl(text: string, size = 160): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0d1117", light: "#ffffff" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Box label ka QR token. Box location hai (Zone ▸ Rack ▸ Bin ▸ Box) — isliye
 * wo `VTECH-LOC:` location token use karte hain taaki scan karne par box page
 * khule. `parts` diya ho to wahi token, warna fallback `BOX:`.
 */
export function boxQrToken(data: BoxLabelData, parts?: Partial<LocationParts> | null): string {
  if (parts && (parts.zone || parts.rack || parts.bin || parts.box)) {
    return encodeLocationToken(parts);
  }
  return `BOX:${data.boxId}`;
}

/* ── Print metric (mm) constants — .label / .cell-content / .items CSS se ── */
const LABEL_PAD_MM = 1;     // .label padding (tight — frame 80×40 ke andar rahe)
const CONTENT_GAP_MM = 1.2; // label ke andar left-content ↔ right column gap
const CONTENT_PAD_X_MM = 1.5; // .cell-content horizontal padding
const GRID_COL_GAP_MM = 1;   // .items grid-column-gap
const GRID_ROW_GAP_MM = 0.6; // .items grid-row-gap (tight — rows ke beech gap kam)
const ITEMS_TITLE_MM = 3.2;  // "Contents" header ki approximate height (mm)
const CHAR_EM = 0.6;         // bold Arial me avg char width (em)
const MIN_FONT_PT = 3.5;
const MAX_WRAP_LINES = 2;    // har item max 2 lines me wrap ho sakta hai

/** Content column ki width (mm) — right column ko minus kar ke (frame LOCKED). */
function contentColWidthMm(opts: BoxPrintOptions, cols: number): number {
  const rightW = Math.min(opts.heightMm * 0.72, 28);
  const outer = opts.widthMm - rightW - LABEL_PAD_MM * 2 - CONTENT_GAP_MM;
  const inner = outer - CONTENT_PAD_X_MM * 2;
  return (inner - GRID_COL_GAP_MM * (cols - 1)) / cols;
}

/** Available content area height (mm) — title header ko minus karke. */
function contentHeightMm(opts: BoxPrintOptions): number {
  const overhead = LABEL_PAD_MM * 2 + ITEMS_TITLE_MM + 0.8;
  return Math.max(8, opts.heightMm - overhead);
}

/**
 * Height-fit font (pt) with word-wrap. Har row max 2 lines rakhta hai,
 * isliye font auto-shrink hota hai — rows badhne par bhi frame nahi tootta.
 */
function heightFitFontPt(opts: BoxPrintOptions, rows: number): number {
  const availH = contentHeightMm(opts);
  const totalGaps = GRID_ROW_GAP_MM * Math.max(0, rows - 1);
  const perRow = (availH - totalGaps) / Math.max(rows, 1);
  return perRow / (0.3528 * 1.15 * MAX_WRAP_LINES);
}

/**
 * Word-wrap aware width-fit: longest WORD (not full string) drives font.
 * Kyunki naam 2 lines me wrap ho sakta hai, sabse lamba word single-line
 * column me fit hona chahiye — baaki words dusri line me aa jayenge.
 */
function widthFitFontPt(opts: BoxPrintOptions, cols: number, names: string[]): number {
  const colWmm = contentColWidthMm(opts, cols);
  const longestWord = Math.max(
    1,
    ...names.flatMap((name) => (name || "").split(/\s+/).map((w) => w.length))
  );
  return colWmm / 0.3528 / (longestWord * CHAR_EM);
}

/**
 * Items ka best-fit layout (FIXED 2-column structure — frame lock).
 *
 * - contentCols > 0 → wahi cols use hote hain (default 2 = aapki requirement).
 * - contentRows > 0 → fixed rows; 0 = auto → ceil(n/cols).
 * - fontSizePt > 0 → fixed font; warna height+width dono se auto (maxFont cap).
 *
 * STRUCTURE HAMESHA LOCK: right column (BOX ID / QR / Location) bilkul nahi
 * hilta. Content ka 2-column grid fix hai — font itna set hota hai ki sabse
 * lamba WORD column width aur row height me fit ho jaye. Naam kabhi nahi kata,
 * frame kabhi nahi tootta.
 */
export function itemsLayout(
  n: number,
  opts: BoxPrintOptions,
  names: string[] = []
): { cols: number; fonts: number[]; lines: number[]; capacity: number; wrap: number } {
  if (n <= 0) {
    const cols = opts.contentCols || 2;
    const font = opts.fontSizePt || Math.min(opts.maxFont, 8);
    return { cols, fonts: [font], lines: [], capacity: 0, wrap: MAX_WRAP_LINES };
  }

  const effNames = names.length >= n ? names.slice(0, n) : Array.from({ length: n }, () => "");

  // Default 2 cols hota hai; 3+ sirf tab jab user explicit set kare.
  const cols = opts.contentCols > 0 ? opts.contentCols : 2;
  const rows = opts.contentRows > 0 ? opts.contentRows : Math.ceil(n / cols);
  const hFit = heightFitFontPt(opts, rows);
  const wFit = widthFitFontPt(opts, cols, effNames);
  const bestFont = opts.fontSizePt > 0
    ? Math.min(opts.fontSizePt, Math.max(MIN_FONT_PT, wFit))
    : Math.min(opts.maxFont, Math.max(MIN_FONT_PT, Math.min(hFit, wFit)));

  const capacity = cols * rows;
  const fonts = Array.from({ length: capacity }, () => bestFont);
  const lines = Array.from({ length: capacity }, () => MAX_WRAP_LINES);

  return { cols, fonts, lines, capacity, wrap: MAX_WRAP_LINES };
}

function buildLabelHtml(
  data: BoxLabelData,
  qrDataUrl: string,
  wMm: number,
  hMm: number,
  _opts: BoxPrintOptions
): string {
  const n = data.items.length;
  const { cols, fonts, capacity } = itemsLayout(n, _opts, data.items.map((i) => i.name));
  const visibleItems = data.items.slice(0, capacity);
  const fontPt = (fonts[0] || 7) as number;
  const fontPx = fontPt * 1.333;

  // Preview (TemplatePreviewCard) se EXACT same px-based inline styles.
  // Print me px→mm conversion (96dpi: 1px = 0.2646mm) apne aap 80×40mm deta hai,
  // isliye preview aur print ab bilkul identical render hote hain.
  const W = wMm * 3.78;
  const H = hMm * 3.78;
  const rightW = Math.min(H * 0.72, 28) * 3.78;

  const itemStyle =
    `font-size:${fontPx}px;font-weight:800;color:#1f2937;line-height:1.15;` +
    `white-space:normal;word-break:break-word;overflow:hidden;` +
    `display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;` +
    `text-align:center;border:1px solid #cbd5e1;border-radius:3px;background:#fff;` +
    `padding:1px 2px;box-sizing:border-box;min-width:0;align-self:center`;

  const itemsHtml = visibleItems.length
    ? visibleItems
        .map((it) => `<div style="${itemStyle}">${escapeHtml(it.name)}</div>`)
        .join("")
    : `<div style="${itemStyle};color:#9ca3af;font-style:italic;border:1px dashed #e5e7eb;background:#f9fafb">— khali —</div>`;

  const itemsStyle =
    `display:grid;grid-template-columns:repeat(${cols},1fr);grid-auto-rows:1fr;` +
    `column-gap:4px;row-gap:2px;flex:1;min-height:0;max-height:100%;overflow:hidden`;

  return `
    <div style="width:${W}px;height:${H}px;border:1px solid #94a3b8;border-radius:11px;padding:1mm 1mm;display:flex;align-items:stretch;gap:4px;overflow:hidden;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;background:#fff;break-inside:avoid;page-break-inside:avoid">
      <div style="flex:1;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;display:flex;flex-direction:column;align-items:stretch;padding:0.8mm 1mm;gap:1.5px;min-width:0;min-height:0;max-height:100%;overflow:hidden">
        <div style="font-size:5px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;line-height:1;flex-shrink:0">Contents</div>
        <div style="${itemsStyle}">${itemsHtml}</div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;width:${rightW}px;max-height:100%;min-height:0">
        <div style="background:#0d1117;border:1px solid #0d1117;border-radius:7px;display:flex;align-items:center;justify-content:center;gap:3px;padding:2px 4px;overflow:hidden;box-sizing:border-box">
          <span style="font-size:7.5px;font-weight:900;color:#8a94a6;letter-spacing:0.1em;text-transform:uppercase">BOX</span>
          <span style="font-size:9.5px;font-weight:900;color:#fff;letter-spacing:0.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(data.boxId || "BOX-XX")}</span>
        </div>
        <div style="flex:1;border:1px solid #cbd5e1;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;padding:2px;min-height:0;overflow:hidden">
          <img src="${qrDataUrl}" alt="QR" style="max-width:100%;max-height:100%;height:auto;display:block;object-fit:contain;image-rendering:pixelated" />
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;font-size:5px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.03em;text-align:center;line-height:1.15;word-break:break-word;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding:1.5px 3px;max-height:20px;box-sizing:border-box">${escapeHtml(data.locationPath || "Location")}</div>
      </div>
    </div>`;
}

export async function printBoxLabels(
  boxes: (BoxLabelData & { printQty?: number })[],
  opts: BoxPrintOptions = DEFAULT_BOX_PRINT_OPTIONS,
  partsMap: Record<string, Partial<LocationParts> | null> = {}
): Promise<void> {
  if (!boxes.length) return;

  // Har box ko uske printQty ke mutabiq repeat karo
  const expandedBoxes: BoxLabelData[] = [];
  for (const b of boxes) {
    const qty = Math.max(1, b.printQty || 1);
    for (let q = 0; q < qty; q++) {
      expandedBoxes.push(b);
    }
  }
  if (!expandedBoxes.length) return;

  const { widthMm: w, heightMm: h, cols, rows, gapMm: gap } = opts;
  const labelsPerPage = cols * rows;

  const labelsWithQr = await Promise.all(
    expandedBoxes.map(async (box) => {
      const qr = await boxQrDataUrl(boxQrToken(box, partsMap[box.boxId]));
      return { box, qr };
    })
  );

  const pagesHtml: string[] = [];
  for (let i = 0; i < labelsWithQr.length; i += labelsPerPage) {
    const slice = labelsWithQr.slice(i, i + labelsPerPage);
    const cells = slice
      .map(({ box, qr }) => buildLabelHtml(box, qr, w, h, opts))
      .join("");
    const empty = labelsPerPage - slice.length;
    const emptyCells =
      empty > 0
        ? Array.from(
            { length: empty },
            () =>
              `<div style="width:${w * 3.78}px;height:${h * 3.78}px;border:1px dashed #e5e7eb;border-radius:11px;background:#fafafa;box-sizing:border-box;"></div>`
          ).join("")
        : "";
    pagesHtml.push(`<div class="page">${cells}${emptyCells}</div>`);
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Box Labels</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* Sirf A4 sheet reader. Har label apne hi inline styles me hota hai
   (bilkul preview jaisa) — isliye print == preview guaranteed. */
.page{
  display:grid;
  grid-template-columns:repeat(${cols},${w}mm);
  grid-auto-rows:${h}mm;
  gap:${gap}mm;
  justify-content:center;
  page-break-after:always;
}
.page:last-child{page-break-after:auto}

@media print{
  body{margin:0;padding:0}
}
</style>
</head>
<body>
${pagesHtml.join("")}
<script>
window.onload=function(){setTimeout(function(){window.print();},400)};
</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Popup blocked — popups allow kar ke dobara try karein.");
    return;
  }
  win.document.write(fullHtml);
  win.document.close();
  win.focus();
}
