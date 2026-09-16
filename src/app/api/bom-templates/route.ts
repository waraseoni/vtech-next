import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireStaffWithRole } from "@/lib/api-auth";

export type BomTemplateItemInput = {
  product_id: number | null;
  name: string;
  qty: number;
  notes?: string;
};

/** Server-side validation mirror — lib/bomTemplates.ts me client types alag hain. */
function normalizeItems(raw: unknown): { items: BomTemplateItemInput[]; error: string | null } {
  if (!Array.isArray(raw)) return { items: [], error: "items array hona chahiye" };
  if (raw.length === 0) return { items: [], error: "Koi component line nahi hai" };
  const items: BomTemplateItemInput[] = [];
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

/** single round-trip: cookie supabase + staff check. */
async function authed() {
  const session = await requireStaffWithRole();
  if (!session) return null;
  const supabase = await getServerSupabase();
  return { supabase, session };
}

export async function GET() {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("bom_templates")
    .select("id, name, description, items, created_by, created_at, updated_at")
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: `bom_templates load fail: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, session } = auth;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = sanitizeName(body.name);
  if (!name) return NextResponse.json({ error: "Template ka naam chahiye" }, { status: 400 });
  const description = sanitizeDesc(body.description);
  const { items, error: itemsErr } = normalizeItems(body.items);
  if (itemsErr) return NextResponse.json({ error: itemsErr }, { status: 400 });

  const { data, error } = await supabase
    .from("bom_templates")
    .insert({
      name,
      description,
      items: items as unknown as Record<string, unknown>[],
      created_by: session.user.id,
    })
    .select("id, name, description, items, created_by, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: `bom_templates save fail: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ template: data }, { status: 201 });
}