import { z } from "zod";

/**
 * AI provider settings ke shared schemas (route + future form dono ke liye).
 * Naya provider (openai/anthropic) add karna ho to yahan enum + `AI_PROVIDER_CATALOG`
 * me entry — baaki code automatic pick kar leta hai.
 */
export const aiProviderIdSchema = z.enum(["groq", "gemini"]);

export const aiProviderUpdateSchema = z
  .object({
    provider: aiProviderIdSchema,
    model: z.string().trim().min(1).max(120).optional(),
    /** Naya API key — plaintext sirf request me, DB me encrypted jaata hai. */
    apiKey: z.string().trim().min(8).max(400).optional(),
    /** Maujooda key delete karo */
    clearKey: z.boolean().optional(),
    /** Is provider ko active banao */
    isActive: z.boolean().optional(),
  })
  .refine((data) => !(data.apiKey && data.clearKey), {
    message: "apiKey aur clearKey ek saath nahi bhej sakte",
  })
  .refine((data) => data.apiKey !== undefined || data.clearKey || data.model || data.isActive, {
    message: "Kuch bhi update karne ko nahi bheja",
  });

export type AiProviderUpdateInput = z.infer<typeof aiProviderUpdateSchema>;
