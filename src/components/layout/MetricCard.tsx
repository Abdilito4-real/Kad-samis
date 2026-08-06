import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "emerald" | "sky" | "amber" | "violet" | "rose";

const TONE_STYLES: Record<Tone, { chip: string; icon: string }> = {
  neutral: { chip: "bg-slate-500/10", icon: "text-slate-500" },
  emerald: { chip: "bg-emerald-500/10", icon: "text-emerald-500" },
  sky: { chip: "bg-sky-500/10", icon: "text-sky-500" },
  amber: { chip: "bg-amber-500/10", icon: "text-amber-600" },
  violet: { chip: "bg-violet-500/10", icon: "text-violet-500" },
  rose: { chip: "bg-rose-500/10", icon: "text-rose-500" },
};

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: Tone;
  /** Small supporting line under the value, e.g. "12 pending review". */
  detail?: React.ReactNode;
  /** Optional trailing slot, e.g. a sparkline or a trend badge. */
  trailing?: React.ReactNode;
}

/**
 * Generalizes the stat-card markup duplicated across dashboard, assets,
 * mdas, transfers, facilities, inspections, users and settings (all of which
 * already share the same `grid gap-4 md:grid-cols-2 xl:grid-cols-{3,4,6}`
 * shape) — pair with `ResponsiveGrid` for the surrounding layout.
 */
const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, title, value, icon: Icon, tone = "neutral", detail, trailing, ...props }, ref) => {
    const styles = TONE_STYLES[tone];

    return (
      <Card ref={ref} className={cn("flex h-full flex-col overflow-hidden", className)} {...props}>
        <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted-foreground">
              {title}
            </p>
            {Icon ? (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  styles.chip,
                  styles.icon
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
          </div>

          <div className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</div>

          {detail ? <p className="line-clamp-2 text-sm text-muted-foreground">{detail}</p> : null}

          {trailing ? <div className="mt-auto pt-1">{trailing}</div> : null}
        </CardContent>
      </Card>
    );
  }
);
MetricCard.displayName = "MetricCard";

export { MetricCard };
