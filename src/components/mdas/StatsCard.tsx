"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

type Tone = 'neutral' | 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';

const toneStyles: Record<Tone, { bar: string; chip: string; icon: string }> = {
  neutral: { bar: 'bg-slate-400', chip: 'bg-slate-500/10', icon: 'text-slate-500' },
  emerald: { bar: 'bg-emerald-500', chip: 'bg-emerald-500/10', icon: 'text-emerald-500' },
  sky: { bar: 'bg-sky-500', chip: 'bg-sky-500/10', icon: 'text-sky-500' },
  amber: { bar: 'bg-amber-500', chip: 'bg-amber-500/10', icon: 'text-amber-600' },
  violet: { bar: 'bg-violet-500', chip: 'bg-violet-500/10', icon: 'text-violet-500' },
  rose: { bar: 'bg-rose-500', chip: 'bg-rose-500/10', icon: 'text-rose-500' },
};

export default function StatsCard({
  title,
  value,
  icon,
  tone = 'neutral',
  loading = false,
}: {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Shows a skeleton bar in place of the value while the count is still
   * being fetched, instead of flashing "0" before the real number lands. */
  loading?: boolean;
}) {
  const [count, setCount] = useState(0);
  const styles = toneStyles[tone];

  useEffect(() => {
    if (typeof value === 'number') {
      let raf: number;
      const start = performance.now();
      const from = 0;
      const to = value as number;
      const duration = 700;
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setCount(Math.floor(from + (to - from) * p));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }

    setCount(Number(value as any) || 0);
    return () => {};
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card py-4 pl-5 pr-4 shadow-sm transition hover:shadow-md"
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${styles.bar}`} aria-hidden />
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase leading-snug tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? <Skeleton className="h-7 w-12" /> : typeof value === 'number' ? count : value}
          </div>
        </div>
        {icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.chip} ${styles.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}