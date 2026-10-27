import { createClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret, maskKey } from "./ai-crypto";
import {
  AI_DEFAULT_PROVIDER,
  AI_PROVIDER_CATALOG,
  AI_PROVIDER_IDS,
  defaultModel,
  providerLabel,
  type AiProviderId,
} from "./ai-provider-catalog";

export { AI_PROVIDER_CATALOG, AI_PROVIDER_IDS, defaultModel, providerLabel };
export type { AiProviderId };

/**
 * AI provider settings - multi-provider (v1.71+).
 *
 * Pehle `system_info` me sirf ek `ai_provider` + ek `ai_api_key` + ek `ai_model`
 * row thi, isliye provider switch karne par purani key overwrite ho jaati thi
 * (ya stale key reh jaati thi -> silent "API key not valid" error).
 *
 * Ab: nayi `ai_providers` table, har provider ki apni key + model, aur ek
 * `is_active` row. Keys AES-256-GCM me encrypted rehti hain aur browser ko
 * kabhi plaintext me nahi jaati (sirf "....last4" hint).
 *
 * Backwards compatible:
 *   - `ai_providers` table na ho (migration pending) to purani `system_info`
 *     rows se kaam chalta rahega.
 *   - `ai_api_key` plaintext mile to `migrateLegacyAiKey()` use encrypt karke
 *     system_info se hata deta hai (admin GET par one-time).
 *
 * Resolution order (per provider):
 *   1. `ai_providers.api_key_cipher` (decrypt)
 *   2. legacy `system_info.ai_api_key` (sirf tab jab legacy provider wahi ho)
 *   3. env - `GROQ_API_KEY` / `GEMINI_API_KEY`
 */

export type AiSettings = {
  provider: string;
  apiKey: string;
  model: string;
};

/** Browser ko bhejne layak provider info - key kabhi nahi, sirf hint. */
export type AiProviderPublic = {
  provider: AiProviderId;
  label: string;
  model: string;
  hasKey: boolean;
  keyHint: string | null;
  keySource: "db" | "legacy" | "env" | "none";
  isActive: boolean;
  updatedAt: string | null;
};

const LEGACY_FIELDS = ["ai_provider", "ai_api_key", "ai_model"];

type AiProviderRow = {
  provider: string;
  label: string | null;
  model: string | null;
  api_key_cipher: string | null;
  key_hint: string | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type LegacySettings = { provider: string; apiKey: string; model: string };

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Env fallback - provider ke hisaab se. `AI_API_KEY` jaisa generic var nahi,
 * taaki galti se ek provider ki key doosre par na lag jaye.
 */
function envKeyFor(provider: string): string {
  if (provider === "groq") return process.env.GROQ_API_KEY || "";
  if (provider === "gemini") return process.env.GEMINI_API_KEY || "";
  return "";
}

async function loadProviderRows(): Promise<{ rows: AiProviderRow[]; ready: boolean }> {
  const { data, error } = await adminClient()
    .from("ai_providers")
    .select("provider, label, model, api_key_cipher, key_hint, is_active, updated_at");

  // Table missing (migration pending) -> legacy mode, crash nahi
  if (error) return { rows: [], ready: false };
  return { rows: (data ?? []) as AiProviderRow[], ready: true };
}

async function loadLegacy(): Promise<LegacySettings> {
  const { data } = await adminClient()
    .from("system_info")
    .select("meta_field, meta_value")
    .in("meta_field", LEGACY_FIELDS);

  const info: Record<string, string> = {};
  for (const row of data ?? []) info[row.meta_field] = row.meta_value ?? "";

  return {
    provider: info.ai_provider || AI_DEFAULT_PROVIDER,
    apiKey: info.ai_api_key || "",
    model: info.ai_model || "",
  };
}

/** DB rows + legacy rows dono padho (parallel). */
async function readState() {
  const [providerState, legacy] = await Promise.all([loadProviderRows(), loadLegacy()]);
  return { ...providerState, legacy };
}

/** Ek provider ki effective key - DB, phir legacy, phir env. */
function resolveKey(row: AiProviderRow | undefined, legacy: LegacySettings, provider: string) {
  const decrypted = decryptSecret(row?.api_key_cipher);
  if (decrypted) return decrypted;
  if (legacy.provider === provider && legacy.apiKey) return legacy.apiKey;
  return envKeyFor(provider);
}

function resolveModel(row: AiProviderRow | undefined, legacy: LegacySettings, provider: string) {
  if (row?.model) return row.model;
  if (legacy.provider === provider && legacy.model) return legacy.model;
  return defaultModel(provider);
}

/** Active provider ki poori settings (server-side, key plaintext me). */
export async function getAiSettings(): Promise<AiSettings> {
  const { rows } = await loadProviderRows();
  const activeRow = rows.find((row) => row.is_active);

  // Fast path: active row + decryptable key → legacy query ki zaroorat nahi
  // (chat route har message par isse call karta hai)
  if (activeRow) {
    const apiKey = decryptSecret(activeRow.api_key_cipher);
    if (apiKey) {
      return {
        provider: activeRow.provider,
        apiKey,
        model: activeRow.model || defaultModel(activeRow.provider),
      };
    }
  }

  const legacy = await loadLegacy();
  const provider = activeRow?.provider || legacy.provider || AI_DEFAULT_PROVIDER;
  const row = activeRow ?? rows.find((r) => r.provider === provider);

  return {
    provider,
    apiKey: resolveKey(row, legacy, provider),
    model: resolveModel(row, legacy, provider),
  };
}

/** Kisi bhi provider ki settings (Settings "Test API" ke liye). */
export async function getProviderSettings(provider: string): Promise<AiSettings> {
  const { rows } = await loadProviderRows();
  const row = rows.find((r) => r.provider === provider);

  const apiKey = decryptSecret(row?.api_key_cipher);
  if (apiKey) {
    return { provider, apiKey, model: row?.model || defaultModel(provider) };
  }

  const legacy = await loadLegacy();
  return {
    provider,
    apiKey: resolveKey(row, legacy, provider),
    model: resolveModel(row, legacy, provider),
  };
}

/**
 * Settings UI ke liye masked list. Dono known providers hamesha list me aate
 * hain, chahe DB row abhi bane hi na ho (naya install).
 */
export async function listAiProviders(): Promise<{
  providers: AiProviderPublic[];
  ready: boolean;
}> {
  const { rows, ready, legacy } = await readState();

  const activeRow = rows.find((row) => row.is_active);
  const activeProvider = activeRow?.provider || legacy.provider || AI_DEFAULT_PROVIDER;

  const providers = AI_PROVIDER_IDS.map((id): AiProviderPublic => {
    const row = rows.find((r) => r.provider === id);
    const dbKey = decryptSecret(row?.api_key_cipher);
    const legacyKey = legacy.provider === id ? legacy.apiKey : "";
    const envKey = envKeyFor(id);

    const keySource: AiProviderPublic["keySource"] = dbKey
      ? "db"
      : legacyKey
        ? "legacy"
        : envKey
          ? "env"
          : "none";

    return {
      provider: id,
      label: row?.label || AI_PROVIDER_CATALOG[id].label,
      model: resolveModel(row, legacy, id),
      hasKey: keySource !== "none",
      keyHint: row?.key_hint || maskKey(dbKey || legacyKey || envKey),
      keySource,
      isActive: id === activeProvider,
      updatedAt: row?.updated_at ?? null,
    };
  });

  return { providers, ready };
}

export type SaveAiProviderInput = {
  provider: AiProviderId;
  model?: string;
  /** Naya key (plaintext) - sirf yahan aata hai, store encrypted hota hai. */
  apiKey?: string;
  /** Existing key hatao */
  clearKey?: boolean;
  /** Is provider ko active banao (baaki automatically off) */
  isActive?: boolean;
};

/** Ek provider ki settings save karo (admin-only route se call hota hai). */
export async function saveAiProvider(input: SaveAiProviderInput): Promise<void> {
  const sb = adminClient();
  const catalog = AI_PROVIDER_CATALOG[input.provider];
  if (!catalog) throw new Error(`Unknown AI provider: ${input.provider}`);

  const { data: existing, error: readError } = await sb
    .from("ai_providers")
    .select("provider")
    .eq("provider", input.provider)
    .maybeSingle();

  if (readError) {
    throw new Error(
      `ai_providers read failed: ${readError.message} - migration apply hui hai? (npm run schema:drift)`
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.model) patch.model = input.model;

  if (input.apiKey) {
    const key = input.apiKey.trim();
    if (!key) throw new Error("API key khaali hai");
    patch.api_key_cipher = encryptSecret(key);
    patch.key_hint = maskKey(key);
  }

  if (input.clearKey) {
    patch.api_key_cipher = null;
    patch.key_hint = null;

    // Legacy plaintext row bhi saaf karo, warna `resolveKey` use wapas utha lega
    await sb.from("system_info").update({ meta_value: "" }).eq("meta_field", "ai_api_key");
  }
  if (!existing) {
    const { error } = await sb.from("ai_providers").insert({
      provider: input.provider,
      label: catalog.label,
      model: input.model || catalog.model,
      api_key_cipher: (patch.api_key_cipher as string | null | undefined) ?? null,
      key_hint: (patch.key_hint as string | null | undefined) ?? null,
      is_active: false,
    });
    if (error) throw new Error(`ai_providers insert failed: ${error.message}`);
  } else {
    const { error } = await sb.from("ai_providers").update(patch).eq("provider", input.provider);
    if (error) throw new Error(`ai_providers update failed: ${error.message}`);
  }

  if (input.isActive) {
    // Partial unique index (ek hi active row) - pehle baaki off, phir ye on
    const { error: offError } = await sb
      .from("ai_providers")
      .update({ is_active: false })
      .neq("provider", input.provider);
    if (offError) throw new Error(`ai_providers deactivate failed: ${offError.message}`);

    const { error: onError } = await sb
      .from("ai_providers")
      .update({ is_active: true })
      .eq("provider", input.provider);
    if (onError) throw new Error(`ai_providers activate failed: ${onError.message}`);
  }
}

/**
 * Purani plaintext key (`system_info.ai_api_key`) ko encrypted store me le jao
 * aur plaintext row ko blank kar do. Idempotent - dobara chalane par kuch nahi
 * hota. Sirf admin GET se call hota hai.
 */
export async function migrateLegacyAiKey(): Promise<{ migrated: boolean; reason?: string }> {
  const { rows, ready, legacy } = await readState();

  if (!ready) return { migrated: false, reason: "migration-pending" };
  if (!legacy.apiKey) return { migrated: false, reason: "no-legacy-key" };

  const row = rows.find((r) => r.provider === legacy.provider);
  if (!row) return { migrated: false, reason: "provider-row-missing" };

  const sb = adminClient();

  if (!decryptSecret(row.api_key_cipher)) {
    const { error } = await sb
      .from("ai_providers")
      .update({
        api_key_cipher: encryptSecret(legacy.apiKey),
        key_hint: maskKey(legacy.apiKey),
        updated_at: new Date().toISOString(),
      })
      .eq("provider", legacy.provider);

    if (error) return { migrated: false, reason: error.message };
  }

  // Plaintext key ki zaroorat ab nahi - RLS leak bhi isi se band hota hai
  const { error: clearError } = await sb
    .from("system_info")
    .update({ meta_value: "" })
    .eq("meta_field", "ai_api_key");

  if (clearError) return { migrated: true, reason: `legacy-clear-failed: ${clearError.message}` };

  return { migrated: true };
}
