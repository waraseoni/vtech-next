import { NextRequest, NextResponse } from "next/server";
import { requireDev } from "@/lib/portal-auth";
import { isLicenseAdminConfigured, getLicense } from "@/lib/license-admin";
import { getClientCredentials, patchClientCredentials } from "@/lib/client-creds";
import { buildSetupKitZip, deriveSetupToken, slugify } from "@/lib/setup-kit";

type Ctx = { params: Promise<{ licenseId: string }> };

const guard = async () => {
  if (!isLicenseAdminConfigured()) {
    return { error: "License admin configured nahi hai", status: 503 as const };
  }
  const auth = await requireDev();
  if (!auth) return { error: "Unauthorized", status: 401 as const };
  return null;
};

const parseId = async (ctx: Ctx): Promise<number | null> => {
  const { licenseId } = await ctx.params;
  const n = Number(licenseId);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// GET — modal ke liye prefill data: license info + stored creds + derived setup token.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });

  try {
    const [license, creds] = await Promise.all([getLicense(id), getClientCredentials(id)]);
    if (!license) return NextResponse.json({ error: "License nahi mila" }, { status: 404 });
    return NextResponse.json({
      shopName: license.shop_name || `Client #${id}`,
      licenseKey: license.license_key,
      creds: creds ?? null,
      setupToken: deriveSetupToken(id),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

// POST — creds save karo (optional) + package build karo + zip download.
export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const appUrl = str(body.appUrl);
  const supabaseUrl = str(body.supabaseUrl);
  const supabaseAnonKey = str(body.supabaseAnonKey);
  const supabaseServiceRoleKey = str(body.supabaseServiceRoleKey);
  const setupToken = str(body.setupToken) || deriveSetupToken(id);
  const vercelProjectUrl = str(body.vercelProjectUrl);
  const vercelProjectId = str(body.vercelProjectId);
  const vercelToken = str(body.vercelToken);
  const customDomain = str(body.customDomain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("Supabase URL");
  if (!supabaseAnonKey) missing.push("Supabase Anon Key");
  if (!supabaseServiceRoleKey) missing.push("Supabase Service Role Key");
  if (missing.length) {
    return NextResponse.json(
      { error: `Package banane ke liye ye required hain: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const license = await getLicense(id);
    if (!license) return NextResponse.json({ error: "License nahi mila" }, { status: 404 });

    if (body.saveCreds === true) {
      await patchClientCredentials(id, {
        app_url: appUrl,
        supabase_url: supabaseUrl,
        supabase_anon_key: supabaseAnonKey,
        supabase_service_role_key: supabaseServiceRoleKey,
        vercel_project_url: vercelProjectUrl,
        vercel_project_id: vercelProjectId,
        vercel_token: vercelToken,
        custom_domain: customDomain,
      });
    }

    const slug = slugify(license.shop_name || `client-${id}`);
    const zip = buildSetupKitZip({
      slug,
      shopName: license.shop_name || `Client #${id}`,
      appUrl,
      licenseKey: license.license_key,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
      setupToken,
    });

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-setup-kit.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
