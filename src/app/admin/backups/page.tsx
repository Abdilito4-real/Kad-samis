"use client";

import { useState } from "react";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const ADMIN_ROLES = new Set([
  "super_admin",
  "agency_admin",
  "ministry_admin",
  "department_head",
]);

export default function BackupsPage() {
  const { user, loading } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const canExport = Boolean(user?.roleId && ADMIN_ROLES.has(user.roleId));

  const downloadBackup = async () => {
    setDownloading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      if (!session?.access_token) {
        throw new Error("Your session has expired. Sign in again to export a backup.");
      }

      const response = await fetch("/api/admin/backups/export", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Unable to generate the backup.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ??
        "kad-samis-operational-backup.csv";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded. Verify the file and store it securely.");
    } catch (error) {
      toast.error("Backup export failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Backups</h1>
        <p className="text-muted-foreground">
          Download and verify an operational-data backup for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational data export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            The CSV includes organizations, asset categories, assets, requests,
            maintenance records and logs, inspections, and transfers. Organization
            admins can export only their own organization; General Admin can export
            all organizations.
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p>
              This operational-data export is not a full Supabase backup. It does
              not include login accounts, credentials, or stored document/image
              files. Verify the downloaded CSV and store it in an approved secure
              location.
            </p>
          </div>
          {canExport ? (
            <Button onClick={downloadBackup} isLoading={downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Preparing backup…" : "Download CSV backup"}
            </Button>
          ) : (
            <p className="text-sm text-destructive">
              Backup exports are available to General Admin and organization administrators.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
