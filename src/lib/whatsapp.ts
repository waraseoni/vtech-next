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
 * Open WhatsApp chat for a client with a rendered message.
 * Returns the wa.me URL (caller may also log to payment_reminders).
 */
export function waLink(phone: string, message: string): string {
  const clean = (phone || "").replace(/\D/g, "");
  return `https://wa.me/91${clean}?text=${encodeURIComponent(message)}`;
}
