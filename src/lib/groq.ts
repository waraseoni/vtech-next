import Groq from "groq-sdk";
import { geminiTools, executeGeminiTool } from "./gemini-tools";

const API_KEY = process.env.GROQ_API_KEY || "API_KEY_MISSING";
const groq = new Groq({ apiKey: API_KEY });

// Convert Gemini tool schema to Groq (OpenAI style) tool schema
const groqTools = geminiTools.map((t: any) => ({
    type: "function",
    function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }
}));

export async function getGroqChatResponse(messages: any[]): Promise<string> {
    if (API_KEY === "API_KEY_MISSING" || API_KEY.trim() === "") {
        return "ERROR: Groq API Key is missing in `.env.local`. Kripya nayi GROQ_API_KEY = ... wahan add karein aur server restart karein.";
    }

    const systemInstruction = `
Namaste! You are the intelligent, helpful business assistant for V-Technologies (V-TECH PRO).
Always greet the user politely and answer their questions precisely.
Today's date is: ${new Date().toLocaleDateString("en-GB")} (YYYY-MM-DD for tool usage: ${new Date().toISOString().split("T")[0]}).
You have access to their Supabase database via tools to check total profit, customers, recent jobs, and mechanic performance.
Whenever the user asks about profit, revenue, or cash in, ALWAYS use the function calling tools.
- **Revenue**: Use get_financial_report. It includes BOTH Repairs and Direct Product Sales.
- **Cash In**: Use get_financial_report.  - Revenue (कमाई): Sum of Job Amounts (for jobs with Status 5 ONLY) + All Direct Sales.
  - Cash In (नकद आय): Sum of Received Payments + Walk-in Cash Sales (where client_id is 0/null).
  - Profit (लाभ): Total Revenue minus (Salaries + Commission + Shop Expenses + EMI + Discounts).
  - Single Day Logic: If the user asks for data for a specific day (e.g., '23 March'), you MUST call tools with start_date and end_date BOTH set to that exact date (e.g., '2026-03-23'). Do NOT include previous days unless a range is asked.
  - Context: User's business is V-TECH. Dates are in YYYY-MM-DD format. Offset is IST (+05:30).
- **Monthly stats**: Always use a full month range (e.g., 2024-03-01 to 2024-03-31) when asked about "this month".
- **Job Status**: Always use the "status_label" (e.g., 'Delivered') instead of the number (e.g., 5) when replying.
- **Tool Usage**: When calling tools like get_recent_jobs, ALWAYS provide "limit" and "status" as INTEGERS (e.g., 5), not as strings (e.g., "5").
- **STRICT**: Do NOT use pseudo-tags like "<function=...>" or mention function names in text. Use the provided tools interface.
If they speak in Hindi or Hinglish, reply in Hindi/Hinglish (roman perfectly). Otherwise, reply in English.
`;

    try {
        const lastMessageObj = messages[messages.length - 1];
        const initialPrompt = lastMessageObj.content;

        let formattedHistory: any[] = [{ role: "system", content: systemInstruction }];

        const pastMessages = messages.slice(0, -1).map(msg => ({
            role: (msg.role === 'assistant' || msg.role === 'model') ? 'assistant' : 'user',
            content: msg.content
        }));

        formattedHistory = [...formattedHistory, ...pastMessages, { role: "user", content: initialPrompt }];

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Reverted to 3.3 with improved schema/fallback
            messages: formattedHistory,
            // @ts-ignore
            tools: groqTools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0]?.message;
        const content = responseMessage?.content || "";
        let toolCalls = responseMessage?.tool_calls;

        // --- FALLBACK: Handle Textual Tool Calls (<function=...>) ---
        if (!toolCalls && content.includes("<function=")) {
            const funcMatch = content.match(/<function=(\w+)\s*([\s\S]*?)<\/function>/);
            if (funcMatch) {
                const name = funcMatch[1];
                let args = {};
                try {
                    args = JSON.parse(funcMatch[2].trim());
                } catch (e) {
                    console.error("Failed to parse textual tool args:", e);
                }
                toolCalls = [{
                    id: "text_call_" + Date.now(),
                    type: "function",
                    function: { name, arguments: JSON.stringify(args) }
                }];
            }
        }

        if (toolCalls && toolCalls.length > 0) {
            // Add the assistant's message with tool_calls to the conversation
            formattedHistory.push(responseMessage || { role: "assistant", content: content });

            // Execute all requested tools
            for (const toolCall of toolCalls) {
                console.log(`Groq requested tool: ${toolCall.function.name}`);
                let functionArgs = {};
                try {
                    functionArgs = JSON.parse(toolCall.function.arguments);
                } catch(e) {
                    console.error("Arg parse error:", e);
                }
                
                const apiResponse = await executeGeminiTool({
                    name: toolCall.function.name,
                    args: functionArgs
                });

                // Send back the tool result
                formattedHistory.push({
                    role: "tool",
                    tool_call_id: (toolCall as any).id,
                    content: JSON.stringify(apiResponse),
                });
            }

            // Get final response from Groq
            const finalResponse = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: formattedHistory,
            });

            return finalResponse.choices[0]?.message?.content || "No response generated.";
        }

        return content || "No response generated.";

    } catch (error: any) {
        console.error("Groq Execution Error:", error);
        
        const errorMessage = error.message || JSON.stringify(error);
        if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
            return "Aapki Groq API request limit poori ho gayi hai. Kripya thodi der baad try karein. ⏳";
        }
        return `Groq API Error: ${errorMessage}`;
    }
}
