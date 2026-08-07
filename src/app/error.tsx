"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { logger } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Route-level render error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.16),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-4 dark:bg-background dark:bg-none">
      <div className="w-full max-w-lg rounded-[32px] border border-border bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A workflow interruption occurred. Retry to refresh the current view or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
