"use client";

import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Check if user has a recovery session from the reset link
    const checkRecoverySession = async () => {
      if (!supabase) {
        setError("Supabase not configured");
        return;
      }

      try {
        // First, let Supabase process the recovery token from the URL hash
        // This is important - Supabase needs time to create the session from the hash
        await new Promise(resolve => setTimeout(resolve, 1000));

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session check error:", sessionError);
          setError(`Session error: ${sessionError.message}`);
          return;
        }

        if (session) {
          // User has a valid recovery session - they can reset password
          setHasToken(true);
        } else {
          // No session found - check for recovery token in URL hash. Never
          // log `hash` itself — it's the raw recovery link fragment and
          // literally contains the access/refresh tokens in plain text.
          const hash = window.location.hash;

          if (hash.includes("type=recovery") || hash.includes("access_token")) {
            // Give Supabase more time to establish session
            await new Promise(resolve => setTimeout(resolve, 1500));

            const {
              data: { session: retrySession },
            } = await supabase.auth.getSession();

            if (retrySession) {
              setHasToken(true);
            } else {
              setError("Failed to establish recovery session. Please request a new password reset link.");
            }
          } else {
            setError("No recovery token found. Please use the link from your password reset email.");
          }
        }
      } catch (err) {
        console.error("Recovery check failed:", err);
        setError("Unable to verify reset link. Please try again.");
      }
    };

    checkRecoverySession();
  }, [supabase, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        setError(updateError.message || "Failed to update password");
        toast.error("Password update failed", { description: updateError.message });
      } else {
        toast.success("Password updated successfully!");
        // Sign out user and redirect to login
        await supabase.auth.signOut();
        // Wait a moment for the toast to display, then redirect
        setTimeout(() => {
          router.push("/auth/login?message=Password+reset+successful.+Please+sign+in.");
        }, 1000);
      }
    } catch (err: any) {
      console.error("Password reset failed:", err);
      setError(err?.message || "An unexpected error occurred");
      toast.error("Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  const shellClass =
    "relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.14),_transparent_25%),linear-gradient(135deg,_#f8fafc,_#eef5f8)] px-4 py-12 transition-colors dark:bg-background dark:bg-none flex items-center justify-center";

  if (!hasToken) {
    return (
      <div className={shellClass}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-auto w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl"
        >
          {error ? (
            <>
              <div className="flex justify-center">
                <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-500">
                  <AlertCircle className="h-6 w-6" />
                </div>
              </div>
              <h2 className="mt-4 text-center text-xl font-semibold text-foreground">Reset link invalid</h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {error}
              </p>
              <div className="mt-6 space-y-3">
                <a
                  href="/auth/forgot-password"
                  className="block rounded-2xl border border-border bg-background px-4 py-2.5 text-center text-sm font-medium text-foreground transition hover:bg-accent"
                >
                  Request new reset link
                </a>
                <a
                  href="/auth/login"
                  className="block rounded-2xl bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  Back to sign in
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              </div>
              <h2 className="mt-4 text-center text-lg font-semibold text-foreground">Verifying reset link</h2>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Please wait while we verify your password reset link…
              </p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_35%)] dark:bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.08),_transparent_35%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl"
      >
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below. Make it strong and unique.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              New password
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Minimum 8 characters"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-2.5 transition focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                placeholder="Confirm your new password"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-muted p-3">
            <p className="text-xs font-medium text-foreground">Password requirements:</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li className={cn("flex items-center gap-1.5", password.length >= 8 && "text-emerald-500")}>
                <CheckCircle2 className="h-3 w-3 shrink-0" /> At least 8 characters
              </li>
              <li className={cn("flex items-center gap-1.5", password === confirmPassword && password && "text-emerald-500")}>
                <CheckCircle2 className="h-3 w-3 shrink-0" /> Passwords match
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating password…
              </span>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
