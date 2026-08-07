"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { PushNotificationsCard } from "@/components/notifications/PushNotificationsCard";
import { ResponsiveList } from "@/components/layout/ResponsiveList";
import { cn } from "@/lib/utils";

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
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const sessionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!session || cancelled) return;

        const nextSessionKey = session.access_token ?? 'anonymous';
        if (sessionKeyRef.current && sessionKeyRef.current !== nextSessionKey) {
          return;
        }
        if (!sessionKeyRef.current) {
          sessionKeyRef.current = nextSessionKey;
        }

        const response = await fetch("/api/notifications", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load notifications");
        if (!cancelled) {
          setItems(data.notifications ?? []);
          setHasLoadedNotifications(true);
        }
      } catch (error) {
        if (!cancelled) {
          if (!hasLoadedNotifications) {
            setItems([]);
          }
          toast.error("Unable to load notifications", { description: error instanceof Error ? error.message : undefined });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!authLoading && user?.id && !hasLoadedNotifications) {
      loadNotifications();
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, hasLoadedNotifications]);

  const unreadCount = items.filter((item) => !item.read).length;

  const markAsRead = async (id: string) => {
    const supabase = createClient();
    const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ id }),
    });
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
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
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading notifications...</div>
          ) : items.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No notifications yet.</p>
          ) : <ResponsiveList>
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={cn(
                  "flex min-h-12 w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:bg-muted/50",
                  item.read ? "border-border bg-background/70" : "border-emerald-500/30 bg-emerald-500/5"
                )}
              >
                <div className="relative mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  {item.type === "approval" ? <CheckCircle2 className="h-4 w-4" /> : item.type === "request" ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  {!item.read && (
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
            ))}
          </ResponsiveList>}
        </CardContent>
      </Card>
    </div>
  );
}
