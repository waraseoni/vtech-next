import { NextRequest, NextResponse } from "next/server";
import { getChatResponse, generateWhatsAppReply, type ChatMessage } from "@/lib/gemini";
import { getGroqChatResponse } from "@/lib/groq";
import { getAiSettings } from "@/lib/ai-settings";
import { requireStaff, getSessionRole } from "@/lib/api-auth";
import { getLiveContext, type AiRole } from "@/lib/gemini-tools";

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionRole = await getSessionRole();
    const role: AiRole = sessionRole === "admin" ? "admin" : "staff";

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

    // Fresh shop snapshot (role-aware) so replies are grounded in current data
    const liveContext = await getLiveContext(role);

    let responseText: string;

    if (type === "chat" && messages) {
      const enrichedMessages = [
        ...messages.slice(0, -1),
        {
          ...messages[messages.length - 1],
          content: `${messages[messages.length - 1].content}\n\n[${liveContext}]\nYe fresh snapshot hai — common questions ka seedha jawab isse do; tools sirf deep/filtered data ke liye call karo.`,
        },
      ];
      if (activeProvider === "groq") {
         responseText = await getGroqChatResponse(enrichedMessages, apiKey, modelName, role);
      } else {
         responseText = await getChatResponse(enrichedMessages as ChatMessage[], apiKey, modelName, role);
      }
    } else if (type === "whatsapp") {
      responseText = await generateWhatsAppReply(
        message,
        context?.customerName,
        { ...context, liveContext },
        apiKey,
        modelName,
        role
      );
    } else {
      const prompt = (message || (messages && messages[messages.length - 1]?.content) || "")
        + `\n\n[${liveContext}]`;
      responseText = await getChatResponse([{ role: "user", content: prompt }], apiKey, modelName, role);
    }

    return NextResponse.json({ response: responseText });

  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to get response", 
        details: error instanceof Error ? error.message : String(error) 
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