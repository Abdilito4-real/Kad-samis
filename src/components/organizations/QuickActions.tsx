'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Package,
  RotateCcw,
  Power,
  Trash2,
  AlertTriangle,
  Mail,
  Copy,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

type Organization = {
  id: string;
  name: string;
  email?: string;
  status?: string;
};

function ActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'rose';
}) {
  const iconClasses = tone === 'rose' ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary';
  const labelClasses = tone === 'rose' ? 'text-rose-500' : 'text-foreground';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClasses}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className={`min-w-0 flex-1 truncate ${labelClasses}`}>{label}</span>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

export default function QuickActions({
  org,
  onUpdate,
  onNavigateBack,
  isSuperAdmin,
}: {
  org: Organization;
  onUpdate?: () => void;
  onNavigateBack?: () => void;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('Organization update');
  const [notificationMessage, setNotificationMessage] = useState(`A new update is available for ${org.name}.`);

  const handleSendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setSendingNotification(true);
    try {
      const supabase = createClient();
      const session = supabase ? await supabase.auth.getSession() : null;
      const accessToken = session?.data?.session?.access_token;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch('/api/admin/send-notification', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ organizationId: org.id, title: notificationTitle.trim(), message: notificationMessage.trim() }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to send notification');

      toast.success('Notification sent successfully');
      setNotificationDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleDeactivate = async () => {
    if (isSuperAdmin) {
      toast.error('Super admins have read-only access to organizations');
      return;
    }

    if (!confirm(`Are you sure you want to deactivate "${org.name}"? This action can be reversed.`)) return;

    setDeactivating(true);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });

      if (!response.ok) throw new Error('Failed to deactivate');

      toast.success('Organization deactivated');
      onUpdate?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to deactivate organization');
    } finally {
      setDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (isSuperAdmin) {
      toast.error('Super admins have read-only access to organizations');
      return;
    }

    if (!confirm(`Warning: This will permanently delete "${org.name}" and all associated data. This action cannot be undone. Continue?`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Organization deleted successfully');
      setTimeout(() => onNavigateBack?.(), 1000);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete organization');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!org.email) {
      toast.error('Organization email not set');
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/admin/send-password-reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: org.email }),
      });

      if (!response.ok) throw new Error('Failed to send reset link');

      toast.success(`Password reset link sent to ${org.email}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send password reset');
    } finally {
      setResetting(false);
    }
  };

  const handleCopyOrgId = () => {
    navigator.clipboard.writeText(org.id);
    toast.success('Organization ID copied to clipboard');
  };

  return (
    <div className="min-w-0 space-y-4 lg:sticky lg:top-24">
      <Card className="divide-y divide-border overflow-hidden">
        <div className="p-3">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Management</p>
          <ActionRow
            icon={Package}
            label="Organization Statistics"
            onClick={() => router.push(`/admin/organizations/${encodeURIComponent(org.id)}?tab=statistics`)}
          />
        </div>

        <div className="p-3">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Security</p>
          <ActionRow
            icon={RotateCcw}
            label={resetting ? 'Sending reset link…' : 'Reset Password'}
            onClick={handleResetPassword}
            disabled={resetting}
            loading={resetting}
          />
          <ActionRow
            icon={Mail}
            label="Send Notification"
            onClick={() => setNotificationDialogOpen(true)}
            disabled={sendingNotification}
          />
        </div>

        <div className="p-3">
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-500">Danger Zone</p>
          {org.status === 'active' ? (
            <ActionRow
              icon={Power}
              label={deactivating ? 'Deactivating…' : 'Deactivate Organization'}
              onClick={handleDeactivate}
              disabled={deactivating}
              loading={deactivating}
              tone="rose"
            />
          ) : (
            <ActionRow icon={Power} label="Organization Inactive" disabled tone="rose" />
          )}
          <ActionRow
            icon={Trash2}
            label={deleting ? 'Deleting…' : 'Delete Organization'}
            onClick={handleDelete}
            disabled={deleting}
            loading={deleting}
            tone="rose"
          />
        </div>
      </Card>

      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
            <DialogDescription>
              Create a notification message for all users in this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Title</span>
              <input
                value={notificationTitle}
                onChange={(event) => setNotificationTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">Message</span>
              <textarea
                value={notificationMessage}
                onChange={(event) => setNotificationMessage(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              />
            </label>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setNotificationDialogOpen(false)} disabled={sendingNotification}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSendNotification} disabled={sendingNotification}>
                {sendingNotification ? 'Sending...' : 'Send Notification'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="min-w-0 space-y-3 bg-muted/50 p-4">
        <h3 className="px-1 text-sm font-semibold">Organization ID</h3>

        <div className="flex min-w-0 items-center gap-2 px-1">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-background px-2 py-1.5 text-xs text-foreground">
            {org.id}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyOrgId}
            className="h-8 w-8 shrink-0 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {org.email && (
          <div className="min-w-0 px-1">
            <p className="mb-1 text-xs text-muted-foreground">Contact Email</p>
            <a
              href={`mailto:${org.email}`}
              className="block truncate text-xs font-medium text-primary hover:underline"
            >
              {org.email}
            </a>
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="min-w-0 text-xs text-amber-600">
          Deleting an organization will permanently remove all related data including users, assets, and requests.
        </p>
      </div>
    </div>
  );
}
