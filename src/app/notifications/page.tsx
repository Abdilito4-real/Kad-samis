"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, BellRing, AlertTriangle, CheckCircle2, Info, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { PushNotificationsCard } from "@/components/notifications/PushNotificationsCard";
import { ResponsiveList } from "@/components/layout/ResponsiveList";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Record<string, ReactNode> = {
  approval: <CheckCircle2 className="h-4 w-4" />,
  request: <AlertTriangle className="h-4 w-4" />,
  security: <ShieldCheck className="h-4 w-4" />,
  backup_reminder: <Archive className="h-4 w-4" />,
};

function NotificationRowSkeleton() {
  return (
    <div className="flex min-h-12 items-start gap-3 rounded-2xl border border-border bg-background/70 p-4">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  related_request_id: string | null;
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  // Tracks the one notification currently being marked read, so only that
  // row shows a busy state instead of blocking the whole list.
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        setLoadError(null);
        const supabase = createClient();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (cancelled) return;
        if (!session?.access_token) {
          throw new Error("Your session has expired. Sign in again to load notifications.");
        }

        const response = await fetch("/api/notifications", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load notifications");
        if (!cancelled) {
          setItems(data.notifications ?? []);
          setLoadedUserId(userId ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          if (loadedUserId !== userId) {
            setItems([]);
          }
          setLoadError(error instanceof Error ? error.message : "Unable to load notifications.");
          toast.error("Unable to load notifications", { description: error instanceof Error ? error.message : undefined });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!authLoading && !userId) {
      setLoading(false);
    } else if (!authLoading && userId && loadedUserId !== userId) {
      loadNotifications();
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, loadedUserId, reloadCounter]);

  const unreadCount = items.filter((item) => !item.read).length;

  const markAsRead = async (id: string) => {
    setMarkingId(id);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (!session?.access_token) {
        throw new Error("Your session has expired. Sign in again to update notifications.");
      }

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to update notification");
      }
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch (error) {
      toast.error("Unable to mark notification as read", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1>
        <p className="text-muted-foreground">Stay on top of alerts, approvals, and service milestones.</p>
      </div>

      <PushNotificationsCard />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inbox</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellRing className="h-4 w-4" />
            {unreadCount} unread updates
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ResponsiveList>
              {Array.from({ length: 4 }).map((_, index) => (
                <NotificationRowSkeleton key={index} />
              ))}
            </ResponsiveList>
          ) : loadError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setLoading(true);
                  setLoadError(null);
                  setReloadCounter((counter) => counter + 1);
                }}
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No notifications yet.</p>
          ) : <ResponsiveList>
            {items.map((item) => {
              const isMarking = markingId === item.id;
              return (
              <button
                type="button"
                key={item.id}
                onClick={() => !item.read && markAsRead(item.id)}
                disabled={isMarking}
                aria-busy={isMarking || undefined}
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-70",
                  item.read ? "border-border bg-background/70" : "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <div className="relative mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  {isMarking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    NOTIFICATION_ICONS[item.type] ?? <Info className="h-4 w-4" />
                  )}
                  {!item.read && !isMarking && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
                      aria-label="Unread"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", item.read ? "text-muted-foreground" : "text-foreground")}>{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <time className="mt-1 block text-xs text-muted-foreground" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                </div>
              </button>
              );
            })}
          </ResponsiveList>}
        </CardContent>
      </Card>
    </div>
  );
}
