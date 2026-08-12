import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ─── SELLER ADMIN — central licensing project ke tables par direct CRUD ─────
// Sirf seller ke APNE deployment par chalta hai (env vars set honge tabhi).
// Service Role key RLS bypass karta hai — isliye ye lib kabhi customer ke
// deployment par nahi bhejni. Browser ise kabhi nahi dekhta (server-only).

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bina 0/O/1/I — padhne me confuse nahi

export function generateLicenseKey(): string {
  const parts: string[] = [];
  for (let g = 0; g < 4; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += KEY_ALPHABET[randomBytes(1)[0] % KEY_ALPHABET.length];
    }
    parts.push(s);
  }
  return `VTC-${parts.join("-")}`;
}

export const isLicenseAdminConfigured = () =>
  !!process.env.LICENSE_SERVICE_URL &&
  !!process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY;

function makeLicenseAdminClient() {
  return createClient(
    process.env.LICENSE_SERVICE_URL!,
    process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type LicenseRow = {
  id: number;
  license_key: string;
  shop_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  plan: string;
  max_activations: number;
  expires_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  activation_count?: number;
  last_seen_at?: string | null;
};

export async function listLicenses(): Promise<LicenseRow[]> {
  const sb = makeLicenseAdminClient();
  const { data: rows, error } = await sb
    .from("licenses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: acts } = await sb.from("activations").select("license_id, activated_at, last_seen_at");
  const byLicense: Record<number, { count: number; lastSeen: string | null }> = {};
  (acts || []).forEach((a: { license_id: number; activated_at: string; last_seen_at: string }) => {
    const cur = byLicense[a.license_id] || { count: 0, lastSeen: null };
    cur.count += 1;
    const t = a.last_seen_at || a.activated_at;
    if (t && (!cur.lastSeen || t > cur.lastSeen)) cur.lastSeen = t;
    byLicense[a.license_id] = cur;
  });

  return (rows || []).map((r: LicenseRow) => ({
    ...r,
    activation_count: byLicense[r.id]?.count ?? 0,
    last_seen_at: byLicense[r.id]?.lastSeen ?? null,
  }));
}

export type LicenseDetail = LicenseRow & {
  activations: { activation_id: string; shop_url: string | null; shop_name: string | null; activated_at: string; last_seen_at: string }[];
};

export async function getLicense(id: number): Promise<LicenseDetail | null> {
  const sb = makeLicenseAdminClient();
  const { data, error } = await sb.from("licenses").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: acts, error: actsErr } = await sb
    .from("activations")
    .select("activation_id, shop_url, shop_name, activated_at, last_seen_at")
    .eq("license_id", id)
    .order("activated_at", { ascending: true });
  if (actsErr) throw new Error(actsErr.message);
  const activations = acts || [];
  return {
    ...(data as LicenseRow),
    activation_count: activations.length,
    last_seen_at: activations.reduce<string | null>(
      (acc, a) => (a.last_seen_at && (!acc || a.last_seen_at > acc) ? a.last_seen_at : acc),
      null
    ),
    activations,
  };
}

export type LicenseInput = {
  shop_name?: string;
  owner_name?: string;
  owner_email?: string;
  plan?: string;
  max_activations?: number;
  expires_at?: string | null;
  status?: string;
  notes?: string;
};

export async function createLicense(input: LicenseInput): Promise<LicenseRow> {
  const sb = makeLicenseAdminClient();
  // Unique key collision ho to naya key ke saath retry
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await sb
      .from("licenses")
      .insert({
        license_key: generateLicenseKey(),
        shop_name: input.shop_name || null,
        owner_name: input.owner_name || null,
        owner_email: input.owner_email || null,
        plan: input.plan || "standard",
        max_activations: input.max_activations ?? 1,
        expires_at: input.expires_at ?? null,
        status: input.status || "active",
        notes: input.notes || null,
      })
      .select()
      .single();
    if (!error && data) return data as LicenseRow;
    if (attempt === 4) throw new Error(error?.message || "License create nahi hua");
  }
  throw new Error("Unexpected");
}

export async function updateLicense(id: number, input: LicenseInput): Promise<LicenseRow> {
  const sb = makeLicenseAdminClient();
  const patch: Record<string, unknown> = {};
  if (input.shop_name !== undefined) patch.shop_name = input.shop_name || null;
  if (input.owner_name !== undefined) patch.owner_name = input.owner_name || null;
  if (input.owner_email !== undefined) patch.owner_email = input.owner_email || null;
  if (input.plan !== undefined) patch.plan = input.plan;
  if (input.max_activations !== undefined) patch.max_activations = input.max_activations;
  if (input.expires_at !== undefined) patch.expires_at = input.expires_at ?? null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes || null;

  const { data, error } = await sb.from("licenses").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as LicenseRow;
}

export async function deleteLicense(id: number) {
  const sb = makeLicenseAdminClient();
  const { error } = await sb.from("licenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Developer stats — kitne clients ko license diye + expiry dates ─────────
export async function getDevStats() {
  const sb = makeLicenseAdminClient();
  const { data: licenses, error } = await sb.from("licenses").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: activations } = await sb.from("activations").select("license_id");

  const now = Date.now();
  const rows = (licenses || []).map((l: LicenseRow) => {
    const expires = l.expires_at ? new Date(l.expires_at).getTime() : null;
    const expired = l.status === "active" && expires !== null && expires < now;
    return {
      id: l.id,
      license_key: l.license_key,
      shop_name: l.shop_name,
      owner_name: l.owner_name,
      owner_email: l.owner_email,
      plan: l.plan,
      status: l.status,
      expires_at: l.expires_at,
      days_left: expires !== null ? Math.ceil((expires - now) / 86400000) : null,
      active: l.status === "active" && !expired,
      expired,
      activated_instances: (activations || []).filter((a: { license_id: number }) => a.license_id === l.id).length,
    };
  });

  return {
    total: rows.length,
    active: rows.filter((r) => r.active).length,
    expired: rows.filter((r) => r.expired).length,
    disabled: rows.filter((r) => r.status !== "active").length,
    expiringSoon: rows.filter((r) => r.active && r.days_left !== null && r.days_left <= 30).length,
    licenses: rows,
  };
}
