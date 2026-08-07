"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Globe2, LayoutDashboard, Mail, Plus, RefreshCcw, Search, Users } from 'lucide-react';
import StatsCard from '@/components/mdas/StatsCard';
import LoadingSkeleton from '@/components/mdas/LoadingSkeleton';
import OrganizationCard from '@/components/mdas/OrganizationCard';
import OrganizationDrawer from '@/components/mdas/OrganizationDrawer';
import CreateOrganizationDialog from '@/components/mdas/CreateOrganizationDialog';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth-provider';
import { createClient } from '@/lib/supabase/client';

type Org = {
  id: string;
  name: string;
  organization_type: 'MINISTRY' | 'DEPARTMENT' | 'AGENCY' | string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  email?: string;
  phone?: string;
  address?: string;
  profiles?: Array<{ id: string; email?: string; role?: string }>;
  assets?: Array<{ id: string; name: string; status: string; condition?: string; department?: string }>;
};

const CATEGORY_TITLES: Record<string, string> = {
  ALL: 'All',
  MINISTRY: 'Ministries',
  DEPARTMENT: 'Departments',
  AGENCY: 'Agencies',
};

export default function MdasPage() {
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.roleId === 'super_admin';
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [currentTab, setCurrentTab] = useState<'ALL' | 'MINISTRY' | 'DEPARTMENT' | 'AGENCY'>('ALL');
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(9);
  const [loading, setLoading] = useState(true);
  const [drawerOrg, setDrawerOrg] = useState<Org | null>(null);
  const [drawerEdit, setDrawerEdit] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [hasLoadedOrgs, setHasLoadedOrgs] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client unavailable');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const nextSessionKey = session?.access_token ?? 'anonymous';
      if (sessionKey && sessionKey !== nextSessionKey) {
        return;
      }
      if (!sessionKey) {
        setSessionKey(nextSessionKey);
      }

      const [organizationsResponse, requestsResponse] = await Promise.all([
        fetch('/api/admin/organizations', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/admin/requests/summary', { headers: authHeaders, cache: 'no-store' }),
      ]);
      const organizationsJson = await organizationsResponse.json();
      const requestsJson = await requestsResponse.json();

      if (!organizationsResponse.ok) {
        throw new Error(organizationsJson?.error || 'Unable to load organizations');
      }

      setOrgs(organizationsJson.organizations || []);
      setPendingRequests(requestsResponse.ok ? requestsJson.pending || 0 : (current) => current);
      setHasLoadedOrgs(true);
    } catch {
      // Preserve existing organization list to avoid blinking when retries happen.
      if (!hasLoadedOrgs) {
        setOrgs([]);
      }
      setPendingRequests((current) => current);
    } finally {
      setLoading(false);
    }
  }, [sessionKey, hasLoadedOrgs]);

  useEffect(() => {
    if (!authLoading && user?.id && !hasLoadedOrgs) {
      refreshList();
    }
  }, [authLoading, user?.id, hasLoadedOrgs, refreshList]);

  const deleteOrganization = async (id: string) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || 'Unable to delete organization');
      }

      setOrgs((prev) => prev.filter((org) => org.id !== id));
      setDrawerOrg((prev) => (prev?.id === id ? null : prev));
      setDrawerEdit(false);
      toast.success('Organization deleted');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization');
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = (updated: Org) => {
    setOrgs((prev) => prev.map((org) => (org.id === updated.id ? updated : org)));
    setDrawerOrg((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const openEditOrganization = (org: Org) => {
    setDrawerOrg(org);
    setDrawerEdit(true);
  };

  const filteredOrgs = useMemo(() => {
    return orgs
      .filter((org) => {
        if (typeFilter !== 'ALL' && org.organization_type !== typeFilter) return false;
        if (statusFilter !== 'ALL' && (org.status || 'active').toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          org.name.toLowerCase().includes(q) ||
          (org.email || '').toLowerCase().includes(q) ||
          (org.phone || '').toLowerCase().includes(q) ||
          (org.address || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === 'az') return a.name.localeCompare(b.name);
        if (sort === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        if (sort === 'updated') return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [orgs, query, typeFilter, statusFilter, sort]);

  const grouped = useMemo(() => {
    const map: Record<string, Org[]> = { MINISTRY: [], DEPARTMENT: [], AGENCY: [] };
    filteredOrgs.forEach((org) => {
      const type = (org.organization_type || '').toUpperCase();
      if (map[type]) map[type].push(org);
    });
    return map;
  }, [filteredOrgs]);

  const tabCounts = {
    ALL: filteredOrgs.length,
    MINISTRY: grouped.MINISTRY.length,
    DEPARTMENT: grouped.DEPARTMENT.length,
    AGENCY: grouped.AGENCY.length,
  };

  const visibleOrgs = useMemo(() => {
    if (currentTab === 'ALL') return filteredOrgs;
    return filteredOrgs.filter((org) => org.organization_type === currentTab);
  }, [filteredOrgs, currentTab]);

  const pageCount = Math.max(1, Math.ceil(visibleOrgs.length / pageSize));
  const paginatedOrgs = visibleOrgs.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
  const isEmpty = !loading && visibleOrgs.length === 0;

  const handleExport = () => {
    if (orgs.length === 0) {
      toast.error('No organizations available to export');
      return;
    }

    const header = ['ID', 'Name', 'Type', 'Status', 'Email', 'Phone', 'Address', 'Created At'];
    const rows = orgs.map((org) => [
      org.id,
      org.name,
      org.organization_type,
      org.status ?? '',
      org.email ?? '',
      org.phone ?? '',
      org.address ?? '',
      org.created_at ?? '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'organizations.csv';
    anchor.click();
    URL.revokeObjectURL(url);

    toast.success('Organization export ready');
  };

  const handleTabChange = (tab: 'ALL' | 'MINISTRY' | 'DEPARTMENT' | 'AGENCY') => {
    setCurrentTab(tab);
    setPageIndex(1);
  };

  return (
    <>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <section className="rounded-[2rem] border border-border bg-card px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/5">
                    Dashboard
                  </Link>
                  <span className="text-muted-foreground">›</span>
                  <span className="text-muted-foreground">Organizations</span>
                  <span className="text-muted-foreground">›</span>
                  <span className="font-semibold text-foreground">MDAs</span>
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold tracking-tight">Ministries, Departments & Agencies</h1>
                  <p className="max-w-3xl text-base text-muted-foreground">Manage every Ministry, Department and Agency registered within Kaduna State, with fast access to administrators, assets, status, and control actions.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={refreshList}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </div>
          </section>

          <ResponsiveGrid cols={{ base: 1, md: 2, xl: 6 }}>
            <StatsCard title="Total Organizations" value={orgs.length} icon={<LayoutDashboard className="h-6 w-6" />} tone="neutral" />
            <StatsCard title="Ministries" value={(grouped['MINISTRY'] || []).length} icon={<Building2 className="h-6 w-6" />} tone="emerald" />
            <StatsCard title="Departments" value={(grouped['DEPARTMENT'] || []).length} icon={<LayoutDashboard className="h-6 w-6" />} tone="sky" />
            <StatsCard title="Agencies" value={(grouped['AGENCY'] || []).length} icon={<Globe2 className="h-6 w-6" />} tone="amber" />
            <StatsCard title="Administrators" value={orgs.reduce((sum, org) => sum + (org.profiles?.length || 0), 0)} icon={<Users className="h-6 w-6" />} tone="violet" />
            <StatsCard title="Pending Requests" value={pendingRequests} icon={<Mail className="h-6 w-6" />} tone="rose" />
          </ResponsiveGrid>

          {/* Toolbar: search, filters, and actions each get their own row so the
              hierarchy reads top-to-bottom instead of competing for space. */}
          <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <div className="space-y-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPageIndex(1); }}
                  placeholder="Search by name, email, phone, or address"
                  aria-label="Search organizations"
                  className="w-full rounded-full border border-input bg-background py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid flex-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <span className="px-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Organization</span>
                    <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPageIndex(1); }}>
                      <SelectTrigger aria-label="Filter by organization type" className="rounded-3xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All types</SelectItem>
                        <SelectItem value="MINISTRY">Ministry</SelectItem>
                        <SelectItem value="DEPARTMENT">Department</SelectItem>
                        <SelectItem value="AGENCY">Agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="px-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Status</span>
                    <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPageIndex(1); }}>
                      <SelectTrigger aria-label="Filter by status" className="rounded-3xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="px-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
                    <Select value={sort} onValueChange={setSort}>
                      <SelectTrigger aria-label="Sort organizations" className="rounded-3xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="az">A - Z</SelectItem>
                        <SelectItem value="updated">Recently updated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    onClick={handleExport}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium transition hover:bg-accent"
                  >
                    <FileText className="h-4 w-4" /> Export
                  </button>
                  {isSuperAdmin && (
                    <button
                      onClick={() => setDialogOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600"
                    >
                      <Plus className="h-4 w-4" /> Register Organization
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {(['ALL', 'MINISTRY', 'DEPARTMENT', 'AGENCY'] as const).map((tab) => {
                  const isActive = currentTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabChange(tab)}
                      className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition ${isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'border border-border bg-background text-muted-foreground hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-foreground'}`}
                    >
                      {CATEGORY_TITLES[tab]}
                      <span
                        className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}
                      >
                        {tabCounts[tab]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-muted-foreground">Showing {visibleOrgs.length} organizations</div>
            </div>
          </section>

          {loading ? (
            <LoadingSkeleton />
          ) : isEmpty ? (
            <section className="rounded-[2rem] border border-dashed border-border bg-card p-12 text-center shadow-sm">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-4xl">📭</div>
              <h2 className="text-2xl font-semibold">No organizations found</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">Register your first Ministry, Department or Agency to start managing administrators, assets, and approvals from this control center.</p>
              {isSuperAdmin && <button onClick={() => setDialogOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-3xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
                <Plus className="h-4 w-4" /> Register Organization
              </button>}
            </section>
          ) : (
            <section className="space-y-2 w-full">
              {paginatedOrgs.map((org) => (
                <OrganizationCard
                  key={org.id}
                  compact
                  org={org}
                  readOnly={isSuperAdmin}
                  onToggle={() => {
                    setDrawerOrg(org);
                    setDrawerEdit(false);
                  }}
                  onEdit={isSuperAdmin ? undefined : () => openEditOrganization(org)}
                />
              ))}
            </section>
          )}

          {!loading && !isEmpty && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-border bg-card p-4 text-sm text-muted-foreground">
              <div>{Math.min((pageIndex - 1) * pageSize + 1, visibleOrgs.length)}–{Math.min(pageIndex * pageSize, visibleOrgs.length)} of {visibleOrgs.length} organizations</div>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => Math.max(prev - 1, 1))}
                  disabled={pageIndex === 1}
                  className="rounded-full border border-border bg-background px-4 py-2 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-2 rounded-full bg-muted">Page {pageIndex} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPageIndex((prev) => Math.min(prev + 1, pageCount))}
                  disabled={pageIndex === pageCount}
                  className="rounded-full border border-border bg-background px-4 py-2 transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
      </div>

      <OrganizationDrawer org={drawerOrg} open={!!drawerOrg} initiallyEditing={drawerEdit} readOnly={isSuperAdmin} onClose={() => { setDrawerOrg(null); setDrawerEdit(false); }} onDelete={isSuperAdmin ? undefined : (id) => deleteOrganization(id)} onUpdate={isSuperAdmin ? undefined : updateOrganization} />

      <CreateOrganizationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={(org) => {
        setOrgs((prev) => [org, ...prev]);
        toast.success('Organization added');
      }} />
    </>
  );
}