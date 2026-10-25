import { z } from "zod";

/**
 * Messaging side-effects ke payloads (`/api/messages/push`, `/api/media/delete`).
 * Dono geo-exempt hain (staff bahar bhi message/media delete kar sakta hai) —
 * validation yahan bhi mandatory hai kyunki data Supabase/storage tak jaata hai.
 */

/** `POST /api/messages/push` — recipient + non-empty content. */
export const messagePushSchema = z.object({
  recipientId: z.string().min(1, "recipientId required"),
  senderName: z.string().trim().max(120).optional().nullable(),
  content: z.string().trim().min(1, "content required").max(4000),
});
export type MessagePushPayload = z.infer<typeof messagePushSchema>;

/** `POST /api/media/delete` — storage paths (max 50 per call). */
export const mediaDeleteSchema = z.object({
  paths: z.array(z.string().min(1)).min(1, "paths required").max(50),
});
export type MediaDeletePayload = z.infer<typeof mediaDeleteSchema>;
