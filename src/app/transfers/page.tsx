"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { MetricCard } from "@/components/layout/MetricCard";
import { ResponsiveList, ResponsiveListRow } from "@/components/layout/ResponsiveList";
import { Plus, ArrowRightLeft, TimerReset, BadgeCheck, Loader2 } from "lucide-react";

const TRANSFER_STATUS_BADGE: Record<string, string> = {
  requested: "bg-amber-500/10 text-amber-600",
  pending: "bg-amber-500/10 text-amber-600",
  approved: "bg-sky-500/10 text-sky-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
};
import { createClient } from "@/lib/supabase/client";

interface Transfer {
  id: string;
  status: string;
  transfer_date: string | null;
  requested_date: string;
  reason: string | null;
  asset?: { asset_number?: string; name?: string } | null;
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!session) throw new Error("Please sign in to view transfers");

        const response = await fetch("/api/admin/transfers", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load transfers");
        setTransfers(body.transfers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load transfers");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = [
    { title: "Open transfers", value: transfers.filter((t) => t.status !== "completed" && t.status !== "rejected").length, icon: ArrowRightLeft },
    { title: "Awaiting review", value: transfers.filter((t) => t.status === "requested" || t.status === "pending").length, icon: TimerReset },
    { title: "Completed", value: transfers.filter((t) => t.status === "completed").length, icon: BadgeCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Asset Transfers</h1>
          <p className="text-muted-foreground">Move assets securely between departments with full traceability.</p>
        </div>
        <Button size="sm" asChild>
          <a href="/requests">
            <Plus className="mr-2 h-4 w-4" />
            Request Transfer
          </a>
        </Button>
      </div>

      {error && !loading ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>
      ) : null}

      <ResponsiveGrid cols={{ base: 1, md: 3, xl: 3 }}>
        {stats.map((item) => (
          <MetricCard key={item.title} title={item.title} value={loading ? "—" : item.value} icon={item.icon} />
        ))}
      </ResponsiveGrid>

      <Card>
        <CardHeader>
          <CardTitle>Transfer requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading transfers...
            </div>
          ) : transfers.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No asset transfers have been recorded yet.</p>
          ) : (
            <ResponsiveList>
              {transfers.map((transfer) => (
                <ResponsiveListRow key={transfer.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{transfer.asset?.name || transfer.asset?.asset_number || "Asset"}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {transfer.reason || "No reason provided"} · Requested {new Date(transfer.requested_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={`${TRANSFER_STATUS_BADGE[transfer.status] ?? "bg-muted text-muted-foreground"} w-fit shrink-0 capitalize`}>
                      {transfer.status}
                    </Badge>
                  </div>
                </ResponsiveListRow>
              ))}
            </ResponsiveList>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
