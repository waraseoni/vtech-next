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
  autoCols: true,
  maxFont: 11,
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
const LABEL_PAD_MM = 1.5; // .label padding
const CONTENT_GAP_MM = 1.5; // label ke andar left-content ↔ right column gap
const CONTENT_PAD_X_MM = 2; // .cell-content horizontal padding
const GRID_COL_GAP_MM = 1.5; // .items grid-column-gap
const CHAR_EM = 0.62; // bold Arial me avg char width (em)
const MIN_FONT_PT = 3.5;

/** Content column ki width (mm) — right column ko minus kar ke. */
function contentColWidthMm(opts: BoxPrintOptions, cols: number): number {
  const rightW = Math.min(opts.heightMm * 0.72, 28);
  const outer = opts.widthMm - rightW - LABEL_PAD_MM * 2 - CONTENT_GAP_MM;
  const inner = outer - CONTENT_PAD_X_MM * 2;
  return (inner - GRID_COL_GAP_MM * (cols - 1)) / cols;
}

/** Available content height (mm). */
function contentHeightMm(opts: BoxPrintOptions): number {
  return Math.max(8, opts.heightMm - 8.5);
}

/** Rows ke liye height-based max font (pt). */
function heightFitFontPt(opts: BoxPrintOptions, rows: number): number {
  return (contentHeightMm(opts) / Math.max(rows, 1)) * 0.85 / 0.3528;
}

/** Sabse lambe naam ko single-line column me fit karne ke liye font (pt). */
function widthFitFontPt(opts: BoxPrintOptions, cols: number, names: string[]): number {
  const colWmm = contentColWidthMm(opts, cols);
  const longest = Math.max(1, ...names.map((name) => (name || "").length || 1));
  return colWmm / 0.3528 / (longest * CHAR_EM);
}

/**
 * Items ka best-fit lookup (rigid grid).
 * - contentCols > 0 → fixed columns; warna auto (font maximize karne wala cols)
 * - contentRows > 0 → fixed rows (grid rigid rahta hai); 0 = auto → ceil(n/cols)
 * - fontSizePt > 0 → fixed font; warna height+width se auto (maxFont cap)
 *
 * STRUCTURE HAMESHA LOCK: right column (BOX ID / QR / Location) bilkul nahi
 * hilta. Content box ka grid fix hai (cols × rows). Har naam SINGLE-LINE
 * dikhta hai — font uniform itna chhota hota hai ki sabse lambe naam ki
 * line column me fit ho jaye. Isliye kuch bhi nahi kat-ta, sab pura dikhta
 * hai, aur frame kabhi nahi tootta.
 */
export function itemsLayout(
  n: number,
  opts: BoxPrintOptions,
  names: string[] = []
): { cols: number; fonts: number[]; lines: number[]; capacity: number; wrap: number } {
  if (n <= 0) {
    const cols = opts.contentCols || 3;
    const font = opts.fontSizePt || Math.min(opts.maxFont, 10);
    return { cols, fonts: [font], lines: [], capacity: 0, wrap: 1 };
  }

  const effNames = names.length >= n ? names.slice(0, n) : Array.from({ length: n }, () => "");

  const fixedCols = opts.contentCols > 0;
  const maxAutoCols = Math.min(opts.autoCols ? 5 : 3, n);
  let bestCol = fixedCols ? opts.contentCols : 1;
  let bestFont = -1;

  for (let c = fixedCols ? opts.contentCols : 1; c <= maxAutoCols; c++) {
    const rows = opts.contentRows > 0 ? opts.contentRows : Math.ceil(n / c);
    const hFit = heightFitFontPt(opts, rows);
    const wFit = widthFitFontPt(opts, c, effNames);
    const f = opts.fontSizePt > 0
      ? Math.min(opts.fontSizePt, Math.max(MIN_FONT_PT, wFit))
      : Math.min(opts.maxFont, Math.max(MIN_FONT_PT, Math.min(hFit, wFit)));
    if (f > bestFont) {
      bestFont = f;
      bestCol = c;
    }
  }

  const rows = opts.contentRows > 0 ? opts.contentRows : Math.ceil(n / bestCol);
  const capacity = bestCol * rows;
  const fonts = Array.from({ length: capacity }, () => bestFont);
  const lines = Array.from({ length: capacity }, () => 1);

  return { cols: bestCol, fonts, lines, capacity, wrap: 1 };
}

function buildLabelHtml(
  data: BoxLabelData,
  qrDataUrl: string,
  wMm: number,
  hMm: number,
  opts: BoxPrintOptions
): string {
  const n = data.items.length;
  const { cols, fonts, capacity } = itemsLayout(n, opts, data.items.map((i) => i.name));
  const visibleItems = data.items.slice(0, capacity);
  const fontPt = (fonts[0] || 8) as number;

  const itemsHtml = visibleItems.length
    ? visibleItems
        .map(
          (it, i) =>
            `<div class="item" style="font-size:${fontPt}pt;">${escapeHtml(it.name)}</div>`
        )
        .join("")
    : `<div class="item item--empty" style="font-size:${fontPt}pt;">— khali —</div>`;

  const itemsStyle = `grid-template-columns:repeat(${cols},1fr);grid-auto-rows:1fr;`;

  return `
    <div class="label" style="width:${wMm}mm;height:${hMm}mm;">
      <div class="cell cell-content">
        <div class="items-title">Contents</div>
        <div class="items" style="${itemsStyle}">${itemsHtml}</div>
      </div>
      <div class="col-right">
        <div class="cell cell-id"><span class="id-label">BOX</span><span class="id-value">${escapeHtml(data.boxId)}</span></div>
        <div class="cell-qr"><img src="${qrDataUrl}" alt="QR" class="qr" /></div>
        <div class="cell cell-loc">${escapeHtml(data.locationPath || "Location")}</div>
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
              `<div class="label label--empty" style="width:${w}mm;height:${h}mm;"></div>`
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

.page{
  display:grid;
  grid-template-columns:repeat(${cols},${w}mm);
  grid-auto-rows:${h}mm;
  gap:${gap}mm;
  justify-content:center;
  page-break-after:always;
}
.page:last-child{page-break-after:auto}

.label{
  border:1px solid #94a3b8;
  border-radius:3mm;
  padding:1.5mm;
  display:flex;
  align-items:stretch;
  gap:1.5mm;
  overflow:hidden;
  break-inside:avoid;
  page-break-inside:avoid;
  background:#fff;
}
.label--empty{border:1px dashed #e5e7eb;background:#fafafa}

/* Left — poori height ka content box */
.cell-content{
  flex:1;
  border:1px solid #cbd5e1;
  border-radius:2mm;
  background:#f8fafc;
  display:flex;
  flex-direction:column;
  align-items:stretch;
  justify-content:flex-start;
  gap:0.8mm;
  padding:1.5mm 2mm;
  min-width:0;
  min-height:0;
}
.items-title{
  font-size:5pt;
  font-weight:900;
  color:#94a3b8;
  text-transform:uppercase;
  letter-spacing:.12em;
  line-height:1;
}
.items{
  display:grid;
  grid-auto-rows:1fr;
  grid-column-gap:1.5mm;
  grid-row-gap:0.6mm;
  flex:1;
  min-height:0;
  align-content:start;
  overflow:hidden;
}

.item{
  display:flex;
  align-items:center;
  font-weight:800;
  color:#1f2937;
  line-height:1.05;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  min-width:0;
}
.item--empty{color:#9ca3af;font-style:italic}

/* Right column — title (top), QR (middle), location (bottom) */
.col-right{
  flex-shrink:0;
  display:flex;
  flex-direction:column;
  gap:1.2mm;
  width:${Math.min(h * 0.72, 28)}mm;
}
.cell{
  border-radius:2mm;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  flex:0 0 auto;
}
.cell-id{
  background:#0d1117;
  border:1px solid #0d1117;
  padding:0.8mm 1.2mm;
  gap:1mm;
}
.id-label{
  font-size:6.5pt;
  font-weight:900;
  color:#8a94a6;
  letter-spacing:.1em;
  text-transform:uppercase;
}
.id-value{
  font-size:9pt;
  font-weight:900;
  color:#fff;
  letter-spacing:.03em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.cell-qr{
  flex:1;
  border:1px solid #cbd5e1;
  border-radius:2mm;
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0.8mm;
  min-height:0;
}
.qr{
  max-width:100%;
  max-height:100%;
  height:auto;
  display:block;
  object-fit:contain;
  image-rendering:pixelated;
}

.cell-loc{
  border:1px solid #cbd5e1;
  border-radius:2mm;
  background:#f8fafc;
  font-size:5pt;
  font-weight:700;
  color:#334155;
  text-transform:uppercase;
  letter-spacing:.03em;
  text-align:center;
  line-height:1.15;
  word-break:break-word;
  white-space:normal;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
  overflow:hidden;
  padding:0.8mm 1mm;
  max-height:6mm;
}

@media print{
  body{margin:0;padding:0}
  .label{box-shadow:none}
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
