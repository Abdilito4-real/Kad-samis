"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { MetricCard } from "@/components/layout/MetricCard";
import { ListRowSkeleton, MetricValueSkeleton } from "@/components/ui/skeletons";
import { Upload, Download, Package2, ShieldCheck, Wrench, ShieldAlert, Search, X } from "lucide-react";
import { RequestAssetDialog } from "@/components/requests/RequestAssetDialog";
import { toCSV, downloadCSV } from "@/lib/csv";
import { ASSET_CSV_HEADERS } from "@/lib/assetImport";
import { logExportActivity } from "@/lib/logActivity";
import { WarrantyIndicator } from "@/components/assets/WarrantyIndicator";
import { assessWarranty } from "@/lib/warranty";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const INITIAL_ASSET_LIMIT = 10;

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  maintenance: "bg-amber-500/10 text-amber-600",
  disposal: "bg-rose-500/10 text-rose-500",
  inactive: "bg-muted text-muted-foreground",
};

const CONDITION_BADGE: Record<string, string> = {
  serviceable: "bg-emerald-500/10 text-emerald-500",
  unserviceable: "bg-rose-500/10 text-rose-500",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllAssets, setShowAllAssets] = useState(false);
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
  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return assetItems;

    return assetItems.filter((asset) =>
      [
        asset.name,
        asset.asset_number,
        asset.status,
        asset.condition,
        asset.asset_categories?.[0]?.name,
        asset.make,
        asset.geolocation,
      ].some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [assetItems, searchQuery]);
  const visibleAssets = showAllAssets
    ? filteredAssets
    : filteredAssets.slice(0, INITIAL_ASSET_LIMIT);

  const handleExport = () => {
    if (assetItems.length === 0) {
      toast.error("There are no assets to export yet.");
      return;
    }

    const rows: Array<Array<string | number>> = [
      [...ASSET_CSV_HEADERS],
      ...assetItems.map((asset, index) => [
        index + 1,
        asset.asset_number ?? "",
        asset.name ?? "",
        asset.purchase_year ?? "",
        asset.purchase_value ?? "",
        asset.condition ?? "",
        asset.warranty_years ?? "",
        asset.status ?? "",
        asset.asset_categories?.[0]?.name ?? "",
        asset.geolocation ?? "",
      ]),
    ];

    downloadCSV(`assets-export-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    void logExportActivity("assets", assetItems.length);
    toast.success(`Exported ${assetItems.length} asset${assetItems.length === 1 ? "" : "s"}.`);
  };

  // Super Admin can add assets through bulk import but doesn't edit existing
  // assets directly — "View" takes them to the owning organization's page.
  // Falls back to the asset page if an asset is missing its org link.
  const assetLinkHref = (asset: any) =>
    isSuperAdmin && asset.organization_id ? `/admin/organizations/${asset.organization_id}` : `/assets/${asset.id}`;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">
          <strong>⚠️ {error.includes("Redirecting") ? "Notice" : "Error"}:</strong> {error}
        </div>
      ) : (
        <>
          {/* The page's own template — title, actions, column headers —
              renders immediately and stays put; only the numbers and rows
              below swap from skeletons to real data once `loading` clears. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Asset Registry</h1>
              <p className="text-muted-foreground">Track each government asset from acquisition to disposal.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/assets/create">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Assets
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <ResponsiveGrid cols={{ base: 1, md: 2, xl: 4 }}>
            {[
              { title: "Registered assets", value: assetItems.length, icon: Package2, tone: "neutral" as const },
              { title: "In service", value: assetItems.filter((item) => item.status === "active").length, icon: ShieldCheck, tone: "emerald" as const },
              { title: "Maintenance", value: assetItems.filter((item) => item.status === "maintenance").length, icon: Wrench, tone: "amber" as const },
              { title: "Out of warranty", value: assetItems.filter((item) => assessWarranty(item.purchase_year, item.warranty_years)?.status === "expired").length, icon: ShieldAlert, tone: "rose" as const },
            ].map((item) => (
              <MetricCard
                key={item.title}
                title={item.title}
                value={loading ? <MetricValueSkeleton /> : item.value}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </ResponsiveGrid>

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Asset register</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{isSuperAdmin ? "Read-only records across all organizations." : "Latest records with quick edit access."}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Search assets"
                    placeholder="Search name, asset ID, category…"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setShowAllAssets(false);
                    }}
                    className="pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear asset search"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!loading && assetItems.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
                  {searchQuery.trim()
                    ? `${visibleAssets.length === filteredAssets.length ? "Showing" : `Showing ${visibleAssets.length} of`} ${filteredAssets.length} matching asset${filteredAssets.length === 1 ? "" : "s"}`
                    : `Showing ${visibleAssets.length} of ${assetItems.length} asset${assetItems.length === 1 ? "" : "s"}`}
                </p>
              )}
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="hidden items-center gap-4 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <span>Asset</span>
                  <span>Status</span>
                  <span>Condition</span>
                  <span className="text-right">Actions</span>
                </div>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => <ListRowSkeleton key={index} />)
                ) : assetItems.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No assets have been registered yet.</div>
                ) : filteredAssets.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No assets match “{searchQuery.trim()}”.
                  </div>
                ) : (
                  visibleAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="min-w-0 border-t border-border px-4 py-3 text-sm first:border-t-0 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3 sm:block">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{asset.name}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{asset.asset_number}</span>
                            <WarrantyIndicator
                              compact
                              purchaseYear={asset.purchase_year}
                              warrantyYears={asset.warranty_years}
                            />
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 sm:hidden">
                          {canRequest && (
                            <RequestAssetDialog
                              assetId={asset.id}
                              assetName={asset.name}
                              assetNumber={asset.asset_number}
                              triggerLabel=""
                              triggerVariant="ghost"
                              triggerSize="icon-lg"
                              triggerClassName="p-0"
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
              {!loading && filteredAssets.length > INITIAL_ASSET_LIMIT && (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAllAssets((showingAll) => !showingAll)}
                  >
                    {showAllAssets ? "Show top 10" : `View all (${filteredAssets.length})`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
