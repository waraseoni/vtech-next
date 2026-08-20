import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabaseAdmin
      .from("system_info")
      .select("meta_value")
      .eq("meta_field", "seller_contact")
      .maybeSingle();

    if (!data?.meta_value) {
      return NextResponse.json({ name: null, phone: null, whatsapp: null, address: null });
    }

    try {
      return NextResponse.json(JSON.parse(data.meta_value));
    } catch {
      return NextResponse.json({ name: null, phone: null, whatsapp: null, address: null });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const contact = {
      name: typeof body.name === "string" ? body.name : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      whatsapp: typeof body.whatsapp === "string" ? body.whatsapp : null,
      address: typeof body.address === "string" ? body.address : null,
    };

    const { data: existing } = await supabaseAdmin
      .from("system_info")
      .select("id")
      .eq("meta_field", "seller_contact")
      .maybeSingle();

    if (existing?.id) {
      await supabaseAdmin
        .from("system_info")
        .update({ meta_value: JSON.stringify(contact) })
        .eq("meta_field", "seller_contact");
    } else {
      await supabaseAdmin
        .from("system_info")
        .insert({ meta_field: "seller_contact", meta_value: JSON.stringify(contact) });
    }

    return NextResponse.json({ ok: true, seller: contact });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
