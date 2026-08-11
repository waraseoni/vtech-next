import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { geminiTools, executeGeminiTool, buildSystemPrompt, type AiRole } from "./gemini-tools";

const groqTools = geminiTools.map((t) => ({
    type: "function",
    function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }
}));

export async function getGroqChatResponse(messages: ChatCompletionMessageParam[], apiKey?: string, modelName?: string, role: AiRole = "admin"): Promise<string> {
    const key = apiKey || process.env.GROQ_API_KEY || "API_KEY_MISSING";
    if (key === "API_KEY_MISSING" || key.trim() === "") {
        return "ERROR: Groq API Key missing. Settings page se API key daalein ya .env.local mein GROQ_API_KEY set karein.";
    }
    const groq = new Groq({ apiKey: key });
    const modelId = modelName || "llama-3.3-70b-versatile";

    const systemInstruction = buildSystemPrompt(role);

    const lastMessageObj = messages[messages.length - 1];
    const initialPrompt = lastMessageObj.content;

    let formattedHistory: unknown[] = [{ role: "system", content: systemInstruction }];
    const pastMessages = messages.slice(0, -1).map(msg => ({
        role: (String(msg.role) === 'assistant' || String(msg.role) === 'model') ? 'assistant' : 'user',
        content: msg.content
    }));
    formattedHistory = [...formattedHistory, ...pastMessages, { role: "user", content: initialPrompt }];

    try {
        const response = await groq.chat.completions.create({
            model: modelId,
            messages: formattedHistory as unknown as ChatCompletionMessageParam[],
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
                }, role);

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
                messages: formattedHistory as unknown as ChatCompletionMessageParam[],
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
                        const apiResponse = await executeGeminiTool({ name, args }, role);

                // INSTEAD of throwing a native tool message (which causes 400 Bad Request if ID is fake),
                // we tell the model it performed an action and give it the result directly via user prompt.
                formattedHistory.push({ role: "assistant", content: content });
                formattedHistory.push({ 
                    role: "user", 
                    content: `System Alert: The tool '${name}' was executed successfully with your arguments. The database returned the following JSON data:\n\n${JSON.stringify(apiResponse)}\n\nPlease read this data carefully and answer my original question.` 
                });

                const finalResponse = await groq.chat.completions.create({
                    model: modelId,
                    messages: formattedHistory as unknown as ChatCompletionMessageParam[],
                });

                return finalResponse.choices[0]?.message?.content || "No response generated.";
            }
        }

        return content || "No response generated.";

    } catch (error) {
        console.error("Groq Execution Error:", error);
        
        const errorMessage = (error instanceof Error ? error.message : String(error)) || JSON.stringify(error);

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
                        try { args = JSON.parse(argsMatch[0]); } catch {}
                        
                const apiResponse = await executeGeminiTool({ name, args }, role);
                        
                        const fallbackHistory = [...formattedHistory];
                        
                        // CRITICAL: Prevent secondary hallucinations (Llama-3 recursively trying to call another tool 
                        // when it sees the data isn't enough, which throws another 400 Error that hides the real answer).
                        const firstMsg = fallbackHistory[0] as Record<string, unknown> | undefined;
                        if (fallbackHistory.length > 0 && firstMsg && firstMsg.role === "system") {
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
                            messages: fallbackHistory as unknown as ChatCompletionMessageParam[],
                        });
                        return finalResponse.choices[0]?.message?.content || "No response generated.";
                    }
                }
            }
        } catch (recoverError) {
            console.error("Failed to recover from 400 Error:", recoverError);
            return `Data fetched successfully, but AI failed to generate final response. (Inner Error: ${recoverError instanceof Error ? recoverError.message : String(recoverError)})`;
        }

        if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
            return "Aapki Groq API request limit poori ho gayi hai. Kripya thodi der baad try karein. â³";
        }
        return `Groq API Error: ${errorMessage}`;
    }
}
