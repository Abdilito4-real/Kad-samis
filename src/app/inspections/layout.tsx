"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { cn } from "@/lib/utils";
import { Bell, Home, Package, Settings } from "lucide-react";

const mobileNavigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Assets", href: "/assets", icon: Package },
  { name: "Alerts", href: "/notifications", icon: Bell },
  { name: "System", href: "/settings", icon: Settings },
];

export default function InspectionsLayout({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50/70 text-foreground transition-colors dark:bg-background dark:bg-none">
        <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="flex flex-1 flex-col lg:ml-72">
          <DashboardHeader onOpenCommandPalette={() => setCommandPaletteOpen(true)} onOpenMobileMenu={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.96))] p-4 sm:p-6 lg:p-8 dark:bg-background dark:bg-none">
            {children}
            <div className="h-20 lg:hidden" aria-hidden />
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
            <div className="grid grid-cols-4 gap-1 px-2 py-2">
              {mobileNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center rounded-xl px-2 py-2 text-[11px] font-medium",
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
