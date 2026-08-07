import { NextRequest, NextResponse } from "next/server";
import { getChatResponse, generateWhatsAppReply } from "@/lib/gemini";
import { getGroqChatResponse } from "@/lib/groq";
import type { ChatMessage } from "@/lib/gemini";
import { getAiSettings } from "@/lib/ai-settings";
import { requireUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { message, messages, type, context, provider } = body;

    if (!message && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const aiSettings = await getAiSettings();

    const activeProvider = provider || aiSettings.provider;
    const apiKey = aiSettings.apiKey;
    const modelName = aiSettings.model;

    let responseText: string;

    if (type === "chat" && messages) {
      if (activeProvider === "groq") {
         responseText = await getGroqChatResponse(messages, apiKey, modelName);
      } else {
         responseText = await getChatResponse(messages as ChatMessage[], apiKey, modelName);
      }
    } else if (type === "whatsapp") {
      responseText = await generateWhatsAppReply(
        message,
        context?.customerName,
        context,
        apiKey,
        modelName
      );
    } else {
      const prompt = message || (messages && messages[messages.length - 1]?.content) || "";
      responseText = await getChatResponse([{ role: "user", content: prompt }], apiKey, modelName);
    }

    return NextResponse.json({ response: responseText });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get response", 
        details: error?.message || String(error) 
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