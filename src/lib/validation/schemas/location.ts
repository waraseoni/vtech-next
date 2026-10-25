import { z } from "zod";

/**
 * Physical location naming (zone > rack > bin > box) ke payload schemas.
 * Legacy rows me empty string / null dono aa sakte hain — isliye name fields
 * optional + nullable hain, route apni tarah `|| null` normalize karta hai.
 */

const optionalName = z.string().trim().max(120).optional().nullable();
const optionalId = z.number().int().positive().optional().nullable();

/** `POST /api/locations` — naya location row. */
export const locationCreateSchema = z.object({
  zone: optionalName,
  rack: optionalName,
  bin: optionalName,
  box: optionalName,
  label: z.string().trim().max(200).optional().nullable(),
  zone_id: optionalId,
  rack_id: optionalId,
  bin_id: optionalId,
  box_id: optionalId,
});
export type LocationCreatePayload = z.infer<typeof locationCreateSchema>;

/** `PUT /api/locations` — edit (id mandatory). */
export const locationUpdateSchema = locationCreateSchema.extend({
  id: z.number().int().positive("id required"),
});
export type LocationUpdatePayload = z.infer<typeof locationUpdateSchema>;

/** `PATCH /api/locations` — soft delete / status toggle. */
export const locationPatchSchema = z.object({
  id: z.number().int().positive("id required"),
  delete_flag: z.number().int().min(0).max(1).optional(),
  status: z.number().int().optional(),
});
export type LocationPatchPayload = z.infer<typeof locationPatchSchema>;

/** `POST|PUT|PATCH /api/locations/manage` — hierarchy CRUD. */
export const locationEntities = ["zones", "racks", "bins", "boxes"] as const;
export const locationEntitySchema = z.enum(locationEntities);
export type LocationEntity = z.infer<typeof locationEntitySchema>;

export const locationManageCreateSchema = z.object({
  tab: locationEntitySchema,
  name: z.string().trim().min(1, "Name required").max(120),
  parent_id: z.number().int().positive().optional().nullable(),
});
export type LocationManageCreatePayload = z.infer<typeof locationManageCreateSchema>;

export const locationManageUpdateSchema = z.object({
  tab: locationEntitySchema,
  id: z.number().int().positive(),
  name: z.string().trim().min(1, "Name required").max(120),
  parent_id: z.number().int().positive().optional().nullable(),
});
export type LocationManageUpdatePayload = z.infer<typeof locationManageUpdateSchema>;

export const locationManagePatchSchema = z.object({
  tab: locationEntitySchema,
  id: z.number().int().positive(),
  delete_flag: z.number().int().min(0).max(1).optional(),
  status: z.number().int().optional(),
});
export type LocationManagePatchPayload = z.infer<typeof locationManagePatchSchema>;

/** `POST /api/locations/assign` — product ka spot (box/label hierarchy). */
export const locationAssignSchema = z.object({
  product_id: z.number().int().positive("product_id required"),
  zone: z.string().trim().max(120).optional().nullable(),
  rack: z.string().trim().max(120).optional().nullable(),
  bin: z.string().trim().max(120).optional().nullable(),
  box: z.string().trim().max(120).optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
});
export type LocationAssignPayload = z.infer<typeof locationAssignSchema>;
