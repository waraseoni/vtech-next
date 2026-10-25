import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireStaffWithRole, enforceApiGeoGate } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";
import { bomTemplateUpdateSchema, toBomItemRow } from "@/lib/validation/schemas/bomTemplate";

type Ctx = { params: Promise<{ id: string }> };

const parseId = async (ctx: Ctx): Promise<number | null> => {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

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
    return NextResponse.json(
      { error: `bom_templates load fail: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Template nahi mila" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Staff + office ke bahar + permit nahi → write block (GET par gate nahi).
  const geo = await enforceApiGeoGate(req, auth.session.role, auth.session.user.id);
  if (geo) return geo;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const parsed = await parseBody(bomTemplateUpdateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, description, items } = parsed.data;

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description ?? "";
  if (items !== undefined) {
    patch.items = items.map(toBomItemRow) as unknown as Record<string, unknown>[];
  }
  // "kuch update nahi" case schema ke refine() me already 400 hai.

  const { data, error } = await auth.supabase
    .from("bom_templates")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, items, created_by, date_created, date_updated")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `bom_templates update fail: ${error.message}` },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Template nahi mila" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const geo = await enforceApiGeoGate(req, auth.session.role, auth.session.user.id);
  if (geo) return geo;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await auth.supabase.from("bom_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: `bom_templates delete fail: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
