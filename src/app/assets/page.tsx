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
import { Upload, Download, Package2, ShieldCheck, Wrench, ShieldAlert, Search, X, Building2, ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { RequestAssetDialog } from "@/components/requests/RequestAssetDialog";
import { toCSV, downloadCSV } from "@/lib/csv";
import { ASSET_CSV_HEADERS } from "@/lib/assetImport";
import { logExportActivity } from "@/lib/logActivity";
import { WarrantyIndicator } from "@/components/assets/WarrantyIndicator";
import { assessWarranty } from "@/lib/warranty";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const INITIAL_ASSET_LIMIT = 10;

interface Organization {
  id: string;
  name: string;
}

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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === "super_admin";
  // Only org-scoped roles submit requests — super_admin approves them and
  // Operational Managers (no organization) don't file them.
  const canRequest = Boolean(user?.organizationId);

  useEffect(() => {
    if (!isSuperAdmin) return;

    let cancelled = false;
    const fetchOrganizations = async () => {
      setLoadingOrganizations(true);
      try {
        const supabase = createClient();
        const { data: { session } } = supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };
        if (!session?.access_token) {
          throw new Error("Your session has expired. Sign in again to view organizations.");
        }

        const response = await fetch("/api/admin/organizations?forAssetImport=true", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load organizations.");
        if (!cancelled) setOrganizations(result.organizations ?? []);
      } catch (organizationError) {
        if (!cancelled) {
          console.error("Asset registry organization list failed", organizationError);
          setError(organizationError instanceof Error ? organizationError.message : "Unable to load organizations.");
        }
      } finally {
        if (!cancelled) setLoadingOrganizations(false);
      }
    };

    fetchOrganizations();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

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

  const assetItems = useMemo(
    () =>
      isSuperAdmin && selectedOrganizationId
        ? assets.filter((asset) => asset.organization_id === selectedOrganizationId)
        : isSuperAdmin
          ? []
          : assets,
    [assets, isSuperAdmin, selectedOrganizationId]
  );
  const organizationAssetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      if (asset.organization_id) {
        counts.set(asset.organization_id, (counts.get(asset.organization_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [assets]);
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
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
        asset.organizations?.name,
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

  const handleDeleteAsset = async (asset: any) => {
    if (!window.confirm(`Remove "${asset.name}" (${asset.asset_number}) from the active register? Its maintenance, inspection, and transfer history will be retained.`)) {
      return;
    }

    setDeletingAssetId(asset.id);
    try {
      const supabase = createClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (!session?.access_token) {
        throw new Error("Your session has expired. Sign in again to delete assets.");
      }

      const response = await fetch(`/api/admin/assets/${asset.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete asset.");

      setAssets((current) => current.filter((item) => item.id !== asset.id));
      if (result.notificationsSent === false) {
        toast.warning("Asset removed, but the notification could not be recorded.");
      } else {
        toast.success(`${asset.asset_number} was removed from the active register. Organization administrators were notified.`);
      }
    } catch (deleteError) {
      toast.error("Asset deletion failed", {
        description: deleteError instanceof Error ? deleteError.message : undefined,
      });
    } finally {
      setDeletingAssetId(null);
    }
  };

  const assetLinkHref = (asset: any) => `/assets/${asset.id}`;

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={loading || (isSuperAdmin && !selectedOrganization)}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {isSuperAdmin && !selectedOrganization ? (
            <Card>
              <CardHeader>
                <CardTitle>Organizations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select an organization to view and manage its asset register.
                </p>
              </CardHeader>
              <CardContent>
                {loadingOrganizations || loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => <ListRowSkeleton key={index} />)}
                  </div>
                ) : organizations.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">No organizations found.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {organizations.map((organization) => (
                      <button
                        key={organization.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrganizationId(organization.id);
                          setSearchQuery("");
                          setShowAllAssets(false);
                        }}
                        className="flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="rounded-xl bg-primary/10 p-3 text-primary">
                          <Building2 className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{organization.name}</span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {organizationAssetCounts.get(organization.id) ?? 0} assets
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {(!isSuperAdmin || selectedOrganization) && (
          <>
          {isSuperAdmin && selectedOrganization && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-3 mb-1"
                  onClick={() => setSelectedOrganizationId(null)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  All organizations
                </Button>
                <h2 className="text-xl font-semibold">{selectedOrganization.name}</h2>
                <p className="text-sm text-muted-foreground">Assets registered to this organization.</p>
              </div>
            </div>
          )}

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
                <p className="mt-1 text-sm text-muted-foreground">{isSuperAdmin ? "Records belonging to the selected organization." : "Latest records with quick edit access."}</p>
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
                <div className={`hidden items-center gap-4 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground sm:grid ${isSuperAdmin ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"}`}>
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
                          {isSuperAdmin && (
                            <div className="truncate text-xs font-medium text-primary">
                              {asset.organizations?.name || "Organization unavailable"}
                            </div>
                          )}
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
                          {isSuperAdmin ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-lg"
                              aria-label={`Delete ${asset.name}`}
                              title="Delete asset"
                              disabled={deletingAssetId === asset.id}
                              onClick={() => handleDeleteAsset(asset)}
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingAssetId === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          ) : canRequest && (
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
                            {isSuperAdmin ? "View asset" : "Edit"}
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
                        {isSuperAdmin ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deletingAssetId === asset.id}
                            onClick={() => handleDeleteAsset(asset)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        ) : canRequest && (
                          <RequestAssetDialog
                            assetId={asset.id}
                            assetName={asset.name}
                            assetNumber={asset.asset_number}
                          />
                        )}
                        {isSuperAdmin ? (
                          <Link href={assetLinkHref(asset)} className="text-sm font-medium text-primary hover:underline">View asset</Link>
                        ) : (
                          <Link href={assetLinkHref(asset)} className="text-sm font-medium text-primary hover:underline">Edit</Link>
                        )}
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
        </>
      )}
    </div>
  );
}
