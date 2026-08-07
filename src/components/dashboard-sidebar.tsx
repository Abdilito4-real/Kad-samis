"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { displayIdentity } from "@/lib/displayIdentity";
import { Avatar } from "@/components/ui/avatar";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  User,
  Package,
  Wrench,
  ClipboardList,
  Users,
  Settings,
  Bell,
  Search,
  ShieldCheck,
  Landmark,
  ChevronsUpDown,
  X,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

const organizationAdminNavigationGroups: NavigationGroup[] = [
  {
    title: "Core",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Executive summary",
      },
      {
        name: "Assets",
        href: "/assets",
        icon: Package,
        description: "Registry and lifecycle",
      },
    ],
  },
  {
    title: "Governance",
    items: [
      {
        name: "Requests",
        href: "/requests",
        icon: ClipboardList,
        description: "Submit and track requests to super admin",
      },
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "Activity and alerts",
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
];

const superAdminNavigationGroups: NavigationGroup[] = [
  {
    title: "Core",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "System overview across all organizations",
      },
      {
        name: "Organizations",
        href: "/mdas",
        icon: Landmark,
        description: "Manage all MDAs and agencies",
      },
      {
        name: "Assets",
        href: "/assets",
        icon: Package,
        description: "Review assets across organizations",
      },
    ],
  },
  {
    title: "Governance",
    items: [
      {
        name: "Requests",
        href: "/requests",
        icon: ClipboardList,
        description: "Review requests from all organizations",
      },
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "New requests and system alerts",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        name: "Users",
        href: "/users",
        icon: Users,
        description: "System-wide user accounts",
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
];

const operationalManagerNavigationGroups: NavigationGroup[] = [
  {
    title: "Operations",
    items: [
      {
        name: "My Operations",
        href: "/operations",
        icon: Wrench,
        description: "Assigned maintenance and repair requests",
      },
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "New assignments and activity",
      },
      {
        name: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Account preferences",
      },
    ],
  },
];

/**
 * Role-aware nav groups — the single source of truth for "what modules can this
 * user see", shared by the sidebar itself and the command palette (Ctrl/Cmd+K).
 * Keep this in sync with the `isSuperAdmin`/`isOperationalManager` branching below.
 */
export function getNavigationGroupsForRole(roleId?: string | null): NavigationGroup[] {
  if (roleId === "super_admin") return superAdminNavigationGroups;
  if (roleId === "operational_manager") return operationalManagerNavigationGroups;
  return organizationAdminNavigationGroups;
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  agency_admin: "Agency Admin",
  ministry_admin: "Ministry Admin",
  department_head: "Department Head",
  asset_officer: "Asset Officer",
  maintenance_officer: "Maintenance Officer",
  inspector: "Inspector",
  auditor: "Auditor",
  procurement_officer: "Procurement Officer",
  finance_officer: "Finance Officer",
  operational_manager: "Operational Manager",
  read_only_user: "Read-Only User",
};

export interface DashboardSidebarProps {
  /** Whether the mobile slide-in drawer is open. Ignored at the `lg` breakpoint and up, where the sidebar is always visible. */
  mobileOpen?: boolean;
  /** Called when the drawer should close — backdrop tap, close button, or a nav link being followed. */
  onMobileClose?: () => void;
}

export function DashboardSidebar({ mobileOpen = false, onMobileClose }: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  // Real-time unread count (and the toast that comes with new notifications)
  // — see useUnreadNotifications for the realtime wiring. Applies to every
  // role, not just super admin, so org admins see their own inbox state too.
  const unreadNotificationCount = useUnreadNotifications();
  const isSuperAdmin = user?.roleId === "super_admin";
  const isOperationalManager = user?.roleId === "operational_manager";
  const activeNavigationGroups = getNavigationGroupsForRole(user?.roleId);

  const filteredGroups = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return activeNavigationGroups;
    }

    return activeNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.name} ${item.description ?? ""}`.toLowerCase().includes(value)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeNavigationGroups, query]);

  const identity = user ? displayIdentity({ email: user.email, username: user.username, role: user.roleId }) : "Account";
  const roleLabel = user?.roleId ? ROLE_LABELS[user.roleId] ?? user.roleId.replace(/_/g, " ") : "Guest";

  return (
    <>
      {/* Backdrop — mobile/tablet only, sits under the drawer and above page content */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-background px-4 py-5 transition-transform duration-200 ease-out lg:z-30 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <img
          src="/images/auth/kaduna-state.svg"
          alt="Kaduna State logo"
          className="h-10 w-10 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none">KAD-SAMIS</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSuperAdmin ? "System administration" : isOperationalManager ? "Field operations" : "Enterprise operations"}
          </p>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Signed in as</span>
        <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          {isSuperAdmin ? "Super Admin" : isOperationalManager ? "Operational Manager" : "Organization Admin"}
        </span>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground focus-within:border-primary/50">
        <Search className="h-4 w-4 shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules..."
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          Ctrl K
        </kbd>
      </label>

      <div className="mt-5 flex-1 space-y-5 overflow-y-auto pr-1">

        {filteredGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const showBadge = item.name === "Notifications" && unreadNotificationCount > 0;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-foreground/80 hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="relative flex shrink-0">
                        <Icon className="h-4 w-4" />
                        {showBadge ? (
                          <span
                            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background"
                            aria-label={`${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? "" : "s"}`}
                          />
                        ) : null}
                      </span>
                      {item.name}
                    </span>
                    {isActive ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/settings"
        onClick={onMobileClose}
        className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
      >
        <Avatar>
          <User className="h-4 w-4" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-none">{roleLabel}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{identity}</p>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
      </aside>
    </>
  );
}
