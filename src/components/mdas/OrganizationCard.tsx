"use client";

import { type KeyboardEvent } from 'react';
import { Banknote, Edit3, Eye, MapPin, Phone, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const typeStyles: Record<string, { badge: string; rail: string; avatar: string; letter: string }> = {
  MINISTRY: { badge: 'bg-emerald-500/10 text-emerald-500', rail: 'bg-emerald-500', avatar: 'bg-emerald-500/15 text-emerald-500', letter: 'M' },
  DEPARTMENT: { badge: 'bg-sky-500/10 text-sky-500', rail: 'bg-sky-500', avatar: 'bg-sky-500/15 text-sky-500', letter: 'D' },
  AGENCY: { badge: 'bg-amber-500/10 text-amber-600', rail: 'bg-amber-500', avatar: 'bg-amber-500/15 text-amber-500', letter: 'A' },
};

const fallbackStyle = { badge: 'bg-slate-500/10 text-slate-500', rail: 'bg-slate-400', avatar: 'bg-slate-500/15 text-slate-500', letter: '?' };

export default function OrganizationCard({ org, onToggle, onEdit, readOnly = false, compact = false }: { org: any; onToggle?: () => void; onEdit?: () => void; readOnly?: boolean; compact?: boolean }) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle?.();
    }
  };

  const styles = typeStyles[org.organization_type] || fallbackStyle;
  const assetsCount = org.assets?.length ?? 0;
  const adminsCount = org.profiles?.length ?? 0;
  const contact = org.phone || org.email || 'No contact on file';
  const statusLabel = org.status ? org.status.charAt(0).toUpperCase() + org.status.slice(1) : 'Active';

  if (compact) {
    // List row: everything on one line so scanning a page of organizations
    // doesn't require scrolling through nine tall cards. The colored rail on
    // the left is the same emerald / sky / amber used for Ministries /
    // Departments / Agencies everywhere else on the page, so the type is
    // readable from the color alone before you even reach the badge text.
    return (
      <motion.article
        role="button"
        aria-labelledby={`org-title-${org.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => onToggle?.()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-border bg-background/80 py-3 pl-5 pr-4 shadow-sm transition hover:border-emerald-300/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <span className={`absolute left-0 top-0 h-full w-1 ${styles.rail}`} aria-hidden />

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.avatar} text-base font-semibold`} aria-hidden>
          {styles.letter}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span id={`org-title-${org.id}`} className="truncate text-base font-semibold text-foreground">
              {org.name}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}>
              {org.organization_type}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{org.address || 'No address provided yet'}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:hidden">
            <span className="flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground">{assetsCount}</span> assets
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold text-foreground">{adminsCount}</span> admins
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-5 text-xs text-muted-foreground sm:flex">
          <div className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{assetsCount}</span> assets
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{adminsCount}</span> admins
          </div>
          <div className="hidden items-center gap-1.5 lg:flex">
            <Phone className="h-3.5 w-3.5" />
            <span className="max-w-[9rem] truncate font-medium text-foreground">{contact}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onEdit?.(); }}
              aria-label="Edit organization"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
            aria-label="View details"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      role="button"
      aria-labelledby={`org-title-${org.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)' }}
      onClick={() => onToggle?.()}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="relative cursor-pointer overflow-hidden rounded-[2rem] border border-border bg-background/80 p-5 shadow-sm transition duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
    >
      <span className={`absolute left-0 top-0 h-full w-1.5 ${styles.rail}`} aria-hidden />

      <div className="flex flex-col gap-3 pl-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${styles.avatar} text-base font-semibold`} aria-hidden>
            {styles.letter}
          </div>
          <div className="min-w-0 flex-1">
            <div id={`org-title-${org.id}`} className="truncate text-lg font-semibold text-foreground">
              {org.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`rounded-full px-2 py-1 ${styles.badge}`}>
                {org.organization_type}
              </span>
              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
          aria-label="View details"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-4 pl-2 text-sm leading-6 text-muted-foreground">
        {org.address || 'No address provided yet'}
      </p>

      <div className="mt-4 grid gap-3 pl-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/80 px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Assets</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{assetsCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/80 px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Admins</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{adminsCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/80 px-3 py-3 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Contact</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{contact}</p>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 pl-2">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onEdit?.(); }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            <Edit3 className="h-4 w-4" /> Edit organization
          </button>
        </div>
      )}
    </motion.article>
  );
}