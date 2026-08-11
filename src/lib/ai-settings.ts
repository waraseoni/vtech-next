import { createClient } from "@supabase/supabase-js";

export type AiSettings = {
  provider: string;
  apiKey: string;
  model: string;
};

export async function getAiSettings(): Promise<AiSettings> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("system_info")
    .select("meta_field, meta_value")
    .in("meta_field", ["ai_provider", "ai_api_key", "ai_model"]);

  const info: Record<string, string> = {};
  (data || []).forEach((r) => { info[r.meta_field] = r.meta_value; });

  const provider = info.ai_provider || "gemini";
  const envKey = provider === "groq" ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;

  return {
    provider,
    apiKey: envKey || info.ai_api_key || "",
    model: info.ai_model || "gemini-2.5-flash",
  };
}
