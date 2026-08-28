import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextResponse } from "next/server";

// Public business info — client apne Settings (system_info) se manage karta hai.
// SIRF safe public fields return karte hain (name/contact/address/timing).
// Service role bypasses RLS — isliye response sirf ye whitelisted fields deta hai.
const supabase = getAdminSupabase();

function fmt12h(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

function fmtPhone(contact: string | undefined): string {
  if (!contact) return "";
  const c = contact.trim();
  if (!c) return "";
  return c.startsWith("+") ? c : `+91 ${c}`;
}

export async function GET() {
  const { data, error } = await supabase.from("system_info").select("meta_field, meta_value");

  if (error || !data) {
    return NextResponse.json({ error: "system_info unavailable" }, { status: 500 });
  }

  const meta: Record<string, string> = {};
  (data as Array<{ meta_field: string; meta_value: string | null }>).forEach((r) => {
    if (r.meta_value != null) meta[r.meta_field] = String(r.meta_value);
  });

  const open = fmt12h(meta.biz_open || "10:00");
  const close = fmt12h(meta.biz_close || "20:00");
  const hours =
    meta.biz_open || meta.biz_close ? `${meta.biz_days || "Mon-Sat"} · ${open} – ${close}` : "";

  const year = meta.established_year ? Number(meta.established_year) : null;

  return NextResponse.json({
    shop_name: meta.name || "",
    short_name: meta.short_name || "",
    phone: fmtPhone(meta.contact),
    whatsapp: fmtPhone(meta.contact),
    email: meta.email || "",
    address: meta.address || "",
    business_hours: hours,
    established_year: year && !isNaN(year) ? year : null,
  });
}
