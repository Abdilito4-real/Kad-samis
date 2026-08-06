"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequestSubmissionForm } from "@/components/requests/RequestSubmissionForm";

interface RequestAssetDialogProps {
  assetId: string;
  assetName: string;
  assetNumber?: string | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerClassName?: string;
}

export function RequestAssetDialog({
  assetId,
  assetName,
  assetNumber,
  triggerLabel = "Request",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: RequestAssetDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={cn("gap-2", triggerClassName)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Wrench className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Maintenance / Repair</DialogTitle>
            <DialogDescription>
              Describe the issue for the super admin to review before it is routed to an Operational Manager.
            </DialogDescription>
          </DialogHeader>
          <RequestSubmissionForm
            presetAsset={{ id: assetId, name: assetName, assetNumber }}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
