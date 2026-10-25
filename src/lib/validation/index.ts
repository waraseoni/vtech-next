import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * API routes ke liye shared validation layer (Zod 4).
 *
 * Kyun: pehle routes `const body = await req.json()` + `body as { ... }` karte
 * the — TypeScript ka type assertion runtime par kuch check nahi karta, isliye
 * missing/wrong fields seedha Supabase tak jaate the.
 *
 * Design rules:
 * - `error` key purane clients ke liye hamesha rahegi (backwards-compatible).
 * - Naya `issues` key field-wise messages deta hai (UI inline errors ke liye).
 * - Har schema `src/lib/validation/schemas/*` me — route aur form dono wahi
 *   import karte hain (single source of truth, client/server drift nahi).
 */

/** `{ field: ["msg", ...] }` — UI ise seedha field ke neeche dikha sakta hai. */
export type FieldErrors = Record<string, string[]>;

export type ParseOk<T> = { ok: true; data: T };
export type ParseErr = { ok: false; response: NextResponse };
export type ParseResult<T> = ParseOk<T> | ParseErr;

/** Zod error ko flat field-wise map me badlo. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error);
  // `fieldErrors` ka type generic mapped type hai — runtime par plain object.
  const map = flat.fieldErrors as Record<string, string[] | undefined>;
  const out: FieldErrors = {};
  for (const [field, messages] of Object.entries(map)) {
    const list = (messages ?? []).filter((m): m is string => typeof m === "string" && m.length > 0);
    if (list.length > 0) out[field] = list;
  }
  // Cross-field refine() failures ka koi field nahi hota — `_form` me daalo.
  if (flat.formErrors.length > 0) out._form = flat.formErrors;
  return out;
}

/**
 * Standard 400. Purana client sirf `error` padhta hai, naya `issues` bhi.
 * `issues` tabhi add hota hai jab field-wise messages hon (noise se bachne ke liye).
 */
export function badRequest(message: string, issues?: FieldErrors): NextResponse {
  const hasIssues = issues && Object.keys(issues).length > 0;
  return NextResponse.json(hasIssues ? { error: message, issues } : { error: message }, {
    status: 400,
  });
}

/** Already-parsed value ko schema se validate karo (forms/server actions ke liye). */
export function parseData<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: badRequest("Input valid nahi hai", fieldErrors(parsed.error)) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Request body parse + validate.
 *
 * ```ts
 * const parsed = await parseBody(locationCreateSchema, request);
 * if (!parsed.ok) return parsed.response;
 * // parsed.data ab fully typed + runtime-validated hai
 * ```
 */
export async function parseBody<T>(
  schema: z.ZodType<T>,
  request: Request
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest("Request body valid JSON nahi hai") };
  }
  return parseData(schema, raw);
}
