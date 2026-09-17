import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { parseOpenApiToSchema, type SupabaseTableSchema } from "@/lib/backupSchema";

export const runtime = "nodejs";

// Live Supabase schema ka ek read-only snapshot (admin + service role).
// Backup/Restore tooling isi se table/column/PK list leta hai — static lists
// (jo drift karte hain) ki jagah. Koi data read nahi — sirf OpenAPI meta.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenAPI fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }
    const spec = await res.json();
    const tables: SupabaseTableSchema[] = parseOpenApiToSchema(spec);
    return NextResponse.json({ ok: true, tables, count: tables.length });
  } catch (error) {
    console.error("backup schema fetch error:", error);
    return NextResponse.json(
      { ok: false, error: "Live schema fetch nahi ho paya." },
      { status: 500 }
    );
  }
}