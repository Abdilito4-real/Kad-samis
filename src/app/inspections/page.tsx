"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { MetricCard } from "@/components/layout/MetricCard";
import { ResponsiveList, ResponsiveListRow } from "@/components/layout/ResponsiveList";
import { Plus, ClipboardCheck, CalendarClock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MetricValueSkeleton, ResponsiveListSkeleton } from "@/components/ui/skeletons";

interface Inspection {
  id: string;
  condition: string | null;
  notes: string | null;
  inspection_date: string;
  gps_verified: boolean | null;
  asset?: { asset_number?: string; name?: string } | null;
}

const CONDITION_TONE: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-500",
  good: "bg-sky-500/10 text-sky-500",
  fair: "bg-amber-500/10 text-amber-600",
  poor: "bg-orange-500/10 text-orange-500",
  damaged: "bg-rose-500/10 text-rose-500",
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
        if (!session) throw new Error("Please sign in to view inspections");

        const response = await fetch("/api/admin/inspections", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load inspections");
        setInspections(body.inspections ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load inspections");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return [
      { title: "Total inspections", value: inspections.length, icon: ClipboardCheck },
      { title: "This month", value: inspections.filter((i) => new Date(i.inspection_date) >= startOfMonth).length, icon: CalendarClock },
      { title: "GPS verified", value: inspections.filter((i) => i.gps_verified).length, icon: MapPin },
    ];
  }, [inspections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inspections</h1>
          <p className="text-muted-foreground">Keep all inspections, notes, and evidence in order.</p>
        </div>
        <Button size="sm" disabled title="Coming soon">
          <Plus className="mr-2 h-4 w-4" />
          New Inspection
        </Button>
      </div>

      {error && !loading ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>
      ) : null}

      <ResponsiveGrid cols={{ base: 1, md: 3, xl: 3 }}>
        {stats.map((item) => (
          <MetricCard key={item.title} title={item.title} value={loading ? <MetricValueSkeleton /> : item.value} icon={item.icon} />
        ))}
      </ResponsiveGrid>

      <Card>
        <CardHeader>
          <CardTitle>Inspection history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ResponsiveListSkeleton rows={4} detailCols={2} />
          ) : inspections.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No inspections have been recorded yet.</p>
          ) : (
            <ResponsiveList>
              {inspections.map((inspection) => (
                <ResponsiveListRow key={inspection.id}>
                  <div className="sm:flex sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inspection.asset?.name || inspection.asset?.asset_number || "Asset"}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {new Date(inspection.inspection_date).toLocaleDateString()}
                        {inspection.notes ? ` · ${inspection.notes}` : ""}
                      </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-0 sm:shrink-0">
                      {inspection.gps_verified ? (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> GPS verified
                        </span>
                      ) : null}
                      {inspection.condition ? (
                        <Badge className={`${CONDITION_TONE[inspection.condition.toLowerCase()] ?? "bg-muted text-muted-foreground"} capitalize`}>
                          {inspection.condition}
                        </Badge>
                      ) : null}
                    </div>
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
