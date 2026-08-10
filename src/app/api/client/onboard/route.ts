import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Email OTP verify ke baad client ka profile banao/link karo.
// client_id kabhi client se NAHI liya jata — auth user ke email se derive hota hai.
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = user.email?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "Email nahi mila" }, { status: 400 });

  // Existing profile — admin kabhi client nahi banta (escalation guard).
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.role === "admin") {
    return NextResponse.json({ success: true, redirect: "/" });
  }

  if (existing?.role === "client" && existing.client_id) {
    const { data: cl } = await supabaseAdmin
      .from("client_list")
      .select("id, firstname, middlename, lastname, contact, email, opening_balance, login_allowed")
      .eq("id", existing.client_id)
      .maybeSingle();
    if (cl?.login_allowed) {
      return NextResponse.json({ success: true, client: toClientPayload(cl) });
    }
    return NextResponse.json(
      { error: "Aapka portal access band hai. Dukaan se contact karein." },
      { status: 403 }
    );
  }

  // Email se client_list me dhoondo (login_allowed hona zaroori hai).
  // NOTE: profile nahi bani ho YA role='staff' (Supabase ke auto-profile trigger
  // se OTP signup par zombie staff row ban jaati hai) — dono case me yahi lookup
  // decide karta hai ki ye email portal client hai ya nahi.
  const { data: client, error: clientErr } = await supabaseAdmin
    .from("client_list")
    .select("id, firstname, middlename, lastname, contact, email, opening_balance, login_allowed")
    .ilike("email", email)
    .eq("delete_flag", 0)
    .limit(1)
    .maybeSingle();

  if (clientErr) {
    return NextResponse.json({ error: clientErr.message }, { status: 500 });
  }

  if (!client) {
    // Email client_list me NAHI hai → genuine staff account (client tab se
    // login kar raha hai) → staff UI. Portal client nahi hai.
    if (existing?.role === "staff") {
      return NextResponse.json({ success: true, redirect: "/" });
    }
    return NextResponse.json(
      { error: "Aapko portal access nahi hai. Dukaan se contact karke email confirm karein." },
      { status: 403 }
    );
  }

  // Email client_list me hai par login_allowed=false → ye client hai, bas
  // portal access band hai. Staff profile ho tab bhi kabhi staff UI mat do.
  if (!client.login_allowed) {
    return NextResponse.json(
      { error: "Aapka portal access band hai. Dukaan se contact karein." },
      { status: 403 }
    );
  }

  // client_list me ye email portal client hai → profile create karo (agar nahi
  // hai) YA zombie staff row ko client me convert karo (downgrade hai, escalation
  // nahi — client_list + login_allowed hi authoritative source hai).
  const fullName = [client.firstname, client.middlename, client.lastname].filter(Boolean).join(" ").trim();

  const { error: upsertErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, full_name: fullName, role: "client", client_id: client.id });

  if (upsertErr) {
    return NextResponse.json({ error: "Profile save nahi hua: " + upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, client: toClientPayload(client) });
}

function toClientPayload(cl: {
  id: number; firstname?: string | null; middlename?: string | null; lastname?: string | null;
  contact?: string | null; email?: string | null; opening_balance?: number | null;
}) {
  return {
    id: cl.id,
    name: [cl.firstname, cl.middlename, cl.lastname].filter(Boolean).join(" ").trim(),
    contact: cl.contact ?? "",
    email: cl.email ?? "",
    opening_balance: Number(cl.opening_balance ?? 0),
  };
}
