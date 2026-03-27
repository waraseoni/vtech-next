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
- **Revenue**: Use get_financial_report. It means the total bill amount of jobs delivered/paid today.
- **Cash In**: Use get_financial_report. It means actual money collected today (payments).
- **Monthly stats**: Use get_job_statistics or get_financial_report with a date range.
- **Job Status**: Always use the "status_label" (e.g., 'Delivered') instead of the number (e.g., 5) when replying.
- **Tool Usage**: When calling tools like get_recent_jobs, ALWAYS provide "limit" and "status" as INTEGERS (e.g., 5), not as strings (e.g., "5").
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
            model: "llama-3.3-70b-versatile", // Fast and generous Llama-3.3 model
            messages: formattedHistory,
            // @ts-ignore
            tools: groqTools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0]?.message;
        const toolCalls = responseMessage?.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            // Add the assistant's message with tool_calls to the conversation
            formattedHistory.push(responseMessage);

            // Execute all requested tools
            for (const toolCall of toolCalls) {
                console.log(`Groq requested tool: ${toolCall.function.name}`);
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                const apiResponse = await executeGeminiTool({
                    name: toolCall.function.name,
                    args: functionArgs
                });

                // Send back the tool result
                formattedHistory.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
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

        return responseMessage?.content || "No response generated.";

    } catch (error: any) {
        console.error("Groq Execution Error:", error);
        
        const errorMessage = error.message || JSON.stringify(error);
        if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
            return "Aapki Groq API request limit poori ho gayi hai. Kripya thodi der baad try karein. ⏳";
        }
        return `Groq API Error: ${errorMessage}`;
    }
}
