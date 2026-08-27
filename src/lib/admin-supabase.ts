import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client — service_role RLS bypass karta hai.
// SIRF server code me use karo (API routes / libs), kabhi browser me NAHI.
// Singleton: ek process me ek hi client reuse hota hai (Vercel serverless me
// instance lifetime ke andar hota hai; env vars missing hone par fail-fast).
let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return cached;
}