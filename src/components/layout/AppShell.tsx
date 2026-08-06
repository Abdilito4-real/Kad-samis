"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { Bell, Home, Package, Settings, Wrench, type LucideIcon } from "lucide-react";

interface BottomNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// Same 4-slot bottom tab bar every route previously duplicated verbatim.
const DEFAULT_BOTTOM_NAV: BottomNavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Alerts", href: "/notifications", icon: Bell },
  { name: "System", href: "/settings", icon: Settings },
];

// operational_manager accounts don't use /assets directly — mirrors the one
// layout (operations/layout.tsx) that previously carried its own array.
const OPERATIONAL_MANAGER_BOTTOM_NAV: BottomNavItem[] = [
  { name: "Operations", href: "/operations", icon: Wrench },
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Alerts", href: "/notifications", icon: Bell },
  { name: "System", href: "/settings", icon: Settings },
];

function getBottomNavForRole(roleId?: string | null): BottomNavItem[] {
  if (roleId === "operational_manager") return OPERATIONAL_MANAGER_BOTTOM_NAV;
  return DEFAULT_BOTTOM_NAV;
}

/**
 * The shell every authenticated route renders: sidebar + header + main +
 * mobile bottom tab bar + command palette. Previously copy-pasted (~65
 * lines each, byte-for-byte identical bar one padding regression and one
 * role-specific bottom-nav array) across all 11 route-group layout.tsx
 * files — now a single component each of them wraps `{children}` in.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  const bottomNav = getBottomNavForRole(user?.roleId);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50/70 text-foreground transition-colors dark:bg-background dark:bg-none">
        <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex flex-1 flex-col lg:ml-72">
          <DashboardHeader
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
          />
          <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.96))] p-4 sm:p-6 lg:p-8 dark:bg-background dark:bg-none">
            {children}
            <div className="h-20 lg:hidden" aria-hidden />
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
            <div className="grid grid-cols-4 gap-1 px-2 py-2">
              {bottomNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      // min-h-12 (48px) — the row was already close to this via padding,
                      // made explicit so it reliably meets the touch-target minimum.
                      "flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] font-medium",
                      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Icon className="mb-1 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </ProtectedRoute>
  );
}
