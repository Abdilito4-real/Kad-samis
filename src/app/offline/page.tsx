"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RotateCcw, WifiOff } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(100,116,139,0.16),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-4 dark:bg-background dark:bg-none">
      <div className="w-full max-w-lg rounded-[32px] border border-border bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <WifiOff className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kadsamis couldn&apos;t reach the network. Check your connection — this page will reload automatically the
          moment it&apos;s back, or you can try again now.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={handleRetry} isLoading={retrying} loadingText="Retrying…">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Already signed in on this device? Your last-loaded pages may still open from your browser&apos;s own cache
          even before the connection returns.
        </p>
      </div>
    </div>
  );
}
