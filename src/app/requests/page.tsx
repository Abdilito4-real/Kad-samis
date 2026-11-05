"use client";

import { useAuth } from "@/components/auth-provider";
import { RequestHistory } from "@/components/requests/RequestHistory";

export default function RequestsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const isMechanicalHandler = user?.roleId === "mechanical_request_handler";
  const isElectricalHandler = user?.roleId === "electrical_mechanical_handler";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Request History</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {isSuperAdmin
            ? "Review requests submitted from every organization and track them through to completion."
            : isMechanicalHandler
              ? "Review your organization’s incoming requests, forward them to the Electrical & Mechanical Handler, and send reminders."
              : isElectricalHandler
                ? "Review requests forwarded by the Mechanical Request Handler, then send them to the Agency Admin for approval."
                : "Track requests submitted by your organization and their current stage. New maintenance/repair requests are raised from an asset's page."}
        </p>
      </div>

      <RequestHistory />
    </div>
  );
}
