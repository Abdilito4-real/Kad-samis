"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  related_request_id: string | null;
  read: boolean;
  created_at: string;
}

/**
 * Live unread-notification count, backed by a Supabase Realtime subscription
 * on the caller's own `notifications` rows (see migration
 * 013_notifications_realtime.sql, which adds the table to the realtime
 * publication — without that, postgres_changes never fires regardless of
 * this subscription code). An initial fetch plus a slow fallback poll cover
 * the moment before the channel finishes subscribing and any missed events
 * from a dropped connection.
 */
export function useUnreadNotifications() {
  const { user, loading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (authLoading || !user) {
      setUnreadCount(0);
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;

    const fetchUnread = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const response = await fetch("/api/notifications", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const unread = (data.notifications ?? []).filter((n: NotificationRow) => !n.read).length;
        if (!cancelled) setUnreadCount(unread);
      } catch {
        // Non-blocking — the next realtime event or fallback poll will retry.
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchUnread();

    // The topic includes a random suffix so each effect run gets a genuinely
    // fresh channel. React StrictMode (and Fast Refresh) mount → cleanup →
    // remount effects in dev; supabase-js reuses an existing channel object
    // for a topic it still has registered, and `.on()` throws once that
    // channel has already had `subscribe()` called on it. A per-mount unique
    // topic sidesteps the reuse entirely instead of racing removeChannel's
    // cleanup against the remount.
    const channel = supabase
      .channel(`notifications:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: { new: NotificationRow }) => {
          const row = payload.new;
          setUnreadCount((count) => count + 1);
          toast.info(row.title, {
            description: row.message,
            action: {
              label: "View",
              onClick: () =>
                window.location.assign(row.related_request_id ? `/requests/${row.related_request_id}` : "/notifications"),
            },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          // Read state changed (this tab, another tab, or "mark all read") — resync from the source of truth.
          fetchUnread();
        }
      )
      .subscribe();

    // Safety net in case the realtime channel silently drops (network blips, tab sleep).
    const interval = window.setInterval(fetchUnread, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [authLoading, user]);

  return unreadCount;
}
