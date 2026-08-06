"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { getNavigationGroupsForRole } from "@/components/dashboard-sidebar";
import { useAuth } from "@/components/auth-provider";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const navigationGroups = useMemo(() => getNavigationGroupsForRole(user?.roleId), [user?.roleId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  const items = useMemo(() => {
    const flattened = navigationGroups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        group: group.title,
      }))
    );

    if (!query.trim()) {
      return flattened.slice(0, 8);
    }

    return flattened.filter((item) =>
      `${item.group} ${item.name}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, navigationGroups]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 py-16 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search assets, reports, users, or pages"
            className="w-full bg-transparent text-sm outline-none"
          />
          <div className="rounded-full border border-border px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Esc
          </div>
        </div>

        <div className="max-h-[320px] overflow-auto p-2">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No matches yet. Try another keyword.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.group}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Press Ctrl/Cmd + K to open again
          </div>
          <div className="rounded-full border border-border px-2 py-1">Quick navigation</div>
        </div>
      </div>
    </div>
  );
}
