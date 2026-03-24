import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export async function getGeminiResponse(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemInstruction || getSystemPrompt(),
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text() || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, something went wrong. Please try again.";
  }
}

export async function getChatResponse(
  messages: ChatMessage[],
  context?: string
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: getSystemPrompt(context),
    });

    const chat = model.startChat({
      history: messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text() || "Sorry, I couldn't understand that.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Sorry, something went wrong. Please try again.";
  }
}

function getSystemPrompt(customContext?: string): string {
  const baseContext = customContext || "";

  return `You are a helpful assistant for V-Technologies, a repair shop in Jabalpur.

Shop Details:
- Name: V-Technologies
- Address: F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002
- Mobile: 9179105875
- Services: SMPS Repair, Power Supply Repair, Stage Light Repair, DMX Controller Repair
- Owner: Vikram Jain

${baseContext}

Guidelines:
1. Always be polite and professional
2. Give brief and helpful responses
3. If customer asks about repair status, ask for their phone number or job ID
4. If customer asks about payment, guide them to visit the shop or call
5. Don't make up information about specific repairs or amounts
6. Suggest visiting the shop for accurate information`;
}

export async function generateReportSummary(
  reportType: string,
  data: Record<string, any>
): Promise<string> {
  const prompt = `
    Analyze this ${reportType} data and give a brief summary:
    
    ${JSON.stringify(data, null, 2)}
    
    Give a concise summary in 2-3 sentences highlighting key insights.
  `;

  return getGeminiResponse(prompt);
}

export async function generateWhatsAppReply(
  customerMessage: string,
  customerName?: string,
  context?: {
    balance?: number;
    lastRepair?: string;
    jobStatus?: string;
  }
): Promise<string> {
  let contextInfo = "";
  if (context?.balance !== undefined) {
    contextInfo += `Customer's current balance: ₹${context.balance}. `;
  }
  if (context?.lastRepair) {
    contextInfo += `Last repair: ${context.lastRepair}. `;
  }
  if (context?.jobStatus) {
    contextInfo += `Current job status: ${context.jobStatus}. `;
  }

  const prompt = `
    Customer (${customerName || "Customer"}) sent this message: "${customerMessage}"
    
    ${contextInfo}
    
    Generate a short, polite WhatsApp reply in Hindi/Hindi-English mix (like WhatsApp chats).
    Keep it brief and helpful.
  `;

  return getGeminiResponse(prompt);
}
