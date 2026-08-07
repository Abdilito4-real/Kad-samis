"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckCircle, Clock, XCircle, ArrowUp, Send, ChevronRight, Wrench } from "lucide-react";
import { StageProgressBar } from "@/components/requests/StageProgressBar";
import {
  ResponsiveList,
  ResponsiveListRow,
  ResponsiveListDetailGrid,
  ResponsiveListField,
} from "@/components/layout/ResponsiveList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";

interface Request {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "in_operation" | "completed";
  notes: string | null;
  created_at: string;
  updated_at: string;
  organization_id: string;
  organizations?: { name: string } | null;
  created_by?: string;
  escalated_at?: string;
  escalation_reason?: string;
  current_stage?: "assigned" | "monitoring" | "in_progress" | "completed" | null;
}

interface RequestHistoryProps {
  orgId?: string;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-600" />,
  approved: <CheckCircle className="h-4 w-4 text-emerald-600" />,
  rejected: <XCircle className="h-4 w-4 text-red-600" />,
  escalated: <ArrowUp className="h-4 w-4 text-purple-600" />,
  in_operation: <Wrench className="h-4 w-4 text-sky-600" />,
  completed: <CheckCircle className="h-4 w-4 text-emerald-600" />,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  escalated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  in_operation: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const statusLabels: Record<string, string> = {
  in_operation: "In Operation",
};

const priorityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const typeLabels: Record<string, string> = {
  asset_approval: "Asset Approval",
  transfer_approval: "Transfer Approval",
  maintenance_approval: "Maintenance Approval",
  budget_request: "Budget Request",
  general: "General Request",
};

export function RequestHistory({ orgId }: RequestHistoryProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected" | "escalated" | "in_operation" | "completed"
  >("all");
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [isEscalating, setIsEscalating] = useState(false);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const supabase = createClient();
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No authenticated session. Please log in.");
        }

        const params = new URLSearchParams();
        if (orgId) params.append("orgId", orgId);
        if (filter !== "all") params.append("status", filter);

        const response = await fetch(`/api/admin/requests?${params.toString()}`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load requests");
        }

        const data = await response.json();
        setRequests(data.requests || []);
      } catch (err: any) {
        console.error("Load requests error:", err);
        toast.error("Failed to load requests", {
          description: err.message,
        });
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      loadRequests();
    }
  }, [authLoading, user, orgId, filter]);

  const handleEscalateClick = (request: Request) => {
    setSelectedRequest(request);
    setEscalationReason("");
    setEscalateDialogOpen(true);
  };

  const handleEscalateSubmit = async () => {
    if (!selectedRequest || !escalationReason.trim()) {
      toast.error("Escalation reason is required");
      return;
    }

    setIsEscalating(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase client not initialized");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No authenticated session. Please log in.");
      }

      const response = await fetch(`/api/admin/requests/${selectedRequest.id}/escalate`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          escalationReason: escalationReason.trim(),
          priority: selectedRequest.priority,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to escalate request");
      }

      toast.success("Request escalated", {
        description: "Your request has been escalated to the super admin.",
      });

      setEscalateDialogOpen(false);
      setSelectedRequest(null);
      setEscalationReason("");

      // Reload requests with bearer token
      const params = new URLSearchParams();
      if (orgId) params.append("orgId", orgId);
      if (filter !== "all") params.append("status", filter);

      const listResponse = await fetch(`/api/admin/requests?${params.toString()}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (listResponse.ok) {
        const data = await listResponse.json();
        setRequests(data.requests || []);
      }
    } catch (err: any) {
      console.error("Escalate error:", err);
      toast.error("Escalation failed", {
        description: err.message || "Unable to escalate request",
      });
    } finally {
      setIsEscalating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected", "escalated", "in_operation", "completed"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {f === "all" ? "All Requests" : statusLabels[f] ?? f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            {filter === "all" ? "No requests yet" : `No ${filter} requests`}
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
                  <div className="flex items-center gap-3">
                    <h4 className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-slate-50">
                      {request.title}
                    </h4>
                    {statusIcons[request.status]}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {request.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 mt-1" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge className={typeLabels[request.type] ? "bg-slate-100 text-slate-800 dark:bg-slate-900/30" : ""}>
                  {typeLabels[request.type] || request.type}
                </Badge>
                <Badge className={priorityColors[request.priority]}>
                  {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} Priority
                </Badge>
                <Badge className={statusColors[request.status]}>
                  {statusLabels[request.status] ?? request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </Badge>
              </div>

              {request.current_stage && (
                <StageProgressBar currentStage={request.current_stage} />
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
                  label="Status Updated"
                  value={new Date(request.updated_at).toLocaleDateString()}
                />
              </ResponsiveListDetailGrid>

              {request.notes && (
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900/30">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Super Admin Notes
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-50">{request.notes}</p>
                </div>
              )}

              {!isSuperAdmin && request.status === "pending" && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEscalateClick(request);
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-2 hover:border-purple-400 hover:text-purple-600"
                  >
                    <ArrowUp className="h-4 w-4" />
                    Escalate to Super Admin
                  </Button>
                </div>
              )}
            </ResponsiveListRow>
          ))}
        </ResponsiveList>
      )}

      <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate Request</DialogTitle>
            <DialogDescription>
              Explain why this request needs escalation to the super admin
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-1">{selectedRequest?.title}</h4>
              <p className="text-xs text-muted-foreground">{selectedRequest?.description}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Escalation Reason</Label>
              <Textarea
                id="reason"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Explain why this request needs immediate attention from the super admin..."
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEscalateDialogOpen(false)}
                disabled={isEscalating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEscalateSubmit}
                disabled={isEscalating || !escalationReason.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {isEscalating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Escalating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Escalate
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
