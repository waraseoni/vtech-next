export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

const SHOP_CONTEXT = `You are a helpful assistant for V-Technologies, a repair shop in Jabalpur.

Shop Details:
- Name: V-Technologies
- Address: F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur – 482002
- Mobile: 9179105875
- Services: SMPS Repair, Power Supply Repair, Stage Light Repair, DMX Controller Repair
- Owner: Vikram Jain

Guidelines:
1. Always be polite and professional
2. Give brief and helpful responses in English or Hindi
3. If customer asks about repair status, ask for their phone number or job ID
4. If customer asks about payment, guide them to visit the shop or call
5. Don't make up information about specific repairs or amounts
6. Suggest visiting the shop for accurate information`;

const DEEPSEEK_API_KEY = "sk-a1f3fc63e6124f3990ebcc97a31b39e8";

async function callDeepSeek(prompt: string): Promise<string> {
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SHOP_CONTEXT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response."
    );
  } catch (error: any) {
    console.error("DeepSeek API Error:", error?.message || error);
    return `Error: ${error?.message || error}`;
  }
}

export async function getGeminiResponse(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  return callDeepSeek(prompt);
}

export async function getChatResponse(
  messages: ChatMessage[],
  context?: string
): Promise<string> {
  try {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role === "model" ? "assistant" : msg.role,
      content: msg.content,
    }));

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SHOP_CONTEXT },
          ...formattedMessages,
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek error ${response.status}: ${error}`);
    }

    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't understand that."
    );
  } catch (error: any) {
    console.error("DeepSeek Chat Error:", error?.message || error);
    return "Sorry, something went wrong. Please try again.";
  }
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

  return callDeepSeek(prompt);
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

  return callDeepSeek(prompt);
}
