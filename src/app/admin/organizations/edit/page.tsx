"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowLeft, Save } from 'lucide-react';

type Org = {
  id: string;
  name: string;
  organization_type: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  profiles?: Array<{ id: string; email?: string; role?: string }>;
};

export default function EditOrganizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = searchParams.get('id');

  const { user } = useAuth();
  const isSuperAdmin = user?.roleId === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [organization, setOrganization] = useState<Org | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', status: 'active' });
  const [adminEmail, setAdminEmail] = useState('');
  const [adminId, setAdminId] = useState('');

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: HeadersInit = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      return fetch(`/api/admin/organizations/${orgId}`, {
        credentials: 'include',
        headers,
      });
    })()
      .then((res) => res.json())
      .then((data) => {
        if (data.organization) {
          const org = data.organization as Org;
          setOrganization(org);
          setForm({
            name: org.name,
            email: org.email || '',
            phone: org.phone || '',
            address: org.address || '',
            status: org.status || 'active',
          });
          const admin = org.profiles?.[0];
          setAdminEmail(admin?.email || '');
          setAdminId(admin?.id || '');
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error('Unable to load organization');
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const saveOrganization = async () => {
    if (isSuperAdmin) {
      toast.error('Super admins have read-only access to organizations');
      return;
    }
    if (!orgId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Unable to update organization');

      toast.success('Organization updated');
      router.push('/mdas');
    } catch (error: any) {
      toast.error(error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveAdmin = async () => {
    if (isSuperAdmin) {
      toast.error('Super admins have read-only access to organizations');
      return;
    }
    if (!adminId) {
      toast.error('No administrator profile available to update');
      return;
    }
    setSavingAdmin(true);
    try {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch(`/api/admin/profiles/${adminId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ email: adminEmail }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Unable to update admin profile');

      toast.success('Admin profile updated');
    } catch (error: any) {
      toast.error(error?.message || 'Save failed');
    } finally {
      setSavingAdmin(false);
    }
  };

  if (!orgId) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-500">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Organization ID is required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => router.push('/mdas')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Edit organization</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Organization details</h1>
        </div>
        {isSuperAdmin ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Super admins have read-only access to organizations and cannot save changes here.
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading organization...</div>
      ) : organization ? (
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Organization details</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type">Type</Label>
                <Input id="org-type" value={organization.organization_type} readOnly className="bg-muted text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Email</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  disabled={isSuperAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  disabled={isSuperAdmin}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="org-address">Address</Label>
                <Textarea
                  id="org-address"
                  value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  rows={4}
                  disabled={isSuperAdmin}
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="org-status">Status</Label>
                <select
                  id="org-status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  disabled={isSuperAdmin}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={saveOrganization} disabled={saving || isSuperAdmin} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save organization'}
              </Button>
              <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Administrator profile</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={isSuperAdmin}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={saveAdmin} disabled={isSuperAdmin || savingAdmin} className="gap-2">
                <Save className="h-4 w-4" />
                {savingAdmin ? 'Saving...' : 'Save admin profile'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/mdas')}>Back to organizations</Button>
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Organization not found.</div>
      )}
    </div>
  );
}
