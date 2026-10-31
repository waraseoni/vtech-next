// ─── Estimate builder: types, totals math, local draft ──────────────────────
// Record-free by design (D1/D2): estimate sirf client ko dene ke liye hai.
// R1: stock kabhi deduct/reserve nahi. R2: client khate me koi debit nahi.
// R3: koi job/bill/activity_logs row nahi. Is file me koi DB access nahi.

import { todayIST } from "@/lib/dateUtils";

export type EstimateLineKind = "inventory" | "custom_part" | "service" | "custom_service";

export type EstimateLine = {
  id: string;
  kind: EstimateLineKind;
  product_id: number | null;
  service_id: number | null;
  name: string;
  hsn: string | null;
  qty: number;
  rate: number;
};

export type EstimateDiscountType = "amount" | "percent";

export type EstimatePrintOptions = {
  showTitle: boolean;
  title: string;
  showDisclaimer: boolean;
  disclaimer: string;
};

/** Client snapshot — draft me local rehta hai; koi client table write nahi. */
export type EstimateClient = {
  id: number | null;
  name: string;
  contact: string;
  email: string;
  address: string;
};

export type EstimateForm = {
  reference: string;
  date: string;
  validTill: string;
  client: EstimateClient | null;
  gstEnabled: boolean;
  gstRate: number;
  discountType: EstimateDiscountType;
  discountValue: number;
  remarks: string;
  lines: EstimateLine[];
  printOptions: EstimatePrintOptions;
};

export type EstimateTotals = {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  roundOff: number;
  grandTotal: number;
};

export type EstimatePrintClient = {
  name: string;
  mobile?: string;
  email?: string;
  address?: string;
};

export type EstimatePrintLine = {
  name: string;
  hsn: string | null;
  qty: number;
  rate: number;
};

export type EstimatePrintPayload = {
  reference: string;
  date: string;
  validTill: string;
  client: EstimatePrintClient | null;
  lines: EstimatePrintLine[];
  gstEnabled: boolean;
  gstRate: number;
  discountType: EstimateDiscountType;
  discountValue: number;
  remarks: string;
  printOptions: EstimatePrintOptions;
};

export const DEFAULT_GST_RATE = 18;
export const GST_RATES = [0, 5, 12, 18] as const;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const finite = (n: unknown, fallback = 0): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

export function lineAmount(line: Pick<EstimateLine, "qty" | "rate">): number {
  return round2(Math.max(0, finite(line.qty)) * Math.max(0, finite(line.rate)));
}

/**
 * Plan §4 (locked formulas):
 * subtotal = Σ round2(qty*rate); discount clamped to [0, subtotal];
 * GST exclusive on taxable; CGST/SGST split 9+9 at 18%; nearest-rupee round-off.
 */
export function computeEstimateTotals(
  lines: Pick<EstimateLine, "qty" | "rate">[],
  opts: {
    gstEnabled: boolean;
    gstRate: number;
    discountType: EstimateDiscountType;
    discountValue: number;
  }
): EstimateTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineAmount(l), 0));

  const rawDiscount =
    opts.discountType === "percent"
      ? (subtotal * Math.max(0, finite(opts.discountValue))) / 100
      : Math.max(0, finite(opts.discountValue));
  const discountAmount = round2(clamp(rawDiscount, 0, subtotal));

  const taxable = round2(subtotal - discountAmount);
  const gstRate = opts.gstEnabled ? clamp(finite(opts.gstRate), 0, 100) : 0;
  const gstAmount = round2((taxable * gstRate) / 100);
  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);

  const grandRaw = taxable + gstAmount;
  const roundOff = round2(Math.round(grandRaw) - grandRaw);
  const grandTotal = Math.round(grandRaw);

  return { subtotal, discountAmount, taxable, gstAmount, cgst, sgst, roundOff, grandTotal };
}

/** Default valid-till = date + 15 din (IST-safe plain YYYY-MM-DD math). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = (dateStr || todayIST()).split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

/** Editable reference hint: YYYYMMDD-XXX (no "EST-" prefix — print neutral). */
export function suggestEstimateReference(dateStr: string = todayIST()): string {
  return `${dateStr.replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
}

export function newLineId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function createDefaultEstimateForm(dateStr: string = todayIST()): EstimateForm {
  return {
    reference: suggestEstimateReference(dateStr),
    date: dateStr,
    validTill: addDaysToDateStr(dateStr, 15),
    client: null,
    gstEnabled: false,
    gstRate: DEFAULT_GST_RATE,
    discountType: "amount",
    discountValue: 0,
    remarks: "",
    lines: [],
    printOptions: {
      showTitle: false,
      title: "ESTIMATE",
      showDisclaimer: false,
      disclaimer:
        "Ye estimate hai — stock deduct nahi hota aur koi amount client ke khate me debit nahi hota.",
    },
  };
}

/** WhatsApp share text — informational only, koi posting nahi. */
export function buildEstimateWhatsAppMessage(
  shop: { name: string; mobile: string },
  form: EstimateForm,
  totals: EstimateTotals
): string {
  const inr = (n: number) => `₹${n.toFixed(2)}`;
  const rows = form.lines
    .filter((l) => l.name.trim() || lineAmount(l) > 0)
    .map((l) => `• ${l.name.trim() || "Item"} × ${l.qty} = ${inr(lineAmount(l))}`);

  const parts = [
    `*${shop.name}*`,
    `Estimate ${form.reference}`,
    `Date: ${form.date} | Valid till: ${form.validTill}`,
    "",
    ...rows,
    "",
    `Subtotal: ${inr(totals.subtotal)}`,
  ];
  if (totals.discountAmount > 0) parts.push(`Discount: -${inr(totals.discountAmount)}`);
  if (form.gstEnabled && totals.gstAmount > 0) {
    parts.push(`GST (${form.gstRate}%): ${inr(totals.gstAmount)}`);
  }
  parts.push(`*Total: ${inr(totals.grandTotal)}*`);
  if (form.remarks.trim()) parts.push("", form.remarks.trim());
  if (shop.mobile) parts.push("", `Contact: ${shop.mobile}`);
  return parts.join("\n");
}

// ─── Draft persistence (localStorage only, 7-day TTL) ───────────────────────

export const ESTIMATE_DRAFT_KEY = "vtech_estimate_draft_v1";
export const ESTIMATE_DRAFT_VERSION = 1;
export const ESTIMATE_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type EstimateDraftEnvelope = {
  version: number;
  savedAt: number;
  form: EstimateForm;
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const LINE_KINDS: EstimateLineKind[] = ["inventory", "custom_part", "service", "custom_service"];

function parseLine(raw: unknown): EstimateLine | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = LINE_KINDS.includes(r.kind as EstimateLineKind)
    ? (r.kind as EstimateLineKind)
    : "custom_part";
  return {
    id: str(r.id, 80) || newLineId(),
    kind,
    product_id:
      typeof r.product_id === "number" && Number.isFinite(r.product_id) ? r.product_id : null,
    service_id:
      typeof r.service_id === "number" && Number.isFinite(r.service_id) ? r.service_id : null,
    name: str(r.name, 200),
    hsn: typeof r.hsn === "string" ? r.hsn.slice(0, 40) : null,
    qty: Math.max(0, num(r.qty, 1)),
    rate: Math.max(0, num(r.rate, 0)),
  };
}

function parseForm(raw: unknown): EstimateForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const defaults = createDefaultEstimateForm();
  const po = (r.printOptions && typeof r.printOptions === "object" ? r.printOptions : {}) as Record<
    string,
    unknown
  >;
  const c = (r.client && typeof r.client === "object" ? r.client : null) as Record<
    string,
    unknown
  > | null;
  return {
    reference: str(r.reference, 60) || defaults.reference,
    date: str(r.date, 10) || defaults.date,
    validTill: str(r.validTill, 10) || defaults.validTill,
    client: c
      ? {
          id: typeof c.id === "number" && Number.isFinite(c.id) ? c.id : null,
          name: str(c.name, 200),
          contact: str(c.contact, 40),
          email: str(c.email, 200),
          address: str(c.address, 500),
        }
      : null,
    gstEnabled: r.gstEnabled === true,
    gstRate: clamp(num(r.gstRate, DEFAULT_GST_RATE), 0, 100),
    discountType: r.discountType === "percent" ? "percent" : "amount",
    discountValue: Math.max(0, num(r.discountValue)),
    remarks: str(r.remarks, 1000),
    lines: Array.isArray(r.lines)
      ? (r.lines.map(parseLine).filter(Boolean) as EstimateLine[]).slice(0, 100)
      : [],
    printOptions: {
      showTitle: po.showTitle === true,
      title: str(po.title, 60) || "ESTIMATE",
      showDisclaimer: po.showDisclaimer === true,
      disclaimer: str(po.disclaimer, 300) || defaults.printOptions.disclaimer,
    },
  };
}

export function serializeEstimateDraft(form: EstimateForm, savedAt = Date.now()): string {
  const envelope: EstimateDraftEnvelope = { version: ESTIMATE_DRAFT_VERSION, savedAt, form };
  return JSON.stringify(envelope);
}

/** Returns the form only if it is valid and younger than the 7-day TTL. */
export function parseEstimateDraft(raw: string | null, now = Date.now()): EstimateForm | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Partial<EstimateDraftEnvelope>;
    if (env.version !== ESTIMATE_DRAFT_VERSION) return null;
    if (typeof env.savedAt !== "number" || !Number.isFinite(env.savedAt)) return null;
    const age = now - env.savedAt;
    if (age < 0 || age > ESTIMATE_DRAFT_TTL_MS) return null;
    return parseForm(env.form);
  } catch {
    return null;
  }
}

export function loadEstimateDraft(now = Date.now()): EstimateForm | null {
  if (typeof window === "undefined") return null;
  try {
    return parseEstimateDraft(window.localStorage.getItem(ESTIMATE_DRAFT_KEY), now);
  } catch {
    return null;
  }
}

export function saveEstimateDraft(form: EstimateForm, savedAt = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ESTIMATE_DRAFT_KEY, serializeEstimateDraft(form, savedAt));
  } catch {
    /* storage full/blocked — draft is a convenience, not critical */
  }
}

export function clearEstimateDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ESTIMATE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
