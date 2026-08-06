"use client";

import { useAuth } from "@/components/auth-provider";
import { RequestHistory } from "@/components/requests/RequestHistory";

export default function RequestsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Request History</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {isSuperAdmin
            ? "Review requests submitted from every organization and track them through to completion."
            : "Track every request your organization has submitted and its current stage. New maintenance/repair requests are raised from an asset's page."}
        </p>
      </div>

      <RequestHistory />
    </div>
  );
}
