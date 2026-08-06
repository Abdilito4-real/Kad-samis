"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BellPlus, BellOff } from "lucide-react";
import { isPushSupported, getCurrentPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

/**
 * Enable/disable Web Push for this device. Shared between /notifications
 * and /settings so there's exactly one place this logic lives.
 */
export function PushNotificationsCard() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushChecked, setPushChecked] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushChecked(true);
      return;
    }
    getCurrentPushSubscription()
      .then((sub) => setPushEnabled(Boolean(sub)))
      .finally(() => setPushChecked(true));
  }, []);

  const handleToggle = async () => {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush();
        setPushEnabled(false);
        toast.success("Push notifications turned off");
      } else {
        await subscribeToPush();
        setPushEnabled(true);
        toast.success("Push notifications enabled", {
          description: "You'll get an alert on this device even when KAD-SAMIS isn't open.",
        });
      }
    } catch (err: any) {
      toast.error("Unable to update push notifications", { description: err?.message });
    } finally {
      setPushBusy(false);
    }
  };

  if (!isPushSupported()) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Push notifications</p>
          <p className="text-sm text-muted-foreground">
            {pushEnabled
              ? "Enabled on this device — you'll get alerts here even when KAD-SAMIS isn't open."
              : "Get an alert on this device the moment something needs your attention, even if the app is closed."}
          </p>
        </div>
        <Button
          onClick={handleToggle}
          disabled={pushBusy || !pushChecked}
          variant={pushEnabled ? "outline" : "default"}
          className="gap-2 shrink-0"
        >
          {pushBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : pushEnabled ? (
            <BellOff className="h-4 w-4" />
          ) : (
            <BellPlus className="h-4 w-4" />
          )}
          {pushEnabled ? "Turn off" : "Enable push notifications"}
        </Button>
      </CardContent>
    </Card>
  );
}
