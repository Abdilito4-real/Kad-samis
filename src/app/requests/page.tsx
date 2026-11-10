"use client";

import { useAuth } from "@/components/auth-provider";
import { RequestHistory } from "@/components/requests/RequestHistory";

export default function RequestsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const isRequestHandler = user?.roleId === "mechanical_request_handler" || user?.roleId === "electrical_mechanical_handler";
  const isAssistantDirector = user?.roleId === "assistant_director_operations";
  const isDirectorOperations = user?.roleId === "director_operations";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Request History</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {isSuperAdmin
            ? "Review requests submitted from every organization and track them through to completion."
            : isRequestHandler
              ? "Review incoming requests and forward them to Assistant Director Operations. Both Requests Operator roles share the same review authority."
              : isAssistantDirector
                  ? "Use Received and Sent to track Requests Operator and Director Operations handoffs. Return requests to Requests Operators or forward them to Director Operations."
                : isDirectorOperations
                    ? "Use Received and Sent to track Assistant Director Operations and Director General handoffs. Return requests to Assistant Director Operations or forward them to the Director General."
                  : "Track requests submitted by your organization and their current stage. New maintenance/repair requests are raised from an asset's page."}
        </p>
      </div>

      <RequestHistory />
    </div>
  );
}
