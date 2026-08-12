import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );
}

export const UNAUTHORIZED = () =>
  NextResponse.json({ error: "Unauthorized — pehle login karein" }, { status: 401 });

export const FORBIDDEN = () =>
  NextResponse.json({ error: "Sirf Admin is action ko kar sakta hai" }, { status: 403 });

export async function requireUser() {
  const supabase = await getServerSupabase();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireStaff() {
  const supabase = await getServerSupabase();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin" && profile?.role !== "staff" && profile?.role !== "developer") return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireClient() {
  const supabase = await getServerSupabase();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "client" || !profile.client_id) return null;
    // Revoked portal access → session invalid. Admin ne login_allowed=false
    // kar diya to client turant hi logout ho jata hai (API level par bhi).
    const { data: cl } = await supabase
      .from("client_list")
      .select("login_allowed")
      .eq("id", profile.client_id)
      .maybeSingle();
    if (!cl?.login_allowed) return null;
    return { user, profile };
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const supabase = await getServerSupabase();
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
  try {
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch {
    return null;
  }
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  // Developer role admin ke barabar trusted hota hai (V-TECH dev team ke liye).
  if (profile?.role !== "admin" && profile?.role !== "developer") return null;
  return { user, profile };
}

/** Admin YA developer role — dono ko allow karta hai (seller/dev portals ke liye). */
export async function requireAdminOrDeveloper() {
  return requireAdmin();
}

/** Returns the logged-in user's profile role ("admin" | "staff" | "client") or null. */
export async function getSessionRole(): Promise<string | null> {
  const supabase = await getServerSupabase();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return profile?.role ?? null;
  } catch {
    return null;
  }
}
