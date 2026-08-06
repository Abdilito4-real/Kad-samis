'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Request = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: string;
  created_at?: string;
  admin_notes?: string;
};

export default function OrganizationRequests({ orgId }: { orgId: string }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
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

      const params = new URLSearchParams({
        orgId,
        ...(filter !== 'all' && { status: filter }),
      });

      const response = await fetch(`/api/admin/requests?${params.toString()}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to fetch requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error: any) {
      toast.error('Failed to load requests');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filter, orgId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-600',
    approved: 'bg-emerald-500/10 text-emerald-500',
    rejected: 'bg-rose-500/10 text-rose-500',
    completed: 'bg-sky-500/10 text-sky-500',
  };

  const priorityColor: Record<string, string> = {
    low: 'bg-sky-500/10 text-sky-500',
    medium: 'bg-amber-500/10 text-amber-600',
    high: 'bg-orange-500/10 text-orange-500',
    urgent: 'bg-rose-500/10 text-rose-500',
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </Card>
    );
  }

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({requests.length})
        </Button>
        <Button
          variant={filter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('pending')}
        >
          Pending ({requests.filter(r => r.status === 'pending').length})
        </Button>
        <Button
          variant={filter === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('approved')}
        >
          Approved ({requests.filter(r => r.status === 'approved').length})
        </Button>
        <Button
          variant={filter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('rejected')}
        >
          Rejected ({requests.filter(r => r.status === 'rejected').length})
        </Button>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">
            {requests.length === 0 ? 'No requests found' : `No ${filter} requests`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(request => (
            <Card key={request.id} className="p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">{request.title}</h4>
                  {request.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {request.priority && (
                    <Badge className={priorityColor[request.priority] || 'bg-muted text-muted-foreground'}>
                      {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                    </Badge>
                  )}
                  {request.status && (
                    <Badge className={statusColor[request.status] || 'bg-muted text-muted-foreground'}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  {request.type && (
                    <span>Type: {request.type.replace(/_/g, ' ')}</span>
                  )}
                  {request.created_at && (
                    <span>{new Date(request.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {request.admin_notes && (
                <div className="mt-3 p-2 bg-muted rounded text-xs">
                  <p className="font-medium mb-1">Admin Notes:</p>
                  <p className="text-muted-foreground">{request.admin_notes}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
