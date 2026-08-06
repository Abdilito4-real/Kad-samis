'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, ArrowLeft, BarChart3, ClipboardList, Mail, MapPin, Package, Phone, Users, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';
import OrganizationOverview from './OrganizationOverview';
import OrganizationAdministrators from './OrganizationAdministrators';
import OrganizationStatistics from './OrganizationStatistics';
import OrganizationAssets from './OrganizationAssets';
import OrganizationActivity from './OrganizationActivity';
import OrganizationRequests from './OrganizationRequests';

type TabValue = 'overview' | 'administrators' | 'statistics' | 'assets' | 'activity' | 'requests';

type Organization = {
  id: string;
  name: string;
  organization_type: string;
  status?: string;
  email?: string;
  phone?: string;
  address?: string;
  profiles?: Array<{ id: string; email?: string; role?: string }>;
};

const tabLabels: Record<TabValue, { label: string; icon: typeof BarChart3 }> = {
  overview: { label: 'Overview', icon: BarChart3 },
  administrators: { label: 'Administrators', icon: Users },
  statistics: { label: 'Statistics', icon: BarChart3 },
  assets: { label: 'Assets', icon: Package },
  activity: { label: 'Activity', icon: Activity },
  requests: { label: 'Requests', icon: ClipboardList },
};

const validTabValues: TabValue[] = ['overview', 'administrators', 'statistics', 'assets', 'activity', 'requests'];

const TYPE_STYLES: Record<string, { badge: string; ring: string; text: string }> = {
  MINISTRY: { badge: 'bg-emerald-500/10 text-emerald-500', ring: 'border-emerald-500/50', text: 'text-emerald-500' },
  DEPARTMENT: { badge: 'bg-sky-500/10 text-sky-500', ring: 'border-sky-500/50', text: 'text-sky-500' },
  AGENCY: { badge: 'bg-amber-500/10 text-amber-600', ring: 'border-amber-500/50', text: 'text-amber-500' },
};
const FALLBACK_TYPE_STYLE = { badge: 'bg-slate-500/10 text-slate-400', ring: 'border-slate-500/50', text: 'text-slate-400' };

const getInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export default function OrganizationDetailTabs({ orgId, initialTab }: { orgId: string; initialTab?: TabValue }) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabValue>(initialTab ?? 'overview');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === 'super_admin';

  const fetchOrganization = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(orgId)}`, {
        credentials: 'include',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      const data = await response.json();

      if (!response.ok || !data?.organization) {
        throw new Error(data?.error || 'Unable to load organization details');
      }

      setOrg(data.organization);
    } catch (err: any) {
      console.error('Failed to load organization details', err);
      setError(err?.message || 'Unable to load organization details');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  useEffect(() => {
    const tabFromQuery = searchParams.get('tab') as TabValue | null;
    if (tabFromQuery && validTabValues.includes(tabFromQuery)) {
      setSelectedTab(tabFromQuery);
      return;
    }
    if (initialTab && validTabValues.includes(initialTab)) {
      setSelectedTab(initialTab);
      return;
    }
    setSelectedTab('overview');
  }, [searchParams, initialTab]);

  const typeStyle = org ? (TYPE_STYLES[org.organization_type] ?? FALLBACK_TYPE_STYLE) : FALLBACK_TYPE_STYLE;
  const statusBadge = org?.status === 'active'
    ? 'bg-emerald-500/10 text-emerald-500'
    : 'bg-rose-500/10 text-rose-500';
  const adminCount = org?.profiles?.length ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-56 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-500">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Unable to load organization</p>
          <p className="mt-1 text-rose-500/80">{error}</p>
          <Button className="mt-4" size="sm" onClick={() => fetchOrganization()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Organization not found.
      </div>
    );
  }

  const metaRows = [
    { icon: Mail, value: org.email, href: org.email ? `mailto:${org.email}` : undefined },
    { icon: Phone, value: org.phone, href: org.phone ? `tel:${org.phone}` : undefined },
    { icon: MapPin, value: org.address },
  ].filter((row) => row.value);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="inline-flex items-center gap-2" onClick={() => router.push('/mdas')}>
        <ArrowLeft className="h-4 w-4" />
        Back to organizations
      </Button>

      <Card className="overflow-hidden rounded-3xl border-border bg-gradient-to-br from-card via-card to-background p-6 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-1 items-start gap-4">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 ${typeStyle.ring} ${typeStyle.badge} text-xl font-semibold`}>
              {getInitials(org.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={typeStyle.badge}>{org.organization_type}</Badge>
                <Badge className={statusBadge}>{org.status?.toUpperCase() || 'ACTIVE'}</Badge>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{org.name}</h1>
              {metaRows.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {metaRows.map((row, index) => {
                    const RowIcon = row.icon;
                    const content = (
                      <span className="flex items-center gap-1.5">
                        <RowIcon className="h-3.5 w-3.5 shrink-0" />
                        {row.value}
                      </span>
                    );
                    return row.href ? (
                      <a key={index} href={row.href} className="transition hover:text-primary">
                        {content}
                      </a>
                    ) : (
                      <span key={index}>{content}</span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No contact details on file yet.</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl border border-border bg-background/60 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-foreground">{adminCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">{adminCount === 1 ? 'Administrator' : 'Administrators'}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <div className="p-6">
          <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as TabValue)} className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-muted/60 p-1.5">
              {validTabValues.map((tab) => {
                const TabIcon = tabLabels[tab].icon;
                return (
                  <TabsTrigger key={tab} value={tab} className="justify-start gap-2 px-3 py-2 text-sm font-medium">
                    <TabIcon className="h-4 w-4" />
                    {tabLabels[tab].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OrganizationOverview org={org} onUpdate={fetchOrganization} isSuperAdmin={isSuperAdmin} />
            </TabsContent>
            <TabsContent value="administrators" className="space-y-6">
              <OrganizationAdministrators org={org} onUpdate={fetchOrganization} />
            </TabsContent>
            <TabsContent value="statistics" className="space-y-6">
              <OrganizationStatistics orgId={orgId} />
            </TabsContent>
            <TabsContent value="assets" className="space-y-6">
              <OrganizationAssets orgId={orgId} />
            </TabsContent>
            <TabsContent value="activity" className="space-y-6">
              <OrganizationActivity orgId={orgId} />
            </TabsContent>
            <TabsContent value="requests" className="space-y-6">
              <OrganizationRequests orgId={orgId} />
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
