import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/portal-auth";
import { getLicense } from "@/lib/license-admin";
import { getClientCredentials } from "@/lib/client-creds";
import { buildSetupKitZip, deriveSetupToken, slugify } from "@/lib/setup-kit";

type Ctx = { params: Promise<{ licenseId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.LICENSE_SERVICE_URL || !process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { licenseId } = await ctx.params;
  const id = Number(licenseId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });
  }

  try {
    const [license, creds] = await Promise.all([getLicense(id), getClientCredentials(id)]);
    if (!license) return NextResponse.json({ error: "License nahi mila" }, { status: 404 });

    const supabaseUrl = creds?.supabase_url?.trim() || "";
    const supabaseAnonKey = creds?.supabase_anon_key?.trim() || "";
    const supabaseServiceRoleKey = creds?.supabase_service_role_key?.trim() || "";
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("Supabase URL");
    if (!supabaseAnonKey) missing.push("Supabase Anon Key");
    if (!supabaseServiceRoleKey) missing.push("Supabase Service Role Key");
    if (missing.length) {
      return NextResponse.json(
        { error: `Setup Kit banane se pehle ye credentials save karo: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const slug = slugify(license.shop_name || `client-${id}`);
    const zip = buildSetupKitZip({
      slug,
      shopName: license.shop_name || `Client #${id}`,
      appUrl: creds?.app_url || "",
      licenseKey: license.license_key,
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceRoleKey,
      setupToken: deriveSetupToken(id),
    });

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-setup-kit.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
