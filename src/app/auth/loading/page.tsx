"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const loadingSteps = [
  {
    title: "Authenticating session",
    description: "Validating your secure sign-in state",
    icon: ShieldCheck,
  },
  {
    title: "Loading user profile",
    description: "Preparing your account context",
    icon: UserCheck,
  },
  {
    title: "Loading permissions",
    description: "Mapping your ministry role access",
    icon: Briefcase,
  },
  {
    title: "Loading ministry context",
    description: "Connecting department and facility context",
    icon: Building2,
  },
  {
    title: "Loading dashboard",
    description: "Opening your workspace with a polished transition",
    icon: Sparkles,
  },
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
        className="relative w-full max-w-2xl rounded-[32px] border border-border bg-card/90 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary">
              Secure access
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">
              Welcome back, {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your secure workspace is being prepared for you.
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {loadingSteps.map((step, index) => {
            const isActive = index === stepIndex;
            const isComplete = index < stepIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={step.title}
                className={`rounded-2xl border px-4 py-3 transition-all ${
                  isComplete
                    ? "border-emerald-500/25 bg-emerald-500/10"
                    : isActive
                      ? "border-primary/25 bg-primary/5"
                      : "border-border bg-background/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isComplete
                        ? "bg-emerald-500 text-white"
                        : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-background/70 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{currentStep.title}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-primary to-emerald-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
