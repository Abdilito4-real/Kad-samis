"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";

const loadingSteps = [
  "Authenticating session",
  "Loading user profile",
  "Loading permissions",
  "Loading ministry context",
  "Preparing dashboard",
];

export function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setReady(true);
      if (!user) {
        router.replace("/auth/login");
      }
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const interval = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % loadingSteps.length);
    }, 600);

    return () => window.clearInterval(interval);
  }, [loading]);

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_30%)] px-4 dark:bg-background dark:bg-none">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">
                Secure access
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Preparing your workspace</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {loadingSteps[stepIndex]}
          </div>

          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-2 rounded-full bg-muted/70">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-primary to-sky-500 transition-all"
                  style={{ width: `${70 + item * 8}%` }}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Government-grade workflows are loading.
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
