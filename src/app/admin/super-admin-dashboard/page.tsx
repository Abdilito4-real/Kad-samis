"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Building2, FileCheck, AlertCircle, Loader2 } from "lucide-react";

interface DashboardData {
  superAdmin: {
    email: string;
    organizations: number;
    totalUsers: number;
    totalRequests: number;
    pendingMaintenanceRequests: number;
  };
  portfolio: {
    totalAssets: number;
    totalOriginalValue: number;
    totalCurrentValue: number;
    totalAccumulatedDepreciation: number;
    depreciationPercentage: string | number;
  };
  organizations: Array<{ id: string; name: string; created_at: string }>;
  organizationMetrics: Array<{
    organizationId: string;
    organizationName: string;
    assetCount: number;
    totalOriginalValue: number;
    totalCurrentValue: number;
    totalAccumulatedDepreciation: number;
    pendingRequests: number;
  }>;
  pendingRequests: Array<{ id: string; title: string; status: string; created_at: string; organizations: { name: string } }>;
}

export default function SuperAdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
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
        let data: any;
        try {
          data = JSON.parse(body);
        } catch (parseError) {
          throw new Error(`Dashboard response invalid JSON: ${body}`);
        }

        if (!response.ok) {
          console.error('Dashboard API error', response.status, data);
          throw new Error(data?.error ? `${data.error}${data?.details ? `: ${JSON.stringify(data.details)}` : ""}` : "Failed to load dashboard");
        }

        setDashboard(data.dashboard);
      } catch (err) {
        const message = (err as any)?.message || "Unable to load dashboard";
        setError(message);
        toast.error("Dashboard error", { description: message });
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      loadDashboard();
    }
  }, [authLoading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-500">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p>{error || "Unable to load dashboard"}</p>
      </div>
    );
  }

  const { superAdmin, portfolio, organizationMetrics, pendingRequests } = dashboard;
  const getOrgName = (orgId: string) => {
    return dashboard.organizations?.find((o) => o.id === orgId)?.name || '—';
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">Monitor all organizations, assets, and approvals across KAD-SAMIS</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Organizations</p>
            <p className="text-3xl font-bold text-foreground">{superAdmin.organizations}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-3xl font-bold text-foreground">{superAdmin.totalUsers}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pending Requests</p>
            <p className="text-3xl font-bold text-amber-500">{superAdmin.totalRequests}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Assets</p>
            <p className="text-3xl font-bold text-foreground">{portfolio.totalAssets}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Pending Maintenance</p>
            <p className="text-3xl font-bold text-rose-500">{superAdmin.pendingMaintenanceRequests}</p>
          </div>
        </Card>
      </div>

      {/* Portfolio Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Original Value</p>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              ₦{(portfolio.totalOriginalValue / 1_000_000).toFixed(2)}M
            </p>
            <p className="text-sm text-muted-foreground">Total asset purchase value</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Current Value</p>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              ₦{(portfolio.totalCurrentValue / 1_000_000).toFixed(2)}M
            </p>
            <p className="text-sm text-muted-foreground">After depreciation</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Depreciation</p>
              <TrendingDown className="h-5 w-5 text-rose-500" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {portfolio.depreciationPercentage}%
            </p>
            <p className="text-sm text-muted-foreground">
              ₦{(portfolio.totalAccumulatedDepreciation / 1_000_000).toFixed(2)}M accumulated
            </p>
          </div>
        </Card>
      </div>

      {/* Organizations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Organizations (MDAs)</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizationMetrics.map((org) => (
            <Card key={org.organizationId} className="p-6 transition-shadow hover:shadow-lg">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{org.organizationName}</p>
                    <p className="text-sm text-muted-foreground">{org.assetCount} assets</p>
                  </div>
                  <Building2 className="h-5 w-5 text-primary" />
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Original Value</span>
                    <span className="font-medium text-foreground">₦{(org.totalOriginalValue / 1_000_000).toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-medium text-foreground">₦{(org.totalCurrentValue / 1_000_000).toFixed(1)}M</span>
                  </div>
                  {org.pendingRequests > 0 && (
                    <div className="flex justify-between text-sm text-amber-500">
                      <span>Pending Approvals</span>
                      <span className="font-medium">{org.pendingRequests}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Pending Approvals</h2>

          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="p-4 transition-colors hover:bg-accent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileCheck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{request.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.organizations?.name || getOrgName((request as any).organization_id)} • {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <a href={`/requests/${request.id}`}>Review</a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
