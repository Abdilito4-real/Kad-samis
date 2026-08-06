"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_ORDER = ["assigned", "monitoring", "in_progress", "completed"] as const;
export type Stage = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<Stage, string> = {
  assigned: "Assigned",
  monitoring: "Monitoring",
  in_progress: "Repair In Progress",
  completed: "Completed",
};

interface StageProgressBarProps {
  currentStage: Stage | null | undefined;
  /** Compact drops the text labels — for tight spaces like a list row. */
  size?: "default" | "compact";
  className?: string;
}

export function StageProgressBar({ currentStage, size = "default", className }: StageProgressBarProps) {
  const currentIndex = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;

  return (
    <div className={cn("flex w-full items-center", className)}>
      {STAGE_ORDER.map((stage, index) => {
        const isComplete = index < currentIndex || (currentStage === "completed" && index <= currentIndex);
        const isCurrent = index === currentIndex && currentStage !== "completed";
        const isLast = index === STAGE_ORDER.length - 1;

        return (
          <div key={stage} className={cn("flex items-center", isLast ? "flex-none" : "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  size === "compact" ? "h-4 w-4" : "h-6 w-6",
                  isComplete
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : isCurrent
                      ? "border-emerald-500 bg-background text-emerald-600"
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                )}
                aria-label={`${STAGE_LABELS[stage]}${isComplete ? " (done)" : isCurrent ? " (current)" : ""}`}
              >
                {isComplete ? (
                  <Check className={size === "compact" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} />
                ) : (
                  <span className={cn("rounded-full bg-current", size === "compact" ? "h-1.5 w-1.5" : "h-2 w-2")} />
                )}
              </div>
              {size !== "compact" && (
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] sm:text-xs",
                    isComplete || isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {STAGE_LABELS[stage]}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-1 h-0.5 flex-1",
                  index < currentIndex || (currentStage === "completed" && index < STAGE_ORDER.length - 1)
                    ? "bg-emerald-500"
                    : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
