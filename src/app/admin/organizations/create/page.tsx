"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Building2, Save } from 'lucide-react';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Organization details',
  2: 'Assign administrator',
  3: 'Review & create',
};

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [org, setOrg] = useState({ name: '', organization_type: 'MINISTRY', email: '', phone: '', address: '', logo: '' });
  const [admin, setAdmin] = useState({ id: '', email: '', name: '' });
  const [loading, setLoading] = useState(false);

  function next() {
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }
  function back() {
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  async function submit() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const authHeaders: Record<string, string> = {};
      if (session?.access_token) {
        authHeaders.Authorization = `Bearer ${session.access_token}`;
      }
      const payload = { ...org, admin: { id: admin.id || undefined, email: admin.email, name: admin.name, role: 'ministry_admin' } };
      const res = await fetch('/api/admin/create-organization', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Organization created');
        router.push('/mdas');
      } else {
        toast.error(json?.error || 'Failed to create organization');
      }
    } catch (err) {
      toast.error('Error creating organization');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => router.push('/mdas')}>
        <ArrowLeft className="h-4 w-4" />
        Back to organizations
      </Button>

      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Organization registration</p>
            <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Register a new MDA</h1>
          </div>
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">Step {step} of 3</p>
            <div className="inline-flex rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {STEP_LABELS[step]}
            </div>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((value) => (
              <div
                key={value}
                className={`h-1.5 flex-1 rounded-full transition-colors ${value <= step ? 'bg-emerald-500' : 'bg-border'}`}
              />
            ))}
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Ministry of Works" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-type">Type</Label>
                <Select
                  value={org.organization_type}
                  onValueChange={(value) => setOrg({ ...org, organization_type: value })}
                >
                  <SelectTrigger id="org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINISTRY">Ministry</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                    <SelectItem value="AGENCY">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-email">Email</Label>
                  <Input id="org-email" type="email" value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} placeholder="works@kad.gov.ng" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-phone">Phone</Label>
                  <Input id="org-phone" value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} placeholder="0803 123 4567" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-address">Address</Label>
                <Textarea id="org-address" value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} rows={3} placeholder="NO. 35 Ali Akilu Street, Kaduna State, Nigeria" />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={next} disabled={!org.name.trim()} className="gap-2">
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Assign the person who will administer this organization day to day.</p>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Administrator name</Label>
                <Input id="admin-name" value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Administrator email</Label>
                <Input id="admin-email" type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder="jane.doe@kad.gov.ng" />
              </div>
              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <Button variant="outline" onClick={back} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={next} disabled={!admin.email.trim()} className="gap-2">
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Review the details below before creating this organization.</p>
              <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Name</span>
                  <span className="min-w-0 truncate font-medium text-foreground">{org.name || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium text-foreground">{org.organization_type}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Email</span>
                  <span className="min-w-0 truncate font-medium text-foreground">{org.email || '—'}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Administrator</span>
                  <span className="min-w-0 truncate font-medium text-foreground">{admin.name} ({admin.email})</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-3 pt-2">
                <Button variant="outline" onClick={back} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={submit} disabled={loading} className="gap-2">
                  <Save className="h-4 w-4" />
                  {loading ? 'Creating...' : 'Create Organization'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
