"use client";

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Building2, Check, Copy, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEP_META = [
  { number: 1, label: 'Organization Details' },
  { number: 2, label: 'Administrator Details' },
  { number: 3, label: 'Review & Submit' },
] as const;

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

type ExistingOrganization = {
  id: string;
  name: string;
  organization_type?: string | null;
  email?: string | null;
  phone?: string | null;
};

function normalizeOrganizationName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(of|the|and|for)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getNameSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }

  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function getMatchReasons(name: string, email: string, phone: string, existing: ExistingOrganization) {
  const reasons: string[] = [];
  const normalizedName = normalizeOrganizationName(name);
  const existingName = normalizeOrganizationName(existing.name);
  const normalizedEmail = email.trim().toLowerCase();
  const existingEmail = (existing.email || '').trim().toLowerCase();
  const normalizedPhone = phone.replace(/\D/g, '');
  const existingPhone = (existing.phone || '').replace(/\D/g, '');

  if (normalizedEmail && existingEmail && normalizedEmail === existingEmail) {
    reasons.push('Office email');
  }
  if (normalizedPhone.length >= 7 && existingPhone.length >= 7 && normalizedPhone === existingPhone) {
    reasons.push('Phone number');
  }
  if (normalizedName && existingName) {
    if (normalizedName === existingName) {
      reasons.push('Organization name');
    } else {
      const currentWords = new Set(normalizedName.split(' '));
      const existingWords = new Set(existingName.split(' '));
      const sharedWords = [...currentWords].filter((word) => existingWords.has(word)).length;
      const containment = sharedWords / Math.min(currentWords.size, existingWords.size);
      const similarity = getNameSimilarity(normalizedName, existingName);

      if ((Math.min(currentWords.size, existingWords.size) >= 2 && containment >= 0.8) || similarity >= 0.88) {
        reasons.push('Similar organization name');
      }
    }
  }

  return reasons;
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none transition duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';

export default function CreateOrganizationDialog({
  open,
  onClose,
  onCreated,
  existingOrganizations,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (org: any) => void;
  existingOrganizations: ExistingOrganization[];
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const adminRole = TYPE_TO_ROLE[type] ?? '';
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmailValid = (value: string) => /\S+@\S+\.\S+/.test(value);
  const normalizedPhone = phone.replace(/\D/g, '');
  const isPhoneValid = normalizedPhone.length === 11;
  const isStep1Complete = Boolean(name.trim() && type && isPhoneValid);
  const isStep2Complete = Boolean(
    adminName.trim() && adminEmail.trim() && isEmailValid(adminEmail) && adminPassword.trim(),
  );
  const canSubmit = Boolean(isStep1Complete && isStep2Complete && hasCopiedCredentials);
  const possibleMatches = useMemo(
    () => existingOrganizations
      .map((organization) => ({
        organization,
        reasons: getMatchReasons(name, email, phone, organization),
      }))
      .filter((match) => match.reasons.length > 0)
      .slice(0, 5),
    [existingOrganizations, name, email, phone]
  );
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
      <DialogContent
        className="left-0 right-0 top-0 bottom-0 h-[100dvh] max-h-[100dvh] w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-[#f8faf9] p-0 shadow-none sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:h-[90dvh] sm:max-h-[90dvh] sm:w-[calc(100vw-2rem)] sm:max-w-[960px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[32px] sm:border sm:shadow-[0_30px_80px_rgba(15,23,42,0.12)]"
        hideClose
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Organization registration</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Register a new MDA</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a Ministry, Department, or Agency and assign its administrator.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={!canClose}
                aria-label="Close dialog"
                title={canClose ? 'Close' : 'Copy the admin credentials before closing'}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <form onSubmit={step === 3 ? submit : (e) => e.preventDefault()} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-6 sm:py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">Step {step} of {STEP_META.length}</p>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                  {STEP_META[step - 1].label}
                </div>
              </div>

              <div className="flex min-w-0 gap-1.5 pb-1 sm:gap-2">
                {STEP_META.map((item, index) => {
                  const isCompleted = index + 1 < step;
                  const isActive = index + 1 === step;

                  return (
                    <div
                      key={item.label}
                      aria-label={item.label}
                      aria-current={isActive ? 'step' : undefined}
                      className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2"
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[10px] font-medium sm:text-[11px] ${
                            isCompleted || isActive ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
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
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <p className="text-sm font-semibold text-slate-700">Organization profile</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Organization name <span className="text-rose-500">*</span>
                          </span>
                          <input
                            value={name}
                            onChange={(e) =>
                              setName(e.target.value.replace(/(^|\s)([a-z])/g, (_, space, letter) => `${space}${letter.toUpperCase()}`))
                            }
                            placeholder="Ministry of Works"
                            className={inputClassName}
                            aria-invalid={!isStep1Complete && name.length === 0}
                            required
                          />
                          {!isStep1Complete && (
                            <p className="text-xs text-rose-600">Organization name is required before you can continue.</p>
                          )}
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Organization type <span className="text-rose-500">*</span>
                          </span>
                          <Select
                            value={type || undefined}
                            onValueChange={(nextType) => {
                              setType(nextType);
                            }}
                          >
                            <SelectTrigger className="h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100">
                              <SelectValue placeholder="Select organization" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MINISTRY">Ministry</SelectItem>
                              <SelectItem value="DEPARTMENT">Department</SelectItem>
                              <SelectItem value="AGENCY">Agency</SelectItem>
                            </SelectContent>
                          </Select>
                          {!type && (
                            <p className="text-xs text-rose-600">Please select an organization type.</p>
                          )}
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Office email</span>
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="office@kd.gov.ng"
                            className={inputClassName}
                            type="email"
                          />
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Phone number <span className="text-rose-500">*</span>
                          </span>
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="08010000004"
                            className={inputClassName}
                            inputMode="numeric"
                            maxLength={11}
                          />
                          {phone && !isPhoneValid && (
                            <p className="text-xs text-rose-600">Phone number must be exactly 11 digits.</p>
                          )}
                        </label>
                      </div>
                      {possibleMatches.length > 0 && (
                        <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">Possible existing organizations</p>
                              <p className="mt-1 text-xs text-slate-600">
                                Review these records before continuing. Exact name or office-email duplicates cannot be registered again.
                              </p>
                              <ul className="mt-3 space-y-2">
                                {possibleMatches.map(({ organization, reasons }) => (
                                  <li key={organization.id} className="border-t border-amber-500/15 pt-2 first:border-0 first:pt-0">
                                    <p className="break-words text-sm font-medium text-slate-800">{organization.name}</p>
                                    <p className="text-xs text-slate-600">
                                      {[organization.organization_type, `Matched by ${reasons.join(', ')}`].filter(Boolean).join(' · ')}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
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
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <p className="text-sm font-semibold text-slate-700">Primary administrator</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Admin name <span className="text-rose-500">*</span>
                          </span>
                          <input
                            value={adminName}
                            onChange={(e) => {
                              setAdminName(e.target.value);
                              setHasCopiedCredentials(false);
                            }}
                            placeholder="Jane Doe"
                            className={inputClassName}
                            aria-invalid={!adminName.trim()}
                            required
                          />
                          {!adminName.trim() && (
                            <p className="text-xs text-rose-600">Admin name is required before continuing.</p>
                          )}
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">
                            Admin email <span className="text-rose-500">*</span>
                          </span>
                          <input
                            value={adminEmail}
                            onChange={(e) => {
                              setAdminEmail(e.target.value);
                              setHasCopiedCredentials(false);
                            }}
                            placeholder="jane.doe@kd.gov.ng"
                            className={inputClassName}
                            type="email"
                            aria-invalid={Boolean(adminEmail && !isEmailValid(adminEmail))}
                            required
                          />
                          {adminEmail && !isEmailValid(adminEmail) && (
                            <p className="text-xs text-rose-600">Enter a valid email address.</p>
                          )}
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Admin password</span>
                          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={adminPassword}
                                readOnly
                                className="w-full rounded-xl bg-transparent px-2.5 py-2.5 pr-10 text-sm text-slate-700 outline-none"
                              />
                              {adminPassword && (
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((value) => !value)}
                                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              )}
                            </div>

                            <div className="mt-2 flex gap-2 border-t border-slate-200 pt-2">
                              <button
                                type="button"
                                onClick={generatePassword}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Regenerate
                              </button>
                              <button
                                type="button"
                                onClick={copyPassword}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                {hasCopiedCredentials ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                {hasCopiedCredentials ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-medium text-slate-700">Administrator role</span>
                          <input
                            value={ROLE_LABELS[adminRole] ?? 'Select an organization type first'}
                            readOnly
                            aria-readonly="true"
                            className={`${inputClassName} cursor-not-allowed bg-slate-50 text-slate-600`}
                          />
                          <p className="text-xs text-slate-500">
                            Assigned automatically based on the organization type selected in Step 1.
                          </p>
                        </label>
                      </div>
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <p className="text-sm font-semibold text-slate-800">Organization summary</p>
                        <dl className="mt-4 space-y-3 text-sm text-slate-600">
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Name</dt>
                            <dd className="mt-1 text-slate-700">{name || 'Not specified'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Type</dt>
                            <dd className="mt-1 text-slate-700">{type}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Email</dt>
                            <dd className="mt-1 text-slate-700">{email || 'No email provided'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Phone</dt>
                            <dd className="mt-1 text-slate-700">{phone || 'No phone number provided'}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                        <p className="text-sm font-semibold text-slate-800">Administrator summary</p>
                        <dl className="mt-4 space-y-3 text-sm text-slate-600">
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Name</dt>
                            <dd className="mt-1 text-slate-700">{adminName || 'Not specified'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Email</dt>
                            <dd className="mt-1 text-slate-700">{adminEmail || 'No email provided'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Role</dt>
                            <dd className="mt-1 text-slate-700">{ROLE_LABELS[adminRole] || adminRole}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-emerald-900">Admin credentials</p>
                        <button
                          type="button"
                          onClick={copyPassword}
                          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                        >
                          {hasCopiedCredentials ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {hasCopiedCredentials ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p>
                          <span className="font-medium text-slate-500">Email:</span> {adminEmail}
                        </p>
                        <p>
                          <span className="font-medium text-slate-500">Password:</span> {adminPassword}
                        </p>
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        {hasCopiedCredentials
                          ? 'Credentials copied — you can submit the registration below.'
                          : 'These credentials only appear here. Copy them before submitting so you can share them with the new admin.'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1) {
                      onClose();
                    } else {
                      setStep((prev) => Math.max(prev - 1, 1) as 1 | 2 | 3);
                    }
                  }}
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
                      setStep((prev) => Math.min(prev + 1, 3) as 1 | 2 | 3);
                    }}
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto"
                    disabled={
                      loading ||
                      (step === 1 && !isStep1Complete) ||
                      (step === 2 && !isStep2Complete)
                    }
                  >
                    {step === 1 ? 'Next: Administrator Details' : 'Review & Submit'}
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
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
