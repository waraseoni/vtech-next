import { createClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "./creds-crypto";

// ─── Client credentials (central project) — seller portal ke liye ───────────
// Har license/client ke deployment infra details (Supabase/GitHub/Vercel).
// Sensitive fields DB mein encrypted rehte hain; server-side decrypt hota hai
// jab seller portal (double-password) ke andar data dikhana ho.

export type ClientCredsInput = {
  app_url?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_service_role_key?: string;
  supabase_email?: string;
  supabase_password?: string;
  github_repo?: string;
  github_token?: string;
  github_username?: string;
  github_password?: string;
  vercel_project_url?: string;
  vercel_project_id?: string;
  vercel_token?: string;
  vercel_email?: string;
  vercel_password?: string;
  custom_domain?: string;
  notes?: string;
};

export type ClientCreds = {
  license_id: number;
  app_url: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_role_key: string | null;
  supabase_email: string | null;
  supabase_password: string | null;
  github_repo: string | null;
  github_token: string | null;
  github_username: string | null;
  github_password: string | null;
  vercel_project_url: string | null;
  vercel_project_id: string | null;
  vercel_token: string | null;
  vercel_email: string | null;
  vercel_password: string | null;
  custom_domain: string | null;
  notes: string | null;
  updated_at: string | null;
};

function makeClient() {
  return createClient(
    process.env.LICENSE_SERVICE_URL!,
    process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type RawRow = {
  license_id: number;
  app_url: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_role_key: string | null;
  supabase_email: string | null;
  supabase_password: string | null;
  github_repo: string | null;
  github_token: string | null;
  github_username: string | null;
  github_password: string | null;
  vercel_project_url: string | null;
  vercel_project_id: string | null;
  vercel_token: string | null;
  vercel_email: string | null;
  vercel_password: string | null;
  custom_domain: string | null;
  notes: string | null;
  updated_at: string | null;
};

export async function getClientCredentials(licenseId: number): Promise<ClientCreds | null> {
  const sb = makeClient();
  const { data, error } = await sb
    .from("client_credentials")
    .select("*")
    .eq("license_id", licenseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const r = data as RawRow;
  return {
    ...r,
    supabase_anon_key: decryptSecret(r.supabase_anon_key) || null,
    supabase_service_role_key: decryptSecret(r.supabase_service_role_key) || null,
    supabase_password: decryptSecret(r.supabase_password) || null,
    github_token: decryptSecret(r.github_token) || null,
    github_password: decryptSecret(r.github_password) || null,
    vercel_token: decryptSecret(r.vercel_token) || null,
    vercel_password: decryptSecret(r.vercel_password) || null,
  };
}

export async function upsertClientCredentials(
  licenseId: number,
  input: ClientCredsInput
): Promise<ClientCreds> {
  const sb = makeClient();
  const patch: Record<string, unknown> = {
    license_id: licenseId,
    app_url: input.app_url || null,
    supabase_url: input.supabase_url || null,
    supabase_email: input.supabase_email || null,
    github_repo: input.github_repo || null,
    github_username: input.github_username || null,
    vercel_project_url: input.vercel_project_url || null,
    vercel_project_id: input.vercel_project_id || null,
    vercel_email: input.vercel_email || null,
    custom_domain: input.custom_domain || null,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  };
  // Sensitive fields: hamesha encrypt karke store karo.
  patch.supabase_anon_key = encryptSecret(input.supabase_anon_key || "");
  patch.supabase_service_role_key = encryptSecret(input.supabase_service_role_key || "");
  patch.supabase_password = encryptSecret(input.supabase_password || "");
  patch.github_token = encryptSecret(input.github_token || "");
  patch.github_password = encryptSecret(input.github_password || "");
  patch.vercel_token = encryptSecret(input.vercel_token || "");
  patch.vercel_password = encryptSecret(input.vercel_password || "");

  const { data, error } = await sb
    .from("client_credentials")
    .upsert(patch, { onConflict: "license_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const r = data as RawRow;
  return {
    ...r,
    supabase_anon_key: decryptSecret(r.supabase_anon_key) || null,
    supabase_service_role_key: decryptSecret(r.supabase_service_role_key) || null,
    supabase_password: decryptSecret(r.supabase_password) || null,
    github_token: decryptSecret(r.github_token) || null,
    github_password: decryptSecret(r.github_password) || null,
    vercel_token: decryptSecret(r.vercel_token) || null,
    vercel_password: decryptSecret(r.vercel_password) || null,
  };
}

// Partial update — sirf diye gaye fields update karo; baaki existing values preserve.
// (Developer page ke push/setup-kit routes sirf subset bhejte hain — bina merge ke
//  baaki fields null ho jate the: notes, github, emails, vercel email/password...)
export async function patchClientCredentials(
  licenseId: number,
  input: ClientCredsInput
): Promise<ClientCreds> {
  const existing = await getClientCredentials(licenseId).catch(() => null);
  // Sirf string fields merge karo (null/number fields drop) — taaki null
  // values se unset na ho jayein.
  const merged: ClientCredsInput = {};
  if (existing) {
    (Object.keys(existing) as (keyof ClientCreds)[]).forEach((k) => {
      const v = existing[k];
      if (typeof v === "string") (merged as Record<string, unknown>)[k] = v;
    });
  }
  return upsertClientCredentials(licenseId, { ...merged, ...input });
}

export async function deleteClientCredentials(licenseId: number) {
  const sb = makeClient();
  const { error } = await sb.from("client_credentials").delete().eq("license_id", licenseId);
  if (error) throw new Error(error.message);
}

// Supabase dashboard URL helper — client ke project par seedha "Open" karne ke liye.
export function supabaseDashboardUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}` : null;
}
