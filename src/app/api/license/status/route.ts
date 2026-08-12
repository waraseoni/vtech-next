import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/api-auth";
import {
  isLicenseConfigured,
  maskKey,
  checkRemoteLicense,
  type LicenseStatus,
} from "@/lib/license";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Re-check interval: default 24h. LICENSE_RECHECK_HOURS env se shorten kiya ja
// sakta hai (seller ko delete/revoke ka asar jaldi dikhane ke liye).
const RECHECK_MS = (Number(process.env.LICENSE_RECHECK_HOURS) || 24) * 60 * 60 * 1000;

async function readField(field: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("system_info")
    .select("meta_value")
    .eq("meta_field", field)
    .maybeSingle();
  return typeof data?.meta_value === "string" ? data.meta_value : null;
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

export async function GET() {
  try {
    // requireUser (admin nahi): login hamesha allowed hai, isliye staff/client ko
    // bhi status dikhega — taaki unke liye bhi license gate sahi dikhe.
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [keyRaw, statusRaw, lastCheckedRaw] = await Promise.all([
      readField("license_key"),
      readField("license_status"),
      readField("license_last_checked"),
    ]);

    let parsed: Partial<LicenseStatus> = {};
    if (statusRaw) {
      try { parsed = JSON.parse(statusRaw); } catch { /* ignore */ }
    }

    const activationId = parsed.activationId;
    const activated = !!parsed.activated && !!keyRaw;
    let valid = false;
    let error: string | undefined;
    const plan = parsed.plan;
    const shopName = parsed.shopName;
    let expiresAt = parsed.expiresAt ?? null;

    if (activated && activationId) {
      const lastChecked = lastCheckedRaw ? new Date(lastCheckedRaw).getTime() : 0;
      const due = !lastChecked || Date.now() - lastChecked > RECHECK_MS;
      // Locally stored expiry (agar ho) — trial/unconfigured fallback ke liye.
      const localExpired = expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();

      if (isLicenseConfigured() && due) {
        // Central se fresh verify — naya activation NAHI, sirf check_license.
        try {
          const res = await checkRemoteLicense(activationId);
          const checkedAt = new Date().toISOString();
          // Real RPC response mila (network error nahi) → result ko persist karo,
          // taaki agle 24h ke status calls bhi yahi result maane — deleted/expired
          // license ka gate reload par galat nahi hat sakta.
          parsed.remoteValid = res.ok;
          parsed.remoteError = res.error;
          parsed.remoteCheckedAt = checkedAt;
          if (res.expiresAt !== undefined) {
            expiresAt = res.expiresAt ?? null;
            parsed.expiresAt = res.expiresAt ?? null;
          }
          if (res.plan) parsed.plan = res.plan;
          if (res.shopName) parsed.shopName = res.shopName;
          valid = res.ok;
          error = res.ok ? undefined : res.error;
          // Re-check timestamp hamesha save karo — offline grace window avoid karo.
          await Promise.all([
            upsertField("license_last_checked", checkedAt),
            upsertField("license_status", JSON.stringify(parsed)),
          ]);
        } catch {
          // Central unreachable → offline grace: last verified result ko bharosha.
          // Agar central ne kabhi revoke/delete bataya tha to wahi maano.
          valid = !localExpired && parsed.remoteValid !== false;
          error = "LICENSE_CHECK_UNREACHABLE";
        }
      } else if (!isLicenseConfigured()) {
        // Service setup nahi → locally stored expiry se verify karo.
        valid = !localExpired;
      } else {
        // Re-check abhi due nahi → last verified remote result ko maano. Agar
        // kabhi remote check nahi hua (undefined) to local expiry se verify.
        valid = parsed.remoteValid !== undefined ? parsed.remoteValid : !localExpired;
        error = parsed.remoteError ?? (parsed.remoteValid === false ? "LICENSE_NOT_ACTIVE" : undefined);
      }
    } else if (activated) {
      // Purani install jisme activationId store nahi hua — local expiry se verify.
      valid = !expiresAt || new Date(expiresAt).getTime() > Date.now();
    }

    const status: LicenseStatus = {
      configured: isLicenseConfigured(),
      activated,
      valid,
      plan,
      shopName,
      keyMasked: keyRaw ? maskKey(keyRaw) : undefined,
      activatedAt: parsed.activatedAt,
      expiresAt,
      activationId,
      error,
      // Env vars set hain to portals enabled (sirf seller ke deployment par).
      sellerEnabled:
        !!process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY &&
        !!process.env.SELLER_PORTAL_PASSWORD,
      devEnabled:
        !!process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY &&
        !!process.env.DEV_PORTAL_PASSWORD,
    };

    return NextResponse.json(status);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
