'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Mail, Phone, MapPin, Package, Edit2, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Organization = {
  id: string;
  name: string;
  organization_type: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  profiles?: Array<{ id: string; email?: string; role?: string }>;
  assets?: Array<{ id: string; name: string; status: string }>;
};

export default function OrganizationDetailsDrawer({
  org,
  open,
  onClose,
  onDelete,
}: {
  org: Organization | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

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
      onDelete?.(org.id);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization');
    } finally {
      setDeleting(false);
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
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span>About Organization</span>
            </h3>
            <Card className="p-4 bg-card border border-border/50">
              {org.email && (
                <div className="flex items-start gap-3 mb-3">
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
                <div className="flex items-start gap-3 mb-3">
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
                    <p className="text-xs text-muted-foreground">{asset.status}</p>
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
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Edit2 className="w-4 h-4" />
                <span>Edit Organization</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-10"
                onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}?tab=administrators`)}
              >
                <Users className="w-4 h-4" />
                <span>Manage Administrator</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Deleting...' : 'Delete Organization'}</span>
              </Button>
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
                onClick={() => router.push(`/dashboard?orgId=${encodeURIComponent(org.id)}&orgName=${encodeURIComponent(org.name)}`)}
              >
                View Dashboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-9"
                onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}?tab=statistics`)}
              >
                Asset Depreciation
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-9"
                onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}?tab=administrators`)}
              >
                Manage Administrators
              </Button>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}