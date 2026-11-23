/**
 * Device identity — EK hi display contract (UX plan §4.4/§4.5).
 *
 * Har `item` dikhne wali jagah isi helper se label banati hai. Kisi bhi page
 * par `.brand_id + " " + model` jaisa alag code na likhein — drift = galat
 * display (print, WhatsApp, reports alag-alag dikhte hain).
 *
 * Non-negotiable: `item` column unchanged. Ye helper sirf *likhne se pehle*
 * label banata hai aur *padhte waqt* legacy row ko waisa hi chhod deta hai.
 */

/** Print/SMS-safe separator. Agar kisi template me issue ho to ` / ` se badlein. */
export const DEVICE_SEPARATOR = " · ";

/** zod schema + DB item text (DB me limit nahi, form me guard). */
export const MAX_ITEM_LENGTH = 300;

export type ComposeInput = {
  brand?: string | null;
  model?: string | null;
  identifier?: string | null;
  /** Purana DB `item` — sirf tab use jab koi structured field na ho. */
  legacyItem?: string | null;
  /** "Apna text likhein" escape — upar sab ko override karta hai. */
  customItem?: string | null;
};

export type FormattedDeviceIdentity = {
  label: string;
  brand?: string;
  model?: string;
  identifier?: string;
  /** true = purana row, koi structured field nahi — raw `item` dikhaye. */
  isLegacy: boolean;
};

const clean = (v?: string | null): string => (v ?? "").trim();

/**
 * Final `item` label. Jo part khali hai wo chhup jata hai — "undefined"/"—" nahi.
 * Custom text > structured (Brand · Model · Identifier) > legacy item.
 */
export function composeJobItemLabel(input: ComposeInput): string {
  const custom = clean(input.customItem);
  if (custom) return custom;

  const parts = [clean(input.brand), clean(input.model), clean(input.identifier)].filter(Boolean);
  if (parts.length === 0) return clean(input.legacyItem);
  return parts.join(DEVICE_SEPARATOR);
}

/**
 * Read path — job row ko display ke liye ready karta hai.
 * structured fields na hon to `item` waisa ka taisa (legacy parity guarantee).
 */
export function formatDeviceIdentity(job: {
  item?: string | null;
  brand?: string | null;
  model?: string | null;
  identifier?: string | null;
  /** DB column naam alag hai — caller yahan se map karega. */
  serial_no?: string | null;
  brand_name?: string | null;
}): FormattedDeviceIdentity {
  const brand = clean(job.brand ?? job.brand_name);
  const model = clean(job.model);
  const identifier = clean(job.identifier ?? job.serial_no);
  const hasStructured = Boolean(brand || model || identifier);

  return {
    label: hasStructured
      ? composeJobItemLabel({ brand, model, identifier, legacyItem: job.item })
      : clean(job.item),
    brand: brand || undefined,
    model: model || undefined,
    identifier: identifier || undefined,
    isLegacy: !hasStructured,
  };
}

/**
 * Preview warning ke liye: composed label purane free-text se chhota to
 * user ko "Apna text likhein" ka option dikhana hai (silent loss nahi).
 */
export function labelShrinks(input: ComposeInput): boolean {
  const legacy = clean(input.legacyItem);
  if (!legacy) return false;
  return composeJobItemLabel(input).length < legacy.length;
}

/** Identifier normalize — inline add aur direct type dono yahin se guzrein. */
export function normalizeIdentifier(value?: string | null): string {
  return clean(value).replace(/\s+/g, " ").toUpperCase();
}

export function clampJobItemLabel(label: string): string {
  return label.slice(0, MAX_ITEM_LENGTH);
}

/** Har form ka controlled device state — ek hi shape, ek hi resolve rule. */
export type DeviceFieldValues = {
  brandId: number | null;
  brandName: string;
  model: string;
  serial: string;
  /** Purana / custom free-text `item`. */
  item: string;
  /** true = "Apna text likhein" — structured compose override. */
  customMode: boolean;
};

export const emptyDeviceFields: DeviceFieldValues = {
  brandId: null,
  brandName: "",
  model: "",
  serial: "",
  item: "",
  customMode: false,
};

/**
 * Save se pehle final `item` — new/edit/old/bulk sab isi ko call karte hain.
 * Custom mode > composed > legacy free-text; aur 300-char guard yahin.
 */
export function resolveDeviceItem(v: DeviceFieldValues): string {
  const composed = composeJobItemLabel({
    brand: v.brandName,
    model: v.model,
    identifier: v.serial,
  });
  return clampJobItemLabel(v.customMode ? v.item : composed || v.item);
}
