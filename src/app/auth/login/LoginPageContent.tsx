"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

export default function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const message = searchParams.get("message");
    if (message) {
      setSuccessMessage(decodeURIComponent(message));
      toast.success("Password reset successful", {
        description: "Please sign in with your new password.",
      });
    }
  }, [searchParams]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
      const fallback = "Supabase is not configured. Please check environment variables.";
      setError(fallback);
      toast.error("Unable to sign in", {
        description: fallback,
      });
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        toast.error("Unable to sign in", {
          description: signInError.message,
        });
      } else if (!data?.session) {
        const fallback = "Unable to establish session. Please try again.";
        setError(fallback);
        toast.error("Unable to sign in", { description: fallback });
      } else {
        const { data: { session: activeSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !activeSession) {
          throw new Error(sessionError?.message || "Session was not created");
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .select("id, role, organization_id")
          .eq("id", activeSession.user.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Profile lookup after login failed", profileError);
        }

        toast.success("Signed in successfully", {
          description: "Preparing your secure workspace…",
        });
        window.setTimeout(() => router.push("/auth/loading"), 900);
      }
    } catch (_error) {
      const fallback = "An unexpected error occurred";
      setError(fallback);
      toast.error("Sign-in failed", { description: fallback });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_25%),linear-gradient(135deg,_#f8fafc,_#eef5f8)] transition-colors dark:bg-background dark:bg-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-border bg-card/90 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]"
        >
          {/* Brand panel — intentionally a fixed dark surface regardless of
              site theme, like most government/enterprise login screens. */}
          <div className="hidden flex-col justify-between bg-[linear-gradient(160deg,_#06120e,_#0b2a22_45%,_#0f172a)] p-8 text-white lg:flex">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Secure government access
              </div>
              <h1 className="mt-8 text-4xl font-semibold leading-tight">
                Trusted digital access for public asset operations.
              </h1>
              <p className="mt-4 max-w-md text-sm text-slate-300">
                Unified workflows for ministries, departments, maintenance teams, and inspectors.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <img
                    src="/images/auth/kaduna-state.svg"
                    alt="Kaduna State government facilities management illustration"
                    className="h-24 w-full rounded-2xl object-cover"
                  />
                  <div className="p-3 text-sm text-slate-200">
                    <p className="font-medium text-white">Kaduna State Government</p>
                    <p className="mt-1 text-xs text-slate-400">Modern public asset oversight</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <img
                    src="/images/auth/kadfama.svg"
                    alt="KADFAMA facilities management agency illustration"
                    className="h-24 w-full rounded-2xl object-cover"
                  />
                  <div className="p-3 text-sm text-slate-200">
                    <p className="font-medium text-white">KADFAMA</p>
                    <p className="mt-1 text-xs text-slate-400">Agency-led facilities coordination</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Role-aware navigation and protected workflows are ready.
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                  <img src="/images/auth/kaduna-state.svg" alt="Kaduna State logo" className="h-full w-full rounded-2xl object-cover" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">KAD-SAMIS</h2>
                  <p className="text-sm text-muted-foreground">Government asset management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-border bg-background p-2 text-muted-foreground shadow-sm transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-500"
                aria-label="Toggle theme"
              >
                {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-8 rounded-[24px] border border-border bg-background/60 p-6 shadow-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Welcome back</p>
                <h3 className="text-2xl font-semibold text-foreground">Secure portal access</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in to continue with ministry workflows, inspections, and approvals.
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                {successMessage ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-500">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {successMessage}
                  </div>
                ) : null}

                {error ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-500">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email address</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="shrink-0 text-muted-foreground transition hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-input accent-emerald-500" />
                    Keep me signed in
                  </label>
                  <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted-foreground">
                <Link href="/" className="font-medium text-primary hover:underline">
                  Back to home
                </Link>
                <span>Support • System status • Version 1.0.0</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
