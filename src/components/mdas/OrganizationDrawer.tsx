'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Mail, Phone, MapPin, Package, Edit2, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Org = {
  id: string;
  name: string;
  organization_type: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  profiles?: Array<{ id: string; email?: string; role?: string }>;
  assets?: Array<{ id: string; name: string; status: string; condition?: string; department?: string }>;
};

export default function OrganizationDrawer({
  org,
  open,
  onClose,
  onDelete,
  initiallyEditing = false,
  onUpdate,
  readOnly = false,
}: {
  org: Org | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  initiallyEditing?: boolean;
  onUpdate?: (updated: Org) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(initiallyEditing);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState({
    name: org?.name || '',
    organization_type: org?.organization_type || 'MINISTRY',
    email: org?.email || '',
    phone: org?.phone || '',
    address: org?.address || '',
    status: org?.status || 'active',
  });

  useEffect(() => {
    if (org) {
      setFormValues({
        name: org.name || '',
        organization_type: org.organization_type || 'MINISTRY',
        email: org.email || '',
        phone: org.phone || '',
        address: org.address || '',
        status: org.status || 'active',
      });
    }
    setIsEditing(initiallyEditing);
  }, [org, initiallyEditing]);

  if (!open || !org) return null;

  const typeColor = org.organization_type === 'MINISTRY'
    ? 'bg-emerald-500/10 text-emerald-500'
    : org.organization_type === 'DEPARTMENT'
    ? 'bg-sky-500/10 text-sky-500'
    : 'bg-violet-500/10 text-violet-400';

  const statusColor = org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500';

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${org.name}"? This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete');
      }

      toast.success('Organization deleted successfully');
      await onDelete?.(org.id);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formValues,
          organization_type: formValues.organization_type.toUpperCase(),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to update organization');
      }

      const updatedOrg = {
        ...org,
        ...json.organization,
        status: json.organization?.status || formValues.status,
        organization_type: json.organization?.organization_type || formValues.organization_type,
      } as Org;

      await onUpdate?.(updatedOrg);
      setIsEditing(false);
      toast.success('Organization updated successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md bg-background shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-background p-6">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Organization Details
            </p>
            <h2 className="text-2xl font-bold mt-2">{org.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={typeColor}>{org.organization_type}</Badge>
              <Badge className={statusColor}>{org.status?.toUpperCase() || 'ACTIVE'}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 bg-muted/50 border-0">
              <p className="text-xs text-muted-foreground font-medium">Total Assets</p>
              <p className="text-2xl font-bold mt-1">{org.assets?.length || 0}</p>
            </Card>
            <Card className="p-3 bg-muted/50 border-0">
              <p className="text-xs text-muted-foreground font-medium">Administrators</p>
              <p className="text-2xl font-bold mt-1">{org.profiles?.length || 0}</p>
            </Card>
          </div>

          {/* About Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">About Organization</h3>
              {!readOnly && !isEditing && (
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
            </div>
            {isEditing && !readOnly ? (
              <Card className="space-y-4 border border-border/50 bg-card p-4">
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Organization name</span>
                      <input
                        value={formValues.name}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                        required
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Type</span>
                      <select
                        value={formValues.organization_type}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, organization_type: event.target.value }))}
                        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      >
                        <option value="MINISTRY">MINISTRY</option>
                        <option value="DEPARTMENT">DEPARTMENT</option>
                        <option value="AGENCY">AGENCY</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Email</span>
                      <input
                        type="email"
                        value={formValues.email}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
                        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Phone</span>
                      <input
                        value={formValues.phone}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, phone: event.target.value }))}
                        className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </label>
                  </div>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Address</span>
                    <textarea
                      value={formValues.address}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, address: event.target.value }))}
                      className="min-h-[96px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Status</span>
                    <select
                      value={formValues.status}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, status: event.target.value }))}
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" className="gap-2" disabled={saving}>
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card className="p-4 bg-card border border-border/50 space-y-3">
                {org.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <a
                      href={`mailto:${org.email}`}
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {org.email}
                    </a>
                  </div>
                )}
                {org.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <a
                      href={`tel:${org.phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {org.phone}
                    </a>
                  </div>
                )}
                {org.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{org.address}</p>
                  </div>
                )}
                {!org.email && !org.phone && !org.address && (
                  <p className="text-sm text-muted-foreground">No information provided</p>
                )}
              </Card>
            )}
          </div>

          {/* Assets Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4" />
                Assets for this organization
              </h3>
              {org.assets && org.assets.length > 0 && (
                <Badge variant="secondary">{org.assets.length}</Badge>
              )}
            </div>
            {org.assets && org.assets.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {org.assets.map(asset => (
                  <Card key={asset.id} className="p-3 bg-muted/50 border-0 text-sm">
                    <p className="font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.condition || asset.status}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-4 text-center bg-muted/30 rounded-lg">
                No asset records found for this organization yet.
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Use these shortcuts to manage the organization and administrator.
            </p>
            <div className="space-y-2">
              {!readOnly && <Button variant="outline" className="w-full justify-start gap-2 h-10" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" />
                <span>Edit Organization</span>
              </Button>}
              {!readOnly && <Button
                variant="outline"
                className="w-full justify-start gap-2 h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Deleting...' : 'Delete Organization'}</span>
              </Button>}
            </div>
          </div>

          {/* Fast Access Section */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Fast access
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-9"
                onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}/statistics`)}
              >
                View Statistics
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-9"
                onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}/statistics`)}
              >
                Asset Depreciation
              </Button>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}
