import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/portal-auth";
import {
  isLicenseAdminConfigured,
  getLicense,
  updateLicense,
  deleteLicense,
  type LicenseInput,
} from "@/lib/license-admin";

type Ctx = { params: Promise<{ id: string }> };

const VALID_PLANS = ["standard", "premium", "lifetime"];
const VALID_STATUS = ["active", "disabled", "revoked"];

async function parseId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const row = await getLicense(id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input: LicenseInput = {};

  if (body.shop_name !== undefined) input.shop_name = String(body.shop_name ?? "");
  if (body.owner_name !== undefined) input.owner_name = String(body.owner_name ?? "");
  if (body.owner_email !== undefined) input.owner_email = String(body.owner_email ?? "");
  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(String(body.plan))) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    input.plan = String(body.plan);
  }
  if (body.max_activations !== undefined) {
    const n = Number(body.max_activations);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: "max_activations >= 1 hona chahiye" }, { status: 400 });
    }
    input.max_activations = n;
  }
  if (body.status !== undefined) {
    const s = String(body.status);
    if (!VALID_STATUS.includes(s)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    input.status = s;
  }
  // Renewal/expiry: '' ya null → lifetime (expires_at null karo)
  if (body.expires_at !== undefined) {
    const raw = body.expires_at;
    if (raw === null || raw === "") {
      input.expires_at = null;
    } else {
      const t = new Date(String(raw));
      if (Number.isNaN(t.getTime())) {
        return NextResponse.json({ error: "Invalid expires_at date" }, { status: 400 });
      }
      input.expires_at = t.toISOString();
    }
  }
  if (body.notes !== undefined) input.notes = String(body.notes ?? "");

  try {
    const row = await updateLicense(id, input);
    return NextResponse.json(row);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    await deleteLicense(id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
