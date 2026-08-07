import Groq from "groq-sdk";
import { geminiTools, executeGeminiTool } from "./gemini-tools";

const groqTools = geminiTools.map((t: any) => ({
    type: "function",
    function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }
}));

export async function getGroqChatResponse(messages: any[], apiKey?: string, modelName?: string): Promise<string> {
    const key = apiKey || process.env.GROQ_API_KEY || "API_KEY_MISSING";
    if (key === "API_KEY_MISSING" || key.trim() === "") {
        return "ERROR: Groq API Key missing. Settings page se API key daalein ya .env.local mein GROQ_API_KEY set karein.";
    }
    const groq = new Groq({ apiKey: key });
    const modelId = modelName || "llama-3.3-70b-versatile";

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
- **Tool Usage**: Use the native JSON tool calling provided by the API. If you absolutely must use the text fallback, use format: <function=tool_name,{"param":"value"}></function>.
If they speak in Hindi or Hinglish, reply in Hindi/Hinglish (roman perfectly). Otherwise, reply in English.
`;

    const lastMessageObj = messages[messages.length - 1];
    const initialPrompt = lastMessageObj.content;

    let formattedHistory: any[] = [{ role: "system", content: systemInstruction }];
    const pastMessages = messages.slice(0, -1).map(msg => ({
        role: (msg.role === 'assistant' || msg.role === 'model') ? 'assistant' : 'user',
        content: msg.content
    }));
    formattedHistory = [...formattedHistory, ...pastMessages, { role: "user", content: initialPrompt }];

    try {
        const response = await groq.chat.completions.create({
            model: modelId,
            messages: formattedHistory,
            // @ts-ignore
            tools: groqTools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0]?.message;
        const content = responseMessage?.content || "";
        const toolCalls = responseMessage?.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            // Add the assistant's message with tool_calls to the conversation natively
            formattedHistory.push(responseMessage);

            // Execute all requested tools
            for (const toolCall of toolCalls) {
                console.debug(`Groq native tool request: ${toolCall.function.name}`);
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

                // Send back the tool result using strict standard
                formattedHistory.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: JSON.stringify(apiResponse),
                });
            }

            // Get final response from Groq
            const finalResponse = await groq.chat.completions.create({
                model: modelId,
                messages: formattedHistory,
            });

            return finalResponse.choices[0]?.message?.content || "No response generated.";
        }

        // --- FALLBACK: Handle Textual Tool Calls (<function=...>) safely ---
        if (content.includes("<function=")) {
            // Regex handles optional comma after tool name
            const funcMatch = content.match(/<function=([\w_]+),?\s*([\s\S]*?)<\/function>/);
            if (funcMatch) {
                const name = funcMatch[1];
                let args = {};
                try {
                    const argString = funcMatch[2].trim();
                    if (argString) args = JSON.parse(argString);
                } catch (e) {
                    console.error("Failed to parse textual tool args:", e);
                }

                console.debug(`Groq text fallback tool request: ${name}`, args);
                const apiResponse = await executeGeminiTool({ name, args });

                // INSTEAD of throwing a native tool message (which causes 400 Bad Request if ID is fake),
                // we tell the model it performed an action and give it the result directly via user prompt.
                formattedHistory.push({ role: "assistant", content: content });
                formattedHistory.push({ 
                    role: "user", 
                    content: `System Alert: The tool '${name}' was executed successfully with your arguments. The database returned the following JSON data:\n\n${JSON.stringify(apiResponse)}\n\nPlease read this data carefully and answer my original question.` 
                });

                const finalResponse = await groq.chat.completions.create({
                    model: modelId,
                    messages: formattedHistory,
                });

                return finalResponse.choices[0]?.message?.content || "No response generated.";
            }
        }

        return content || "No response generated.";

    } catch (error: any) {
        console.error("Groq Execution Error:", error);
        
        const errorMessage = error.message || JSON.stringify(error);

        // Advanced Fallback: Catch 400 errors where Groq intercepted Llama's malformed XML tool string natively
        try {
            const jsonStartIndex = errorMessage.indexOf('{');
            if (jsonStartIndex !== -1) {
                const errorJsonStr = errorMessage.substring(jsonStartIndex);
                const errorJson = JSON.parse(errorJsonStr);
                const failedGenStr = errorJson?.error?.failed_generation || "";
                
                if (failedGenStr) {
                    console.debug("Intercepted Groq 400 Error failed_generation:", failedGenStr);
                    
                    const nameMatch = failedGenStr.match(/<function=([\w_]+)/);
                    const argsMatch = failedGenStr.match(/{[\s\S]*}/); // Extract JSON args
                    
                    if (nameMatch && argsMatch) {
                        const name = nameMatch[1];
                        let args = {};
                        try { args = JSON.parse(argsMatch[0]); } catch(e) {}
                        
                        const apiResponse = await executeGeminiTool({ name, args });
                        
                        const fallbackHistory = [...formattedHistory];
                        
                        // CRITICAL: Prevent secondary hallucinations (Llama-3 recursively trying to call another tool 
                        // when it sees the data isn't enough, which throws another 400 Error that hides the real answer).
                        if (fallbackHistory.length > 0 && fallbackHistory[0].role === "system") {
                            fallbackHistory[0] = { 
                                role: "system", 
                                content: "You are the V-Tech Assistant. You must answer the user's prompt based ONLY on the data in the System Alert below in conversational language. DO NOT request more data. DO NOT attempt to use tools. NO <function> tags." 
                            };
                        }

                        fallbackHistory.push({ role: "assistant", content: "Executing database retrieval..." });
                        fallbackHistory.push({ 
                            role: "user", 
                            content: `System Alert: The tool '${name}' was executed successfully. Result: ${JSON.stringify(apiResponse)}.\n\nNow, generate the final response for the user using ONLY this data.` 
                        });
                        
                        const finalResponse = await groq.chat.completions.create({
                            model: modelId,
                            messages: fallbackHistory,
                        });
                        return finalResponse.choices[0]?.message?.content || "No response generated.";
                    }
                }
            }
        } catch (recoverError: any) {
            console.error("Failed to recover from 400 Error:", recoverError);
            return `Data fetched successfully, but AI failed to generate final response. (Inner Error: ${recoverError.message || recoverError})`;
        }

        if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
            return "Aapki Groq API request limit poori ho gayi hai. Kripya thodi der baad try karein. ⏳";
        }
        return `Groq API Error: ${errorMessage}`;
    }
}
