import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Generic pulsing placeholder primitive. Compose it into shape-specific
 * loading states (a text line, an avatar circle, a card, a list row) instead
 * of each page hand-rolling its own `animate-pulse` div or spinner.
 *
 * Example — a list row skeleton:
 *   <div className="flex items-center gap-3">
 *     <Skeleton className="h-10 w-10 rounded-full" />
 *     <div className="flex-1 space-y-2">
 *       <Skeleton className="h-4 w-1/3" />
 *       <Skeleton className="h-3 w-1/2" />
 *     </div>
 *   </div>
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
      {...props}
    />
  );
}

export { Skeleton };
