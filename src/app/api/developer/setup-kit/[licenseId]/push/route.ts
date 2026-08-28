import { NextRequest, NextResponse } from "next/server";
import { requireDev } from "@/lib/portal-auth";
import { isLicenseAdminConfigured, getLicense } from "@/lib/license-admin";
import { patchClientCredentials } from "@/lib/client-creds";
import { deriveSetupToken } from "@/lib/setup-kit";
import { pushEnvToVercel, triggerVercelDeploy, addDomainToVercel } from "@/lib/vercel-push";

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

// POST — client ke APNE Vercel account par env vars push karo + production redeploy.
// Body = setup-kit POST ke saare fields + Vercel fields (project URL/id/token).
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
  const customDomain = str(body.customDomain)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  // Public site branding (optional)
  const siteName = str(body.siteName);
  const siteTagline = str(body.siteTagline);
  const sitePhone = str(body.sitePhone);
  const siteEmail = str(body.siteEmail);
  const siteAddress = str(body.siteAddress);
  const siteOwner = str(body.siteOwner);
  const siteServices = str(body.siteServices);

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("Supabase URL");
  if (!supabaseAnonKey) missing.push("Supabase Anon Key");
  if (!supabaseServiceRoleKey) missing.push("Supabase Service Role Key");
  if (!vercelProjectId) missing.push("Vercel Project ID");
  if (!vercelToken) missing.push("Vercel API Token");
  if (missing.length) {
    return NextResponse.json(
      { error: `Push ke liye ye required hain: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const license = await getLicense(id);
    if (!license) return NextResponse.json({ error: "License nahi mila" }, { status: 404 });

    // Creds save kar lo (encrypted) — dobara se prefilled aayen.
    // SIRF ye fields update karo — baaki (notes, github, emails...) preserve.
    await patchClientCredentials(id, {
      app_url: appUrl,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      supabase_service_role_key: supabaseServiceRoleKey,
      vercel_project_url: vercelProjectUrl,
      vercel_project_id: vercelProjectId,
      vercel_token: vercelToken,
      custom_domain: customDomain,
      site_name: siteName,
      site_tagline: siteTagline,
      site_phone: sitePhone,
      site_email: siteEmail,
      site_address: siteAddress,
      site_owner: siteOwner,
      site_services: siteServices,
    });

    // Kuch values seller ke env se aati hain (license service) — same for all clients.
    const licenseServiceUrl = process.env.LICENSE_SERVICE_URL || "";
    const licenseServiceAnonKey = process.env.LICENSE_SERVICE_ANON_KEY || "";
    if (!licenseServiceUrl || !licenseServiceAnonKey) {
      return NextResponse.json(
        { error: "Seller env mein LICENSE_SERVICE_URL / LICENSE_SERVICE_ANON_KEY set nahi hai" },
        { status: 503 }
      );
    }

    const env = [
      { key: "NEXT_PUBLIC_SUPABASE_URL", value: supabaseUrl },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: supabaseAnonKey },
      { key: "SUPABASE_SERVICE_ROLE_KEY", value: supabaseServiceRoleKey },
      { key: "LICENSE_SERVICE_URL", value: licenseServiceUrl },
      { key: "LICENSE_SERVICE_ANON_KEY", value: licenseServiceAnonKey },
      { key: "SETUP_TOKEN", value: setupToken },
      // Public site branding — empty value se env var bhi nahi banta (fallback use hota hai).
      ...(siteName ? [{ key: "NEXT_PUBLIC_SITE_NAME", value: siteName }] : []),
      ...(siteTagline ? [{ key: "NEXT_PUBLIC_SITE_TAGLINE", value: siteTagline }] : []),
      ...(sitePhone ? [{ key: "NEXT_PUBLIC_SITE_PHONE", value: sitePhone }] : []),
      ...(siteEmail ? [{ key: "NEXT_PUBLIC_SITE_EMAIL", value: siteEmail }] : []),
      ...(siteAddress ? [{ key: "NEXT_PUBLIC_SITE_ADDRESS", value: siteAddress }] : []),
      ...(siteOwner ? [{ key: "NEXT_PUBLIC_SITE_OWNER", value: siteOwner }] : []),
      ...(siteServices ? [{ key: "NEXT_PUBLIC_SITE_SERVICES", value: siteServices }] : []),
    ];

    const pushed = await pushEnvToVercel(vercelToken, vercelProjectId, env);

    // Custom domain (optional) — attach karo agar diya gaya ho.
    let domainNote = "";
    if (customDomain) {
      const dom = await addDomainToVercel(vercelToken, vercelProjectId, customDomain);
      domainNote = dom.verified
        ? `Domain https://${customDomain} attach ho gaya.`
        : `Domain https://${customDomain} add ho gaya — DNS/TXT verify karo (Vercel dashboard → Domains).`;
    }

    const deploy = await triggerVercelDeploy(vercelToken, vercelProjectId);

    return NextResponse.json({
      ok: true,
      created: pushed.created,
      skipped: pushed.skipped,
      deployment: deploy.url,
      readyState: deploy.readyState,
      customDomain: customDomain || null,
      message:
        `${pushed.created} env vars push ho gaye (Vercel) aur production redeploy trigger hua. ` +
        `Status: ${deploy.readyState}. ` +
        (domainNote ? `${domainNote} ` : "") +
        `Deploy log: https://vercel.com/dashboard`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
