import { z } from "zod";

/**
 * Admin geofence permit (staff ko office ke bahar write karne ki temporary
 * permission). Route pehle `Number(body.minutes) || 60` karta tha — ab schema
 * wahi bounds (5 min – 72 ghante) enforce karta hai.
 */
export const geofencePermitCreateSchema = z.object({
  user_id: z.string().uuid("user_id valid UUID chahiye"),
  mechanic_id: z.number().int().positive().nullable().optional(),
  minutes: z.number().int().min(5).max(4320).default(60),
  reason: z.string().trim().max(500).optional().nullable(),
});
export type GeofencePermitCreatePayload = z.infer<typeof geofencePermitCreateSchema>;

/** `DELETE /api/admin/geofence-permit?id=...` — query param. */
export const geofencePermitDeleteQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
  user_id: z.string().uuid().optional(),
});
export type GeofencePermitDeleteQuery = z.infer<typeof geofencePermitDeleteQuerySchema>;
