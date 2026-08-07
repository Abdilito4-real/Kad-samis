// Next.js instrumentation hook — runs once when the server starts, before
// any route handles a request. Used here to load the right Sentry config
// for whichever runtime this process actually is (Node vs Edge), per
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
