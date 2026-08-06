"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Download, Package2, ShieldCheck, Wrench, ArrowRightLeft } from "lucide-react";
import { RequestAssetDialog } from "@/components/requests/RequestAssetDialog";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  maintenance: "bg-amber-500/10 text-amber-600",
  disposal: "bg-rose-500/10 text-rose-500",
  inactive: "bg-muted text-muted-foreground",
};

const CONDITION_BADGE: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-500",
  good: "bg-sky-500/10 text-sky-500",
  fair: "bg-amber-500/10 text-amber-600",
  poor: "bg-orange-500/10 text-orange-500",
  damaged: "bg-rose-500/10 text-rose-500",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  // Only org-scoped roles submit requests — super_admin approves them and
  // Operational Managers (no organization) don't file them.
  const canRequest = Boolean(user?.organizationId);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        const supabase = createClient();
        if (!supabase) {
          setError("Supabase not configured");
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Not authenticated. Redirecting to login...");
          setTimeout(() => router.push("/auth/login"), 2000);
          setLoading(false);
          return;
        }

        await fetchAssets();
      } catch (err) {
        console.error("Auth check failed", err);
        setError("Unable to verify authentication");
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [router]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase client not initialized");
        setAssets([]);
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No authenticated session. Please log in.");
        setAssets([]);
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/assets", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await response.json();
      if (!response.ok) {
        setError(json?.error || "Unable to load assets");
        setAssets([]);
      } else {
        setAssets(json.assets ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch assets", err);
      setError("Unable to load assets");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const assetItems = assets;

  // Super Admin doesn't edit assets directly — "View" takes them to the
  // owning organization's page instead of the asset edit form. Falls back
  // to the asset page itself if an asset is somehow missing its org link.
  const assetLinkHref = (asset: any) =>
    isSuperAdmin && asset.organization_id ? `/admin/organizations/${asset.organization_id}` : `/assets/${asset.id}`;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : null}

      {error && !loading ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">
          <strong>⚠️ {error.includes("Redirecting") ? "Notice" : "Error"}:</strong> {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Asset Registry</h1>
              <p className="text-muted-foreground">Track each government asset from acquisition to disposal.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isSuperAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/assets/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Asset
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Registered assets", value: assetItems.length.toString(), icon: Package2 },
              { title: "In service", value: assetItems.filter((item) => item.status === "active").length.toString(), icon: ShieldCheck },
              { title: "Maintenance", value: assetItems.filter((item) => item.status === "maintenance").length.toString(), icon: Wrench },
              { title: "Recently added", value: assetItems.slice(0, 5).length.toString(), icon: ArrowRightLeft },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                    <Icon className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{item.value}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Asset register</CardTitle>
              <p className="text-sm text-muted-foreground">{isSuperAdmin ? "Read-only records across all organizations." : "Latest records with quick edit access."}</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden items-center gap-4 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <span>Asset</span>
                  <span>Status</span>
                  <span>Condition</span>
                  <span className="text-right">Actions</span>
                </div>
                {assetItems.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No assets have been registered yet.</div>
                ) : (
                  assetItems.map((asset) => (
                    <div
                      key={asset.id}
                      className="min-w-0 border-t border-border px-4 py-3 text-sm first:border-t-0 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3 sm:block">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{asset.name}</div>
                          <div className="truncate text-muted-foreground text-xs">{asset.asset_number}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:hidden">
                          {canRequest && (
                            <RequestAssetDialog
                              assetId={asset.id}
                              assetName={asset.name}
                              assetNumber={asset.asset_number}
                              triggerLabel=""
                              triggerVariant="ghost"
                              triggerSize="icon"
                              triggerClassName="h-8 w-8 p-0"
                            />
                          )}
                          <Link href={assetLinkHref(asset)} className="text-sm font-medium text-primary hover:underline">
                            {isSuperAdmin ? "View" : "Edit"}
                          </Link>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:contents">
                        {asset.status ? (
                          <Badge className={`${STATUS_BADGE[asset.status] ?? "bg-muted text-muted-foreground"} capitalize`}>
                            {asset.status}
                          </Badge>
                        ) : (
                          <span className="sm:inline hidden">—</span>
                        )}
                        {asset.condition ? (
                          <Badge className={`${CONDITION_BADGE[asset.condition] ?? "bg-muted text-muted-foreground"} capitalize`}>
                            {asset.condition}
                          </Badge>
                        ) : (
                          <span className="sm:inline hidden">—</span>
                        )}
                      </div>
                      <div className="hidden items-center justify-end gap-2 sm:flex">
                        {canRequest && (
                          <RequestAssetDialog
                            assetId={asset.id}
                            assetName={asset.name}
                            assetNumber={asset.asset_number}
                          />
                        )}
                        <Link href={assetLinkHref(asset)} className="text-sm font-medium text-primary hover:underline">
                          {isSuperAdmin ? "View" : "Edit"}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
