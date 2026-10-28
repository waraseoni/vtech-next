import { getAdminSupabase } from "@/lib/admin-supabase";

// Single source of truth for shop identity on printed documents.
// Reads public branding from `system_info` (service-role, read-only) with env
// fallbacks so white-label clients never print the seller's hardcoded details.

export type PrintShop = {
  name: string;
  tagline: string;
  address: string;
  mobile: string;
  email: string;
  gstin: string;
  upiId: string;
  signature: string;
  logo: string;
};

const TTL_MS = 60_000;
let cache: { value: PrintShop; at: number } | null = null;

function env(key: string): string {
  return process.env[key]?.trim() || "";
}

export async function getPrintShop(): Promise<PrintShop> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const supabase = getAdminSupabase();
  const { data } = await supabase.from("system_info").select("meta_field, meta_value");
  const info: Record<string, string> = {};
  for (const row of data || []) {
    if (row.meta_value != null) info[row.meta_field] = String(row.meta_value);
  }

  const value: PrintShop = {
    name: info.name || env("NEXT_PUBLIC_SITE_NAME") || "Your Shop",
    tagline: info.tagline || env("NEXT_PUBLIC_SITE_TAGLINE") || "Repair & Service Solutions",
    address: info.address || env("NEXT_PUBLIC_SITE_ADDRESS") || "",
    mobile: info.contact || env("NEXT_PUBLIC_SITE_PHONE") || "",
    email: info.email || env("NEXT_PUBLIC_SITE_EMAIL") || "",
    gstin: info.gst_no || info.gstin || "",
    upiId: info.upi_id || "",
    signature: info.signature || "",
    logo: info.logo || "",
  };

  cache = { value, at: Date.now() };
  return value;
}

/** Absolute site base URL for QR codes and shared links. */
export function getSiteBaseUrl(requestUrl?: string): string {
  const configured = env("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  if (configured) return configured;
  if (requestUrl) {
    try {
      return new URL(requestUrl).origin;
    } catch {
      /* ignore */
    }
  }
  return "";
}

/** Local QR generation (no third-party image service, works offline). */
export async function qrDataUrl(data: string, size = 130): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export function escHtml(value: string | null | undefined): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
