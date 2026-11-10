"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Wrench } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface PresetAsset {
  id: string;
  name: string;
  assetNumber?: string | null;
}

interface RequestSubmissionFormProps {
  onSuccess?: () => void;
  /** The asset this maintenance/repair request is for — assets are the only
   * entry point for creating a request, so this is always required. */
  presetAsset: PresetAsset;
}

type WorkType = "repair" | "maintenance";

const workTypes: { value: WorkType; label: string; description: string }[] = [
  { value: "repair", label: "Repair", description: "Something's broken or not working correctly" },
  { value: "maintenance", label: "Maintenance", description: "Routine or preventive upkeep" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const titleFor = (workType: WorkType, asset: PresetAsset) => {
  const prefix = workType === "repair" ? "Repair request" : "Maintenance request";
  return `${prefix}: ${asset.name}${asset.assetNumber ? ` (${asset.assetNumber})` : ""}`;
};

export function RequestSubmissionForm({ onSuccess, presetAsset }: RequestSubmissionFormProps) {
  const { user } = useAuth();
  const isRequestHandler = user?.roleId === "mechanical_request_handler" || user?.roleId === "electrical_mechanical_handler";
  const [workType, setWorkType] = useState<WorkType>("repair");
  const [title, setTitle] = useState(() => titleFor("repair", presetAsset));
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);

  const handleWorkTypeChange = (next: WorkType) => {
    // Only auto-update the title if the user hasn't typed over the
    // auto-filled one — don't clobber something they wrote themselves.
    setTitle((current) => (current === titleFor(workType, presetAsset) ? titleFor(next, presetAsset) : current));
    setWorkType(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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

      const response = await fetch("/api/admin/requests", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description,
          requestType: "maintenance_approval",
          priority,
          relatedAssetId: presetAsset.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      const result = await response.json();
      if (result.notificationsSent === false) {
        toast.warning(isRequestHandler
          ? "Request submitted, but Assistant Director Operations could not be notified."
          : "Request submitted, but the Requests Operators could not be notified.");
      } else {
        toast.success("Request submitted", {
          description: isRequestHandler
            ? "Sent directly to Assistant Director Operations, then Director Operations and the Director General."
            : "Sent to the Requests Operator queue, then Assistant Director Operations, Director Operations, and the Director General.",
        });
      }

      setWorkType("repair");
      setTitle(titleFor("repair", presetAsset));
      setDescription("");
      setPriority("medium");
      onSuccess?.();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Submission failed", {
        description: err.message || "Unable to submit request",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Request Maintenance / Repair</h3>
        <p className="text-sm text-muted-foreground">
          {isRequestHandler
            ? "Your request goes directly to Assistant Director Operations, then Director Operations and Director General approval."
            : "Requests are reviewed by a Requests Operator, then Assistant Director Operations, Director Operations, and the Director General. Approved maintenance requests can then be assigned to an Operational Manager."}
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-sm">
        <Wrench className="h-4 w-4 text-primary shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-foreground">{presetAsset.name}</span>
          {presetAsset.assetNumber ? (
            <span className="text-muted-foreground"> · {presetAsset.assetNumber}</span>
          ) : null}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workType">Request Type</Label>
          <Select value={workType} onValueChange={(value) => handleWorkTypeChange(value as WorkType)}>
            <SelectTrigger id="workType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{workTypes.find((t) => t.value === workType)?.description}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Request Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Approve purchase of 5 laptops"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            workType === "repair"
              ? "Describe what's broken or malfunctioning..."
              : "Describe the maintenance or upkeep needed..."
          }
          rows={4}
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        isLoading={loading}
        loadingText="Submitting…"
      >
        <span className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Submit Request
        </span>
      </Button>
    </form>
  );
}
