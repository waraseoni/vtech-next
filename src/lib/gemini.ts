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

const FALLBACK_RESPONSES: Record<string, string> = {
  "hello": "Hello! Welcome to V-Technologies! How can I help you today? We specialize in SMPS repair, power supply repair, stage light repair, and DMX controller repair.",
  "hi": "Hi there! Welcome to V-Technologies, Jabalpur's trusted repair shop. What can I help you with?",
  "services": "We offer:\n• SMPS Repair\n• Power Supply Repair\n• Stage Light Repair\n• DMX Controller Repair\n\nVisit us at F4, Hotel Plaza, Marhatal or call 9179105875",
  "address": "We're located at:\nF4, Hotel Plaza (Now Madhushala)\nBeside Jayanti Complex\nMarhatal, Jabalpur - 482002",
  "contact": "Call us at: 9179105875\nOwner: Vikram Jain",
  "repair": "For repair inquiries, please visit our shop or call 9179105875. We'll need your phone number or job ID to check the status.",
  "default": "Thank you for contacting V-Technologies! For repair services, please visit our shop at F4, Hotel Plaza, Marhatal or call us at 9179105875."
};

function getFallbackResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  for (const [keyword, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (lowerPrompt.includes(keyword)) {
      return response;
    }
  }
  
  if (lowerPrompt.includes("service") || lowerPrompt.includes("repair") || lowerPrompt.includes("smps") || lowerPrompt.includes("power supply")) {
    return FALLBACK_RESPONSES.services;
  }
  if (lowerPrompt.includes("address") || lowerPrompt.includes("location") || lowerPrompt.includes("where")) {
    return FALLBACK_RESPONSES.address;
  }
  if (lowerPrompt.includes("contact") || lowerPrompt.includes("call") || lowerPrompt.includes("phone") || lowerPrompt.includes("number")) {
    return FALLBACK_RESPONSES.contact;
  }
  
  return FALLBACK_RESPONSES.default;
}

export async function getGeminiResponse(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  return getFallbackResponse(prompt);
}

export async function getChatResponse(
  messages: ChatMessage[],
  context?: string
): Promise<string> {
  const lastMessage = messages[messages.length - 1]?.content || "";
  return getFallbackResponse(lastMessage);
}

export async function generateReportSummary(
  reportType: string,
  data: Record<string, any>
): Promise<string> {
  return `This is a summary placeholder for ${reportType}. Please configure an AI API key to enable AI-powered summaries.`;
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
  const msg = customerMessage.toLowerCase();
  
  if (msg.includes("status") || msg.includes("repair done")) {
    return `Hello ${customerName || 'Customer'}, for repair status please provide your phone number or job ID. Call us at 9179105875`;
  }
  if (msg.includes("balance") || msg.includes("payment")) {
    return `Hello ${customerName || 'Customer'}, please visit our shop or call 9179105875 for balance and payment details.`;
  }
  if (msg.includes("hello") || msg.includes("hi")) {
    return `Hello ${customerName || 'Customer'}! Welcome to V-Technologies. How can we help you?`;
  }
  
  return `Thank you for your message! For assistance, please call us at 9179105875 or visit our shop.`;
}
