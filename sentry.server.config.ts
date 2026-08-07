// This file configures the initialization of Sentry on the server (Node.js runtime — API routes, server components).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // Server-side DSN can reuse the public one — see sentry.client.config.ts
  // for why an unconfigured DSN is a safe no-op rather than a startup error.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  // Server-side events are far more likely to carry request bodies,
  // headers, or DB rows in their context than client-side ones — strip
  // anything sensitive before it leaves this process.
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["Authorization"];
      delete event.request.headers["cookie"];
      delete event.request.headers["Cookie"];
    }
    if (event.request?.data && typeof event.request.data === "object") {
      const data = event.request.data as Record<string, unknown>;
      for (const key of Object.keys(data)) {
        if (/token|password|secret|key/i.test(key)) delete data[key];
      }
    }
    return event;
  },
});
