"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarInitials } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayIdentity } from "@/lib/displayIdentity";
import { ROLE_LABELS } from "@/components/dashboard-sidebar";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import {
  Bell,
  CalendarDays,
  Command,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Circle,
  Building2,
} from "lucide-react";

interface DashboardHeaderProps {
  onOpenCommandPalette: () => void;
  /** Opens the mobile navigation drawer. Omit to hide the hamburger trigger (e.g. on pages that render their own). */
  onOpenMobileMenu?: () => void;
}

export function DashboardHeader({ onOpenCommandPalette, onOpenMobileMenu }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Real-time unread count (and the "new request"/"new assignment" etc. toast
  // that goes with it) — see useUnreadNotifications for the realtime wiring.
  const unreadNotificationCount = useUnreadNotifications();

  const identity = user
    ? displayIdentity({ email: user.email, username: user.username, role: user.roleId })
    : "Account";
  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : identity;
  const roleLabel = user?.roleId ? ROLE_LABELS[user.roleId] ?? user.roleId.replace(/_/g, " ") : "Guest";

  useEffect(() => {
    setMounted(true);
  }, []);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const crumbs = segments.map((segment, index) => ({
      label: segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      href: `/${segments.slice(0, index + 1).join("/")}`,
    }));

    if (!crumbs.length) {
      return [{ label: "Dashboard", href: "/dashboard" }];
    }

    return [{ label: "Dashboard", href: "/dashboard" }, ...crumbs];
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  const orgId = searchParams.get("orgId");
  const orgName = searchParams.get("orgName");
  const quickAccessHref = orgId
    ? `/dashboard?orgId=${encodeURIComponent(orgId)}&orgName=${encodeURIComponent(orgName ?? "Organization")}`
    : "/mdas";

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-NG", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date()),
    []
  );

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          {onOpenMobileMenu ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation menu"
              className="mt-0.5 shrink-0 lg:hidden"
              onClick={onOpenMobileMenu}
            >
              <Menu className="h-4 w-4" />
            </Button>
          ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.href}-${index}`} className="flex items-center gap-2">
                {index > 0 ? <span className="text-muted-foreground/50">/</span> : null}
                <span className={index === breadcrumbs.length - 1 ? "font-semibold text-primary" : ""}>
                  {crumb.label}
                </span>
              </div>
            ))}
          </div>
          {/* Status pills — hidden below sm, where three wrapping pills next to
              breadcrumbs just ate the row; still useful once there's room. */}
          <div className="hidden flex-wrap items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1">
              <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
              Online
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {todayLabel}
            </span>
            <span className="rounded-full border border-border bg-background/70 px-2.5 py-1">
              {user?.firstName ?? "Government staff"}
            </span>
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Icon-only on mobile — the old "Quick search" trigger was hidden
              below `sm` with nothing replacing it, so the command palette
              was unreachable from the header on phones. */}
          <Button
            variant="outline"
            size="icon-lg"
            aria-label="Search"
            className="sm:hidden"
            onClick={onOpenCommandPalette}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={onOpenCommandPalette}
          >
            <Command className="mr-2 h-4 w-4" />
            Quick search
          </Button>
          {isSuperAdmin && (
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href={quickAccessHref}>
                <Building2 className="mr-2 h-4 w-4" />
                {orgId ? `Open ${orgName ?? "MDA"}` : "Open MDAs"}
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Link href="/notifications" className="relative flex items-center justify-center">
              <Bell className="h-4 w-4" />
              {unreadNotificationCount > 0 ? (
                <span
                  className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
                  aria-label={`${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? "" : "s"}`}
                />
              ) : null}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex h-12 items-center gap-2 rounded-full border border-border bg-background/70 py-1 pl-1 pr-2 transition hover:border-primary/40 sm:pr-3"
              >
                <Avatar className="h-8 w-8">
                  <AvatarInitials name={displayName} />
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{roleLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="normal-case">
                <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
                <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{identity}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  // Keep the menu open — flipping the theme shouldn't dismiss it.
                  event.preventDefault();
                  setTheme(theme === "dark" ? "light" : "dark");
                }}
              >
                {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
