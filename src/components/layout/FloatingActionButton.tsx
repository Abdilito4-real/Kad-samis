import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
}

/**
 * Mobile-only primary action button (e.g. "New Asset", "New Request").
 * Desktop keeps the existing inline header "New" buttons — this only
 * appears below `lg`, sitting above the bottom tab bar.
 */
const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(
  ({ className, icon: Icon, label, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 lg:hidden",
        className
      )}
      {...props}
    >
      <Icon className="h-6 w-6" />
    </button>
  )
);
FloatingActionButton.displayName = "FloatingActionButton";

export { FloatingActionButton };
