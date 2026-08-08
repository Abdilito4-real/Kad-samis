"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, UserCog, CheckCircle2 } from "lucide-react";
import { StageProgressBar } from "@/components/requests/StageProgressBar";

const OPERATIONS_ELIGIBLE_TYPE = "maintenance_approval";

const STAGE_ORDER = ["assigned", "monitoring", "in_progress", "completed"] as const;
type Stage = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<Stage, string> = {
  assigned: "Assigned",
  monitoring: "Monitoring",
  in_progress: "Repair In Progress",
  completed: "Completed",
};

const STAGE_COLORS: Record<Stage, string> = {
  assigned: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  monitoring: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

interface OperationEntry {
  id: string;
  stage: Stage;
  note: string | null;
  created_at: string;
  actor?: { email: string; username?: string | null } | null;
}

interface OperationRequest {
  id: string;
  type: string;
  status: string;
  current_stage?: Stage | null;
  assigned_operator?: { id: string; email: string; username?: string | null } | null;
  request_operations?: OperationEntry[];
}

interface OperationStagePanelProps {
  request: OperationRequest;
  viewerRole: string | null | undefined;
  viewerId: string | null | undefined;
  onUpdate: (updated: any) => void;
}

interface OperatorOption {
  id: string;
  email: string;
  username?: string | null;
}

export function OperationStagePanel({ request, viewerRole, viewerId, onUpdate }: OperationStagePanelProps) {
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const [selectedStage, setSelectedStage] = useState<Stage | "">("");
  const [stageNote, setStageNote] = useState("");
  const [updatingStage, setUpdatingStage] = useState(false);

  const isSuperAdmin = viewerRole === "super_admin";
  const isAssignedOperator = viewerRole === "operational_manager" && request.assigned_operator?.id === viewerId;
  const currentIndex = STAGE_ORDER.indexOf((request.current_stage as Stage) ?? "assigned");
  const nextStages = STAGE_ORDER.filter((_, index) => index > currentIndex);

  useEffect(() => {
    if (!isSuperAdmin || !showAssignForm) return;

    const loadOperators = async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch("/api/admin/profiles", { credentials: "include", headers });
        if (!response.ok) {
          console.error("Failed to load operational managers:", await response.text());
          return;
        }
        const data = await response.json();
        const list = (data.profiles ?? []).filter((p: any) => p.role === "operational_manager");
        setOperators(list);
      } catch (err) {
        console.error("Failed to load operational managers:", err);
      }
    };

    loadOperators();
  }, [isSuperAdmin, showAssignForm]);

  if (request.type !== OPERATIONS_ELIGIBLE_TYPE) return null;
  if (!["approved", "in_operation", "completed"].includes(request.status)) return null;

  const authHeaders = async () => {
    const supabase = createClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const handleAssign = async () => {
    if (!selectedOperatorId) {
      toast.error("Select an Operational Manager");
      return;
    }

    setAssigning(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/requests/${request.id}/assign`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ operatorId: selectedOperatorId, note: assignNote.trim() || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to assign request");

      toast.success("Request assigned to Operational Manager");
      setShowAssignForm(false);
      setAssignNote("");
      setSelectedOperatorId("");
      onUpdate(data.request);
    } catch (err: any) {
      toast.error("Assignment failed", { description: err.message });
    } finally {
      setAssigning(false);
    }
  };

  const handleStageUpdate = async () => {
    if (!selectedStage) {
      toast.error("Select the next stage");
      return;
    }
    if (!stageNote.trim()) {
      toast.error("A note describing this update is required");
      return;
    }

    setUpdatingStage(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`/api/admin/requests/${request.id}/operations`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ stage: selectedStage, note: stageNote.trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update stage");

      toast.success(selectedStage === "completed" ? "Request marked complete" : "Stage updated");
      setSelectedStage("");
      setStageNote("");
      onUpdate(data.request);
    } catch (err: any) {
      toast.error("Update failed", { description: err.message });
    } finally {
      setUpdatingStage(false);
    }
  };

  const timeline = [...(request.request_operations ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Operations</h3>
        </div>
        {request.current_stage && (
          <Badge className={STAGE_COLORS[request.current_stage]}>{STAGE_LABELS[request.current_stage]}</Badge>
        )}
      </div>

      {request.current_stage && (
        <div className="px-1 py-2">
          <StageProgressBar currentStage={request.current_stage} />
        </div>
      )}

      {request.assigned_operator && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <UserCog className="h-4 w-4" />
          Assigned to{" "}
          <span className="font-medium text-slate-900 dark:text-slate-50">
            {request.assigned_operator.username || request.assigned_operator.email}
          </span>
        </div>
      )}

      {/* Super Admin: assign / reassign */}
      {isSuperAdmin && (request.status === "approved" || request.status === "in_operation") && (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          {!showAssignForm ? (
            <Button variant="outline" size="sm" onClick={() => setShowAssignForm(true)} className="gap-2">
              <UserCog className="h-4 w-4" />
              {request.status === "in_operation" ? "Reassign Operational Manager" : "Assign to Operational Manager"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="operator-select">Operational Manager</Label>
                <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                  <SelectTrigger id="operator-select">
                    <SelectValue placeholder="Select an Operational Manager…" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.username || op.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-note">Note (optional)</Label>
                <Textarea id="assign-note" value={assignNote} onChange={(e) => setAssignNote(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAssignForm(false)} disabled={assigning}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleAssign} isLoading={assigning} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assigned operator: advance stage */}
      {isAssignedOperator && request.status === "in_operation" && nextStages.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <Label htmlFor="stage-select">Move to next stage</Label>
          <Select value={selectedStage} onValueChange={(value) => setSelectedStage(value as Stage)}>
            <SelectTrigger id="stage-select">
              <SelectValue placeholder="Select a stage…" />
            </SelectTrigger>
            <SelectContent>
              {nextStages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label htmlFor="stage-note">Update note</Label>
            <Textarea
              id="stage-note"
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              placeholder="Describe what happened at this stage…"
              rows={3}
            />
          </div>
          <Button onClick={handleStageUpdate} isLoading={updatingStage} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {selectedStage === "completed" ? "Mark Complete" : "Update Stage"}
          </Button>
        </div>
      )}

      {/* Timeline — visible to everyone who can see the request */}
      {timeline.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Progress timeline</p>
          <ol className="space-y-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="flex gap-3">
                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-50">{STAGE_LABELS[entry.stage]}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    {(entry.actor?.username || entry.actor?.email) && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {entry.actor?.username || entry.actor?.email}
                      </span>
                    )}
                  </div>
                  {entry.note && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
