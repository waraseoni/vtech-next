import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/api-auth";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const adminSession = await requireAdmin();
  if (!adminSession) return NextResponse.json({ status: "failed", msg: "Admin only" }, { status: 403 });

  const { data: info } = await supabase
    .from("system_info").select("meta_value").eq("meta_field", "log_retention").maybeSingle();
  const days = Math.max(1, parseInt(info?.meta_value || "90") || 90);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  // Use service-role for the actual delete (RLS may block batch deletes with user token)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin
    .from("activity_logs")
    .delete()
    .lt("date_created", cutoffStr)
    .select("id");

  if (error) return NextResponse.json({ status: "failed", msg: error.message }, { status: 500 });

  return NextResponse.json({
    status: "success",
    msg: `${data?.length ?? 0} logs older than ${days} days delete ho gaye.`,
    affected: data?.length ?? 0,
  });
}
