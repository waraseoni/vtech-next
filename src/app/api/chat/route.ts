import { NextRequest, NextResponse } from "next/server";
// Import paths ko check karein, ye @/lib/gemini hona chahiye
import { getChatResponse, generateWhatsAppReply } from "@/lib/gemini";
import { getGroqChatResponse } from "@/lib/groq";
import type { ChatMessage } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, messages, type, context, provider } = body;

    if (!message && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let responseText: string;

    if (type === "chat" && messages) {
      if (provider === "groq") {
         responseText = await getGroqChatResponse(messages);
      } else {
         responseText = await getChatResponse(messages as ChatMessage[]);
      }
    } else if (type === "whatsapp") {
      responseText = await generateWhatsAppReply(
        message,
        context?.customerName,
        context
      );
    } else {
      const prompt = message || (messages && messages[messages.length - 1]?.content) || "";
      responseText = await getChatResponse([{ role: "user", content: prompt }]);
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