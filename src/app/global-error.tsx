"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Catches errors thrown from the root layout itself — src/app/error.tsx
 * can't (a route segment's error boundary is a sibling of that segment's
 * layout, not a wrapper around the root one). Replaces the entire document
 * when triggered, so unlike every other page in this app it renders its
 * own <html>/<body> rather than relying on layout.tsx's — this is the one
 * place that's unavoidable.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Root layout render error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-2xl">
            <h1 className="text-3xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              The application failed to load. Reloading usually resolves this.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
