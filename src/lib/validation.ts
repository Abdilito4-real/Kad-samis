import { NextResponse } from "next/server";
import { z, type ZodSchema } from "zod";

/**
 * Parses and validates a request body against `schema` in one step. Every
 * mutating API route should go through this instead of using `await
 * req.json()` fields directly — it's the difference between "whatever
 * shape the caller felt like sending" and a checked, typed payload, and
 * it's what actually stops malformed/malicious input (oversized strings,
 * wrong types, unexpected fields) from reaching a database query.
 *
 * Returns a discriminated result rather than throwing, so callers write:
 *   const parsed = await parseJsonBody(req, schema);
 *   if ("error" in parsed) return parsed.error;
 *   const body = parsed.data; // fully typed
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid request", details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }

  return { data: result.data };
}

// --- Reusable field schemas ---------------------------------------------
// Building blocks for route-specific schemas below. Keeping these in one
// place means "what's a valid email/name/phone in this app" is answered
// once, not redefined slightly differently in every route file.

/** Trimmed, length-capped free text — the default for any user-typed field that isn't email/uuid/enum. */
export function safeText(maxLength: number, minLength = 1) {
  return z.string().trim().min(minLength).max(maxLength);
}

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Supabase auth requires 6+ characters minimum; this app's admin-created accounts should meet a real bar, not just Supabase's floor. */
export const passwordSchema = z.string().min(8).max(128);

export const uuidSchema = z.string().uuid();

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9+()\-.\s]*$/, "Phone number contains invalid characters")
  .optional()
  .or(z.literal(""));
