import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/api-auth";
import {
  isValidLicenseKey,
  makeActivationId,
  activateRemoteLicense,
} from "@/lib/license";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getShopName() {
  const { data } = await supabaseAdmin
    .from("system_info")
    .select("meta_value")
    .eq("meta_field", "name")
    .maybeSingle();
  return typeof data?.meta_value === "string" ? data.meta_value : "";
}

async function upsertField(field: string, value: string) {
  const { data: existing } = await supabaseAdmin
    .from("system_info")
    .select("id")
    .eq("meta_field", field)
    .maybeSingle();
  if (existing?.id) {
    return supabaseAdmin.from("system_info").update({ meta_value: value }).eq("meta_field", field);
  }
  return supabaseAdmin.from("system_info").insert({ meta_field: field, meta_value: value });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Sirf Admin license activate kar sakta hai" }, { status: 403 });
    }

    const { key } = (await req.json()) as { key?: string };
    if (!key || !isValidLicenseKey(key)) {
      return NextResponse.json({ error: "Invalid license key format — VTC-XXXX-XXXX-XXXX-XXXX" }, { status: 400 });
    }

    const host = req.headers.get("host") || "localhost";
    const activationId = makeActivationId(host);
    const shopName = await getShopName();

    const res = await activateRemoteLicense({
      key,
      activationId,
      shopUrl: host,
      shopName,
    });

    if (!res.ok) {
      const friendly: Record<string, string> = {
        INVALID_KEY: "Ye license key valid nahi hai. Seller se verify karein.",
        LICENSE_DISABLED: "Ye license disabled kar diya gaya hai. Seller se contact karein.",
        LICENSE_EXPIRED: "Ye license expire ho chuka hai. Renewal ke liye seller se baat karein.",
        MAX_ACTIVATIONS: "Ye license apne limit ke instances par already active hai. Seller se contact karein.",
        LICENSE_SERVICE_NOT_CONFIGURED: "License service setup nahi hai (LICENSE_SERVICE_URL/ANON_KEY missing).",
      };
      const msg = friendly[res.error ?? ""] || res.error || "Activation failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Success → local system_info mein save karo
    const now = new Date().toISOString();
    const status = JSON.stringify({
      activated: true,
      plan: res.plan || "standard",
      shopName: res.shopName || shopName,
      activatedAt: now,
      expiresAt: res.expiresAt ?? null,
      activationId,
    });
    await Promise.all([
      upsertField("license_key", key.trim().toUpperCase()),
      upsertField("license_status", status),
    ]);

    return NextResponse.json({
      success: true,
      plan: res.plan || "standard",
      shopName: res.shopName || shopName,
      expiresAt: res.expiresAt ?? null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
