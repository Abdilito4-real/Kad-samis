"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, Copy, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEP_LABELS = ['Organization', 'Administrator', 'Review & submit'];

const TYPE_TO_ROLE: Record<string, string> = {
  MINISTRY: 'ministry_admin',
  DEPARTMENT: 'department_admin',
  AGENCY: 'agency_admin',
};

const ROLE_LABELS: Record<string, string> = {
  ministry_admin: 'Ministry Admin',
  department_admin: 'Department Admin',
  agency_admin: 'Agency Admin',
};

export default function CreateOrganizationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (org: any) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('MINISTRY');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('ministry_admin');
  const [roleTouched, setRoleTouched] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value);
  const isStep1Complete = Boolean(name.trim());
  const isStep2Complete = Boolean(adminName.trim() && adminEmail.trim() && isEmailValid(adminEmail) && adminPassword.trim());
  const canSubmit = Boolean(isStep1Complete && isStep2Complete && hasCopiedCredentials);

  const canClose = step !== 3 || hasCopiedCredentials;

  const handleClose = () => {
    if (canClose) onClose();
  };

  const generatePassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < 14; i += 1) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    setAdminPassword(password);
    setHasCopiedCredentials(false);
  };

  // Land on the admin step with a password already waiting — no need to
  // remember a separate "Generate" click before you can move on.
  useEffect(() => {
    if (step === 2 && !adminPassword) {
      generatePassword();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!open) return null;

  const copyPassword = async () => {
    if (!adminPassword) {
      toast.error('Generate a password first');
      return;
    }
    await navigator.clipboard.writeText(`${adminEmail}\n${adminPassword}`);
    setHasCopiedCredentials(true);
    toast.success('Credentials copied to clipboard');
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!hasCopiedCredentials) {
      toast.error('Please copy the admin credentials before submitting.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } = { session: null } } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const authHeaders: Record<string, string> = {};
      if (session?.access_token) {
        authHeaders.Authorization = `Bearer ${session.access_token}`;
      }

      const payload = {
        name,
        organization_type: type,
        email,
        phone,
        admin: {
          id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined,
          name: adminName,
          email: adminEmail,
          role: adminRole,
          password: adminPassword,
        },
      };
      const res = await fetch('/api/admin/create-organization', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      toast.success('Organization created');
      onCreated?.(json.organization || payload);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !canClose) return;
        if (!next) onClose();
      }}
    >
      <DialogContent className="w-full max-w-xl gap-0 overflow-hidden rounded-[2rem] p-0" hideClose>
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Organization registration</p>
              <h3 className="text-xl font-semibold leading-tight">Register a new MDA</h3>
              <p className="text-sm text-muted-foreground">Create a Ministry, Department, or Agency and assign its administrator.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={!canClose}
            aria-label="Close dialog"
            title={canClose ? 'Close' : 'Copy the admin credentials before closing'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={step === 3 ? submit : (e) => e.preventDefault()} className="space-y-4 p-5 max-h-[calc(100vh-18rem)] overflow-y-auto">
          <div className="space-y-3 rounded-3xl border border-border bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Step {step} of 3</p>
              <div className="inline-flex rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                {STEP_LABELS[step - 1]}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {STEP_LABELS.map((label, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber <= step;
                return (
                  <div
                    key={label}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-border'}`}
                    aria-hidden
                  />
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Organization name <span className="text-rose-500">*</span></span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ministry of Works"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                      required
                    />
                    {!isStep1Complete && (
                      <p className="text-xs text-rose-500">Organization name is required before you can continue.</p>
                    )}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Organization type</span>
                    <Select
                      value={type}
                      onValueChange={(nextType) => {
                        setType(nextType);
                        if (!roleTouched) {
                          setAdminRole(TYPE_TO_ROLE[nextType] || adminRole);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MINISTRY">MINISTRY</SelectItem>
                        <SelectItem value="DEPARTMENT">DEPARTMENT</SelectItem>
                        <SelectItem value="AGENCY">AGENCY</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Office email</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="office@kd.gov.ng"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Phone number</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0801 000 0004"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </label>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Admin name <span className="text-rose-500">*</span></span>
                    <input
                      value={adminName}
                      onChange={(e) => {
                        setAdminName(e.target.value);
                        setHasCopiedCredentials(false);
                      }}
                      placeholder="Jane Doe"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                      required
                    />
                    {!adminName.trim() && (
                      <p className="text-xs text-rose-500">Admin name is required before continuing.</p>
                    )}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Admin email <span className="text-rose-500">*</span></span>
                    <input
                      value={adminEmail}
                      onChange={(e) => {
                        setAdminEmail(e.target.value);
                        setHasCopiedCredentials(false);
                      }}
                      placeholder="jane.doe@kd.gov.ng"
                      className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                      required
                    />
                    {adminEmail && !isEmailValid(adminEmail) && (
                      <p className="text-xs text-rose-500">Enter a valid email address.</p>
                    )}
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Admin password</span>
                    <div className="rounded-2xl border border-input bg-background p-2">
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={adminPassword}
                          readOnly
                          className="w-full rounded-xl bg-transparent px-2 py-2 pr-9 text-sm outline-none"
                        />
                        {adminPassword && (
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"
                          >
                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2 border-t border-border pt-2">
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={copyPassword}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
                        >
                          {hasCopiedCredentials ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {hasCopiedCredentials ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">Role</span>
                    <Select
                      value={adminRole}
                      onValueChange={(value) => {
                        setRoleTouched(true);
                        setAdminRole(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ministry_admin">Ministry Admin</SelectItem>
                        <SelectItem value="department_admin">Department Admin</SelectItem>
                        <SelectItem value="agency_admin">Agency Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {roleTouched ? 'Manually set — change the organization type to re-sync.' : `Matched to ${type.toLowerCase()} automatically.`}
                    </p>
                  </label>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-3xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-semibold text-foreground">Organization</p>
                    <p className="mt-2 text-sm text-muted-foreground">{name || 'Not specified'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{type}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{email || 'No email provided'}</p>
                  </div>
                  <div className="rounded-3xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-semibold text-foreground">Administrator</p>
                    <p className="mt-2 text-sm text-muted-foreground">{adminName || 'Not specified'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{adminEmail || 'No email provided'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABELS[adminRole] || adminRole}</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-input bg-background p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">Admin credentials</p>
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      {hasCopiedCredentials ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {hasCopiedCredentials ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-2 text-muted-foreground">Email: <span className="font-medium text-foreground">{adminEmail}</span></p>
                  <p className="mt-1 text-muted-foreground">Password: <span className="font-medium text-foreground">{adminPassword}</span></p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {hasCopiedCredentials
                      ? 'Credentials copied — you can submit the registration below.'
                      : 'These credentials only appear here. Copy them before submitting so you can share them with the new admin.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => {
                if (step === 1) {
                  onClose();
                } else {
                  setStep((prev) => (Math.max(prev - 1, 1) as 1 | 2 | 3));
                }
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={loading}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !isStep1Complete) return;
                  if (step === 2 && !isStep2Complete) return;
                  setStep((prev) => (Math.min(prev + 1, 3) as 1 | 2 | 3));
                }}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto"
                disabled={
                  loading ||
                  (step === 1 && !isStep1Complete) ||
                  (step === 2 && !isStep2Complete)
                }
              >
                {step === 1 ? 'Next: Administrator' : 'Review & submit'}
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto"
                disabled={!canSubmit || loading}
              >
                {loading ? 'Creating...' : 'Submit registration'}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}