import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClient } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Logged-in client ki apni info
export async function GET() {
  const client = await requireClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("client_list")
    .select("id, firstname, middlename, lastname, contact, email, opening_balance")
    .eq("id", client.profile.client_id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Client nahi mila" }, { status: 404 });
  }

  return NextResponse.json({
    client: {
      id: data.id,
      name: [data.firstname, data.middlename, data.lastname].filter(Boolean).join(" ").trim(),
      contact: data.contact ?? "",
      email: data.email ?? "",
      opening_balance: Number(data.opening_balance ?? 0),
    },
  });
}
