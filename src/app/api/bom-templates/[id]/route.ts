import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx): Promise<number | null> => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function normalizeItems(raw: unknown): { items: { product_id: number | null; name: string; qty: number; notes?: string }[]; error: string | null } {
  if (!Array.isArray(raw)) return { items: [], error: "items array hona chahiye" };
  if (raw.length === 0) return { items: [], error: "Koi component line nahi hai" };
  const items: { product_id: number | null; name: string; qty: number; notes?: string }[] = [];
  for (const it of raw) {
    const obj = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    const qty = typeof obj.qty === "number" ? obj.qty : NaN;
    if (!name) return { items: [], error: "Har line ka component naam chahiye" };
    if (!Number.isInteger(qty) || qty < 1) return { items: [], error: "Har line ki qty positive integer chahiye" };
    const product_id =
      typeof obj.product_id === "number" && Number.isInteger(obj.product_id) ? obj.product_id : null;
    const notes = typeof obj.notes === "string" ? obj.notes.trim() : "";
    items.push({ product_id, name, qty, ...(notes ? { notes } : {}) });
  }
  return { items, error: null };
}

const sanitizeName = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().slice(0, 120) : "";

const sanitizeDesc = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().slice(0, 500) : "";

async function authed() {
  const session = await requireStaffWithRole();
  if (!session) return null;
  const supabase = await getServerSupabase();
  return { supabase, session };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("bom_templates")
    .select("id, name, description, items, created_by, date_created, date_updated")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `bom_templates load fail: ${error.message}` }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Template nahi mila" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = sanitizeName(body.name);
    if (!name) return NextResponse.json({ error: "Template ka naam chahiye" }, { status: 400 });
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = sanitizeDesc(body.description);
  if (body.items !== undefined) {
    const { items, error: itemsErr } = normalizeItems(body.items);
    if (itemsErr) return NextResponse.json({ error: itemsErr }, { status: 400 });
    patch.items = items as unknown as Record<string, unknown>[];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Kuch update karne ko nahi hai" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("bom_templates")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, items, created_by, date_created, date_updated")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `bom_templates update fail: ${error.message}` }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Template nahi mila" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await auth.supabase.from("bom_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: `bom_templates delete fail: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}