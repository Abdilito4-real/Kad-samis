/**
 * Centralized, safe logging. Two things this exists to prevent:
 *
 * 1. Secrets/PII ending up in logs at all — every value passed as context
 *    is run through `redact()` first, which strips anything shaped like a
 *    token/password/key by key name, regardless of who wrote the call site
 *    or what they meant to log.
 * 2. Verbose diagnostic output surviving into production — `debug()` is a
 *    dev-only no-op in prod, and `error()`/`warn()` print a short message
 *    server-side (useful in Vercel's function logs) rather than dumping
 *    full request/response payloads, while still forwarding the real
 *    exception to Sentry when it's configured (see sentry.*.config.ts) so
 *    nothing is actually lost — it just doesn't sit in plaintext console
 *    output.
 */

const SENSITIVE_KEY_PATTERN =
  /token|password|secret|apikey|api_key|authorization|auth_header|cookie|service_role|jwt|refresh_token|access_token/i;

const isProd = process.env.NODE_ENV === "production";

/** Deep-clones `value`, replacing any property whose key looks sensitive with "[REDACTED]". */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redact(val, depth + 1);
    }
    return out;
  }

  return value;
}

function sentryCaptureException(error: unknown, context?: Record<string, unknown>) {
  // Fire-and-forget: logger.error() is called synchronously from catch
  // blocks all over the app and shouldn't block on network I/O to Sentry.
  // Sentry.init() with no DSN configured is a documented no-op, so this is
  // safe to call unconditionally rather than checking for a DSN first.
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, context ? { extra: redact(context) as Record<string, unknown> } : undefined);
    })
    .catch(() => {
      // @sentry/nextjs not installed — nothing to forward to.
    });
}

export const logger = {
  /** Dev-only verbose logging — never runs in production, so it's safe to be as chatty as you want. */
  debug(message: string, context?: Record<string, unknown>) {
    if (isProd) return;
    // eslint-disable-next-line no-console
    console.debug(`[debug] ${message}`, context ? redact(context) : "");
  },

  /** Recoverable/expected problems (a lookup came back empty, a non-critical write failed). */
  warn(message: string, context?: Record<string, unknown>) {
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${message}`, context ? redact(context) : "");
  },

  /** Unexpected failures. Always forwarded to Sentry (once configured); console output is a short, redacted summary. */
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const summary = error instanceof Error ? error.message : error ? String(error) : undefined;
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}`, summary ?? "", context ? redact(context) : "");
    sentryCaptureException(error ?? new Error(message), { message, ...context });
  },
};
