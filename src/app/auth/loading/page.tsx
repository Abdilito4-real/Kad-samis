"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const loadingSteps = [
  { title: "Authenticating session", icon: ShieldCheck },
  { title: "Loading user profile", icon: UserCheck },
  { title: "Loading permissions", icon: Briefcase },
  { title: "Loading ministry context", icon: Building2 },
  { title: "Loading dashboard", icon: Sparkles },
];

export default function AuthLoadingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepIndex((current) => (current < loadingSteps.length - 1 ? current + 1 : current));
    }, 750);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stepIndex !== loadingSteps.length - 1) {
      return undefined;
    }

    const exitTimer = window.setTimeout(() => setIsExiting(true), 450);
    // Operational Managers always land on their queue — there's no
    // meaningful alternative landing page for that role. Everyone else can
    // set a preferred landing page in Settings (default: Dashboard).
    const preferredView = typeof window !== "undefined" ? window.localStorage.getItem("kadsamis-default-view") : null;
    const destination = user?.roleId === "operational_manager"
      ? "/operations"
      : preferredView === "assets"
        ? "/assets"
        : preferredView === "requests"
          ? "/requests"
          : user?.roleId === "super_admin"
            ? "/dashboard"
            : user && user.organizationId
              ? `/dashboard?orgId=${encodeURIComponent(user.organizationId)}`
              : "/dashboard";
    const redirectTimer = window.setTimeout(() => router.replace(destination), 900);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [router, stepIndex, user]);

  const currentStep = loadingSteps[stepIndex];
  const CurrentIcon = currentStep.icon;
  const progress = ((stepIndex + 1) / loadingSteps.length) * 100;
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "your ministry workspace";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_35%),linear-gradient(135deg,_#f8fafc,_#e2e8f0)] px-4 dark:bg-background dark:bg-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? 10 : 0, scale: isExiting ? 0.98 : 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm rounded-3xl border border-border bg-card/90 p-6 text-center shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
          {/* A soft pulsing ring reads as "working" without the height cost of
              a 5-row step list — this whole card only needs to hold attention
              for ~4 seconds before it redirects. */}
          <motion.span
            className="absolute inset-0 rounded-2xl border-2 border-primary/30"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <motion.div
            key={currentStep.title}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            <CurrentIcon className="h-6 w-6" />
          </motion.div>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-primary">Secure access</p>
        <h1 className="mt-2 truncate text-xl font-semibold text-foreground">Welcome back, {displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preparing your secure workspace…</p>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-primary to-emerald-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground">
            <motion.span
              key={currentStep.title}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep.title}
            </motion.span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
