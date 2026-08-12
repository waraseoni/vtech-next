import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/portal-auth";
import {
  isLicenseAdminConfigured,
  listLicenses,
  createLicense,
  type LicenseInput,
} from "@/lib/license-admin";

export async function GET() {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai (LICENSE_SERVICE_SERVICE_ROLE_KEY missing)" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized — seller password required" }, { status: 401 });
  }
  try {
    const rows = await listLicenses();
    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

const VALID_PLANS = ["standard", "premium", "lifetime"];
const VALID_STATUS = ["active", "disabled", "revoked"];

export async function POST(req: NextRequest) {
  if (!isLicenseAdminConfigured()) {
    return NextResponse.json({ error: "License admin configured nahi hai" }, { status: 503 });
  }
  const auth = await requireSeller();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized — seller password required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const plan = String(body.plan || "standard");
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan — standard | premium | lifetime" }, { status: 400 });
  }
  const maxActivations = Number(body.max_activations ?? 1);
  if (!Number.isInteger(maxActivations) || maxActivations < 1) {
    return NextResponse.json({ error: "max_activations >= 1 hona chahiye" }, { status: 400 });
  }
  const status = body.status ? String(body.status) : "active";
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  let expiresAt: string | null = null;
  if (body.expires_at && typeof body.expires_at === "string") {
    const t = new Date(body.expires_at);
    if (Number.isNaN(t.getTime())) {
      return NextResponse.json({ error: "Invalid expires_at date" }, { status: 400 });
    }
    expiresAt = t.toISOString();
  }

  try {
    const input: LicenseInput = {
      shop_name: typeof body.shop_name === "string" ? body.shop_name : undefined,
      owner_name: typeof body.owner_name === "string" ? body.owner_name : undefined,
      owner_email: typeof body.owner_email === "string" ? body.owner_email : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      plan,
      max_activations: maxActivations,
      status,
      expires_at: expiresAt,
    };
    const created = await createLicense(input);
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
