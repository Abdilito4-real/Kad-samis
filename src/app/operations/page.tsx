"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, Wrench, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { StageProgressBar, type Stage } from "@/components/requests/StageProgressBar";
import {
  ResponsiveList,
  ResponsiveListRow,
  ResponsiveListDetailGrid,
  ResponsiveListField,
} from "@/components/layout/ResponsiveList";

interface OperationRequest {
  id: string;
  title: string;
  description: string;
  status: "in_operation" | "completed" | string;
  current_stage: Stage | null;
  priority: string;
  created_at: string;
  updated_at: string;
  organizations?: { name: string } | null;
  assigned_operator?: { id: string; email: string; username?: string | null } | null;
}

export default function OperationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const operatorId = searchParams.get("operatorId");
  const operatorEmail = searchParams.get("operatorEmail");
  const [requests, setRequests] = useState<OperationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in_operation" | "completed">("all");

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      try {
        const supabase = createClient();
        if (!supabase) throw new Error("Supabase client not initialized");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No authenticated session");

        const params = new URLSearchParams();
        if (filter !== "all") params.append("status", filter);
        if (isSuperAdmin && operatorId) params.append("operatorId", operatorId);

        const response = await fetch(`/api/admin/operations?${params.toString()}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load operations");
        }

        const data = await response.json();
        setRequests(data.requests || []);
      } catch (err: any) {
        console.error("Load operations error:", err);
        toast.error("Failed to load operations", { description: err.message });
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authLoading, user, filter, isSuperAdmin, operatorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const viewingSingleOperator = isSuperAdmin && Boolean(operatorId);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        {viewingSingleOperator && (
          <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => router.push("/users")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
        )}
        <h1 className="text-3xl font-bold tracking-tight">
          {viewingSingleOperator ? `Assigned to ${operatorEmail || "Operational Manager"}` : isSuperAdmin ? "Operations Overview" : "My Operations"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {viewingSingleOperator
            ? "Requests assigned to this Operational Manager and the stage each one is at."
            : isSuperAdmin
              ? "Maintenance and repair requests currently assigned across all Operational Managers"
              : "Maintenance and repair requests assigned to you — monitor, log progress, and complete each one"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "in_operation", "completed"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {f === "all" ? "All" : f === "in_operation" ? "In Operation" : "Completed"}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            {filter === "all" ? "No assigned requests yet" : `No ${filter.replace("_", " ")} requests`}
          </p>
        </Card>
      ) : (
        <ResponsiveList>
          {requests.map((request) => (
            <ResponsiveListRow
              key={request.id}
              onClick={() => router.push(`/requests/${request.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {request.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {request.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
              </div>

              <StageProgressBar currentStage={request.current_stage} />

              {isSuperAdmin && !viewingSingleOperator && (
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                  {request.assigned_operator?.username || request.assigned_operator?.email || "Unassigned"}
                </Badge>
              )}

              <ResponsiveListDetailGrid cols={3}>
                <ResponsiveListField
                  label="Organization"
                  value={request.organizations?.name || "Organization unavailable"}
                />
                <ResponsiveListField
                  label="Submitted"
                  value={new Date(request.created_at).toLocaleDateString()}
                />
                <ResponsiveListField
                  label="Last Updated"
                  value={new Date(request.updated_at).toLocaleDateString()}
                />
              </ResponsiveListDetailGrid>
            </ResponsiveListRow>
          ))}
        </ResponsiveList>
      )}
    </div>
  );
}
