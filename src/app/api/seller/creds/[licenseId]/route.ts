import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/portal-auth";
import {
  getClientCredentials,
  upsertClientCredentials,
  deleteClientCredentials,
} from "@/lib/client-creds";

type Ctx = { params: Promise<{ licenseId: string }> };

async function parseId(ctx: Ctx): Promise<number | null> {
  const { licenseId } = await ctx.params;
  const n = Number(licenseId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const guard = async () => {
  if (!process.env.LICENSE_SERVICE_URL || !process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY) {
    return { error: "License admin configured nahi hai", status: 503 as const };
  }
  const auth = await requireSeller();
  if (!auth) return { error: "Unauthorized", status: 401 as const };
  return null;
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });
  try {
    const row = await getClientCredentials(id);
    // Row nahi mili → empty template return (204 nahi — client ko form khali chahiye).
    return NextResponse.json(row ?? { license_id: id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  try {
    const row = await upsertClientCredentials(id, {
      app_url: str(body.app_url),
      supabase_url: str(body.supabase_url),
      supabase_anon_key: str(body.supabase_anon_key),
      supabase_service_role_key: str(body.supabase_service_role_key),
      supabase_email: str(body.supabase_email),
      supabase_password: str(body.supabase_password),
      github_repo: str(body.github_repo),
      github_token: str(body.github_token),
      github_username: str(body.github_username),
      github_password: str(body.github_password),
      vercel_project_url: str(body.vercel_project_url),
      vercel_project_id: str(body.vercel_project_id),
      vercel_token: str(body.vercel_token),
      vercel_email: str(body.vercel_email),
      vercel_password: str(body.vercel_password),
      custom_domain: str(body.custom_domain),
      notes: str(body.notes),
    });
    return NextResponse.json(row);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const denied = await guard();
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid licenseId" }, { status: 400 });
  try {
    await deleteClientCredentials(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
