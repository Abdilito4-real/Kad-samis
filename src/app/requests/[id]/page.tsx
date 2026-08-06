'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertCircle, ChevronDown, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { OperationStagePanel } from '@/components/requests/OperationStagePanel';
import { StageProgressBar } from '@/components/requests/StageProgressBar';
import { cn } from '@/lib/utils';

const OPERATIONS_ELIGIBLE_TYPE = 'maintenance_approval';

interface Request {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'in_operation' | 'completed';
  notes?: string;
  created_at: string;
  updated_at: string;
  organizations?: { name: string } | null;
  created_by?: string;
  escalated_at?: string;
  escalation_reason?: string;
  organization_id: string;
  current_stage?: 'assigned' | 'monitoring' | 'in_progress' | 'completed' | null;
  assigned_operator?: { id: string; email: string; username?: string | null } | null;
  request_operations?: {
    id: string;
    stage: 'assigned' | 'monitoring' | 'in_progress' | 'completed';
    note: string | null;
    created_at: string;
    actor?: { email: string; username?: string | null } | null;
  }[];
}

const typeLabels: Record<string, string> = {
  asset_approval: 'Asset Approval',
  transfer_approval: 'Transfer Approval',
  maintenance_approval: 'Maintenance Approval',
  budget_request: 'Budget Request',
  general: 'General Request',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  escalated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  in_operation: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const statusLabels: Record<string, string> = {
  in_operation: 'In Operation',
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  medium: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Collapsed by default once a request is past pending — the stage is the
  // thing people need to see first without scrolling; the submission
  // details are still one click away, just not taking up the whole screen.
  const [detailsOpen, setDetailsOpen] = useState(true);

  useEffect(() => {
    const loadRequest = async () => {
      try {
        const supabase = createClient();
        if (!supabase) throw new Error('Supabase client not initialized');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No authenticated session');

        // Get current user profile to check if super admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        setViewerId(session.user.id);

        if (!profileError && profile) {
          const profileWithRole = profile as { role?: string | null } | null;
          setIsSuperAdmin(profileWithRole?.role === 'super_admin');
          setViewerRole(profileWithRole?.role ?? null);
        } else {
          setIsSuperAdmin(false);
        }

        // Fetch request details
        const response = await fetch(`/api/admin/requests/${requestId}`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load request');
        }

        const data = await response.json();
        setRequest(data.request);
        setDetailsOpen(data.request.status === 'pending');
      } catch (err: any) {
        console.error('Load request error:', err);
        toast.error('Failed to load request', { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [requestId]);

  const handleAction = async () => {
    if (!request || !isSuperAdmin) return;

    setIsProcessing(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated session');

      const response = await fetch(`/api/admin/requests/${request.id}/${actionType}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });

      if (!response.ok) {
        let msg = `Failed to ${actionType} request`;
        try {
          const errorData = await response.json();
          msg = errorData.error || errorData.message || msg;
        } catch (e) {
          // ignore JSON parse errors and keep default message
        }
        toast.error(msg);
        return;
      }

      const data = await response.json();
      setRequest(data.request);
      setActionDialogOpen(false);
      setNotes('');
      toast.success(`Request ${actionType}d successfully`);
    } catch (err: any) {
      console.error(`Request ${actionType} error:`, err);
      toast.error(`Failed to ${actionType} request`, { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center">
        <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Request Not Found</h1>
        <Button onClick={() => router.push('/requests')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-3xl mx-auto">
        <Button
          onClick={() => router.push('/requests')}
          variant="ghost"
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Button>

        <Card className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                {request.title}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                {request.description}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge className={statusColors[request.status]}>
                {statusLabels[request.status] ?? request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </Badge>
              <Badge className={priorityColors[request.priority]}>
                {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Stage summary — always visible, no scrolling required, as soon
              as the request has entered operations. The full assign/advance
              controls and timeline still live in OperationStagePanel below. */}
          {request.type === OPERATIONS_ELIGIBLE_TYPE && request.current_stage && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6 dark:border-slate-800 dark:bg-slate-900/40">
              {request.assigned_operator && (
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <UserCog className="h-4 w-4" />
                  Assigned to{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {request.assigned_operator.username || request.assigned_operator.email}
                  </span>
                </div>
              )}
              <StageProgressBar currentStage={request.current_stage} />
            </div>
          )}

          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between border-t border-slate-200 py-4 text-left dark:border-slate-800"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Request details</span>
            <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', detailsOpen && 'rotate-180')} />
          </button>

          <div className={cn('space-y-6 pb-2', !detailsOpen && 'hidden')}>
            {/* Details Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Request Type</p>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {typeLabels[request.type] || request.type}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Organization</p>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {request.organizations?.name || "Organization unavailable"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Priority</p>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Submitted</p>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Last Updated</p>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {new Date(request.updated_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Escalation Info */}
            {request.status === 'escalated' && request.escalation_reason && (
              <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/30">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-300 mb-2">
                  Escalation Reason
                </p>
                <p className="text-slate-900 dark:text-slate-50">{request.escalation_reason}</p>
              </div>
            )}

            {/* Notes (if exists) */}
            {request.notes && (
              <div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-900/50">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Admin Notes
                </p>
                <p className="text-slate-900 dark:text-slate-50">{request.notes}</p>
              </div>
            )}

            {/* Super Admin Actions */}
            {isSuperAdmin && request.status === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button
                  onClick={() => {
                    setActionType('approve');
                    setActionDialogOpen(true);
                  }}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  onClick={() => {
                    setActionType('reject');
                    setActionDialogOpen(true);
                  }}
                  className="gap-2 bg-red-600 hover:bg-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6">
          <OperationStagePanel
            request={request}
            viewerRole={viewerRole}
            viewerId={viewerId}
            onUpdate={(updated) => setRequest((prev) => (prev ? { ...prev, ...updated } : updated))}
          />
        </div>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'reject' ? 'Reject Request' : 'Approve Request'}</DialogTitle>
            <DialogDescription>
              {actionType === 'reject'
                ? 'Provide a reason so the organization knows why this request was rejected.'
                : 'Add notes (optional) and approve this request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">
                {actionType === 'reject' ? 'Rejection reason' : 'Notes (optional)'}
              </Label>
              <Textarea
                id="notes"
                placeholder={actionType === 'reject' ? 'Explain why this request cannot be approved...' : 'Add any notes for the requester...'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setActionDialogOpen(false)}
                variant="outline"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'reject' && !notes.trim())}
                className={actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  actionType === 'reject' ? 'Reject' : 'Approve'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
