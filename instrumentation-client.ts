// Sentry's client (browser) init. This filename/location is a Next.js
// convention (auto-loaded, no import needed anywhere) — NOT
// `sentry.client.config.ts`, which @sentry/nextjs's Next 15 integration
// explicitly deprecates and which stops working under Turbopack (the dev
// server this project actually runs). See
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client

import * as Sentry from "@sentry/nextjs";

// No DSN configured yet — Sentry.init() with an empty dsn is a documented
// no-op, so this stays safe to import in every environment (local dev,
// CI, a fresh clone) without an account. Create a free project at
// sentry.io, then set NEXT_PUBLIC_SENTRY_DSN in your environment (Vercel
// project settings, not committed here) to turn this on. Public because
// the client bundle needs it — a Sentry DSN is a write-only ingest
// endpoint, not a secret credential.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Percentage of transactions captured for performance monitoring. 1.0
  // (100%) is fine at low traffic; turn this down once real usage picks
  // up so you don't burn through the free-tier event quota.
  tracesSampleRate: 1.0,

  // Session Replay is deliberately NOT enabled here — it's the heaviest
  // part of the SDK's client bundle (tens of KB) for a feature that
  // wasn't asked for. Add `replaysSessionSampleRate`/
  // `replaysOnErrorSampleRate` back (and re-check the bundle size impact)
  // if you actually want session recordings on error, not just
  // exceptions + performance traces.

  // Before this ever leaves the browser: strip anything that looks like a
  // token/secret from the event, mirroring src/lib/logger.ts's redaction
  // — belt-and-braces in case a raw object with a sensitive key slips into
  // an exception's extra context somewhere.
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["Cookie"];
    }
    return event;
  },
});

// Required export for this file's location/name to actually instrument
// client-side route changes (App Router navigations) as Sentry
// performance transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
