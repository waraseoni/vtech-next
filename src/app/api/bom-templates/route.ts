import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, requireStaffWithRole, enforceApiGeoGate } from "@/lib/api-auth";
import { parseBody } from "@/lib/validation";
import {
  bomTemplateCreateSchema,
  toBomItemRow,
} from "@/lib/validation/schemas/bomTemplate";

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
    .select("id, name, description, items, created_by, date_created, date_updated")
    .order("name", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: `bom_templates load fail: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await authed();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Staff + office ke bahar + permit nahi → write block (GET par gate nahi).
  const geo = await enforceApiGeoGate(req, auth.session.role, auth.session.user.id);
  if (geo) return geo;
  const { supabase, session } = auth;

  const parsed = await parseBody(bomTemplateCreateSchema, req);
  if (!parsed.ok) return parsed.response;
  const { name, description, items } = parsed.data;

  const { data, error } = await supabase
    .from("bom_templates")
    .insert({
      name,
      description: description ?? "",
      items: items.map(toBomItemRow) as unknown as Record<string, unknown>[],
      created_by: session.user.id,
    })
    .select("id, name, description, items, created_by, date_created, date_updated")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `bom_templates save fail: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ template: data }, { status: 201 });
}
