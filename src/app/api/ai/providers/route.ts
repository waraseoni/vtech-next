import { NextRequest, NextResponse } from "next/server";
import { getSessionRole, requireAdmin, requireStaff } from "@/lib/api-auth";
import { listAiProviders, migrateLegacyAiKey, saveAiProvider } from "@/lib/ai-settings";
import { logger } from "@/lib/logger";
import { parseBody } from "@/lib/validation";
import { aiProviderUpdateSchema } from "@/lib/validation/schemas/aiProvider";

/**
 * AI provider settings API — multi-provider support.
 *
 * GET   (staff) → masked list: `{ providers: [{ provider, label, model, hasKey,
 *                  keyHint, keySource, isActive, updatedAt }], ready }`
 *                  Kabhi bhi plaintext API key return nahi hoti.
 * PATCH (admin) → `{ provider, model?, apiKey?, clearKey?, isActive? }`
 *                  Key AES-256-GCM me encrypt hoke `ai_providers` me jaati hai.
 *
 * Service-role client sirf server par (`src/lib/ai-settings.ts`), isliye
 * `ai_providers` par koi RLS policy nahi hai — browser se direct read possible
 * nahi.
 */

function errorResponse(error: unknown, message: string) {
  logger.error(message, error);
  return NextResponse.json(
    {
      error: message,
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // One-time legacy migration: `system_info.ai_api_key` (plaintext) →
    // `ai_providers.api_key_cipher` (encrypted), phir plaintext blank.
    // Sirf admin ke GET par (staff ko write nahi karni).
    if ((await getSessionRole()) === "admin") {
      const migration = await migrateLegacyAiKey();
      if (migration.reason && migration.reason !== "no-legacy-key") {
        logger.warn("[ai/providers] legacy key migration:", migration);
      }
    }

    const { providers, ready } = await listAiProviders();
    return NextResponse.json({ providers, ready });
  } catch (error) {
    return errorResponse(error, "AI providers load nahi ho paye");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = await parseBody(aiProviderUpdateSchema, request);
    if (!parsed.ok) return parsed.response;

    await saveAiProvider(parsed.data);

    // Fresh masked list wapas bhejo — UI ko dobara GET nahi karna pade
    const { providers, ready } = await listAiProviders();
    return NextResponse.json({ ok: true, providers, ready });
  } catch (error) {
    return errorResponse(error, "AI provider save nahi ho paya");
  }
}
