"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Landmark, RotateCcw, WifiOff } from "lucide-react";

/**
 * Service-worker offline fallback — see public/sw.js. The worker caches
 * this exact route at install time and serves it back for any page
 * navigation whose network request fails, so it has to work with zero
 * network access itself: no data fetching, no Supabase client, nothing
 * beyond what's already inlined in the page's own JS bundle.
 */
export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  // Auto-recover the moment the browser regains connectivity, instead of
  // leaving the user stuck here until they notice and click "Try again".
  useEffect(() => {
    const handleOnline = () => window.location.reload();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06120e] px-4 py-10 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,_rgba(16,185,129,0.22),_transparent_34%),radial-gradient(circle_at_90%_85%,_rgba(245,158,11,0.12),_transparent_30%)]" />
      <div className="relative w-full max-w-xl">
        <div className="mb-5 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-300">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-white">KAD-SAMIS</p>
            <p className="mt-0.5 text-xs text-emerald-100/70">Kaduna State Asset Management</p>
          </div>
        </div>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
            <WifiOff className="h-7 w-7" />
          </div>
          <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            Connection interrupted
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">You&apos;re offline</h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/70">
            KAD-SAMIS can&apos;t reach the network right now. Check your connection. This page will refresh automatically
            once you&apos;re back online.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleRetry} isLoading={retrying} loadingText="Checking connection…" className="bg-emerald-500 text-white hover:bg-emerald-400">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>
          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs leading-5 text-emerald-50/50">
              Previously opened pages may still be available from this device. Unsaved changes may not be saved while
              you&apos;re offline.
            </p>
          </div>
        </section>
        <p className="mt-5 text-center text-[11px] tracking-wide text-emerald-100/40">
          KADUNA STATE ASSET MANAGEMENT INFORMATION SYSTEM
        </p>
      </div>
    </main>
  );
}
