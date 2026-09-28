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
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

export const UNAUTHORIZED = () =>
  NextResponse.json({ error: "Unauthorized — pehle login karein" }, { status: 401 });

export const FORBIDDEN = () =>
  NextResponse.json({ error: "Sirf Admin is action ko kar sakta hai" }, { status: 403 });

// ─────────────────────────────────────────────────────────────────────────────
// Staff geofence — API route gate (docs/plans/staff_geofence_viewonly_plan.md §4.2)
// Server routes browser client Proxy se guzarte nahi, isliye unke liye alag
// chokepoint. Client `x-vtech-geo-*` headers bhejta hai; permit expiry SERVER
// clock se check hoti hai (client clock par trust nahi, plan §5.5).
//
// Honest scope (plan §6): client coordinates khud bhejta hai, to ye raw API
// call par "sabse aasan bypass" rokta hai, par spoof-proof nahi hai. Asli
// server-side location auth ke liye VPN/MDM chahiye.
// ─────────────────────────────────────────────────────────────────────────────

const GEO_HDR_STATUS = "x-vtech-geo-status";
const GEO_HDR_BLOCKED = "x-vtech-geo-blocked";
const GEO_HDR_DISTANCE = "x-vtech-geo-distance";

function geoBlocked(code: string, message: string, geoStatus = ""): NextResponse {
  return NextResponse.json({ error: message, code, geo: geoStatus || undefined }, { status: 403 });
}

/**
 * Staff ke liye mutating API route guard. Use jaisa:
 *   const gate = await enforceApiGeoGate(req, role, userId);
 *   if (gate) return gate;   // 403 already built
 *
 * Non-staff (admin/developer) hamesha pass (D3).
 * Staff ke liye FAIL-CLOSED:
 *   * header `x-vtech-geo-blocked: 0` → client ne andar/permit bataya, pass
 *   * header `1`                        → server permit table se DB check
 *   * header hi missing/invalid         → BLOCK (staff ke liye)
 *
 * Missing-header par pehle `return null` (allow) tha — jisse ek plain
 * `fetch("/api/...", {method:"POST"})` ya curl bina kisi header ke staff
 * writes chala deta tha, yaani gate ko hi bypass karna tha. Ab unknown =
 * blocked. `ViewOnlyProvider` gate mount par install karta hai, to legit
 * browser traffic hamesha header bhejti hai.
 */
export async function enforceApiGeoGate(
  req: Request,
  role: string | null | undefined,
  userId?: string
): Promise<NextResponse | null> {
  if (role !== "staff") return null; // admin/developer never locked

  const blocked = req.headers.get(GEO_HDR_BLOCKED);
  const status = req.headers.get(GEO_HDR_STATUS) ?? "";
  const distance = req.headers.get(GEO_HDR_DISTANCE);
  const dist = distance != null ? ` (office se ~${Math.round(Number(distance))}m door)` : "";

  if (blocked === "0") return null; // client: inside ya active permit

  if (blocked !== "1") {
    return geoBlocked(
      "GEO_SIGNAL_MISSING",
      "Aapki location verify nahi ho paayi, isliye changes band hain. Page refresh karein ya permit le lein."
    );
  }

  // Client ne block signal bheja — permit check (server clock, authoritative).
  const supabase = await getServerSupabase();
  const uid = userId ?? (await supabase.auth.getUser()).data?.user?.id ?? undefined;
  if (uid) {
    const { data: permit } = await supabase
      .from("staff_geofence_permit")
      .select("expires_at")
      .eq("user_id", uid)
      .gt("expires_at", new Date().toISOString()) // server time, not client clock
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (permit?.expires_at) return null; // active permit → allow
  }

  return geoBlocked("GEO_WRITE_BLOCKED", `Aap office ke bahar hain${dist}. Bina permit ke koi bhi change nahi ho sakta — sirf dekh sakte hain.`, status);
}

/**
 * `requireStaffWithRole()` + geofence gate, ek call me — mutating staff routes
 * ke liye. Return shapes:
 *   null              → login nahi (route UNAUTHORIZED() de)
 *   NextResponse      → geofence block (403, seedha return karo)
 *   { user, role }    → authenticated + allowed
 */
export async function requireStaffWriter(req: Request): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof requireUser>>>; role: string }
  | NextResponse
  | null
> {
  const session = await requireStaffWithRole();
  if (!session) return null;
  const gate = await enforceApiGeoGate(req, session.role, session.user.id);
  if (gate) return gate;
  return session;
}

export async function requireUser() {
  const supabase = await getServerSupabase();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireStaff() {
  const session = await requireStaffWithRole();
  return session?.user ?? null;
}

/** Single round-trip auth + role — use on server pages that also need role. */
export async function requireStaffWithRole(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  role: string;
} | null> {
  const supabase = await getServerSupabase();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = profile?.role ?? "staff";
    if (role !== "admin" && role !== "staff" && role !== "developer") return null;
    return { user, role };
  } catch {
    return null;
  }
}

export async function requireClient() {
  const supabase = await getServerSupabase();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
