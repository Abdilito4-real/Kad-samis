# Security

This document tracks what's actually implemented, what still needs an account
you create yourself, and what's deliberately left to the hosting platform
rather than this codebase. Update it whenever the security posture changes —
it's meant to stay accurate, not be a one-time snapshot.

## Implemented in this repo

### Rate limiting — `src/lib/rate-limit.ts`
Redis-backed (Upstash) when configured, with a single-process in-memory
fallback otherwise. **The in-memory fallback does not share state across
Vercel's serverless instances** — each invocation gets its own memory, so it
only actually limits anything on a traditional long-running server or in
local dev. Configure `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
(free tier at [upstash.com](https://upstash.com)) before relying on this in
production on Vercel.

Applied so far to: `send-password-reset`, `create-organization`, `profiles`
(user creation), and the assets bulk-import endpoint. Extending it to
another route is three lines — `checkRateLimit(bucket, identifier)` then
`rateLimitResponse(result)` if it fails. The remaining write endpoints
(`requests`, `check-user-org`, etc.) don't have it yet.

**Login and the public "forgot password" flow are not rate-limited here** —
both call Supabase Auth directly from the browser (`supabase.auth.
signInWithPassword` / `resetPasswordForEmail`), never touching this app's
server. Supabase's own GoTrue service has built-in rate limiting for both;
there's no app-level route in that path to add a limiter to.

### Caching
`GET /api/admin/asset-categories` sends `Cache-Control: public, max-age=300,
stale-while-revalidate=3600` — categories are shared, non-sensitive, rarely-
changing reference data (see `018_asset_categories_rls_select.sql`). No other
endpoint is cached: everything else returns organization- or user-scoped
data, where the correct behavior is "always fetch fresh," not stale reads
serving one tenant's cached response to another.

### No sensitive data in logs — `src/lib/logger.ts`
`logger.error/warn/debug()` redacts anything shaped like a token, password,
secret, or auth header by key name before it's ever printed, and `debug()`
is a no-op outside development. Real exceptions still reach Sentry (once
configured) via `logger.error()` — nothing is silently lost, it just doesn't
sit in plaintext console output.

Also fixed as part of this pass:
- Deleted `api/admin/debug-assets` and `api/admin/debug-profile` — leftover
  diagnostic routes with no auth gate. `debug-assets` in particular returned
  the 5 most recent assets **across every organization** to any
  authenticated caller regardless of role — an access-control bug, not just
  a logging one.
- `auth/reset-password` no longer logs `window.location.hash` — that's the
  raw Supabase recovery link fragment, i.e. the actual reset token, in
  plaintext in the browser console.
- Stripped verbose diagnostic dumps (`supabaseUrl`, service-role usage
  flags, a redundant duplicate query made only for logging) from
  `api/admin/asset-categories`.

Not yet swept: most of the remaining ~25 API route files still call
`console.error(message, error)` directly with a Supabase error object.
Those are low-risk (Supabase errors are just `{message, code, details}`,
not raw secrets) but not routed through the redacting logger yet — worth
finishing as a follow-up, not urgent.

### Input validation — `src/lib/validation.ts`
`parseJsonBody(req, zodSchema)` replaces `await req.json()` + using fields
directly. Applied to `create-organization` (previously had **zero**
validation — arbitrary strings went straight into an insert and into
`auth.admin.createUser`). `profiles` (user creation) already had reasonable
manual checks and was left as-is. The asset CSV import already has its own
thorough per-row validation (`src/lib/assetImport.ts`) predating this pass.
Most other write routes don't use `parseJsonBody` yet — same "pattern
established, not yet applied everywhere" situation as rate limiting.

### Security headers — `next.config.ts`
Applied to every route: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a
`Content-Security-Policy`. The CSP still allows `'unsafe-inline'`/
`'unsafe-eval'` for scripts (Next's hydration bootstrap and Tailwind/
Radix's inline styles need it) — it blocks loading scripts from or sending
data to any origin other than this app, Supabase, and Sentry, which is the
actual injection vector a text-input XSS would try to use. A stricter
nonce-based policy is possible but a larger, separate change.

### Error tracking / performance monitoring — Sentry
`sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.
config.ts` / `instrumentation.ts`. **Inert until you set
`NEXT_PUBLIC_SENTRY_DSN`** (free account at [sentry.io](https://sentry.io) —
`Sentry.init()` with no DSN is a documented no-op, so nothing breaks before
then). `beforeSend` hooks strip auth headers/cookies and token-shaped body
fields before an event ever leaves the process.

### Dependency vulnerability scanning
`.github/workflows/security-audit.yml` — blocks on any **critical**
`npm audit` finding, surfaces high/moderate ones without blocking (see
"Known accepted risk" below for why). Runs on push, PR, and a weekly cron
so newly-disclosed CVEs get caught even when nothing changed.
`.github/dependabot.yml` adds weekly PRs for outdated packages.

### Scheduled database backups
`.github/workflows/db-backup.yml` — nightly `pg_dump`, kept as a GitHub
Actions artifact (90-day retention). Needs a `SUPABASE_DB_URL` repo secret
(Supabase Dashboard → Project Settings → Database → Connection string) —
**not set yet**, the workflow will fail with a clear error until it is.
Only relevant if you're on Supabase's free tier — Pro and above already
include daily backups + Point-in-Time-Recovery, making this redundant.

### Dependencies — critical RCE fixed, two residual items accepted
`npm audit` went from 9 findings (1 **critical** — RCE in the React Flight
protocol — plus 5 high) down to 4 (2 low, 1 moderate, 1 high) via `npm audit
fix` (patched Next.js within its existing `^15.5.4` range) plus targeted
`overrides` for `uuid` and `sharp`. Two remain, both requiring a major-
version bump big enough to need its own dedicated testing pass rather than
being forced through as a side effect of this work:

- **`postcss` inside Next.js's own bundled build tooling** (high) — only
  fixable by upgrading Next 15→16. Real-world exploitability for this app
  specifically is low: the vulnerable code path processes this project's
  own trusted, developer-authored CSS at build time, never
  attacker-controlled runtime input.
- **`@supabase/ssr` pinned at `0.0.10`** (moderate, via an old `cookie`
  dependency) — this package has had many releases since; bumping it means
  re-verifying the entire session/cookie auth flow this app depends on
  end-to-end, not a drop-in patch.

## Needs your own account — can't be done from this repo

| Item | Where | Status |
|---|---|---|
| Rate limiting storage | [upstash.com](https://upstash.com) free tier | Not configured — falls back to in-memory (see caveat above) |
| Error/performance monitoring | [sentry.io](https://sentry.io) free tier | Not configured — SDK installed and wired, inert until DSN is set |
| DB backup destination | GitHub Actions secret `SUPABASE_DB_URL` | Not set — workflow will fail until it is |

## Infrastructure-level — not app code at all

These were asked for but genuinely can't be "turned on" from inside this
repository — they're properties of where the app is hosted, not of the
code:

- **HTTPS/TLS termination** — Vercel provisions and renews this
  automatically for any domain attached to the project; there's no
  in-app toggle. If self-hosting instead, TLS termination is your
  reverse proxy's job (nginx, Caddy, a load balancer).
- **WAF (Web Application Firewall)** — blocks attacks (SQLi patterns, bot
  traffic, volumetric abuse) *before* a request ever reaches this app's
  code, which is exactly why it can't be implemented in this app's code.
  Vercel includes baseline DDoS mitigation on every plan; for a real WAF
  layer, put [Cloudflare](https://cloudflare.com) (free tier available) in
  front of the domain, or use Vercel's paid Firewall/Attack Challenge Mode.
  The security headers and input validation in this repo are complementary
  to a WAF, not a substitute for one — they protect against what gets
  through once a request arrives; a WAF stops volumetric/bot traffic that
  never should have reached the app at all.
