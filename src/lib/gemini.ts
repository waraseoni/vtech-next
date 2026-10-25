import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { geminiTools, executeGeminiTool, buildSystemPrompt, type AiRole } from "./gemini-tools";
import { logger } from "@/lib/logger";

export type ChatMessage = {
  role: "user" | "model" | "assistant" | "function" | "system";
  content: string;
};

/**
 * Tool declarations naye SDK me `parametersJsonSchema` se jaate hain — plain
 * JSON schema (lowercase `type: "object"`, properties, required) jo
 * `gemini-tools.ts` me already defined hai. Isse purana schema code same rehta
 * hai (Groq path bhi wahi shape use karta hai).
 */
const functionDeclarations: FunctionDeclaration[] = geminiTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.parameters,
}));

export async function getChatResponse(
  messages: ChatMessage[],
  apiKey?: string,
  modelName?: string,
  role: AiRole = "admin"
): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY || "API_KEY_MISSING";
  if (key === "API_KEY_MISSING" || key.trim() === "") {
    return "ERROR: Gemini API Key missing. Settings page se API key daalein ya .env.local mein GEMINI_API_KEY set karein.";
  }
  // Naya SDK client — `GoogleGenAI` (@google/genai). Purana `GoogleGenerativeAI`
  // (@google/generative-ai) deprecated hai.
  const ai = new GoogleGenAI({ apiKey: key });
  const modelId = modelName || "gemini-2.5-flash";

  const systemInstruction = buildSystemPrompt(role);

  try {
    // We do NOT use chat history with function calls directly because the
    // function calling loop is harder to manage if we don't store function
    // responses. Instead, we build the contents array ourselves and send the
    // latest user message.

    // Extract recent user message
    const lastMessageObj = messages[messages.length - 1];
    const initialPrompt = lastMessageObj.content;

    // Convert past string history to Content[] (optional depending on how complex)
    // For simplicity and to avoid functionCall prompt injection mismatch, we pass
    // the user's latest query and rely on System Instruction for personality.
    const formattedHistory: Content[] = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Gemini API STRICTLY requires the first message in history to be from 'user'.
    // If our history starts with 'model' (like the welcome message), we must remove it.
    while (formattedHistory.length > 0 && formattedHistory[0].role === "model") {
      formattedHistory.shift();
    }

    const chat = ai.chats.create({
      model: modelId,
      history: formattedHistory,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations }],
      },
    });

    // 1. Send the actual user message
    let response = await chat.sendMessage({ message: initialPrompt });

    // 2. Check if the model wants to call any functions/tools
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      // We only handle the first function call for simplicity
      const call = functionCalls[0];
      const callName = call.name;
      if (!callName) throw new Error("Gemini ne function call bheja par name missing tha");

      logger.debug(`Gemini requested tool: ${callName}`, call.args);

      // Execute our internal function
      const apiResponse = await executeGeminiTool({ name: callName, args: call.args }, role);

      // 3. Send the API response back to the model so it can answer the user
      response = await chat.sendMessage({
        message: [
          {
            functionResponse: {
              name: callName,
              response: apiResponse,
            },
          },
        ],
      });
    }

    // `text` getter undefined ho sakta hai (empty/blocked response).
    return response.text ?? "Gemini se koi text response nahi mila. Dobara try karein.";
  } catch (error) {
    logger.error("Gemini Execution Error:", error);

    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);

    // Rate limit hit / quota exceeded
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("Too Many Requests") ||
      errorMessage.includes("quota")
    ) {
      // Try to extract the retry time
      const match = errorMessage.match(/retry in ([\d\.]+)s/);
      const retryHint = match ? `${Math.ceil(parseFloat(match[1]))} seconds` : "1-2 minute";

      return `Gemini system abhi busy hai (Rate Limit). Kripya ${retryHint} baad try karein ya Model Selector se 'Groq' choose karein. ⏳\n\nNote: Gemini 2.0 free tier is currently overloaded.`;
    }

    // Return the actual raw error message so the user can debug what exactly failed.
    return `API Error: ${errorMessage}`;
  }
}

export async function generateWhatsAppReply(
  msg: string,
  customerName?: string,
  context?: unknown,
  apiKey?: string,
  modelName?: string,
  role?: AiRole
) {
  const prompt = `Generate a polite and professional WhatsApp reply for this message: "${msg}". Customer Name: ${customerName || "Unknown"}. Context provided: ${JSON.stringify(context || {})}\n\nRules: Reply DIRECTLY to the customer in friendly Hinglish/Hindi. It will be sent AS-IS to the customer, so do NOT include any internal notes, suggestions, meta-commentary, placeholders or instructions aimed at staff. Never mention "I have no data" or internal context. Keep it short, warm and actionable.`;
  return await getChatResponse(
    [{ role: "user", content: prompt }],
    apiKey,
    modelName,
    role || "admin"
  );
}
