import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiTools, executeGeminiTool } from "./gemini-tools";

export type ChatMessage = {
  role: "user" | "model" | "assistant" | "function" | "system";
  content: string;
};

// Use environment variable for API Key
const API_KEY = process.env.GEMINI_API_KEY || "API_KEY_MISSING"; 
const genAI = new GoogleGenerativeAI(API_KEY);

export async function getChatResponse(messages: ChatMessage[]): Promise<string> {
  if (API_KEY === "API_KEY_MISSING" || API_KEY.trim() === "") {
    return "ERROR: Gemini API Key is missing in `.env.local`. Krupya GEMINI_API_KEY add karein.";
  }

  const systemInstruction = `
Namaste! You are the intelligent, helpful business assistant for V-Technologies (V-TECH PRO).
Always greet the user politely and answer their questions precisely.
Today's date is: ${new Date().toLocaleDateString('en-GB')} (YYYY-MM-DD for tool usage: ${new Date().toISOString().split('T')[0]}).
You have access to their Supabase database via tools to check total profit, customers, recent jobs, and mechanic performance.
Whenever the user asks about profit, clients, or jobs, ALWAYS use the function calling tools to get real data. Do not make up data.
When they ask for this month's data, use the get_job_statistics tool with the correct start_date and end_date of this month.
If they speak in Hindi or Hinglish, reply in Hindi/Hinglish (roman perfectly). Otherwise, reply in English.
Be concise with your outputs. Do not return markdown that cannot be read well. Use bullet points where necessary.
`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ functionDeclarations: geminiTools }],
      systemInstruction: systemInstruction
    });

    // We do NOT use model.startChat with history directly because function calling loops 
    // are harder to manage with history if we don't store function responses.
    // Instead, we will construct the contents array directly.
    
    // Extract recent user message
    const lastMessageObj = messages[messages.length - 1];
    const initialPrompt = lastMessageObj.content;

    // Convert past string history to content array (optional depending on how complex)
    // For simplicity and to avoid functionCall prompt injection mismatch, we pass the user's latest query
    // and rely on System Instruction for personality.
    let formattedHistory = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    // Gemini API STRICTLY requires the first message in history to be from 'user'.
    // If our history starts with 'model' (like the welcome message), we must remove it.
    while (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
        formattedHistory.shift();
    }

    const chat = model.startChat({
        history: formattedHistory
    });

    // 1. Send the actual user message
    let result = await chat.sendMessage(initialPrompt);

    // 2. Check if the model wants to call any functions/tools
    const functionCalls = result.response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
        // We only handle the first function call for simplicity
        const call = functionCalls[0];
        console.log(`Gemini requested tool: ${call.name}`, call.args);
        
        // Execute our internal function
        const apiResponse = await executeGeminiTool(call);
        
        // 3. Send the API response back to the model so it can answer the user
        result = await chat.sendMessage([{
            functionResponse: {
                name: call.name,
                response: apiResponse
            }
        }]);
    }

    return result.response.text();
  } catch (error: any) {
    console.error("Gemini Execution Error:", error);
    
    const errorMessage = error.message || JSON.stringify(error);
    
    // Rate limit hit / quota exceeded
    if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests") || errorMessage.includes("quota")) {
      // Try to extract the retry time
      const match = errorMessage.match(/retry in ([\d\.]+)s/);
      if (match && match[1]) {
        const seconds = Math.ceil(parseFloat(match[1]));
        return `Aapki request limit poori ho gayi hai. Kripya ${seconds} seconds ke baad dobara sawaal poochein. ⏳`;
      }
      return "Aapki request limit poori ho gayi hai. Kripya thodi der (1-2 minute) baad dobara try karein. ⏳";
    }

    // Return the actual raw error message so the user can debug what exactly failed.
    return `API Error: ${errorMessage}`;
  }
}

export async function generateWhatsAppReply(msg: string, customerName?: string, context?: any) {
  const prompt = `Generate a polite and professional WhatsApp reply for this message: "${msg}". Customer Name: ${customerName || 'Unknown'}. Context provided: ${JSON.stringify(context || {})}`;
  return await getChatResponse([{ role: "user", content: prompt }]);
}