"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const priorities = ["low", "medium", "high", "urgent"] as const;

interface ManualRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: "escalated";
  notes: string | null;
  created_at: string;
  updated_at: string;
  organization_id: string;
  created_by: string;
  source_mda: string;
  workflow_stage: "electrical_mechanical";
  organizations?: { name: string } | null;
}

export function ManualMdaRequestDialog({ onCreated }: { onCreated: (request: ManualRequest) => void }) {
  const [open, setOpen] = useState(false);
  const [sourceMda, setSourceMda] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<(typeof priorities)[number]>("medium");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSourceMda("");
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (!session?.access_token) throw new Error("Please sign in again to continue.");

      const response = await fetch("/api/admin/requests/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        body: JSON.stringify({ sourceMda, title, description, priority }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit manual request.");

      onCreated(result.request);
      setOpen(false);
      reset();
      if (result.notificationsSent === false) {
        toast.warning("Request sent, but one or more users could not be notified.");
      } else {
        toast.success("Request sent to the Electrical & Mechanical Handler.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit manual request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !saving) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">Enter request received from an MDA</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enter manually received MDA request</DialogTitle>
          <DialogDescription>
            This request will go directly to your organization’s Electrical & Mechanical Request Handler.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-source-mda">Originating MDA</Label>
            <Input
              id="manual-source-mda"
              value={sourceMda}
              onChange={(event) => setSourceMda(event.target.value)}
              maxLength={200}
              required
              placeholder="Name of the MDA that sent the request"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manual-priority">Priority</Label>
              <select
                id="manual-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as typeof priority)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {priorities.map((value) => (
                  <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-request-title">Request title</Label>
            <Input
              id="manual-request-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-request-description">Request details</Label>
            <Textarea
              id="manual-request-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} isLoading={saving} loadingText="Sending request">
              Send to Electrical & Mechanical
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
