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

async function callClaude(
  userMessage: string,
  systemPrompt: string = SHOP_CONTEXT
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";
}

async function callClaudeChat(
  messages: ChatMessage[],
  systemPrompt: string = SHOP_CONTEXT
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  // Normalize roles: Claude only accepts "user" | "assistant"
  const normalized = messages.map((m) => ({
    role: m.role === "model" ? "assistant" : (m.role as "user" | "assistant"),
    content: m.content,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: normalized,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";
}

// ── Public API (same signatures as the old gemini.ts) ──────────────────────

export async function getGeminiResponse(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  return callClaude(prompt, systemInstruction ?? SHOP_CONTEXT);
}

export async function getChatResponse(
  messages: ChatMessage[],
  context?: string
): Promise<string> {
  const system = context
    ? `${SHOP_CONTEXT}\n\nAdditional context: ${context}`
    : SHOP_CONTEXT;
  return callClaudeChat(messages, system);
}

export async function generateReportSummary(
  reportType: string,
  data: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a concise summary for a ${reportType} report with the following data:\n${JSON.stringify(data, null, 2)}`;
  return callClaude(prompt);
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
  const contextLines = [
    customerName ? `Customer name: ${customerName}` : null,
    context?.balance != null ? `Outstanding balance: ₹${context.balance}` : null,
    context?.lastRepair ? `Last repair: ${context.lastRepair}` : null,
    context?.jobStatus ? `Job status: ${context.jobStatus}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Write a short, friendly WhatsApp reply to this customer message:\n"${customerMessage}"${
    contextLines ? `\n\nContext:\n${contextLines}` : ""
  }`;

  return callClaude(prompt);
}
