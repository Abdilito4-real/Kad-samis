import * as React from "react";
import { cn } from "@/lib/utils";

type ColCount = 1 | 2 | 3 | 4 | 5 | 6;

interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Column count at each breakpoint. Mobile-first — omitted breakpoints
   * inherit the previous one, same as writing the Tailwind classes by hand.
   * Defaults match the stat-card pattern already used across the app
   * (`grid gap-4 md:grid-cols-2 xl:grid-cols-4`).
   */
  cols?: Partial<Record<"base" | "sm" | "md" | "lg" | "xl", ColCount>>;
  /** Gap in the app's 8pt scale (Tailwind `gap-*` steps). Defaults to 4 (16px). */
  gap?: 2 | 3 | 4 | 6 | 8;
}

// Static lookup tables so Tailwind's content scanner can see every class
// literally — building class names with string interpolation (e.g.
// `md:grid-cols-${n}`) would get purged from the production build.
const BASE_COLS: Record<ColCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};
const SM_COLS: Record<ColCount, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};
const MD_COLS: Record<ColCount, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};
const LG_COLS: Record<ColCount, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};
const XL_COLS: Record<ColCount, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};
const GAP: Record<number, string> = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

const ResponsiveGrid = React.forwardRef<HTMLDivElement, ResponsiveGridProps>(
  ({ className, cols, gap = 4, children, ...props }, ref) => {
    const { base = 1, sm, md = 2, lg, xl = 4 } = cols ?? {};

    return (
      <div
        ref={ref}
        className={cn(
          "grid",
          GAP[gap],
          BASE_COLS[base],
          sm && SM_COLS[sm],
          MD_COLS[md],
          lg && LG_COLS[lg],
          xl && XL_COLS[xl],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ResponsiveGrid.displayName = "ResponsiveGrid";

export { ResponsiveGrid };
