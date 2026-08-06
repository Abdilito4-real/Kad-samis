import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight avatar — this app only ever renders initials (no profile photo
 * upload exists), so unlike shadcn's default this deliberately skips
 * `@radix-ui/react-avatar` (not an installed dependency) rather than adding
 * a new package for image-load/fallback states nothing here needs yet.
 * Replaces the manual initials-circle markup duplicated in
 * `dashboard-sidebar.tsx`.
 */
const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/50 bg-primary/10 text-xs font-semibold text-primary",
        className
      )}
      {...props}
    />
  )
);
Avatar.displayName = "Avatar";

interface AvatarInitialsProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name or identity string — the first letters of up to the first two words are shown. */
  name: string;
}

const AvatarInitials = React.forwardRef<HTMLSpanElement, AvatarInitialsProps>(
  ({ className, name, ...props }, ref) => {
    const initials = getInitials(name);
    return (
      <span ref={ref} className={cn("select-none", className)} {...props}>
        {initials}
      </span>
    );
  }
);
AvatarInitials.displayName = "AvatarInitials";

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export { Avatar, AvatarInitials, getInitials };
