import { NextRequest, NextResponse } from "next/server";
import { getChatResponse, generateWhatsAppReply, type ChatMessage } from "@/lib/gemini";
import { getGroqChatResponse } from "@/lib/groq";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { getAiSettings, getProviderSettings } from "@/lib/ai-settings";
import { fallbackProviders, isRetryableAiError, providerDisplayName } from "@/lib/ai-failover";
import { isKnownAiProvider } from "@/lib/ai-provider-catalog";
import { requireStaff, getSessionRole } from "@/lib/api-auth";
import { getLiveContext, type AiRole } from "@/lib/gemini-tools";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Chat / WhatsApp AI route.
 *
 * Provider resolution:
 *   1. `body.provider` — staff ka per-session selection (`/ai` page). Sirf known
 *      provider id accept hoti hai; "auto"/invalid par Settings ka active chalta hai.
 *   2. Settings ka active provider (`ai_providers.is_active`).
 *   3. Failover — retryable error (key/quota/model/network) par dusra configured
 *      provider, sirf ek retry per provider.
 *
 * Settings "Test API" `apiKey` bhi bhejta hai (unsaved key test). Us case me
 * failover **band** rehta hai — warna galat key ka failure chhup jata aur test
 * "working" dikha deta.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limit = rateLimit(`chat:${user.id}`, 20, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Bahut zyada AI requests — thodi der baad try karein." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const sessionRole = await getSessionRole();
    const role: AiRole = sessionRole === "admin" ? "admin" : "staff";

    const body = await request.json();
    const {
      message,
      messages,
      type,
      context,
      provider,
      apiKey: bodyKey,
      model: bodyModel,
      test,
    } = body;

    if (!message && (!messages || messages.length === 0)) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const aiSettings = await getAiSettings();

    // Per-session override sirf tab jab known provider ho
    const requestedProvider =
      typeof provider === "string" && isKnownAiProvider(provider) ? provider : "";
    const primaryProvider = requestedProvider || aiSettings.provider;

    const primarySettings =
      primaryProvider === aiSettings.provider
        ? aiSettings
        : await getProviderSettings(primaryProvider);

    // Fresh shop snapshot (role-aware) so replies are grounded in current data
    const liveContext = await getLiveContext(role);

    /** Ek provider ke saath poora request chalao (teeno request shapes). */
    const runProvider = async (
      providerId: string,
      apiKey: string,
      modelName: string
    ): Promise<string> => {
      if (type === "chat" && messages && messages.length > 0) {
        const enrichedMessages = [
          ...messages.slice(0, -1),
          {
            ...messages[messages.length - 1],
            content: `${messages[messages.length - 1].content}\n\n[${liveContext}]\nYe fresh snapshot hai — common questions ka seedha jawab isse do; tools sirf deep/filtered data ke liye call karo.`,
          },
        ];
        return providerId === "groq"
          ? getGroqChatResponse(enrichedMessages, apiKey, modelName, role)
          : getChatResponse(enrichedMessages as ChatMessage[], apiKey, modelName, role);
      }

      if (type === "whatsapp") {
        return generateWhatsAppReply(
          message,
          context?.customerName,
          { ...context, liveContext },
          apiKey,
          modelName,
          role
        );
      }

      const prompt =
        (message || (messages && messages[messages.length - 1]?.content) || "") +
        `\n\n[${liveContext}]`;
      const singleMessage = { role: "user", content: prompt } as const;
      return providerId === "groq"
        ? getGroqChatResponse(
            [singleMessage] as unknown as ChatCompletionMessageParam[],
            apiKey,
            modelName,
            role
          )
        : getChatResponse([singleMessage] as unknown as ChatMessage[], apiKey, modelName, role);
    };

    const attemptedKey = bodyKey || primarySettings.apiKey;
    let responseText = await runProvider(
      primaryProvider,
      attemptedKey,
      bodyModel || primarySettings.model
    );
    let answeredBy = primaryProvider;
    let failoverFrom: string | undefined;

    // Test API (Settings) par failover nahi — warna galat key ka failure chhup
    // jata aur test "working" dikha deta. `bodyKey` bhi test ka signal hai.
    const allowFailover = !bodyKey && test !== true;

    if (allowFailover && isRetryableAiError(responseText)) {
      for (const candidate of fallbackProviders(primaryProvider)) {
        const alt = await getProviderSettings(candidate);
        if (!alt.apiKey) continue;

        logger.warn(
          `[chat] ${providerDisplayName(primaryProvider)} fail hua — ${providerDisplayName(candidate)} se retry`
        );

        responseText = await runProvider(candidate, alt.apiKey, alt.model);
        answeredBy = candidate;

        if (!isRetryableAiError(responseText)) {
          failoverFrom = primaryProvider;
          break;
        }
      }
    }

    return NextResponse.json({
      response: responseText,
      provider: answeredBy,
      ...(failoverFrom ? { failoverFrom } : {}),
    });
  } catch (error) {
    logger.error("Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get response",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET function ko alag se define kiya gaya hai
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Gemini AI Chat API is running",
  });
}
