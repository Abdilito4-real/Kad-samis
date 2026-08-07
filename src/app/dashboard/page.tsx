"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  FileSearch,
  MoreVertical,
  Package,
  TrendingUp,
  ChevronLeft,
  ArrowRightLeft,
  PackagePlus,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveGrid } from "@/components/layout/ResponsiveGrid";
import { MetricCard } from "@/components/layout/MetricCard";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { displayIdentity } from "@/lib/displayIdentity";

type Tone = "neutral" | "emerald" | "sky" | "amber" | "violet" | "rose";

const TONE_STYLES: Record<Tone, { chip: string; icon: string; stroke: string }> = {
  neutral: { chip: "bg-slate-500/10", icon: "text-slate-400", stroke: "#94a3b8" },
  emerald: { chip: "bg-emerald-500/10", icon: "text-emerald-500", stroke: "#10b981" },
  sky: { chip: "bg-sky-500/10", icon: "text-sky-400", stroke: "#38bdf8" },
  amber: { chip: "bg-amber-500/10", icon: "text-amber-500", stroke: "#f59e0b" },
  violet: { chip: "bg-violet-500/10", icon: "text-violet-400", stroke: "#a78bfa" },
  rose: { chip: "bg-rose-500/10", icon: "text-rose-500", stroke: "#f43f5e" },
};

// A quiet, decorative sparkline — not wired to real historical data, so it
// never asserts a trend that isn't actually being tracked yet.
function Sparkline({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0" aria-hidden>
      <polyline
        points="0,18 9,14 18,16 27,9 36,12 45,5 54,8 64,3"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

const REQUEST_ICONS: Record<string, any> = {
  transfer: ArrowRightLeft,
  maintenance: Wrench,
  asset: PackagePlus,
};

const requestIconFor = (type?: string) => REQUEST_ICONS[(type || "").toLowerCase()] || FileSearch;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  in_review: "bg-sky-500/10 text-sky-500",
  approved: "bg-emerald-500/10 text-emerald-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  active: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
  cancelled: "bg-rose-500/10 text-rose-500",
};

const CONDITION_BADGE: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-500",
  good: "bg-sky-500/10 text-sky-500",
  fair: "bg-amber-500/10 text-amber-600",
  poor: "bg-orange-500/10 text-orange-500",
  damaged: "bg-rose-500/10 text-rose-500",
};

const statusBadgeClass = (status?: string) => STATUS_BADGE[(status || "").toLowerCase()] || "bg-muted text-muted-foreground";
const conditionBadgeClass = (condition?: string) => CONDITION_BADGE[(condition || "").toLowerCase()] || "bg-muted text-muted-foreground";

const timeAgo = (value?: string | null) => {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const orgName = searchParams.get("orgName");
  const isSuperAdmin = user?.roleId === "super_admin";
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [currentOrgName, setCurrentOrgName] = useState<string | null>(null);
  const [superAdminDashboard, setSuperAdminDashboard] = useState<any>(null);
  const [loadingSuperAdminData, setLoadingSuperAdminData] = useState(false);
  const [superAdminDashboardError, setSuperAdminDashboardError] = useState<string | null>(null);

  useEffect(() => {
    // Sessions live in localStorage, not cookies (see lib/supabase/client.ts),
    // so the API route can't identify the caller without an explicit bearer
    // token — without it, it falls back to generic/global counts instead of
    // this org admin's own organization data.
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;
    const queryString = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    setLoadingSummary(true);
    setSummaryError(null);

    const loadSummary = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };

        if (!session?.access_token) {
          throw new Error("No authenticated session available for dashboard fetch");
        }

        const response = await fetch(`/api/dashboard/summary${queryString}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          credentials: "include",
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok || data?.error) {
          setSummaryError(data?.error || "Unable to load dashboard summary");
          setSummary(null);
        } else {
          setSummary(data.summary);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Dashboard summary load error", error);
        setSummaryError("Unable to load dashboard summary");
        setSummary(null);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [orgId, authLoading, user]);

  useEffect(() => {
    if (!isSuperAdmin || !user) {
      setSuperAdminDashboard(null);
      setSuperAdminDashboardError(null);
      return;
    }

    let isMounted = true;

    const loadSuperAdminDashboard = async () => {
      try {
        setLoadingSuperAdminData(true);
        setSuperAdminDashboardError(null);

        const supabase = createClient();
        const { data: { session } } = supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };

        if (!session?.access_token) {
          throw new Error("No authenticated session available for dashboard fetch");
        }

        const response = await fetch("/api/admin/super-admin-dashboard", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
          credentials: "include",
        });

        const body = await response.text();
        let payload: any;

        try {
          payload = JSON.parse(body);
        } catch {
          throw new Error("Dashboard response was not valid JSON");
        }

        if (!response.ok) {
          throw new Error(payload?.error ? `${payload.error}${payload?.details ? `: ${JSON.stringify(payload.details)}` : ""}` : "Failed to load dashboard");
        }

        if (isMounted) {
          setSuperAdminDashboard(payload.dashboard);
        }
      } catch (error) {
        console.error("Super admin dashboard load error", error);
        if (isMounted) {
          setSuperAdminDashboardError(error instanceof Error ? error.message : "Unable to load dashboard data");
        }
      } finally {
        if (isMounted) {
          setLoadingSuperAdminData(false);
        }
      }
    };

    loadSuperAdminDashboard();

    return () => {
      isMounted = false;
    };
  }, [isSuperAdmin, user]);

  useEffect(() => {
    let isMounted = true;

    const resolveOrgName = async () => {
      if (orgId) {
        if (isMounted) setCurrentOrgName(orgName ?? null);
        return;
      }

      if (!user?.organizationId || isSuperAdmin) {
        if (isMounted) setCurrentOrgName(null);
        return;
      }

      try {
        const response = await fetch(`/api/admin/organizations/${user.organizationId}`, {
          credentials: 'include',
        });
        const json = await response.json();

        if (response.ok && json?.organization?.name && isMounted) {
          setCurrentOrgName(json.organization.name);
        } else if (!response.ok) {
          console.warn('Failed to fetch organization:', response.status, json?.error);
          if (isMounted) setCurrentOrgName(null);
        } else if (isMounted) {
          setCurrentOrgName(null);
        }
      } catch (err) {
        console.warn('Error resolving org name:', err);
        if (isMounted) setCurrentOrgName(null);
      }
    };

    resolveOrgName();

    return () => {
      isMounted = false;
    };
  }, [orgId, orgName, user?.organizationId, isSuperAdmin]);

  // Use organization name if available and user is org admin, otherwise use user name
  const userName = !isSuperAdmin && (currentOrgName || summary?.organization?.name)
    ? currentOrgName || summary?.organization?.name
    : user?.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
      : user
        ? displayIdentity({ email: user.email, username: user.username, role: user.roleId })
        : "there";

  const dashboardTitle = orgId
    ? summary?.organization?.name || orgName || "Organization"
    : !isSuperAdmin && (currentOrgName || summary?.organization?.name)
      ? currentOrgName || summary?.organization?.name
      : "Executive summary";

  const headerOrgLabel = orgId
    ? summary?.organization?.name || orgName || currentOrgName || "Selected organization"
    : currentOrgName || "Enterprise view";

  const router = useRouter();
  const showBackToSuperAdmin = isSuperAdmin && !!orgId;

  const requestItems = (summary?.requests ?? []) as Array<any>;
  const assetItems = (summary?.assets ?? []) as Array<any>;
  const isLoadingDashboard = loadingSummary || (isSuperAdmin && loadingSuperAdminData);
  const superAdminPortfolioValue = superAdminDashboard?.portfolio?.totalCurrentValue;
  const superAdminOrgMetrics = (superAdminDashboard?.organizationMetrics ?? []) as Array<any>;
  const superAdminPendingApprovals = (superAdminDashboard?.pendingRequests ?? []) as Array<any>;

  const formatCurrency = (value: number | string | null | undefined) => {
    const numericValue = typeof value === "number" ? value : Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return "—";
    }

    return new Intl.NumberFormat("en-NG", {
      maximumFractionDigits: 0,
    }).format(numericValue);
  };

  // Check if viewing org-specific view or if org admin is viewing their own org
  const isOrgView = orgId || (!isSuperAdmin && summary?.organization);

  const statsToRender: Array<{ title: string; value: string | number; detail: string; icon: any; tone: Tone }> = isOrgView
    ? [
        {
          title: "Organization",
          value: summary?.organization?.name ?? orgName ?? "—",
          detail: summary?.organization?.organization_type ? `${summary.organization.organization_type} • ${summary.organization.status ?? "active"}` : "Organization details",
          icon: Package,
          tone: "neutral",
        },
        {
          title: "Assets",
          value: assetItems.length ?? 0,
          detail: "Assets in this organization",
          icon: Package,
          tone: "sky",
        },
        {
          title: "Open requests",
          value: summary?.requestsCount ?? 0,
          detail: "Requests in this organization",
          icon: FileSearch,
          tone: "emerald",
        },
        {
          title: "Pending review",
          value: summary?.pendingRequests ?? 0,
          detail: "Awaiting approval",
          icon: AlertTriangle,
          tone: "amber",
        },
      ]
    : isSuperAdmin
    ? [
        {
          title: "Organizations",
          value: superAdminDashboard?.superAdmin?.organizations ?? summary?.organizations ?? "—",
          detail: "Registered MDAs",
          icon: Package,
          tone: "sky",
        },
        {
          title: "Maintenance",
          value: superAdminDashboard?.superAdmin?.pendingMaintenanceRequests ?? "—",
          detail: "Pending maintenance requests",
          icon: AlertTriangle,
          // Pending maintenance is an outstanding issue, not a good sign — it
          // was previously colored green here, which reads as "all fine."
          tone: "rose",
        },
        {
          title: "Pending reviews",
          value: superAdminPendingApprovals.length || summary?.pendingRequests || "—",
          detail: "Requests awaiting review",
          icon: FileSearch,
          tone: "amber",
        },
        {
          title: "Portfolio value",
          value: superAdminPortfolioValue ? `₦${formatCurrency(superAdminPortfolioValue)}` : "—",
          detail: "Live asset value after depreciation",
          icon: TrendingUp,
          // A financial total isn't inherently a warning — it was previously
          // colored red/rose here, which reads as "something's wrong."
          tone: "emerald",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-background p-4 shadow-xl sm:p-6"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {showBackToSuperAdmin ? (
            <div className="flex items-center rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm lg:self-start">
              <button
                type="button"
                onClick={() => router.push('/admin/super-admin-dashboard')}
                className="inline-flex items-center gap-2 text-sm font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Super Admin Dashboard
              </button>
            </div>
          ) : null}
          <div className="flex flex-1 items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 text-base font-semibold text-primary shadow-lg sm:h-14 sm:w-14 sm:text-lg">
              {getInitials(userName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.3em] text-primary">{dashboardTitle}</p>
              <h1 className="mt-2 break-words text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">Welcome back, {userName}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {isLoadingDashboard
                  ? "Loading your dashboard summary…"
                  : summaryError || superAdminDashboardError
                    ? "Unable to load metrics right now."
                    : orgId
                      ? `Review current stats for ${orgName ?? summary?.organization?.name ?? "this organization"}.`
                      : isSuperAdmin
                        ? "Monitor portfolio health and approvals across the enterprise."
                        : "Track asset health and service requests in one place."}
              </p>
            </div>
          </div>

          {/* Was a separate "Profile" box repeating the same name already in the
              heading above, plus a role pill. Collapsed into one compact badge. */}
          <div className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-border bg-background/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {isSuperAdmin ? "Super admin overview" : headerOrgLabel}
          </div>
        </div>
      </motion.div>

      {statsToRender.length > 0 ? (
        <motion.div initial="hidden" animate="show">
          <ResponsiveGrid cols={{ base: 1, md: 2, xl: 4 }}>
            {statsToRender.map((stat, index) => {
              const tone = TONE_STYLES[stat.tone];
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="h-full"
                >
                  <MetricCard
                    title={stat.title}
                    value={stat.value}
                    icon={stat.icon}
                    tone={stat.tone}
                    detail={stat.detail}
                    trailing={
                      <div className="flex items-end justify-between border-t border-border pt-3">
                        <span className="text-xs font-medium text-muted-foreground">— vs last month</span>
                        <Sparkline stroke={tone.stroke} />
                      </div>
                    }
                  />
                </motion.div>
              );
            })}
          </ResponsiveGrid>
        </motion.div>
      ) : (
        <Card className="border-dashed border-border/80 bg-background/70">
          <CardContent className="py-6 text-sm text-muted-foreground">
            No dashboard metrics are available yet for this workspace.
          </CardContent>
        </Card>
      )}

      {isSuperAdmin ? (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          {/* min-w-0 on each grid item — without it, a CSS Grid item defaults to
              min-width: auto, so a track will grow past its container to fit
              wide content (long org names here) instead of shrinking/wrapping,
              forcing the whole page into horizontal scroll. */}
          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Agency performance</CardTitle>
              <Link href="/mdas" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {superAdminOrgMetrics.length > 0 ? (
                <div className="max-h-[24rem] overflow-y-auto pr-1">
                  <div className="hidden items-center gap-x-4 px-3 pb-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
                    <span>Organization</span>
                    <span className="text-right">Assets</span>
                    <span className="text-right">Maintenance</span>
                    <span className="text-right">Value</span>
                    <span className="w-6" />
                  </div>
                  <div className="space-y-2">
                    {superAdminOrgMetrics.map((organization: any) => (
                      <div
                        key={organization.organizationId}
                        className="min-w-0 rounded-2xl border border-border bg-background/70 px-3 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] sm:items-center sm:gap-x-4"
                      >
                        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src="/images/auth/kaduna-state.svg"
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full border border-border bg-card object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{organization.organizationName}</p>
                              {organization.organizationType ? (
                                <Badge variant="secondary" className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
                                  {organization.organizationType}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label="Organization actions"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:mt-0 sm:contents">
                          <span className="sm:text-right sm:text-sm sm:tabular-nums">{organization.assetCount} assets</span>
                          <span className="sm:text-right sm:text-sm sm:tabular-nums">{organization.pendingMaintenance ?? 0} maintenance</span>
                          <span className="font-medium text-foreground sm:text-right sm:text-sm sm:font-medium sm:tabular-nums">
                            ₦{formatCurrency(organization.totalCurrentValue)}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label="Organization actions"
                          className="ml-auto hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                  No organization performance data is available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pending approvals</CardTitle>
              <Link href="/requests" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {superAdminPendingApprovals.length > 0 ? (
                <div className="space-y-3">
                  {superAdminPendingApprovals.slice(0, 5).map((request: any) => {
                    const RequestIcon = requestIconFor(request.type);
                    return (
                      <div key={request.id} className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <RequestIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{request.title || "Approval request"}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {request.organizations?.name || "Organization"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Badge className="bg-amber-500/15 text-[10px] font-semibold uppercase tracking-wide text-amber-500 hover:bg-amber-500/15">
                            {request.status || "pending"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{timeAgo(request.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                  There are no pending approvals to review right now.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent requests</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Live data
            </div>
          </CardHeader>
          <CardContent>
            {requestItems.length > 0 ? (
              <div className="space-y-3">
                {requestItems.map((request) => (
                  <div key={request.id} className="min-w-0 rounded-2xl border border-border bg-background/70 px-3 py-3 sm:flex sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{request.title || "Request update"}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{request.type || "Request"}</p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3 sm:mt-0 sm:flex-col sm:items-end sm:gap-1.5">
                      <Badge className={`${statusBadgeClass(request.status)} capitalize`}>{request.status || "pending"}</Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {request.created_at ? new Date(request.created_at).toLocaleDateString() : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                No requests were found for this workspace yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Asset snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            {assetItems.length > 0 ? (
              <div className="space-y-3">
                {assetItems.map((asset) => (
                  <div key={asset.id} className="min-w-0 rounded-2xl border border-border bg-background/70 p-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate font-medium">{asset.name || asset.asset_number || "Asset"}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {asset.asset_number ? (
                        <span className="text-xs text-muted-foreground">{asset.asset_number}</span>
                      ) : null}
                      <Badge className={`${statusBadgeClass(asset.status)} capitalize`}>{asset.status || "active"}</Badge>
                      {asset.condition ? (
                        <Badge className={`${conditionBadgeClass(asset.condition)} capitalize`}>{asset.condition}</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
                No assets are available in the current data set.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Operational shortcuts</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Workflow ready
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/assets" className="rounded-2xl border border-border bg-background/70 p-4 text-left transition-all hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300">
              <div className="flex items-center justify-between">
                <p className="font-medium">Open asset register</p>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Review the live asset catalog.</p>
            </Link>
            <Link href="/requests" className="rounded-2xl border border-border bg-background/70 p-4 text-left transition-all hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300">
              <div className="flex items-center justify-between">
                <p className="font-medium">Review requests</p>
                <ArrowUpRight className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Check the latest service and approval requests.</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}