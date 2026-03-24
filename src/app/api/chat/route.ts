import { NextRequest, NextResponse } from "next/server";
import { getChatResponse, getGeminiResponse, ChatMessage } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, messages, type, context } = body;

    if (!message && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let response: string;

    if (type === "chat" && messages) {
      response = await getChatResponse(messages as ChatMessage[], context);
    } else if (type === "whatsapp") {
      const { generateWhatsAppReply } = await import("@/lib/gemini");
      response = await generateWhatsAppReply(
        message,
        context?.customerName,
        context
      );
    } else if (type === "summary") {
      response = await getGeminiResponse(message, context);
    } else {
      response = await getGeminiResponse(message);
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to get response", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Gemini AI Chat API is running",
  });
}
