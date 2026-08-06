import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * Consolidates the "space-y-3 list of Card rows, each with a responsive
 * detail grid" pattern already used (independently, with duplicated markup)
 * across RequestHistory, operations, transfers, facilities, inspections and
 * users pages. Not a table→card conversion (none of those pages ever used a
 * `<table>`) — this just gives that already-correct shape one shared
 * implementation with consistent spacing and touch targets.
 *
 *   <ResponsiveList>
 *     <ResponsiveListRow onClick={...}>
 *       <div className="flex items-start justify-between gap-3">
 *         <p className="font-medium">{title}</p>
 *         <Badge>{status}</Badge>
 *       </div>
 *       <ResponsiveListDetailGrid cols={3}>
 *         <ResponsiveListField label="Organization" value={org} />
 *         <ResponsiveListField label="Assigned to" value={assignee} />
 *         <ResponsiveListField label="Updated" value={updatedAt} />
 *       </ResponsiveListDetailGrid>
 *     </ResponsiveListRow>
 *   </ResponsiveList>
 */
const ResponsiveList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="list" className={cn("space-y-3", className)} {...props} />
  )
);
ResponsiveList.displayName = "ResponsiveList";

interface ResponsiveListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Renders as a `<button>` with hover/focus affordance when provided, matching a `<div>` otherwise. */
  onClick?: () => void;
}

const ResponsiveListRow = React.forwardRef<HTMLDivElement, ResponsiveListRowProps>(
  ({ className, onClick, children, ...props }, ref) => {
    const interactive = Boolean(onClick);

    return (
      <Card
        ref={ref}
        role="listitem"
        // min-h-12 (48px) satisfies the touch-target minimum for the row itself
        // when it's the clickable unit (e.g. navigate-to-detail rows).
        className={cn(
          "min-h-12 p-4 transition-colors",
          interactive && "cursor-pointer hover:border-primary/40 hover:bg-accent/40",
          className
        )}
        {...(interactive
          ? {
              onClick,
              role: "button",
              tabIndex: 0,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onClick?.();
                }
              },
            }
          : {})}
        {...props}
      >
        <div className="space-y-3">{children}</div>
      </Card>
    );
  }
);
ResponsiveListRow.displayName = "ResponsiveListRow";

const DETAIL_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

interface ResponsiveListDetailGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4;
}

const ResponsiveListDetailGrid = React.forwardRef<HTMLDivElement, ResponsiveListDetailGridProps>(
  ({ className, cols = 3, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid grid-cols-1 gap-3 text-sm", DETAIL_COLS[cols], className)}
      {...props}
    />
  )
);
ResponsiveListDetailGrid.displayName = "ResponsiveListDetailGrid";

interface ResponsiveListFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
}

const ResponsiveListField = React.forwardRef<HTMLDivElement, ResponsiveListFieldProps>(
  ({ className, label, value, ...props }, ref) => (
    <div ref={ref} className={cn("min-w-0", className)} {...props}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground">{value}</dd>
    </div>
  )
);
ResponsiveListField.displayName = "ResponsiveListField";

export { ResponsiveList, ResponsiveListRow, ResponsiveListDetailGrid, ResponsiveListField };
