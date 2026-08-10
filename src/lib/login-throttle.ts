import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// ════════════════════════════════════════════════════════════════
// login-throttle.ts — Brute-force login protection (server-side)
//
// PHP (vtech-rsms) ka LoginThrottle class + improvements:
//   - email + IP dono par track (multi-key)
//   - progressive lockout (escalating): 5 fail → 15m, phir ×2 up to 24h
//   - IP flood guard: ek IP se 30+ distinct emails par fail → IP block
//   - sirf service-role DB use (browser client kabhi direct nahi)
// ════════════════════════════════════════════════════════════════

const CONFIG = {
  MAX_ATTEMPTS: 5,             // galat attempts allowed
  WINDOW_MINUTES: 15,          // counting window
  LOCKOUT_MINUTES: 15,         // base lockout duration
  ESCALATE_FACTOR: 2,          // har repeat lock par duration ×2
  MAX_LOCKOUT_MINUTES: 1440,   // cap: 24 hours
  IP_MAX_ATTEMPTS: 30,         // ek IP se kitne alag emails par tries
  IP_WINDOW_MINUTES: 60,
};

let adminClient: SupabaseClient | null = null;
function getAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return adminClient;
}

/** Normalize + extract client IP (Vercel proxy safe). */
export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  let ip = "";
  if (fwd) {
    ip = fwd.split(",")[0]?.trim() ?? "";
  } else {
    ip = request.headers.get("x-real-ip") ?? "";
  }
  if (!ip) ip = request.headers.get("cf-connecting-ip") ?? "";
  // Normalize: strip IPv6 zone + unwrap IPv4-mapped IPv6
  ip = ip.replace(/^::ffff:/, "").split("%").shift() ?? "";
  return ip || "unknown";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getRow(email: string) {
  const sb = getAdmin();
  const { data } = await sb
    .from("login_throttle")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  return data ?? null;
}

function now() {
  return new Date();
}

/** Lock check — locked? remaining seconds? */
export async function checkLockout(email: string, ip: string): Promise<{ locked: boolean; remaining_seconds?: number }> {
  const sb = getAdmin();
  const norm = normalizeEmail(email);
  const t = now();

  // ── IP flood guard ──────────────────────────────────────────────────────
  // SIRF tab IP block karo jab is IP se 60 min me 30+ ALAG emails par fails
  // ho chuke hoon. (Ek email ka lock poora IP block nahi karta — nahi to ek
  // locked user ke peeche same network/office ke sab users block ho jaate.)
  const since = new Date(t.getTime() - CONFIG.IP_WINDOW_MINUTES * 60000).toISOString();
  const [row, floodRes] = await Promise.all([
    getRow(norm),
    (async () => {
      const { count, error } = await sb
        .from("login_throttle")
        .select("id", { count: "exact", head: true })
        .gte("last_attempt_at", since)
        .eq("ip_address", ip);
      if (error || (count ?? 0) < CONFIG.IP_MAX_ATTEMPTS) return null;
      // Approx remaining: window me sabse purana fail exit hote hi flood khatam
      const { data: oldest } = await sb
        .from("login_throttle")
        .select("last_attempt_at")
        .eq("ip_address", ip)
        .gte("last_attempt_at", since)
        .order("last_attempt_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const o = oldest?.last_attempt_at as string | undefined;
      const remaining = o
        ? Math.max(1, Math.round((new Date(o).getTime() + CONFIG.IP_WINDOW_MINUTES * 60000 - t.getTime()) / 1000))
        : CONFIG.IP_WINDOW_MINUTES * 60;
      return remaining;
    })(),
  ]);

  if (floodRes) {
    return { locked: true, remaining_seconds: floodRes };
  }

  // Email-specific lock
  if (row?.lockout_until && new Date(row.lockout_until) > t) {
    return {
      locked: true,
      remaining_seconds: Math.max(1, Math.round((new Date(row.lockout_until).getTime() - t.getTime()) / 1000)),
    };
  }

  return { locked: false };
}

interface FailResult {
  locked: boolean;
  attempts_left: number;
  remaining_seconds?: number;
  ip_locked?: boolean;
}

/** Failure record — progressive lockout + IP flood guard. */
export async function recordFailure(email: string, ip: string): Promise<FailResult> {
  const sb = getAdmin();
  const norm = normalizeEmail(email);
  const t = now();

  // ── Load existing row (email) + count distinct emails for this IP ──
  const row = await getRow(norm);

  // IP flood: 30+ distinct emails par 60 min window me fail → IP lock 15 min
  const since = new Date(t.getTime() - CONFIG.IP_WINDOW_MINUTES * 60000).toISOString();
  const { count } = await sb
    .from("login_throttle")
    .select("id", { count: "exact", head: true })
    .gte("last_attempt_at", since)
    .eq("ip_address", ip);

  if ((count ?? 0) >= CONFIG.IP_MAX_ATTEMPTS) {
    const ipLockUntil = new Date(t.getTime() + CONFIG.LOCKOUT_MINUTES * 60000).toISOString();
    await sb
      .from("login_throttle")
      .update({ lockout_until: ipLockUntil, updated_at: t.toISOString() })
      .eq("ip_address", ip);
    return { locked: true, attempts_left: 0, ip_locked: true, remaining_seconds: CONFIG.LOCKOUT_MINUTES * 60 };
  }

  if (!row) {
    await sb.from("login_throttle").insert({
      email: norm,
      ip_address: ip,
      attempt_count: 1,
      lock_repeats: 0,
      first_attempt_at: t.toISOString(),
      last_attempt_at: t.toISOString(),
      updated_at: t.toISOString(),
    });
    return { locked: false, attempts_left: CONFIG.MAX_ATTEMPTS - 1 };
  }

  // Window expired → fresh window
  const windowExpired = !row.first_attempt_at || t.getTime() - new Date(row.first_attempt_at).getTime() > CONFIG.WINDOW_MINUTES * 60000;
  const attempts = windowExpired ? 1 : row.attempt_count + 1;
  const attemptTimes = windowExpired ? t : row.first_attempt_at;

  const failResult: FailResult = { locked: false, attempts_left: Math.max(0, CONFIG.MAX_ATTEMPTS - attempts) };

  let lockoutUntil: string | null = null;
  let lockRepeats = row.lock_repeats ?? 0;

  // Escalation: naya window start hote hi check — purana lock RELEASE/expire ho
  // chuka ho to lock_repeats++ (duration double). Yahi karna zaroori hai kyunki
  // fail#1-4 ke updates lockout_until ko null kar dete hain; 5th attempt par
  // check karne se escalation kabhi nahi hota.
  if (windowExpired && row.lockout_until && new Date(row.lockout_until) <= t) {
    lockRepeats = Math.min(lockRepeats + 1, 8);   // cap: 15 × 2^8 = 64h → 24h cap se limit
  }

  if (attempts >= CONFIG.MAX_ATTEMPTS) {
    const mins = Math.min(CONFIG.LOCKOUT_MINUTES * Math.pow(CONFIG.ESCALATE_FACTOR, lockRepeats), CONFIG.MAX_LOCKOUT_MINUTES);
    lockoutUntil = new Date(t.getTime() + mins * 60000).toISOString();
    failResult.locked = true;
    failResult.remaining_seconds = mins * 60;
  }

  const { error } = await sb
    .from("login_throttle")
    .update({
      attempt_count: attempts,
      lock_repeats: lockRepeats,
      first_attempt_at: attemptTimes ? (attemptTimes instanceof Date ? attemptTimes.toISOString() : attemptTimes) : null,
      last_attempt_at: t.toISOString(),
      lockout_until: lockoutUntil,
      updated_at: t.toISOString(),
    })
    .eq("email", norm);

  if (error) {
    return { locked: false, attempts_left: Math.max(0, CONFIG.MAX_ATTEMPTS - attempts) };
  }

  return failResult;
}

/** Success → clear all throttle state for the email. */
export async function reset(email: string): Promise<void> {
  const sb = getAdmin();
  const norm = normalizeEmail(email);
  await sb.from("login_throttle").delete().eq("email", norm);
}

/** Maintenance — purani rows delete (1M rows cap se bachao). */
export async function cleanupOld(olderThanMinutes = 1440): Promise<number> {
  const sb = getAdmin();
  const cutoff = new Date(now().getTime() - olderThanMinutes * 60000).toISOString();
  const { error } = await sb
    .from("login_throttle")
    .delete()
    .lt("updated_at", cutoff);
  if (error) return 0;
  return 1;
}

/** Admin — locked users list. */
export async function listLocked(search?: string) {
  const sb = getAdmin();
  let q = sb.from("login_throttle").select("*");
  if (search) q = q.ilike("email", `%${search}%`);
  q = q.not("lockout_until", "is", null).order("lockout_until", { ascending: false }).limit(100);
  const { data } = await q;
  return data ?? [];
}
