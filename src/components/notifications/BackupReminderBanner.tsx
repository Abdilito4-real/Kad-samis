"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface BackupReminder {
  id: string;
  title: string;
  message: string;
}

export function BackupReminderBanner() {
  const { user } = useAuth();
  const [reminder, setReminder] = useState<BackupReminder | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    if (!user?.id || !supabase) {
      setReminder(null);
      return;
    }

    const loadReminder = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Unable to load reminders.");
        const nextReminder = (result.notifications ?? []).find(
          (item: BackupReminder & { type: string; read: boolean }) =>
            item.type === "backup_reminder" && !item.read
        );
        if (!cancelled) setReminder(nextReminder ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("Backup reminder banner load failed", error);
          toast.error("Unable to load the backup reminder.");
        }
      }
    };

    const channel = supabase
      .channel(`backup-reminder:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: { new: BackupReminder & { type: string; read: boolean } }) => {
          if (payload.new.type === "backup_reminder" && !payload.new.read) {
            setReminder(payload.new);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload: { new: BackupReminder & { type: string; read: boolean } }) => {
          if (payload.new.type === "backup_reminder" && payload.new.read) {
            setReminder(null);
          }
        }
      )
      .subscribe();
    void loadReminder();
    const intervalId = window.setInterval(() => {
      void loadReminder();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = async () => {
    if (!reminder) return;
    try {
      const supabase = createClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (!session?.access_token) {
        throw new Error("Your session has expired. Sign in again to dismiss the reminder.");
      }
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: reminder.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to dismiss reminder.");
      setReminder(null);
    } catch (error) {
      toast.error("Unable to dismiss the backup reminder", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (!reminder) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">{reminder.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{reminder.message}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button asChild size="sm">
          <Link href="/admin/backups">Download backup</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss backup reminder"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
