import { supabase } from "@/lib/supabase";
import { DEFAULT_TEMPLATES } from "@/lib/whatsappTemplates";

export type TemplateVars = Record<string, string | number>;

/**
 * Substitute {placeholder} tokens in a WhatsApp template.
 * Unknown placeholders are left as-is (so typos surface in preview).
 */
export function substituteTemplate(tpl: string, vars: TemplateVars): string {
  return (tpl || "").replace(/\{(\w+)\}/g, (m, key: string) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : m
  );
}

/**
 * Resolve a WhatsApp template with proper fallback chain:
 *   1. Canonical key in system_info (e.g. "whatsapp_welcome") — set by "Save + Apply"
 *   2. wp_default_ key in system_info (e.g. "wp_default_whatsapp_welcome") — set by "Save as Defaults"
 *   3. Hardcoded DEFAULT_TEMPLATES fallback
 */
export function resolveTemplate(info: Record<string, string>, key: string): string {
  return info[key] || info[`wp_default_${key}`] || DEFAULT_TEMPLATES[key] || "";
}

/**
 * Load a WhatsApp template from system_info (meta_field = `whatsapp_reminder`,
 * `whatsapp_status_0`, `whatsapp_sale`, etc.) with a fallback string.
 */
export async function loadTemplate(field: string, fallback: string): Promise<string> {
  const { data } = await supabase
    .from("system_info")
    .select("meta_value")
    .eq("meta_field", field)
    .maybeSingle();
  const tpl = data?.meta_value;
  if (!tpl || !tpl.trim()) return fallback;
  return tpl;
}

/** Build the standard firm info vars used by every template. */
export function firmVars(info: Record<string, string>): TemplateVars {
  return {
    firm_name: info.name || "V-Technologies",
    firm_phone: info.contact || "9179105875",
    firm_address: info.address || "Jabalpur",
    firm_owner: info.owner || "Vikram Jain",
  };
}

/**
 * Build wa.me link. India default (+91) — but double-91 bug safe:
 *   - "919179105875" → 919179105875 (already has country code, don't prepend)
 *   - "9179105875"   → 919179105875 (10-digit local, prepend 91)
 *   - "+91 9179..."  → strips non-digits first
 * Message optional (chat open hogi bina text ke).
 *
 * Ye function hi single source of truth hai — pages me inline `wa.me/91...`
 * mat likho (double-91 bug ka risk). Pehle ~20 jagah inline the.
 */
export function waLink(phone: string, message?: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "https://wa.me/";
  // Country code already hai to prepend mat karo (12 digit = 91 + 10)
  if (clean.length === 12 && clean.startsWith("91")) {
    // already 91 + 10-digit — ok
  } else if (clean.length === 10) {
    clean = `91${clean}`;
  } else if (clean.length === 11 && clean.startsWith("9")) {
    // e.g. 9179105875 style without leading 0 — treat as local 10-digit w/ leading 9?
    // Actually 11-digit starting with 91 is country+9... leave as-is if starts 91
    if (!clean.startsWith("91")) clean = `91${clean}`;
  }
  // >12 digits (international non-IN) — use as-is
  const base = `https://wa.me/${clean}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Back-compat alias — older code expected (phone, message) always with text. */
export function waLinkText(phone: string, message: string): string {
  return waLink(phone, message);
}

/** Open WhatsApp in new tab (window.open wrapper for client components). */
export function openWhatsApp(phone: string, message?: string): void {
  if (typeof window !== "undefined") window.open(waLink(phone, message), "_blank");
}
