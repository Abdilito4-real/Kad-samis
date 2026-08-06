'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, Building2, Edit2, Mail, MapPin, Phone, Save, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Organization = {
  id: string;
  name: string;
  organization_type: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  logo?: string;
};

const TYPE_BADGE: Record<string, string> = {
  MINISTRY: 'bg-emerald-500/10 text-emerald-500',
  DEPARTMENT: 'bg-sky-500/10 text-sky-500',
  AGENCY: 'bg-amber-500/10 text-amber-600',
};

const FIELDS: Array<{ key: 'email' | 'phone' | 'address'; label: string; icon: typeof Mail }> = [
  { key: 'email', label: 'Email Address', icon: Mail },
  { key: 'phone', label: 'Phone Number', icon: Phone },
  { key: 'address', label: 'Address', icon: MapPin },
];

export default function OrganizationOverview({ org, onUpdate, isSuperAdmin = false }: { org: Organization; onUpdate?: () => void; isSuperAdmin?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: org.name || '',
    email: org.email || '',
    phone: org.phone || '',
    address: org.address || '',
    status: org.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (isSuperAdmin) {
      toast.error('Super admins have read-only access to organizations');
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update');
      }

      toast.success('Organization updated successfully');
      setEditing(false);
      onUpdate?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: org.name || '',
      email: org.email || '',
      phone: org.phone || '',
      address: org.address || '',
      status: org.status || 'active',
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="space-y-4 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Organization</h3>
          <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ministry of Works"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="works@kad.gov.ng"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="0803 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="NO. 35 Ali Akilu Street, Kaduna State, Nigeria"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Organization Information</h3>
          {isSuperAdmin ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Super admins have read-only access to organization details.
            </p>
          ) : null}
        </div>
        {!isSuperAdmin ? (
          <Button size="sm" onClick={() => setEditing(true)} variant="outline" className="gap-2">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Organization Name</p>
            <p className="mt-0.5 truncate text-base font-semibold text-foreground">{org.name}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Type &amp; Status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge className={TYPE_BADGE[org.organization_type] ?? 'bg-slate-500/10 text-slate-400'}>{org.organization_type}</Badge>
              <Badge className={org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}>
                {org.status?.toUpperCase() || 'ACTIVE'}
              </Badge>
            </div>
          </div>
        </div>

        {FIELDS.map((field) => {
          const Icon = field.icon;
          const value = org[field.key];
          return (
            <div key={field.key} className={`flex items-start gap-3 ${field.key === 'address' ? 'md:col-span-2' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                {value ? (
                  field.key === 'address' ? (
                    <p className="mt-0.5 text-base font-semibold text-foreground">{value}</p>
                  ) : (
                    <a
                      href={field.key === 'email' ? `mailto:${value}` : `tel:${value}`}
                      className="mt-0.5 block truncate text-base font-semibold text-primary hover:underline"
                    >
                      {value}
                    </a>
                  )
                ) : (
                  <p className="mt-0.5 text-base font-medium text-muted-foreground">Not provided</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!org.email && !org.phone ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No contact details are on file for this organization yet.
        </div>
      ) : null}
    </Card>
  );
}
