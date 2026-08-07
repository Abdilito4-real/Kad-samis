'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

const typeLabels: Record<string, string> = {
  asset_approval: 'Asset approval',
  transfer_approval: 'Transfer approval',
  maintenance_approval: 'Maintenance approval',
  budget_request: 'Budget request',
  general: 'General request',
};

const statusBadgeColor: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  approved: 'bg-emerald-500/10 text-emerald-500',
  rejected: 'bg-rose-500/10 text-rose-500',
  escalated: 'bg-violet-500/10 text-violet-400',
};

const typeBadgeColor: Record<string, string> = {
  asset_approval: 'bg-sky-500/10 text-sky-500',
  transfer_approval: 'bg-violet-500/10 text-violet-400',
  maintenance_approval: 'bg-orange-500/10 text-orange-500',
  budget_request: 'bg-emerald-500/10 text-emerald-500',
  general: 'bg-muted text-muted-foreground',
};

const typeIcon: Record<string, string> = {
  asset_approval: '📦',
  transfer_approval: '↔️',
  maintenance_approval: '🛠️',
  budget_request: '💰',
  general: '📝',
};

type ActivityRequest = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
};

export default function OrganizationActivity({ orgId }: { orgId: string }) {
  const [activities, setActivities] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        if (!supabase) {
          throw new Error('Supabase client not initialized');
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const params = new URLSearchParams({ orgId });
        const response = await fetch(`/api/admin/requests?${params.toString()}`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || 'Unable to load organization activity');
        }

        const data = await response.json();
        setActivities(data.requests || []);
      } catch (err: any) {
        console.error('Organization activity failed:', err);
        setError(err?.message || 'Unable to load organization activity');
      } finally {
        setLoading(false);
      }
    };

    if (orgId) {
      loadActivities();
    }
  }, [orgId]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center text-sm text-red-700 bg-red-50 border border-red-200">
        {error}
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">No activity found for this organization yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((request) => (
        <Card key={request.id} className="p-4 hover:shadow-md transition">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-2xl">{typeIcon[request.type] || '📝'}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{request.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {typeLabels[request.type] || request.type.replace(/_/g, ' ')} • {request.status}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
            </div>
            <Badge className={statusBadgeColor[request.status] || 'bg-muted text-muted-foreground'}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
            <span>{new Date(request.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            <Badge className={typeBadgeColor[request.type] || 'bg-muted text-muted-foreground'}>
              {request.type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
